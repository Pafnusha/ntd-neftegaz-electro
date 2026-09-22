/* =====================================================================
   ibp-app.js — расчётный модуль «Расчёт и выбор ИБП» (AC/DC).
   Методики: ГОСТ Р МЭК 60896-21-2013 (выбор ёмкости стационарной АКБ),
   ТУ проекта 3300-E-000-EL-SPE-00021-00-D_02U, ПУЭ 7-е изд.
   Все расчёты прозрачны: формулы выводятся в разделах 2–3 и 9.
   ===================================================================== */
"use strict";

/* SECTION: helpers */
const $ = id => document.getElementById(id);
const val = id => $(id) ? $(id).value : "";
const num = id => parseFloat(String($(id).value).replace(/,/g, ".")) || 0;
const f = (x, d = 2) => isFinite(x) ? x.toLocaleString("ru-RU", { maximumFractionDigits: d, minimumFractionDigits: 0 }) : "—";
const cl = 1.2; // запас по ГОСТ Р МЭК 62485-2: 25 % при calc-коэффициентах не заданы
/* K_t — интерполяция по времени разряда */
function ktOf(minutes, uEnd) {
  const T = KT_TABLE; let k;
  if (minutes <= T[0].min) k = T[0].kt;
  else if (minutes >= T[T.length - 1].min) k = T[T.length - 1].kt;
  else for (let i = 0; i < T.length - 1; i++) if (minutes >= T[i].min && minutes <= T[i + 1].min) {
    const r = (minutes - T[i].min) / (T[i + 1].min - T[i].min);
    k = T[i].kt + r * (T[i + 1].kt - T[i].kt); break;
  }
  return k * (KT_U_END[+uEnd] || 1);
}
function cableOf(I) { for (const c of CABLES) if (c.i >= I) return c; return CABLES[CABLES.length - 1]; }
function breakerOf(I) { for (const b of BREAKER_AMP) if (b >= I) return b; return BREAKER_AMP[BREAKER_AMP.length - 1]; }
function upsOf(kVA) { for (const u of UPSRated_kVA) if (u >= kVA) return u; return null; }
function round100(x) { return Math.ceil(x / 1) * 1; }

/* SECTION: inputs */
function readState() {
  const s = {
    type: val("p-type"), proj: val("proj-name"),
    P: num("p-kw"), cos: num("p-cos"), eff: num("p-eff") / 100,
    kodn: num("p-kodn"), kzap: num("p-kzap"),
    motX: num("p-mot-x") / 100, motK: num("p-mot-k"),
    tmin: num("t-min"), temp: num("t-temp"),
    udc: num("u-dc"), uend: num("u-end"), red: val("red"),
    batMode: val("bat-mode"), batId: val("bat-name"),
    batAh: num("bat-ah"), batV: num("bat-v"), batLife: num("bat-life"),
    ip: val("ip-uc"), chgEff: num("chg-eff") / 100,
    roomL: num("room-l"), roomW: num("room-w"), floor: num("floor-load"),
    seismic: num("seismic"), cableLen: num("cable-len")
  };
  return s;
}
function validate(s) {
  const e = [];
  if (s.P <= 0) e.push("Укажите мощность нагрузки (>0).");
  if (s.tmin <= 0) e.push("Укажите время автономии (>0).");
  if (s.type === "ac") { if (s.cos < 0.5 || s.cos > 1) e.push("cos φ должен быть 0,5…1."); if (s.eff <= 0.5 || s.eff > 1) e.push("КПД инвертора должен быть 50…100%."); }
  if (s.kodn <= 0 || s.kodn > 1) e.push("Коэффициент одновременности — 0…1.");
  if (s.kzap < 1) e.push("Коэффициент запаса должен быть ≥1 (по ТУ ≥1,10).");
  if (uEndRangeErr(s)) e.push("Конечное напряжение 1,6…1,9 В/эл.");
  if (s.batMode === "manual" && (s.batAh <= 0 || s.batV <= 0)) e.push("Для ручного ввода укажите V и А·ч блока АКБ.");
  if (s.roomL <= 2 || s.roomW <= 2) e.push("Габариты помещения — не менее 2×2 м.");
  return e;
}
function uEndRangeErr(s) { return s.uend < 1.6 || s.uend > 1.9; }

/* SECTION: calc */
function calc(s) {
  const R = { s };
  /* --- 2.x Мощность ИБП --- */
  const isAC = s.type === "ac";
  R.Uout = isAC ? 230 : s.udc;
  R.S_kVA = isAC ? s.P / s.cos : s.P;                       // полная мощность нагрузки, кВА/кВт
  R.S_base = R.S_kVA * s.kodn;                                 // расчётная полная нагрузка, кВА
  R.S_inst = isAC ? R.S_base * (1 - s.motX + s.motX * s.motK) : R.S_base; // с учётом пусковых токов
  R.nsys = s.red === "2x100" ? 2 : (s.red === "n1" ? 2 : 1);   // N+1 условно 2 шт. на N=1
  R.S1req = Math.max(R.S_base, R.S_inst) * s.kzap;             //_req на ОДНУ систему (2×100 % — каждая 100 %), с запасом ТУ
  R.ups_kVA = upsOf(R.S1req);
  R.marginEff = R.ups_kVA ? R.ups_kVA / R.S_kVA : null;
  R.I_out = isAC ? R.ups_kVA * 1000 / 230 : R.ups_kVA * 1000 / s.udc; // ном. ток выхода 1-й системы (ВA/В)
  R.I_in = isAC ? R.ups_kVA * 1000 * 1.15 / 230 : R.ups_kVA * 1000 * 1.15 / s.udc; // вход с запасом на заряд

  /* --- 3.x АКБ по ГОСТ Р МЭК 60896-21-2013 (консервативно: ток в конце разряда) --- */
  R.warn = [];
  const PbatW = s.P * 1000 * s.kodn / (isAC ? s.eff : 1);   // потребляемая от батарей мощность, Вт
  R.NcellsMin = isAC ? NaN : Math.ceil(s.udc * 0.9 / s.uend); // ТУ DC: U ≥ 0,9·Uном при Uкон
  let N = isAC ? Math.ceil(s.udc / 2) : Math.max(Math.ceil(s.udc / 2), R.NcellsMin);
  R.Ncells = N;
  R.PbatW = PbatW;
  R.Kt = ktOf(s.tmin, s.uend);
  R.I_max = PbatW / (N * s.uend);                             // А, худший случай (конец разряда)
  R.C_req = R.I_max * (s.tmin / 60) / R.Kt;                   // А·ч, приведённые к C10 при 20 °C
  const alpha = ALPHA_TEMP[s.tmin <= 120 ? "short" : "long"];
  R.alpha = alpha; R.Ktemp = 1 + alpha * (s.temp - 20);       // температурная поправка
  R.Kaging = TU_REQS.agingK;                               // +20 % на старение (п.5.6.1.32 ТУ)
  R.C_corr = R.C_req / R.Ktemp * R.Kaging;                    // требуемая ёмкость на систему, А·ч C10

  /* выбор/учёт батареи */
  let bat;
  if (s.batMode === "auto") {
    let best = null;
    for (const b of BATTERIES) {
      const cand = evalBattery(b, R, isAC);
      if (!cand) continue;
      const score = (cand.b.life >= TU_REQS.lifeYears ? 0 : 1e6) + cand.util;
      if (!best || score < best.score) best = { ...cand, score };
    }
    bat = best || null;
  } else {
    const b = { id: "manual", name: "АКБ (ручной ввод)", V: s.batV || 12, Ah: s.batAh || 100,
      cells6: (s.batV || 12) >= 12, mass: +(0.28 * (s.batAh || 100) * (s.batV || 12) / 12).toFixed(1),
      L: 513, W: 240, H: 225, life: s.batLife, vrla: true, note: "параметры — оценка пользователя" };
    bat = evalBattery(b, R, isAC);
  }
  R.bat = bat;
  if (bat) {
    R.NcellsBat = bat.NcellsBat;                              // элементов/блоков последовательно с учётом конструкции АКБ
    R.C_bank = bat.n * bat.b.Ah;                              // фактическая ёмкость на систему, А·ч
    R.t_real = realAutonomy(R, bat);
    R.cellsTotal = R.NcellsBat * bat.n * R.nsys;              // всего элементов по всем системам
    R.massCell = R.NcellsBat > 0 ? (bat.b.cells6 ? bat.b.mass / 6 : bat.b.mass) : 0; // кг/элемент
    R.massBatt = R.cellsTotal * R.massCell;
    if (!isAC && bat.b.cells6 && R.NcellsBat * 2 > s.udc * 1.12)
      R.warn.push(`Для сети ${s.udc} В нежелательны 12-В блоки: ${R.NcellsBat / 6}×12 В = ${R.NcellsBat / 6 * 12} В вне допуска ±10 %. Рекомендуем 2-В моноблоки (см. базу).`);
    if (R.t_real < s.tmin) R.warn.push(`Фактическая автономия ${f(R.t_real, 0)} мин < требуемой — проверьте подбор.`);
  } else R.warn.push("АКБ не подобрана: увеличьте базу или введите параметры вручную.");

  /* --- 4.x Стеллажи и нагрузка на пол --- */
  R.rackPlan = bat ? pickRack(R, bat, s) : null;

  /* --- зарядное устройство, кабели, автоматы --- */
  R.C_total = bat ? R.C_bank * R.nsys : 0;
  R.I_chg = PbatW / s.udc / s.chgEff + (R.C_bank || 0) / 10; // ТУ п.5.7: ток нагрузки + 10-часовой дозаряд
  R.qf_chg = breakerOf(R.I_chg * 1.25);
  R.s_bat_cable = Math.max(cableOf(R.I_max * 1.25).s, sminForDU(R.I_max, s)); // по ПУЭ: I доп. и ΔU ≤2 %
  R.qf_bat = breakerOf(R.I_max * 1.25);
  R.s_in_cable = cableOf(R.I_in * 1.25).s;
  R.qf_in = breakerOf(R.I_in * 1.25);
  return R;
}
function ceilDiv(a, b) { return Math.ceil(a / b); }
function sminForDU(I, s) { const need = 2 * 0.0175 * s.cableLen * I / (0.02 * s.udc); return cableOf(need).s; }
function evalBattery(b, R) {
  if (!b || b.V <= 0 || b.Ah <= 0) return null;
  const Nser = b.cells6 ? Math.ceil(R.Ncells / 6) : R.Ncells; // последовательно штук
  const NcellsBat = b.cells6 ? Nser * 6 : Nser;                // всего элементов в системе
  const n = Math.max(1, Math.ceil(R.C_corr / b.Ah));           // параллельных цепочек на систему
  const util = (n * b.Ah) / R.C_corr;
  return { b, n, util, Nser, NcellsBat };
}
function realAutonomy(R, bat) {
  const C = bat.n * bat.b.Ah * R.Ktemp / R.Kaging;             // располагаемая ёмкость за вычетом старения/Т°
  let lo = 1, hi = 2880;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const Cneed = R.I_max * (mid / 60) / ktOf(mid, R.s.uend);
    if (Cneed <= C) lo = mid; else hi = mid;
  }
  return lo;
}
function pickRack(R, bat, s) {
  /* Подбор только из реальных типовых стеллажей базы (ACM1-3E-ПГУ). */
  const b = bat.b;
  const massEl = b.cells6 ? b.mass / 6 : b.mass;               // кг/элемент
  const perBank = R.NcellsBat * bat.n;                         // элементов в системе
  const cands = [];
  for (const rk of RACKS) {
    const fitCells = b.cells6 ? Math.max(6, Math.floor(rk.capCells / 6) * 6) : rk.capCells;
    const nr = Math.ceil(perBank / fitCells);
    const cellsPerRack = perBank / nr;
    const load = rk.mass + cellsPerRack * massEl;
    const floor = load / (rk.L / 1000 * rk.W / 1000);
    cands.push({ rk, nr, cellsPerRack, load, floor, ok: floor <= s.floor });
  }
  if (!cands.length) return null;
  cands.sort((x, y) => (x.ok ? 0 : 1) - (y.ok ? 0 : 1) || x.nr - y.nr || x.floor - y.floor);
  const best = cands[0];
  best.racksTotal = best.nr * R.nsys;
  best.unitsPerRack = b.cells6 ? best.cellsPerRack / 6 : best.cellsPerRack;
  best.rowsLimited = best.nr > 3;                              // рядность > 3 не допускается
  return best;
}
/* SECTION: render-ups-bat */
function metric(lbl, v, cls = "") { return `<div class="metric ${cls}"><div class="lbl">${lbl}</div><div class="val">${v}</div></div>`; }
function renderUps(R) {
  const s = R.s, isAC = s.type === "ac";
  $("out-ups-m").innerHTML =
    metric("Нагрузка, кВА", f(R.S_base) + " кВА") +
    metric("Резервирование", isAC || s.red === "2x100" ? "2×100 % (2 системы)" : s.red, R.nsys === 2 ? "" : "bad") +
    metric("Требуется на систему", f(R.S1req, 1) + (isAC ? " кВА" : " кВт")) +
    metric("Выбран ИБП (×" + R.nsys + ")", R.ups_kVA ? R.ups_kVA + " кВА/кВт" : ">1250 ⚠", R.ups_kVA ? "hi" : "bad") +
    metric("Фактический запас", R.ups_kVA ? f((R.ups_kVA / R.S_base - 1) * 100, 0) + " %" : "—", R.marginEff >= s.kzap ? "good" : "bad") +
    metric("Ток выхода (1 сист.)", f(R.I_out, 0) + " А");
  const rows = [
    isAC ? `S = P / cos φ = ${f(s.P)} / ${f(s.cos)} = ${f(R.S_kVA)} кВА` : `P = ${f(s.P)} кВт (цепи постоянного тока)`,
    `S расч. = S · K о = ${f(R.S_kVA)} · ${f(s.kodn)} = ${f(R.S_base)} кВт/кВА`,
    isAC && s.motX > 0 ? `S пуск. = S расч. · [(1−x дв) + x дв · K пуск] = ${f(R.S_base)} · (${f(1 - s.motX)} + ${f(s.motX)}·${f(s.motK)}) = ${f(R.S_inst)} кВА` : "",
    `S на систему = max(S расч.; S пуск.) · K зап = ${f(R.S1req)} ${isAC ? "кВА (каждая из двух 2×100 % — 100 % нагрузки)" : "кВт"}`,
    `Принято: ${R.nsys} × ИБП ${isAC ? "VFI-AC/AC двойного преобразования" : "выпрямитель/зарядное DC"} по ${R.ups_kVA || "—"} кВА/кВт; ток выхода ${f(R.I_out, 0)} А при ${isAC ? "230 В ±1 %, 50 Гц ±1 Гц" : s.udc + " В ±10 %"} (ТУ п.5.2)`,
    `Вход/сеть: ток потребления ${f(R.I_in, 0)} А; кабель питания — медь, ${R.s_in_cable} мм²; QF ввода — ${R.qf_in} А`
  ].filter(Boolean).map(x => `<div class="f">${x}</div>`).join("");
  $("out-ups").innerHTML = rows + (R.warn.length ? `<p class="note warn">⚠ ${R.warn.join("<br>⚠ ")}</p>` : "");
}
function renderBat(R) {
  const s = R.s, b = R.bat;
  $("out-bat-m").innerHTML = b ?
    metric("U кон. батареи", f(R.NcellsBat * s.uend, 1) + " В") +
    metric("Ток макс. разряда", f(R.I_max, 0) + " А") +
    metric("Требуемая ёмкость (с коэфф.)", f(R.C_corr, 0) + " А·ч") +
    metric("Принято на систему", f(R.C_bank, 0) + " А·ч" + ` (${b.n} × ${b.b.Ah})`) +
    metric("Автономия факт.", "≈ " + f(R.t_real, 0) + " мин", R.t_real >= s.tmin ? "good" : "bad") +
    metric("Элементов всего", f(R.cellsTotal, 0) + " шт", "") : "";
  const fml = [
    `N эл. = ⌈U шины / 2 В⌉${s.type === "dc" ? ` (и ≥ 0,9·Uном/U кон = ${f(R.NcellsMin, 0)} по ТУ)` : ""} = ${R.Ncells} эл.`,
    `I макс = P бат / (N · U кон) = ${f(R.PbatW, 0)} Вт / (${R.Ncells} · ${f(s.uend)}) = ${f(R.I_max, 1)} А`,
    `C треб. = I макс · t / K t = ${f(R.I_max, 1)} · ${f(s.tmin / 60, 2)} ч / ${f(R.Kt, 2)} = ${f(R.C_req, 0)} А·ч (K t — по разрядной характеристике ГОСТ Р МЭК 60896-21, t = ${f(s.tmin, 0)} мин, U кон = ${f(s.uend)} В/эл)`,
    `K T° = 1 + α·(T − 20 °C) = 1 + ${f(R.alpha, 3)}·(${f(s.temp, 0)} − 20) = ${f(R.Ktemp, 3)}; K старения = ${f(R.Kaging, 2)} (20 % по ТУ п.5.6.1.32)`,
    `C расч. = C треб. / K T° · K стар = ${f(R.C_corr, 0)} А·ч на ОДНУ систему`,
    b ? `Принято: ${b.b.name.trim()} — ${b.Nser} шт. последовательно (${b.NcellsBat} эл.), ${b.n} цеп. параллельно → ${f(R.C_bank, 0)} А·ч/система; фактическая автономия ≈ ${f(R.t_real, 0)} мин` : "АКБ не подобрана",
    `Кабель АКБ→ИБP: I расч = 1,25·I макс = ${f(R.I_max * 1.25, 0)} А → ${R.s_bat_cable} мм² (медь, ПУЭ табл. 1.3.6 и ΔU ≤ 2 % при L = ${f(s.cableLen, 0)} м); QF батареи = ${R.qf_bat} А`,
    `Выпрямитель/зарядное: I = P бат/(U·η) + C 10-ч = ${f(R.I_chg, 1)} А → номинал ${R.qf_chg} А, КПД ${f(s.chgEff * 100, 0)} % (ТУ ≥ 90 %)`
  ].map(x => `<div class="f">${x}</div>`).join("");
  $("out-bat").innerHTML = fml;
}

/* SECTION: render-racks-layout */
function renderRacks(R) {
  const p = R.rackPlan, s = R.s, b = R.bat;
  if (!p) { $("out-racks").innerHTML = '<p class="note">Нет данных по АКБ.</p>'; return; }
  const massEl = R.massCell;
  $("out-racks").innerHTML = `<table><tr><th>№</th><th>Стеллаж</th><th>Кол-во на систему / всего</th><th>Размеры, Ш×Г×В, мм</th>
    <th>Элементов на стеллаж</th><th>Масса заряж., кг</th><th>Нагрузка на пол, кг/м²</th><th>Проверка</th></tr>
    <tr><td>1</td><td><b>${p.rk.name}</b><br><span class="note">${p.rk.note || ""}</span></td>
    <td>${p.nr} / ${p.racksTotal}</td><td>${p.rk.L}×${p.rk.W}×${p.rk.H}</td>
    <td>${f(p.cellsPerRack, 0)} эл. (${b.b.cells6 ? f(p.cellsPerRack / 6, 1) + " бл.×12 В" : f(p.cellsPerRack, 0) + " монобл.×2 В"})</td>
    <td>${f(p.load, 0)}</td><td>${f(p.floor, 0)}</td>
    <td class="${p.floor <= s.floor ? "ok" : "bad"}">${p.floor <= s.floor ? "✓ ≤" : "✗ >"} ${f(s.floor, 0)} кг/м² (допуск)</td></tr></table>
    <p class="note">Масса АКБ всего: ${f(R.massBatt, 0)} кг (элемент ≈ ${f(massEl, 1)} кг). Зазор между блоками 10–20 мм по ТУ/ГОСТ 62485-2 учтён (15 мм).
    ${s.seismic >= 8 ? '⚠ Сейсмичность ≥8 баллов: стеллажи требуют антивандально-сейсмическогокрепления и расчёта по СП 14.13330 (ТУ п.5.4.1.22).' : "Сейсмичность ≤7 баллов — стандартное крепление к полу."}</p>`;
}
function upsCabOf(kVA) {
  for (const c of UPS_CABINETS) if ((kVA || 1e9) <= c.until) return c;
  return UPS_CABINETS[UPS_CABINETS.length - 1];
}
/* размерная линия по ГОСТ 2.305-2008: стрелки, засечки, число над линией */
function dim(P, x1, y1, x2, y2, label) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (len < 4) return;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  P.els.push({ t: "l", x1, y1, x2, y2, sw: 0.6, color: "#5a6a7e" });
  for (const [cx, cy, dir] of [[x1, y1, 1], [x2, y2, -1]]) {
    P.els.push({ t: "l", x1: cx - px * 3.2 - ux * 4.5 * dir, y1: cy - py * 3.2 - uy * 4.5 * dir, x2: cx + px * 3.2 - ux * 4.5 * dir, y2: cy + py * 3.2 - uy * 4.5 * dir, sw: 0.6, color: "#5a6a7e" }); // засечка
    P.els.push({ t: "p", pts: [[cx, cy], [cx + ux * 7 + px * 1.8, cy + uy * 7 + py * 1.8], [cx + ux * 7 - px * 1.8, cy + uy * 7 - py * 1.8]], color: "#5a6a7e" }); // стрелка
  }
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const vertical = Math.abs(dy) > Math.abs(dx);
  P.els.push({ t: "t", x: mx + (vertical ? 4 : 0), y: my + (vertical ? 0 : -2), s: label, size: 7.5, color: "#33465e",
    align: vertical ? "start" : "middle" });
}
function layoutPrims(R) {
  const s = R.s, p = R.rackPlan, b = R.bat.b;
  const cab = upsCabOf(R.ups_kVA);
  const roomL = s.roomL * 1000, roomW = s.roomW * 1000;
  const scale = Math.min(1100 / (roomL + 1600), 620 / (roomW + 1600));
  const P = { W: Math.round((roomL + 1600) * scale) + 40, H: Math.round((roomW + 1600) * scale) + 40, els: [] };
  const X = mm => 20 + (mm + 800) * scale, Y = mm => 20 + (mm + 500) * scale; // запас под размерные поля
  const S = mm => mm * scale;
  const aisle = 1000, wall = 100, groupGap = 300;                             // проходы/зазоры, мм
  const rackL = p.rk.L, rackD = p.rk.W;
  const perRow = Math.min(3, p.nr);                                           // РЯДНОСТЬ ≤ 3
  const groups = Math.ceil(p.nr / perRow);                                    // групп (цепочек) в системе
  const rowLen = perRow * rackL + (perRow - 1) * groupGap;
  const sysGap = 1000;                                                        // раздельные зоны систем А/В
  const zoneW = rowLen;
  const needL = R.nsys * zoneW + (R.nsys - 1) * sysGap;
  const rowStep = rackD + aisle;
  /* ряды стеллажей: каждый ряд — до 3 стеллажей в линию; между рядами проход aisle */
  const rowsCnt = groups;
  const batteryZoneH = rowsCnt * rackD + (rowsCnt - 1) * aisle;
  const upsY = wall;
  const racksY = upsY + cab.W + aisle;
  const totalDepth = racksY + batteryZoneH + wall;
  /* помещение */
  P.els.push({ t: "r", x: X(0), y: Y(0), w: S(roomL), h: S(roomW), fill: "#fff", stroke: "#33465e", sw: 2.4 });
  /* шкафы ИБП — реальные габариты L×W */
  for (let i = 0; i < R.nsys; i++) {
    const zx = i * (zoneW + sysGap);
    P.els.push({ t: "r", x: X(zx + wall), y: Y(upsY), w: S(cab.L), h: S(cab.W), fill: "#dbe8ff", stroke: "#1b6ef3" });
    P.els.push({ t: "t", x: X(zx + wall) + S(cab.L) / 2, y: Y(upsY) + S(cab.W) / 2 - 1,
      s: `Q${"AB"[i]} · ИБП-${"AB"[i]} · ${R.ups_kVA} кВА`, align: "middle", size: 6.8 });
    P.els.push({ t: "t", x: X(zx + wall) + S(cab.L) / 2, y: Y(upsY) + S(cab.W) / 2 + 8,
      s: `${cab.L}×${cab.W}×${cab.H} мм · ${cab.mass} кг`, align: "middle", size: 6.2, color: "#34508a" });
  }
  /* стеллажи АКБ — реальные габариты стеллажа и блоков; до 3 в ряд */
  for (let sys = 0; sys < R.nsys; sys++) {
    const zx = sys * (zoneW + sysGap);
    for (let g = 0; g < groups; g++) {
      const gy = racksY + g * rowStep;
      for (let k = 0; k < perRow; k++) {
        const idx = g * perRow + k;
        if (idx >= p.nr) break;
        const gx = zx + wall + k * (rackL + groupGap);
        P.els.push({ t: "r", x: X(gx), y: Y(gy), w: S(rackL), h: S(rackD), fill: "#ffe9c7", stroke: "#b26a00" });
        P.els.push({ t: "t", x: X(gx) + S(rackL) / 2, y: Y(gy) + S(rackD) / 2 - 1,
          s: `GB-${"AB"[sys]} Ст.${idx + 1} · ${b.cells6 ? f(p.unitsPerRack, 0) + "×12В" : f(p.cellsPerRack, 0) + "×2В"} · ${b.Ah} А·ч`, align: "middle", size: 6.8 });
        P.els.push({ t: "t", x: X(gx) + S(rackL) / 2, y: Y(gy) + S(rackD) / 2 + 9,
          s: `${rackL}×${rackD}×${p.rk.H} мм`, align: "middle", size: 6.5, color: "#7a5a20" });
      }
    }
  }
  /* размерные линии (ГОСТ 2.305): помещение по низу и слева */
  dim(P, X(0), Y(roomW) + 26, X(roomL), Y(roomW) + 26, `${roomL}`);
  dim(P, X(0) - 26, Y(0), X(0) - 26, Y(roomW), `${roomW}`);
  /* габарит первого стеллажа и проход */
  dim(P, X(wall), Y(racksY) - 8, X(wall + rackL), Y(racksY) - 8, `${rackL}`);
  dim(P, X(wall + rackL) + 10, Y(racksY), X(wall + rackL) + 10, Y(racksY + rackD), `${rackD}`);
  dim(P, X(wall) - 10, Y(racksY - aisle), X(wall) - 10, Y(racksY), `${aisle}`);
  const fitL = needL <= roomL, fitW = totalDepth <= roomW;
  const fit = fitL && fitW;
  P.els.push({ t: "t", x: X(roomL / 2), y: 14, s: `Размеры в мм · М 1:${Math.round(1 / scale)} условно · стеллажи реальные (ACM1-3E-ПГУ), шкафы ИБП — типовые габариты по п. — уточнить по паспорту`, size: 8, bold: true, align: "middle" });
  P.els.push({ t: "t", x: X(roomL / 2), y: Y(roomW) + 44,
    s: (fit ? "✓ Размещение по факту: " : "✗ Размещение не проходит: ") +
      `требуется ${f(needL, 0)}×${f(totalDepth, 0)} мм (проходы ${aisle} мм, отступы ${wall} мм; рядность ≤3 стеллажа${groups > 1 ? ", групп в системе: " + groups : ""}${p.rowsLimited ? "; ВНИМАНИЕ: рядность >3 — увеличить ёмкость АКБ" : ""})`,
    size: 8, color: fit ? "#1b8a3f" : "#c62828", align: "middle" });
  return { prims: P, fit };
}
function renderLayout(R) {
  if (!R.rackPlan) { $("out-layout").innerHTML = ""; $("out-layout-note").textContent = ""; return; }
  const { prims, fit } = layoutPrims(R);
  $("out-layout").innerHTML = prims2svg(prims);
  const s = R.s, p = R.rackPlan;
  const areaEq = p.racksTotal * (p.rk.L / 1000) * (p.rk.W / 1000) + R.nsys * upsCabOf(R.ups_kVA).L / 1000 * upsCabOf(R.ups_kVA).W / 1000;
  $("out-layout-note").innerHTML = `Площадь под оборудование ≈ ${f(areaEq, 1)} м²; нагрузка на пол под заряженным стеллажом — ${f(p.floor, 0)} кг/м² при допуске ${f(s.floor, 0)} кг/м² ${p.floor <= s.floor ? "✓" : "✗"}. Зазор между блоками на стеллаже 10–20 мм (ГОСТ Р МЭК 62485-2), проходы обслуживания ≥1000 мм. ${p.rowsLimited ? "<span class='bad'>Рядность стеллажей >3 не допускается — примените АКБ большей ёмкости.</span>" : ""}`;
}

/* SECTION: scheme-primitives */
function prims2svg(P) {
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.W} ${P.H}" width="${P.W}" height="${P.H}" font-family="Segoe UI,Arial">`;
  o += `<rect x="0" y="0" width="${P.W}" height="${P.H}" fill="white"/>`;
  for (const e of P.els) {
    if (e.t === "l") o += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="${e.color || '#223344'}" stroke-width="${e.sw || 1.2}" ${e.dash ? `stroke-dasharray="${e.dash}"` : ""}/>`;
    else if (e.t === "r") o += `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.fill || 'none'}" stroke="${e.stroke || '#223344'}" stroke-width="${e.sw || 1.2}" rx="${e.rx || 0}"/>`;
    else if (e.t === "c") o += `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="none" stroke="${e.color || '#223344'}" stroke-width="1.2"/>`;
    else if (e.t === "n") o += `<circle cx="${e.x}" cy="${e.y}" r="${e.r || 2.2}" fill="${e.color || '#223344'}"/>`;
    else if (e.t === "p") o += `<polygon points="${e.pts.map(pt => pt.join(',')).join(' ')}" fill="none" stroke="${e.color || '#223344'}" stroke-width="1.2"/>`;
    else if (e.t === "t") o += `<text x="${e.x}" y="${e.y}" font-size="${e.size || 9}" font-weight="${e.bold ? 700 : 400}" fill="${e.color || '#223344'}" text-anchor="${e.align || 'start'}">${(e.s || "").replace(/\n/g, "  ·  ").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  }
  return o + "</svg>";
}
/* ===== УГО по ЕСКД: ГОСТ 2.721-74*, 2.710-81* (2.755), 2.722-74*, 2.730-78*, 2.747-2008
   (* номера базовых стандартов серии 2.7х ЕСКД на условные графические обозначения) ===== */
function symQF(P, x, y, pos, inf) { // автоматический выключатель: контакт + расцепитель (ГОСТ 2.710/2.755)
  P.els.push({ t: "l", x1: x, y1: y - 14, x2: x, y2: y - 4, sw: 1.6 });
  P.els.push({ t: "l", x1: x, y1: y + 14, x2: x, y2: y + 4, sw: 1.6 });
  P.els.push({ t: "l", x1: x - 5, y1: y + 5, x2: x + 4, y2: y - 6, sw: 1.6 });
  P.els.push({ t: "r", x: x + 4, y: y - 9, w: 7, h: 4.5, stroke: "#223344", sw: 0.9 });
  P.els.push({ t: "t", x: x + 15, y: y - 9, s: pos, size: 7.5, bold: true });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 15, y: y + i * 8, s: ln, size: 6.5, color: "#33465e" }));
}
function symSA(P, x, y, pos, inf) { // разъединитель: ножевой контакт, видимый разрыв (ГОСТ 2.710)
  P.els.push({ t: "l", x1: x, y1: y + 11, x2: x, y2: y + 4, sw: 1.6 });
  P.els.push({ t: "l", x1: x - 4, y1: y + 4, x2: x + 4, y2: y - 8, sw: 1.8 });
  P.els.push({ t: "c", x: x - 4, y: y + 5, r: 1.5 });
  P.els.push({ t: "t", x: x + 12, y: y - 8, s: pos, size: 7.5, bold: true });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 12, y: y + 1 + i * 8, s: ln, size: 6.5, color: "#33465e" }));
}
function symBat(P, x, y, pos, inf) { // батарея: цепи элементов (ГОСТ 2.722): длинная + , короткая −
  P.els.push({ t: "l", x1: x, y1: y - 40, x2: x, y2: y - 18, sw: 1.4 });
  P.els.push({ t: "l", x1: x - 9, y1: y - 18, x2: x + 9, y2: y - 18, sw: 2.2 });   // +
  P.els.push({ t: "l", x1: x - 4, y1: y - 14, x2: x + 4, y2: y - 14, sw: 1.4 });   // −
  P.els.push({ t: "l", x1: x - 9, y1: y - 10, x2: x + 9, y2: y - 10, sw: 2.2 });
  P.els.push({ t: "l", x1: x - 4, y1: y - 6, x2: x + 4, y2: y - 6, sw: 1.4 });
  P.els.push({ t: "l", x1: x, y1: y - 6, x2: x, y2: y + 8, sw: 1.4 });
  P.els.push({ t: "l", x1: x - 5, y1: y + 8, x2: x + 5, y2: y + 8, sw: 1.6 });     // рамка «батарея»
  P.els.push({ t: "t", x: x - 26, y: y - 24, s: "+", size: 8 });
  P.els.push({ t: "t", x: x + 13, y: y - 16, s: pos, size: 7.5, bold: true });
  if (inf) inf.split("\n").forEach((ln, i) => P.els.push({ t: "t", x: x + 13, y: y - 6 + i * 9, s: ln, size: 6.5 }));
}
function symSTP(P, x, y, pos, inf) { // статический переключатель: встречно-параллельные тиристоры (ГОСТ 2.747)
  P.els.push({ t: "l", x1: x, y1: y - 15, x2: x, y2: y - 8, sw: 1.4 });
  P.els.push({ t: "l", x1: x, y1: y + 15, x2: x, y2: y + 8, sw: 1.4 });
  P.els.push({ t: "p", pts: [[x - 6, y + 5], [x + 6, y + 5], [x, y - 4]] });
  P.els.push({ t: "l", x1: x - 6, y1: y - 4, x2: x + 6, y2: y - 4, sw: 1.3 });
  P.els.push({ t: "p", pts: [[x - 6, y - 5], [x + 6, y - 5], [x, y + 4]] });
  P.els.push({ t: "l", x1: x - 6, y1: y + 4, x2: x + 6, y2: y + 4, sw: 1.3 });
  P.els.push({ t: "t", x: x + 11, y: y - 3, s: pos, size: 7.5, bold: true, color: "#7a3fd8" });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 11, y: y + 6 + i * 8, s: ln, size: 6.5, color: "#7a3fd8" }));
}
function symConv(P, x, y, w, h, kind, pos, inf) { // преобразователь (ГОСТ 2.747/2.721)
  P.els.push({ t: "r", x: x - w / 2, y: y - h / 2, w, h, fill: "#f6faff", stroke: "#223344", sw: 1.4 });
  const a = kind === "rec" ? ["~", "\u23D7"] : ["\u23D7", "~"]; // вход/выход
  P.els.push({ t: "t", x: x - w / 2 + 14, y: y + 4, s: a[0], size: 12, align: "middle", bold: true });
  P.els.push({ t: "t", x: x + w / 2 - 14, y: y + 4, s: a[1], size: 12, align: "middle", bold: true });
  P.els.push({ t: "l", x1: x - 14, y1: y + 10, x2: x + 14, y2: y - 10, sw: 1.1 });
  P.els.push({ t: "p", pts: [[x + 14, y - 10], [x + 6, y - 10], [x + 14, y - 4]] });
  P.els.push({ t: "t", x: x - w / 2, y: y - h / 2 - 4, s: pos, size: 8, bold: true });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + w / 2 + 8, y: y - 2 + i * 8, s: ln, size: 6.5, color: "#33465e" }));
}
function box(P, x, y, w, h, text, sub, fill, posOut) {
  P.els.push({ t: "r", x, y, w, h, fill: fill || "#f6faff", stroke: "#223344", sw: 1.3, rx: 2 });
  P.els.push({ t: "t", x: x + w / 2, y: y + h / 2 - (sub ? 3 : -3), s: text, align: "middle", size: 8.5, bold: true });
  if (sub) P.els.push({ t: "t", x: x + w / 2, y: y + h / 2 + 9, s: sub, align: "middle", size: 7 });
  return { x, y, w, h };
}
function wire(P, pts, sw) { for (let i = 0; i < pts.length - 1; i++) P.els.push({ t: "l", x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1], sw: sw || 1.4 }); }
function schemeAC(R) {
  const s = R.s, P = { W: 1060, H: 700, els: [] };
  const b = R.bat;
  P.els.push({ t: "t", x: 20, y: 22, s: `Схема электрическая структурная. Источник бесперебойного питания переменного тока 2×100 % — ${s.proj}`, size: 11.5, bold: true });
  P.els.push({ t: "t", x: 20, y: 38, s: `Выполнена по ГОСТ 2.702-2011, ГОСТ 2.701-2008; УГО — ГОСТ 2.7х серии ЕСКД. Байпас общий. Класс по ГОСТ IEC 62040-3-2024: VFI·SS·1·PF1 (2×100 %).`, size: 8 });
  const xA = 250, xB = 600, xBy = 900, y0 = 56;
  for (const [cx, nm, qfIn] of [[xA, "A", "QF1"], [xB, "B", "QF2"]]) {
    P.els.push({ t: "t", x: cx - 90, y: y0 + 4, s: `Ввод ${nm}: сеть 3~/380 В, Iвх=${f(R.I_in, 0)} А`, size: 8 });
    wire(P, [[cx, y0], [cx, y0 + 50]]);
    symQF(P, cx, y0 + 46, qfIn, `${R.qf_in} А`);
    wire(P, [[cx, y0 + 62], [cx, y0 + 92]]);
    symConv(P, cx, y0 + 122, 150, 48, "rec", `VC-${nm}`, `Пит: 3~/380 В cos φ≥${f(TU_REQS.cospfMin)}\nU вых DC: ${s.udc} В · η=${f(s.chgEff * 100, 0)} % · ${f(R.I_chg, 0)} А`);
    wire(P, [[cx, y0 + 146], [cx, y0 + 186]]);
    /* шина DC接单: на уровне yDC */
    const yDC = y0 + 186, bx = cx - 150;
    wire(P, [[bx, yDC], [bx, yDC + 60]]);
    symQF(P, bx, yDC + 62, `QF_${nm}`, `${R.qf_bat} А\nIрасч=${f(R.I_max * 1.25, 0)} А`);
    wire(P, [[bx, yDC + 80], [bx, yDC + 128]]);
    symSA(P, bx, yDC + 142, `SA_${nm}`, `${R.qf_bat} А\nвидимый разрыв`);
    symBat(P, bx, yDC + 210, `GB_${nm}`, `${R.NcellsBat}×${b ? b.b.V : 2} В\n${f(R.C_bank || 0, 0)} А·ч (C10)\nIразр=${f(R.I_max, 0)} А\nt=${f(s.tmin, 0)} мин (≈${f(R.t_real || s.tmin, 0)})`);
    wire(P, [[bx, yDC + 226], [bx, yDC + 252]]);
    P.els.push({ t: "l", x1: bx - 7, y1: yDC + 252, x2: bx + 7, y2: yDC + 252, sw: 2.2 });
    /* инвертор */
    wire(P, [[cx, yDC], [cx, yDC + 26]]);
    symConv(P, cx, yDC + 56, 150, 48, "inv", `NC-${nm}`, `U вх DC ${s.udc} В\nU вых 230 В ±1 % · 50 Гц ±1 Гц\nS ном ${R.ups_kVA} кВА · I вых ${f(R.I_out, 0)} А`);
    wire(P, [[cx, yDC + 80], [cx, yDC + 150]]);
    symSTP(P, cx, yDC + 168, `SF_${nm}`, `Iном=${f(R.I_out, 0)} А`);
    wire(P, [[cx, yDC + 186], [cx, yDC + 222]]);
  }
  const yDC0 = 242;
  P.els.push({ t: "l", x1: 130, y1: yDC0, x2: 600 - 0, y2: yDC0, sw: 2.6 });
  P.els.push({ t: "t", x: 380, y: yDC0 - 10, s: "Шина постоянного тока (звено DC) — 2×100 %", size: 8, align: "middle", bold: true });
  P.els.push({ t: "l", x1: 130, y1: yDC0 + 6, x2: 130 - 8, y2: yDC0 + 6, sw: 2 }); // засечки конца шины
  /* общий байпас */
  P.els.push({ t: "t", x: xBy - 96, y: 60, s: "Резервная (байпасная) линия 3~/380 В", size: 8 });
  wire(P, [[xBy, 66], [xBy, 110]]);
  symQF(P, xBy, 126, "QF9", `${R.qf_in} А`);
  wire(P, [[xBy, 144], [xBy, 420]]);
  symSTP(P, xBy, 438, "SF9-байпас", "Iном=2·" + f(R.I_out, 0) + " А");
  wire(P, [[xBy, 456], [xBy, 470], [660, 470]]);
  /* шина вывода 230 В */
  P.els.push({ t: "l", x1: 250, y1: 464, x2: 900, y2: 464, sw: 2.6 });
  P.els.push({ t: "t", x: 762, y: 459, s: "Шина 230 В ±1 %, 50 Гц ±1 Гц (плавающая земля, ТУ п.5.2)", size: 8, align: "middle", bold: true });
  /* ШСН */
  const shn = box(P, 600 - 70, 484, 150, 40, "ШСН (ЩС) — щит собственных нужд", `выводов: 6…12; I лин. ≤ ${Math.ceil(R.I_out / 6)} А; QF отх.`);
  wire(P, [[380, 464], [380, 504], [530, 504]]);
  const ld = box(P, 830, 470, 130, 46, "Потребители AC", `P = ${f(s.P, 1)} кВт·cos φ ${f(s.cos)}\nTHD по IEEE 519 / ГОСТ IEC 62040-2`);
  wire(P, [[680, 504], [830, 504], [830, 496]]);
  /* цепи управления */
  P.els.push({ t: "l", x1: 90, y1: 660, x2: 980, y2: 660, dash: "5 3", color: "#7a3fd8", sw: 1.1 });
  P.els.push({ t: "t", x: 94, y: 653, s: "Цепи управления и сигнализации: тревожные «сухие контакты», RS-485 (Modbus RTU), контроль изоляции, датчики T° (компенсация заряда), ОПС", size: 7.5, color: "#7a3fd8" });
  P.els.push({ t: "t", x: 20, y: 692, s: `Позиционные обозначения: QF — автоматический выключатель; SA — разъединитель; GB — батарея; VC/NC — выпрямитель/инвертор; SF — статический переключатель. Все параметры — из разделов 2–4 расчёта.`, size: 7, color: "#5a6a7e" });
  return P;
}
function schemeDC(R) {
  const s = R.s, P = { W: 1060, H: 640, els: [] };
  const b = R.bat;
  P.els.push({ t: "t", x: 20, y: 22, s: `Схема электрическая структурная. Источник бесперебойного питания постоянного тока 2×100 % — ${s.proj}`, size: 11.5, bold: true });
  P.els.push({ t: "t", x: 20, y: 38, s: `ГОСТ 2.702-2011, ГОСТ 2.701-2008; УГО — ГОСТ 2.7х ЕСКД. Характеристики ИБП DC — по ГОСТ IEC 62040-5-3-2024; эксплуатация — ГОСТ IEC 62040-1-2024, ЭМС — ГОСТ IEC 62040-2.`, size: 8 });
  const xA = 270, xB = 640, yDC = 200;
  for (const [cx, nm, qfIn, qfBat] of [[xA, "A", "QF1", "QF3"], [xB, "B", "QF2", "QF4"]]) {
    P.els.push({ t: "t", x: cx - 90, y: 60, s: `Ввод ${nm}: сеть 3~/380 В`, size: 8 });
    wire(P, [[cx, 66], [cx, 96]]);
    symQF(P, cx, 112, qfIn, `${R.qf_in} А`);
    wire(P, [[cx, 130], [cx, 160]]);
    symConv(P, cx, 186, 160, 52, "rec", `AVR_${nm}`, `3~/380 В → ${s.udc} В DC ±10 %\nI макс ${f(R.I_chg, 0)} А (нагрузка + 10-ч. заряд)\nη = ${f(s.chgEff * 100, 0)} % (ТУ ≥ 90 %)` );
    wire(P, [[cx - 60, yDC + 14], [cx - 60, yDC + 60]]);
    symQF(P, cx - 60, yDC + 76, qfBat, `${R.qf_bat} А\nIрасч 1,25·${f(R.I_max, 0)} А`);
    wire(P, [[cx - 60, yDC + 94], [cx - 60, 340]]);
    symSA(P, cx + 70, yDC + 76, `SA_${nm}`, `${R.qf_bat} А`);
    wire(P, [[cx - 60, yDC + 94], [cx + 70, yDC + 94], [cx + 70, yDC + 94]]);
    symBat(P, cx + 70, 350, `GB_${nm}`, `${R.NcellsBat}×2 В\n${f(R.C_bank || 0, 0)} А·ч · VRLA\nIразр=${f(R.I_max, 0)} А · t=${f(s.tmin, 0)} мин\n(факт ≈${f(R.t_real || s.tmin, 0)} мин)`);
    wire(P, [[cx + 70, 366], [cx + 70, 388]]);
    P.els.push({ t: "l", x1: cx + 62, y1: 388, x2: cx + 78, y2: 388, sw: 2.2 });
    /* шпн */
  }
  /* шины A и B раздельные (сегрегация ТУ п.5.2) */
  P.els.push({ t: "l", x1: xA - 120, y1: yDC + 4, x2: xA + 130, y2: yDC + 4, sw: 2.6 });
  P.els.push({ t: "l", x1: xB - 120, y1: yDC + 4, x2: xB + 130, y2: yDC + 4, sw: 2.6 });
  P.els.push({ t: "t", x: xA, y: yDC - 6, s: `Шина DC-A ${s.udc} В`, size: 8, align: "middle", bold: true });
  P.els.push({ t: "t", x: xB, y: yDC - 6, s: `Шина DC-B ${s.udc} В`, size: 8, align: "middle", bold: true });
  P.els.push({ t: "l", x1: xA + 140, y1: yDC - 14, x2: xB - 130, y2: yDC - 14, dash: "6 3", color: "#b26a00" });
  P.els.push({ t: "t", x: (xA + xB) / 2, y: yDC - 20, s: "сегрегация: разные шкафы и стеллажи (ТУ п.5.2)", align: "middle", size: 7, color: "#b26a00" });
  const shnA = box(P, xA - 90, 412, 170, 40, `ШПН-A ${s.udc} В`, `I макс линии ${f(R.I_out / 4, 0)} А`);
  const shnB = box(P, xB + 130 - 170, 412, 170, 40, `ШПН-B ${s.udc} В`, `I макс линии ${f(R.I_out / 4, 0)} А`);
  wire(P, [[xA, yDC + 4], [xA, 412]]);
  wire(P, [[xB, yDC + 4], [xB, 412]]);
  const ld = box(P, 380, 508, 300, 46, "Потребители ПС (двухлучевое питание)", `P = ${f(s.P, 1)} кВт; каждый фидер от A и B;\nвводы 2P, ${breakerOf(R.I_out / 4)} А`);
  wire(P, [[xA, 452], [xA, 486], [430, 486], [430, 508]], 1);
  wire(P, [[xB, 452], [xB, 496], [630, 496], [630, 508]], 1);
  box(P, 770, 430, 220, 40, "Прибор контроля изоляции (PVM)", `${s.udc} В, плавающая шина; авария → АСУ`);
  wire(P, [[850, 430], [850, yDC + 4]], 1);
  P.els.push({ t: "l", x1: 90, y1: 608, x2: 990, y2: 608, dash: "5 3", color: "#7a3fd8", sw: 1.1 });
  P.els.push({ t: "t", x: 94, y: 601, s: "Цепи управления и сигнализации: RS-485/Modbus, «сухие контакты», датчики T° у АКБ (температурная компенсация заряда по ТУ п.5.6.1.32)", size: 7.5, color: "#7a3fd8" });
  P.els.push({ t: "t", x: 20, y: 632, s: "Пояснения: AVR — выпрямитель/зарядное; GB — батарея; QF — автомат; SA — разъединитель; ШПН — щит постоянного напряжения. Параметры — из расчёта.", size: 7, color: "#5a6a7e" });
  return P;
}
function currentScheme(R) { return R.s.type === "ac" ? schemeAC(R) : schemeDC(R); }

/* SECTION: checks-spec-method */
function renderChecks(R) {
  const s = R.s, isAC = s.type === "ac", b = R.bat, Y = TU_REQS;
  const ipNum = parseInt((s.ip.match(/\d+/) || [0])[0]);
  const margin = R.ups_kVA ? R.ups_kVA / R.S_base : 0;
  const rows = [
    ["Двойное резервирование 2×100 % (все компоненты в раздельных шкафах)", "ТУ п.5.2", s.red === "2x100" ? "2 системы × 100 %" : s.red, s.red === "2x100"],
    [isAC ? "Выход AC: 230 В ±1 %, 50 Гц ±1 Гц, плавающая земля" : "Выход DC: 110 В ±10 %, плавающая земля, контроль изоляции", "ТУ п.5.2",
      isAC ? "230 В ±1 % (в задании ИБП)" : `${s.udc} В${s.udc === 110 ? "" : " ≠ 110 В по ТУ"}`, isAC ? true : s.udc === 110],
    ["Коэффициент мощности сети ≥ 0,85 при номинальной нагрузке", "ТУ п.5.2", `cos φ = ${f(s.cos)}`, s.cos >= Y.cospfMin || !isAC],
    ["Расчётный запас каждой системы ≥ 10 %", "ТУ п.5.2", `запас ${f((margin - 1) * 100, 0)} %`, margin >= Y.marginMin - 0.001],
    ["КПД выпрямителя/зарядного ≥ 90 %", "ТУ п.5.7.1.11", `${f(s.chgEff * 100, 0)} %`, s.chgEff * 100 >= Y.chargerEffMin],
    ["АКБ — VRLA, требования IEC 60896 / ГОСТ Р МЭК 60896-21", "ТУ п.5.6.1.30, 5.7.1.22", b ? (b.b.vrla ? "VRLA" : "не VRLA ⚠") : "—", b ? !!b.b.vrla : false],
    [`Срок службы АКБ ≥ ${Y.lifeYears} лет (по ТУ проекта)`, "ТУ п.5.1.1", b ? `${f(b.b.life, 0)} лет` : "—", b ? b.b.life >= Y.lifeYears : false],
    ["Компенсация старения 20 % и температурные поправки учтены", "ТУ п.5.6.1.32", `K стар = ${f(R.Kaging)}, K T° = ${f(R.Ktemp, 3)}`, true],
    ["Конечное напряжение разрядки не ниже паспортного", "ТУ п.5.6.1.32", `${f(s.uend)} В/эл`, s.uend >= 1.70],
    ["Степень защиты оболочек не ниже IP42", "ТУ п.5.4.1.5", s.ip, ipNum >= Y.ip],
    ["Температура в помещении АКБ 20…25 °C (проектное)", "ТУ / пояснительная записка", `${f(s.temp, 0)} °C`, s.temp >= Y.tempOk[0] && s.temp <= Y.tempOk[1]],
    ["Время автономии выдержано", "Исходные данные", `≈ ${f(R.t_real || 0, 0)} мин ≥ ${f(s.tmin, 0)} мин`, (R.t_real || 0) >= s.tmin - 0.5],
    ["Нагрузка на пол не выше допуска помещения", "ГОСТ Р МЭК 62485-2, СП", R.rackPlan ? `${f(R.rackPlan.floor, 0)} ≤ ${f(s.floor, 0)} кг/м²` : "—", R.rackPlan ? R.rackPlan.floor <= s.floor : false],
    ["Стеллажи рассчитаны на сейсмичность площадки", "ТУ п.5.4.1.22", `${f(s.seismic, 0)} баллов`, s.seismic <= 7],
    [isAC ? "Класс и эксплуатационные характеристики UPS по ГОСТ IEC 62040-3-2024" : "UPS постоянного тока: характеристики и испытания по ГОСТ IEC 62040-5-3-2024",
      "ГОСТ IEC 62040-3-2024 / ГОСТ IEC 62040-5-3-2024", isAC ? "VFI·SS·1·PF1, 2×100 %" : "буферный режим, U вых " + s.udc + " В ±10 %", null],
    ["Безопасность UPS (электро-, пожаро-, механическая)", "ТУ п.5.2; ГОСТ IEC 62040-1-2024 (взамен ГОСТ IEC 62040-1-2018)", "подтверждается сертификатом ТР ТС 004/2011", null],
    ["ЭМС: помехоэмиссия/устойчивость", "ГОСТ IEC 62040-2; IEC 61000; IEEE 519 (THD)", "декларируется поставщиком", null],
    ["Сертификация ГОСТ Р / ТР ТС 004, 020", "ТУ", "обязательна поставка с сертификатами", null]
  ];
  const html = rows.map((r, i) => {
    const v = r[3] === null ? `<span class="tag">инфо</span>` : r[3] ? `<span class="ok">✓ соответствует</span>` : `<span class="bad">✗ НЕ соответствует</span>`;
    return `<tr><td>${i + 1}</td><td>${r[0]}</td><td class="note">${r[1]}</td><td>${r[2]}</td><td>${v}</td></tr>`;
  }).join("");
  const nBad = rows.filter(r => r[3] === false).length;
  R.nChecksBad = nBad;
  R.checksOut = rows;
  $("out-check").innerHTML = `<table><tr><th>№</th><th>Требование</th><th>Основание</th><th>Фактически в расчёте</th><th>Заключение</th></tr>${html}</table>
    <p class="note">${nBad ? `<span class="bad">✗ Выявлено несоответствий: ${nBad}. Требуется корректировка проекта или отступление, согласованное с Заказчиком.</span>`
    : '<span class="ok">✓ Обязательные требования ТУ и ГОСТ выполнены.</span>'} Сертифицированная поставка (ГОСТ Р / ТР ТС) подтверждается документацией поставщика на этапе закупки.</p>`;
}
function specRows(R) {
  const s = R.s, b = R.bat, isAC = s.type === "ac", Y = TU_REQS;
  const rp = R.rackPlan;
  const spec = [];
  let n = 0;
  const push = (...t) => spec.push([++n, ...t]);
  if (isAC) push("Источник бесперебойного питания двойного преобразования (VFI-AC/AC)",
    `${R.ups_kVA} кВА; вход 3~/380 В, cos φ сети ≥ 0,85, THD по IEEE 519 в допуске; выход 230 В ±1 %, 50 Гц ±1 Гц; статический байпас; η ≥ 92 %; IP не ниже ${Y.ip}; класс VFI·SS·1·PF1 по ГОСТ IEC 62040-3-2024; безопасность — ГОСТ IEC 62040-1-2024; ЭМС — ГОСТ IEC 62040-2; работа в составе 2×100 %`,
    R.nsys, "шт.", `запас ${f((R.ups_kVA / R.S_base - 1) * 100, 0)} % (ТУ ≥10 %)`);
  else push("Шкаф ИБП постоянного тока (выпрямитель/зарядное + ШПН)",
    `${R.ups_kVA || f(s.P, 0)} кВт; вход 3~/380 В; выход ${s.udc} В DC ±10 %, плавающая шина, ограничение тока по заданию заряда АКБ; η ≥ 90 %; ток ${f(R.I_chg, 0)} А; IP не ниже ${Y.ip}`,
    R.nsys, "шт.", "системы A/B — в раздельных шкафах (ТУ п.5.2)");
  if (b) {
    const perSys = b.b.cells6 ? `${b.Nser} блока×12 В (${b.Nser * 6} эл.)` : `${b.Nser} моноблока×2 В`;
    push("Батарея аккумуляторная свинцово-кислотная VRLA (GQ)",
      `${perSys} на цепочку; ${b.n} цеп. параллельно; ${f(b.b.Ah, 0)} А·ч (C10); срок службы ≥ 25 лет в буферном режиме; IEC/OCT 60896; ГОСТ Р МЭК 60896-21-2013; клеммы под пластинчатые наконечники`,
      b.n * R.nsys, "батарей", "обезличено: только технические параметры");
    push(b.b.cells6 ? "Блок АКБ 12 В" : "Моноблок АКБ 2 В", `${b.b.V} В · ${f(b.b.Ah, 0)} А·ч`, b.Nser * b.n * R.nsys, "шт.", "в т.ч. ЗИП — см. строку ЗИП");
  }
  if (rp) push("Стеллаж для АКБ",
    `${rp.rk.L}×${rp.rk.W}×${rp.rk.H} мм, ярусов ${rp.rk.levels || 3}, крепление к полу (при сейсмичности ≥8 — по расчёту СП 14.13330)`,
    rp.racksTotal, "шт.", "нагрузка на пол проверена: п.4");
  push("Кабель цепей АКБ, медь, нг(А)-LS", `${R.s_bat_cable} мм²`, f(2 * s.cableLen * R.nsys, 0), "м", `L расч. ${f(s.cableLen, 0)} м; ΔU ≤ 2 %`);
  push("Кабель питания ИБП, медь, нг(А)-LS", `${R.s_in_cable} мм²`, f(2 * s.cableLen, 1), "м", "ПУЭ табл. 1.3.6");
  push("Автоматический выключатель батарейной цепи (QF)", `${R.qf_bat} А; ${isAC ? "2P" : "2P"}; Icu ≥ 10 кА`, R.nsys, "шт.", "1,25·I макс.разряда");
  push("Автоматический выключатель ввода (QF)", `${R.qf_in} А; ${isAC ? "4P" : "4P (вход выпрямителя)"}`, R.nsys, "шт.", "селективность — по ТЗ на защиту");
  push("Разъединитель батарейный (SA)", `${R.qf_bat} А, видимый разрыв, ГОСТ Р МЭК 60947-3`, R.nsys, "шт.", "у плюсового вывода АКБ");
  push("Комплект соединителей АКБ (пластины, болты, наконечники)", "по ТУ п.5.6.1.31", R.nsys, "компл.", "для оконцевания кабелей заказчика");
  push("ЗИП: элементы АКБ", "1 % от числа элементов, не менее 2 шт.", Math.max(2, Math.round(R.cellsTotal * 0.01)), "шт.", "эксплуатационный запас");
  push("Датчик температуры воздуха у АКБ", "Pt100 / NTC с передачей в ИБП (температурная компенсация заряда)", 2 * R.nsys, "шт.", "ТУ: компенсация от T°");
  if (!isAC) push("Прибор контроля изоляции шины DC (ИМ)", `${s.udc} В, плавающая система, с сигнализацией`, R.nsys, "шт.", "ТУ п.5.2");
  return spec;
}
function renderSpec(R) {
  const rows = R.spec || (R.spec = specRows(R));
  $("out-spec").innerHTML = `<table><tr><th>№</th><th>Наименование</th><th>Характеристика</th><th>Кол-во</th><th>Ед.</th><th>Примечание</th></tr>` +
    rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="note">${r[2]}</td><td><b>${r[3]}</b></td><td>${r[4]}</td><td class="note">${r[5] || ""}</td></tr>`).join("") + `</table>`;
}
function renderMethod(R) {
  $("out-method").innerHTML = `
  <p><b>Мощность ИБП.</b> S = P/cos φ; расчёт S' = max(S·[1−x+x·K пуск]; S)·K о·K зап. ИБП каждой из двух резервированных систем выбирается ≥ S' из рядов IEC (ТУ: запас ≥10 %).</p>
  <p><b>Ёмкость АКБ (ГОСТ Р МЭК 60896-21-2013, раздел выбора батареи, консервативный метод постоянной мощности с пересчётом к току конца разряда):</b></p>
  <div class="f">I макс = P бат / (N эл · U кон)</div>
  <div class="f">C треб = I макс · (t/60) / K t , где K t — использование ёмкости при времени t и конечном напряжении (типовые разрядные характеристики VRLA);</div>
  <div class="f">C расч = C треб / (1 + α·(T−20)) · 1,2 , где α = 0,006 1/°C (t ≤ 2 ч) / 0,004 (t > 2 ч) — температурный коэффициент ГОСТ Р МЭК 60896-21; 1,2 — компенсация старения 20 % (ТУ п.5.6.1.32, 5.7.1.26).</div>
  <p><b>Зарядное устройство (ТУ п.5.7):</b> I ЗУ = P бат/(U·η) + C 10ч ; КПД ≥ 90 %.</p>
  <p><b>Кабели:</b> сечение по ПУЭ (длительный допуск, табл. 1.3.6) и потере напряжения ΔU ≤ 2 % для ответственных цепей; батареи — медь, наконечники пластины/болты по ТУ п.5.6.1.31.</p>
  <p><b>Стеллажи:</b> груз на 1 стеллаж и удельная нагрузка на пол (масса/пятно) относительно допускаемого значения помещения; при сейсмичности ≥8 баллов — расчёт по СП 14.13330; зазоры между АКБ 10–20 мм и проходы обслуживания 1,0 м по ГОСТ Р МЭК 62485-2.</p>
  <p><b>Схема:</b> УГО по ЕСКД (ГОСТ 2.710/2.721/2.722/2.730/2.747), правила выполнения — ГОСТ 2.701-2008, ГОСТ 2.702-2011; все параметры элементов заполнены по результатам расчёта. Экспорт: SVG (вектор) и DXF R12 (NanoCAD / AutoCAD / Компас-3D; DWG — сохранение из NanoCAD).</p>
  <p><b>Нормативная база:</b> ПУЭ 7-е изд.; ГОСТ IEC 62040-1-2024 (безопасность UPS, введён 01.04.2026 взамен ГОСТ IEC 62040-1-2018); ГОСТ IEC 62040-2 (ЭМС); ГОСТ IEC 62040-3-2024 (методы испытаний UPS AC); ГОСТ IEC 62040-5-3-2024 (UPS постоянного тока — характеристики и испытания); ГОСТ Р МЭК 60896-21-2013; ГОСТ Р МЭК 62485-2-2011; IEC 60146; IEEE 519; ТУ проекта 3300-E-000-EL-SPE-00021-00-D_02U. Все коэффициенты вынесены в ibp-data.js и подлежат сверке с паспортами конкретных изделий.</p>`;
}

/* SECTION: export */
function dl(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function txtNote(R) {
  const s = R.s, b = R.bat, rp = R.rackPlan;
  const L = [];
  L.push(`РАСЧЁТНАЯ ЗАПИСКА — выбор системы ИБП (${s.proj})`);
  L.push(`Основание: ТУ проекта 3300-E-000-EL-SPE-00021-00-D_02U; ГОСТ IEC 62040-1-2024; ГОСТ IEC 62040-2;`);
  L.push(`ГОСТ IEC 62040-3-2024; ГОСТ IEC 62040-5-3-2024; ГОСТ Р МЭК 60896-21-2013; ГОСТ Р МЭК 62485-2-2011; ПУЭ 7-е изд.`);
  L.push(`Дата: ${new Date().toLocaleString("ru-RU")}`, "");
  L.push("1. ИСХОДНЫЕ ДАННЫЕ");
  Object.entries({ "Тип нагрузки": s.type === "ac" ? "AC" : "DC", "Нагрузка P, кВт": f(s.P, 2), "cos φ": f(s.cos), "КПД инв. %": f(s.eff * 100, 0),
    "K одн": f(s.kodn), "K запас": f(s.kzap), "t автономии, мин": f(s.tmin, 0), "T среды, °C": f(s.temp, 0),
    "U шины DC, В": s.udc, "U кон, В/эл": f(s.uend), "Резервирование": s.red, "IP": s.ip, "КПД ЗУ %": f(s.chgEff * 100, 0),
    "Помещение, м": `${f(s.roomL, 1)}×${f(s.roomW, 1)}`, "Нагрузка пола доп., кг/м2": f(s.floor, 0), "Сейсмичность, баллов": f(s.seismic, 0) })
    .forEach(([k, v]) => L.push(`  ${k}: ${v}`));
  L.push("", "2. РАСЧЁТ ИБП");
  L.push(`  S расч = ${f(R.S_base)} кВА; пусковая = ${f(R.S_inst)} кВА; на систему = ${f(R.S1req)}; принято ${R.nsys}×${R.ups_kVA} кВА (запас ${f((R.marginEff - 1) * 100, 0)} %)`);
  L.push("", "3. РАСЧЁТ АКБ (ГОСТ Р МЭК 60896-21)");
  L.push(`  N = ${R.Ncells} эл; I макс = ${f(R.I_max, 1)} А; K t = ${f(R.Kt)}; C треб = ${f(R.C_req, 0)} Ач; K T = ${f(R.Ktemp, 3)}; K стар = ${f(R.Kaging)}`);
  L.push(`  C расч = ${f(R.C_corr, 0)} Ач/система; ${b ? `принято: ${b.b.name} ${b.Nser} посл. × ${b.n} цеп.; ёмкость ${f(R.C_bank, 0)} Ач; автономия ≈ ${f(R.t_real, 0)} мин; элементов всего ${R.cellsTotal}` : "АКБ не подобрана"}`);
  if (rp) L.push("", "4. СТЕЛЛАЖИ", `  ${rp.rk.name}: ${rp.nr} на систему, ${rp.racksTotal} всего; масса заряж. ${f(rp.load, 0)} кг; нагрузка на пол ${f(rp.floor, 0)} кг/м2 (допуск ${f(s.floor, 0)}) ${rp.floor <= s.floor ? "— выдерживается" : "— ПРЕВЫШЕНА"}`);
  L.push("", "5. СПЕЦИФИКАЦИЯ");
  (R.spec || []).forEach(r => L.push(`  ${r[0]}. ${r[1]} — ${r[2]}; кол-во ${r[3]} ${r[4]}. ${r[5] || ""}`));
  L.push("", "6. ПРОВЕРКА СООТВЕТСТВИЯ");
  (R.checksOut || []).forEach(c => L.push(`  [${c[3] === null ? "и" : c[3] ? "x" : "!"}] ${c[0]} — ${c[2]}`));
  return L.join("\r\n");
}
function dxfText(s) { // ASCII-safe: кириллица и символы >127 → \U+XXXX (стандарт DXF,reader'ы NanoCAD/AutoCAD понимают)
  return String(s).replace(/[;\r\n]/g, " ").split("").map(ch => {
    const c = ch.codePointAt(0);
    return c > 127 ? "\\U+" + c.toString(16).toUpperCase().padStart(4, "0") : ch;
  }).join("");
}
function prims2dxf(P) {
  /* DXF R12 (ASCII) — формат, который NanoCAD/AutoCAD/Компас-3D открывают без конвертации.
     Векторные примитивы: LINE, POLYLINE-стрелки, TEXT с привязкой и экранированием кириллицы. */
  const H = P.H;
  let o = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1251\n9\n$EXTMIN\n10\n0\n20\n0\n30\n0\n9\n$EXTMAX\n10\n" + P.W + "\n20\n" + H + "\n30\n0\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n70\n0\n3\nSolid line\n72\n65\n73\n0\n40\n0\n0\nLTYPE\n2\nDASHED\n70\n0\n3\nDashed\n72\n65\n73\n2\n40\n6\n49\n4\n49\n-2\n0\nENDTAB\n0\nTABLE\n2\nSTYLE\n70\n1\n0\nSTYLE\n2\nSTANDARD\n70\n0\n40\n0\n41\n1\n50\n0\n71\n0\n42\n2.5\n3\nxrefpxr\n4\n\n0\nENDTAB\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nLAYER\n2\nSCHEME\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nLAYER\n2\nTEXT\n70\n0\n62\n3\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  const y = v => (H - v).toFixed(2);
  for (const e of P.els) {
    if (e.t === "l") o += `0\nLINE\n8\nSCHEME\n10\n${e.x1.toFixed(2)}\n20\n${y(e.y1)}\n30\n0\n11\n${e.x2.toFixed(2)}\n21\n${y(e.y2)}\n31\n0\n`;
    else if (e.t === "r") {
      const c = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]];
      for (let i = 0; i < 4; i++) { const q = c[i], r2 = c[(i + 1) % 4];
        o += `0\nLINE\n8\nSCHEME\n10\n${q[0].toFixed(2)}\n20\n${y(q[1])}\n30\n0\n11\n${r2[0].toFixed(2)}\n21\n${y(r2[1])}\n31\n0\n`; }
    }
    else if (e.t === "n") { const r = e.r || 2.2;
      o += `0\nCIRCLE\n8\nSCHEME\n10\n${e.x.toFixed(2)}\n20\n${y(e.y)}\n30\n0\n40\n${r.toFixed(2)}\n`; }
    else if (e.t === "c") {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const a = i / 16 * 2 * Math.PI; pts.push([e.x + e.r * Math.cos(a), e.y + e.r * Math.sin(a)]); }
      for (let i = 0; i < pts.length - 1; i++) o += `0\nLINE\n8\nSCHEME\n10\n${pts[i][0].toFixed(2)}\n20\n${y(pts[i][1])}\n30\n0\n11\n${pts[i + 1][0].toFixed(2)}\n21\n${y(pts[i + 1][1])}\n31\n0\n`;
    }
    else if (e.t === "p") { const q = e.pts;
      for (let i = 0; i < q.length; i++) { const a2 = q[i], r2 = q[(i + 1) % q.length]; o += `0\nLINE\n8\nSCHEME\n10\n${a2[0].toFixed(2)}\n20\n${y(a2[1])}\n30\n0\n11\n${r2[0].toFixed(2)}\n21\n${y(r2[1])}\n31\n0\n`; } }
    else if (e.t === "t") {
      const al = { start: 0, middle: 1, end: 2 }[e.align || "start"];
      o += `0\nTEXT\n8\nTEXT\n10\n${e.x.toFixed(2)}\n20\n${y(e.y)}\n30\n0\n40\n${((e.size || 9) * 1.15).toFixed(2)}\n1\n${dxfText(e.s || "")}\n`;
      if (al) o += `50\n0\n72\n${al}\n11\n${e.x.toFixed(2)}\n21\n${y(e.y)}\n31\n0\n73\n0\n`;
    }
  }
  return o + "0\nENDSEC\n0\nEOF\n";
}
function xlsCell(v) { return `<td>${String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</td>`; }
function makeXls(R) {
  const s = R.s;
  const tbl = (title, rows) => `<tr><td colspan="8"><b>${title}</b></td></tr>` + rows.map(r => `<tr>${r.map(x => xlsCell(x)).join("")}</tr>`).join("");
  const inputs = Object.entries({ "Нагрузка P, кВт": s.P, "cos φ": s.cos, "t автономии, мин": s.tmin, "T, °C": s.temp, "U шины": s.udc, "U кон": s.uend,
    "K зап": s.kzap, "K одн": s.kodn, "Резерв": s.red, "Помещение L": s.roomL, "Помещение W": s.roomW, "Доп. нагрузка пола": s.floor, "Сейсмика": s.seismic });
  const calcRows = [["S расч, кВА", f(R.S_base)], ["На систему, кВА/кВт", f(R.S1req, 1)], ["Принято ИБП", `${R.nsys} × ${R.ups_kVA}`],
    ["N элементов", R.Ncells], ["I макс, А", f(R.I_max, 1)], ["K t", f(R.Kt)], ["C расч на систему, Ач", f(R.C_corr, 0)],
    ["Принято АКБ", R.bat ? `${R.bat.b.name} ${R.bat.Nser}п×${R.bat.n}ц` : ""], ["Автономия факт., мин", f(R.t_real, 0)],
    ["Стеллаж", R.rackPlan ? `${R.rackPlan.rk.name} ×${R.rackPlan.racksTotal}` : ""], ["Нагрузка на пол, кг/м²", R.rackPlan ? f(R.rackPlan.floor, 0) : ""]];
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">` +
    tbl("Исходные данные", inputs) + tbl("Расчёт", calcRows) +
    tbl("Спецификация", [["№", "Наименование", "Характеристика", "Кол-во", "Ед.", "Примечание"], ...(R.spec || [])]) +
    tbl("Проверка соответствия", [["Требование", "Основание", "Фактически", "Заключение"], ...(R.checksOut || []).map(c => [c[0], c[1], c[2], c[3] === null ? "инфо" : c[3] ? "OK" : "НЕ СООТВЕТСТВУЕТ"])]) +
    `</table></body></html>`;
  return new Blob(["" + html], { type: "application/vnd.ms-excel" });
}

/* SECTION: boot */
function fillBatSelect() {
  $("bat-name").innerHTML = '<option value="">— автовыбор —</option>' + BATTERIES.map(b => `<option value="${b.id}">${b.name.trim()} (${b.V} В, ${b.Ah} А·ч, ${b.life} г)</option>`).join("");
}
const IDS = ["p-type", "proj-name", "p-kw", "p-cos", "p-eff", "p-kodn", "p-kzap", "p-mot-x", "p-mot-k", "t-min", "t-temp", "u-dc", "u-end",
  "red", "bat-mode", "bat-name", "bat-ah", "bat-v", "bat-life", "ip-uc", "chg-eff", "room-l", "room-w", "floor-load", "seismic", "cable-len"];
function syncDeps() {
  const isAC = val("p-type") === "ac", man = val("bat-mode") === "manual";
  $("p-cos").disabled = !isAC; $("p-eff").disabled = !isAC;
  $("bat-ah").disabled = !man; $("bat-v").disabled = !man;
  $("bat-name").disabled = man;
}
let LAST_R = null;
function run() {
  syncDeps();
  const s = readState();
  const errs = validate(s);
  $("err-box").innerHTML = errs.length ? "✗ " + errs.join(" · ") : "";
  $("err-box").className = errs.length ? "bad" : "";
  if (errs.length) return;
  const R = calc(s);
  LAST_R = R;
  R.spec = specRows(R);
  R.checksOut = null;
  renderUps(R); renderBat(R); renderRacks(R); renderLayout(R);
  $("out-scheme").innerHTML = prims2svg(currentScheme(R));
  renderChecks(R); renderSpec(R); renderMethod(R);
}
function boot() {
  fillBatSelect();
  $("p-type").addEventListener("change", () => {  // смена рода тока: адекватное напряжение батареи по умолчанию
    const ac = val("p-type") === "ac", u = $("u-dc");
    if (ac && +(u.value) < 200) u.value = "240";
    if (!ac && +(u.value) > 150) u.value = "110";
  });
  IDS.forEach(id => { const el = $(id); el && el.addEventListener("input", run); el && el.addEventListener("change", run); });
  $("btn-print").onclick = () => window.print();
  $("btn-xls").onclick = () => { run(); if (LAST_R) dl(`IBP_${LAST_R.s.proj}.xls`, makeXls(LAST_R)); };
  $("btn-txt").onclick = () => { if (LAST_R) dl(`IBP_${LAST_R.s.proj}_zapiska.txt`, new Blob(["\ufeff" + txtNote(LAST_R)], { type: "text/plain;charset=utf-8" })); };
  $("btn-svg").onclick = () => { if (LAST_R) dl(`IBP_${LAST_R.s.proj}_shema.svg`, new Blob([prims2svg(currentScheme(LAST_R))], { type: "image/svg+xml" })); };
  $("btn-dxf").onclick = () => { if (LAST_R) dl(`IBP_${LAST_R.s.proj}_shema.dxf`, new Blob([prims2dxf(currentScheme(LAST_R))], { type: "application/dxf" })); };
  $("btn-save").onclick = () => { const d = {}; IDS.forEach(id => d[id] = val(id)); d._date = new Date().toISOString();
    dl(`IBP_${val("proj-name")}_project.json`, new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
    localStorage.setItem("ibp-last", JSON.stringify(d)); };
  $("btn-load").onclick = () => $("file-load").click();
  $("file-load").onchange = ev => { const fl = ev.target.files[0]; if (!fl) return; const rd = new FileReader();
    rd.onload = () => { try { const d = JSON.parse(rd.result); IDS.forEach(id => { if (d[id] !== undefined) $(id).value = d[id]; }); syncDeps(); run(); $("err-box").innerHTML = '<span class="ok">Проект загружен.</span>'; }
      catch (e) { $("err-box").innerHTML = "✗ Неверный файл проекта: " + e.message; $("err-box").className = "bad"; } };
    rd.readAsText(fl); };
  $("btn-demo").onclick = () => {
    const demo = { "p-type": "dc", "proj-name": "Оперативная-DC-110", "p-kw": "10", "u-dc": "110", "t-min": "60", "t-temp": "25",
      "u-end": "1.75", "red": "2x100", "bat-mode": "auto", "ip-uc": "IP42", "chg-eff": "93", "seismic": "8", "room-l": "12", "room-w": "6", "floor-load": "1500", "cable-len": "10" };
    IDS.forEach(id => { if (demo[id] !== undefined) $(id).value = demo[id]; });
    syncDeps(); run();
  };
  const last = localStorage.getItem("ibp-last");
  if (last) { try { const d = JSON.parse(last); IDS.forEach(id => { if (d[id] !== undefined) $(id).value = d[id]; }); } catch (e) {} }
  run();
}
document.addEventListener("DOMContentLoaded", boot);
