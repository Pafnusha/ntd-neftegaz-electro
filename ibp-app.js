/* =====================================================================
   ibp-app.js — расчётный модуль «Расчёт и выбор ИБП» (AC/DC).
   Методики: ГОСТ Р МЭК 60896-21-2013 (выбор ёмкости стационарной АКБ),
   ТУ 3300-E-000-EL-SPE-00021-00-D_02U (Ямал СПГ), ПУЭ 7-е изд.
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
  R.Kaging = YAMAL_REQS.agingK;                               // +20 % на старение (п.5.6.1.32 ТУ)
  R.C_corr = R.C_req / R.Ktemp * R.Kaging;                    // требуемая ёмкость на систему, А·ч C10

  /* выбор/учёт батареи */
  let bat;
  if (s.batMode === "auto") {
    let best = null;
    for (const b of BATTERIES) {
      const cand = evalBattery(b, R, isAC);
      if (!cand) continue;
      const score = (cand.b.life >= YAMAL_REQS.lifeYears ? 0 : 1e6) + cand.util;
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
  const b = bat.b;
  const massEl = b.cells6 ? b.mass / 6 : b.mass;               // кг/элемент
  const perBank = R.NcellsBat * bat.n;                         // элементов в системе
  const cands = [];
  for (const rk of RACKS.slice(0, 2)) {
    const fitCells = b.cells6 ? Math.floor(b.H <= 500 ? rk.capCells * 0.75 : rk.capCells / 2) : rk.capCells;
    if (fitCells < 1) continue;
    const nr = Math.ceil(perBank / fitCells);
    const cellsPerRack = perBank / nr;
    const load = rk.mass + cellsPerRack * massEl;
    const floor = load / (rk.L / 1000 * rk.W / 1000);
    cands.push({ rk, nr, cellsPerRack, load, floor, ok: floor <= s.floor });
  }
  /* расчётный типовой стеллаж с учётом габаритов блока и зазора 10–20 мм между АКБ */
  const gap = 15;                                              // 10–20 мм по ТУ/ГОСТ 62485-2
  const bayL = 1850;
  const perLevel = Math.max(1, Math.floor((bayL - 40 + gap) / ((b.cells6 ? b.L / 1 : b.L / (b.cells6 ? 6 : 1)) + gap) || 1));
  const levels = Math.min(4, Math.max(1, Math.floor((2200 - 300) / (b.H + 60))));
  const capGen = perLevel * levels;                            // штук (блоков или 2В эл.) на секцию
  const unitsBank = perBank / (b.cells6 ? 6 : 1);
  const nrGen = Math.ceil(unitsBank / capGen);
  const genW = b.W + 100, genH = levels * (b.H + 60) + 300;
  const rkGen = { name: `Стеллаж расчётный ${levels}-ярусный, секция ${bayL}×${genW}×${genH} мм`, levels,
    L: bayL, W: genW, H: genH, mass: 60 * levels + 20, capCells: capGen * (b.cells6 ? 6 : 1), note: "сгенерирован под габариты АКБ (зазор между блоками 15 мм)" };
  const cellsGen = unitsBank / nrGen;
  const loadGen = rkGen.mass + cellsGen * (b.cells6 ? b.mass : b.mass / 6);
  const floorGen = loadGen / (rkGen.L / 1000 * rkGen.W / 1000);
  cands.push({ rk: rkGen, nr: nrGen, cellsPerRack: cellsGen * (b.cells6 ? 6 : 1), load: loadGen, floor: floorGen,
    ok: floorGen <= s.floor });
  cands.sort((x, y) => (x.ok ? 0 : 1) - (y.ok ? 0 : 1) || x.nr - y.nr || x.floor - y.floor);
  const best = cands[0] || null;
  if (best) {
    best.racksTotal = best.nr * R.nsys;
    best.unitsPerRack = b.cells6 ? best.cellsPerRack / 6 : best.cellsPerRack;
  }
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
    `N эл. = ⌈U шины / 2 В⌉${s.type === "dc" ? ` (и ≥ 0,9·Uном/U кон = ${f(R.NcellsMin, 0)} по ТУ Ямал)` : ""} = ${R.Ncells} эл.`,
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
function layoutPrims(R) {
  const s = R.s, p = R.rackPlan;
  const roomL = s.roomL * 1000, roomW = s.roomW * 1000; // мм
  const sc = 860 / Math.max(roomL, roomW);
  const P = { W: Math.round(roomL * sc) + 40, H: Math.round(roomW * sc) + 140, els: [] };
  const X = mm => 20 + mm * sc, Y = mm => 20 + mm * sc;
  const upsW = 800, upsD = 600, aisle = 1000, wall = 100, rackGap = 300;
  /* габарит компоновки: сверху шкафы ИБП в ряд, снизу — линии стеллажей (каждая система — в свой пролёт) */
  const rowLen = R.nsys > 1 ? R.nsys * p.rk.L + rackGap : p.rk.L;
  const needL = Math.max(R.nsys * (upsW + wall) - wall + 2 * aisle, rowLen);
  const needW = upsD + aisle + p.nr * (p.rk.W + aisle) - aisle + wall;
  P.els.push({ t: "r", x: X(0), y: Y(0), w: roomL * sc, h: roomW * sc, fill: "#fff", stroke: "#445", sw: 2 });
  for (let i = 0; i < R.nsys; i++) {
    const x = X(aisle + i * (upsW + wall));
    P.els.push({ t: "r", x, y: Y(wall / 2), w: upsW * sc, h: upsD * sc, fill: "#dbe8ff", stroke: "#1b6ef3" });
    P.els.push({ t: "t", x: x + upsW * sc / 2, y: Y(wall / 2) + upsD * sc / 2 + 3, s: `ИБП-${"AB"[i]} ${R.ups_kVA} кВА`, align: "middle", size: 8 });
  }
  for (let r = 0; r < p.nr; r++) for (let sys = 0; sys < R.nsys; sys++) {
    const rx = R.nsys > 1
      ? X(aisle / 2 + sys * (p.rk.L + rackGap))
      : X(aisle / 2);
    const ry = upsD + aisle + wall / 2 + r * (p.rk.W + aisle);
    if (rx + p.rk.L * sc > X(roomL) + 1 && r === 0 && sys === R.nsys - 1) P.els.push({ t: "t", x: X(roomL) - 4, y: Y(ry) + 8, s: "✗ стеллажи длиннее помещения", align: "end", size: 9, color: "#c62828" });
    P.els.push({ t: "r", x: rx, y: Y(ry), w: p.rk.L * sc, h: p.rk.W * sc, fill: "#ffe9c7", stroke: "#b26a00" });
    P.els.push({ t: "t", x: rx + 3, y: Y(ry) + p.rk.W * sc / 2 + 3, s: `АКБ-${"AB"[sys]} ст. ${r + 1}/${p.nr} (${p.rk.name})`, size: 7 });
  }
  const fit = needL <= roomL && needW <= roomW;
  P.els.push({ t: "t", x: X(roomL / 2), y: Y(roomW) + 34, s: `Помещение ${f(s.roomL, 1)}×${f(s.roomW, 1)} м · компоновка требует ≈ ${f(needL / 1000, 1)}×${f(needW / 1000, 1)} м (проходы обслуживания 1,0 м, отступы от стен 0,1 м, зазор между АКБ 10–20 мм)`, align: "middle", size: 10, bold: true });
  P.els.push({ t: "t", x: X(roomL / 2), y: Y(roomW) + 52, s: fit ? "✓ Компоновка размещается в заданном помещении"
      : "✗ Не размещается: увеличьте помещение либо примените стеллажи большей вместимости", align: "middle", size: 10, color: fit ? "#1b8a3f" : "#c62828" });
  return { prims: P, fit };
}
function renderLayout(R) {
  if (!R.rackPlan) { $("out-layout").innerHTML = ""; $("out-layout-note").textContent = ""; return; }
  const { prims, fit } = layoutPrims(R);
  $("out-layout").innerHTML = prims2svg(prims);
  const s = R.s;
  const areaEq = R.rackPlan.racksTotal * (R.rackPlan.rk.L / 1000) * (R.rackPlan.rk.W / 1000) + R.nsys * 0.48;
  $("out-layout-note").innerHTML = `Площадь под оборудование ≈ ${f(areaEq, 1)} м² (без проходов); полная нагрузка на участок пола под стеллажом — ${f(R.rackPlan.floor, 0)} кг/м² при допуске ${f(s.floor, 0)} кг/м². ${fit ? "✓" : "⚠"} Цветовая индикация: жёлтый — АКБ, синий — шкафы ИБП.`;
}

/* SECTION: scheme-primitives */
function prims2svg(P) {
  let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.W} ${P.H}" width="${P.W}" height="${P.H}" font-family="Segoe UI,Arial">`;
  o += `<rect x="0" y="0" width="${P.W}" height="${P.H}" fill="white"/>`;
  for (const e of P.els) {
    if (e.t === "l") o += `<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="${e.color || '#223344'}" stroke-width="${e.sw || 1.2}" ${e.dash ? `stroke-dasharray="${e.dash}"` : ""}/>`;
    else if (e.t === "r") o += `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.fill || 'none'}" stroke="${e.stroke || '#223344'}" stroke-width="${e.sw || 1.2}" rx="${e.rx || 0}"/>`;
    else if (e.t === "c") o += `<circle cx="${e.x}" cy="${e.y}" r="${e.r}" fill="none" stroke="${e.color || '#223344'}" stroke-width="1.4"/>`;
    else if (e.t === "p") o += `<polygon points="${e.pts.map(p => p.join(",")).join(" ")}" fill="none" stroke="${e.color || '#7a3fd8'}" stroke-width="1.4"/>`;
    else if (e.t === "t") o += `<text x="${e.x}" y="${e.y}" font-size="${e.size || 9}" font-weight="${e.bold ? 700 : 400}" fill="${e.color || '#223344'}" text-anchor="${e.align || 'start'}">${(e.s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  }
  return o + "</svg>";
}
/* Условные обозначения (ГОСТ 2.701/2.702, упрощённые): возвращают доп. элементы, рисуют символ в точке */
function symQF(P, x, y, label) { // автомат: косой крест на линии
  P.els.push({ t: "l", x1: x, y1: y - 14, x2: x, y2: y + 14, sw: 1.6 });
  P.els.push({ t: "l", x1: x - 6, y1: y + 6, x2: x + 6, y2: y - 6, sw: 1.6 });
  P.els.push({ t: "l", x1: x - 6, y1: y - 6, x2: x + 6, y2: y + 6, sw: 1.6 });
  P.els.push({ t: "t", x: x + 9, y: y + 3, s: label, size: 8 });
}
function symSA(P, x, y, label) { // разъединитель: нож
  P.els.push({ t: "l", x1: x, y1: y + 10, x2: x, y2: y - 4, sw: 1.6 });
  P.els.push({ t: "l", x1: x, y1: y + 10, x2: x, y2: y - 10 });
  P.els.push({ t: "c", x, y: y - 10, r: 1.8 });
  P.els.push({ t: "c", x, y: y + 10, r: 1.8 });
  P.els.push({ t: "t", x: x + 8, y: y + 3, s: label, size: 8 });
}
function symBat(P, x, y, label) { // батарея: группа элементов
  for (let i = 0; i < 3; i++) {
    P.els.push({ t: "l", x1: x - 7, y1: y - i * 8, x2: x + 7, y2: y - i * 8, sw: 1.8 });
    P.els.push({ t: "l", x1: x - 3, y1: y - 4 - i * 8, x2: x + 3, y2: y - 4 - i * 8, sw: 1.2 });
  }
  P.els.push({ t: "t", x: x + 12, y: y - 6, s: label, size: 8 });
}
function symSTP(P, x, y, label) { // статический переключатель: два встречно-параллельных тиристора
  P.els.push({ t: "p", pts: [[x - 6, y - 8], [x + 6, y - 8], [x, y]] });
  P.els.push({ t: "p", pts: [[x - 6, y + 8], [x + 6, y + 8], [x, y]] });
  P.els.push({ t: "l", x1: x, y1: y - 12, x2: x, y2: y + 12, sw: 1.4 });
  P.els.push({ t: "t", x: x + 9, y: y + 3, s: label, size: 8, color: "#7a3fd8" });
}
function box(P, x, y, w, h, text, sub, fill) {
  P.els.push({ t: "r", x, y, w, h, fill: fill || "#f6faff", stroke: "#223344", rx: 3 });
  P.els.push({ t: "t", x: x + w / 2, y: y + h / 2 - (sub ? 3 : -3), s: text, align: "middle", size: 8.5, bold: true });
  if (sub) P.els.push({ t: "t", x: x + w / 2, y: y + h / 2 + 9, s: sub, align: "middle", size: 7.5 });
}
function schemeAC(R) {
  const P = { W: 980, H: 592, els: [] };
  const s = R.s;
  const colA = 200, colB = 560;
  P.els.push({ t: "t", x: 20, y: 20, s: `Схема структурная ИБП переменного тока 2×100 % — ${s.proj}`, size: 12, bold: true });
  P.els.push({ t: "t", x: 20, y: 34, s: `Выполнена по ГОСТ 2.701-2008, ГОСТ 2.702-2011; аналог листа 3110-G-745-EL-SLD-00102-01-D_07C. Байпас общий для двух систем.`, size: 8 });
  const yIn = 60, yRect = 100, yDC = 168, yInv = 220, yStp = 292, yOut = 340, yBat = 430, ySh = 470;
  for (const [cx, nm] of [[colA, "A"], [colB, "B"]]) {
    P.els.push({ t: "l", x1: cx, y1: yIn, x2: cx, y2: yRect - 24 });
    P.els.push({ t: "t", x: cx - 40, y: yIn + 4, s: `Ввод ${nm} (осн./рез.)`, size: 8 });
    symQF(P, cx, yIn + 22, `QF${nm === "A" ? 1 : 3}`);
    box(P, cx - 80, yRect, 160, 48, `ВЫПРИМИТЕЛЬ-${nm}`, `${R.ups_kVA} кВА · ${s.udc} В DC · η=${f(s.chgEff * 100, 0)} %`);
    P.els.push({ t: "l", x1: cx, y1: yRect + 48, x2: cx, y2: yDC });
    const bx = cx - 105;                       // линия АКБ левее колонки
    P.els.push({ t: "l", x1: bx, y1: yDC, x2: bx, y2: yBat - 84 });
    symSA(P, bx, yBat - 72, `SA-${nm}`);
    symQF(P, bx, yBat - 36, `QF${nm === "A" ? 5 : 7}`);
    P.els.push({ t: "l", x1: bx, y1: yBat - 22, x2: bx, y2: yBat + 8 });
    symBat(P, bx, yBat + 8, "");
    P.els.push({ t: "l", x1: bx, y1: yBat + 8, x2: bx, y2: yBat + 22 });
    P.els.push({ t: "l", x1: bx - 7, y1: yBat + 22, x2: bx + 7, y2: yBat + 22, sw: 2 });
    P.els.push({ t: "t", x: bx - 60, y: yBat + 40, s: `GQ${nm}: ${R.NcellsBat}×${R.bat ? R.bat.b.V : 2} В · ${f(R.C_bank || 0, 0)} А·ч · ${f(R.s.tmin, 0)} мин`, size: 7.5 });
    box(P, cx - 75, yInv, 150, 44, `ИНВЕРТОР-${nm}`, `VFI · ${R.ups_kVA} кВА · 230 В ±1 % · 50 Гц`);
    P.els.push({ t: "l", x1: cx, y1: yDC + 8, x2: cx, y2: yInv });
    P.els.push({ t: "l", x1: cx, y1: yInv + 44, x2: cx, y2: yStp - 12 });
    symSTP(P, cx, yStp, `STP-${nm}`);
    P.els.push({ t: "l", x1: cx, y1: yStp + 12, x2: cx, y2: yOut });
  }
  /* шина DC */
  P.els.push({ t: "l", x1: colA - 55, y1: yDC, x2: colB + 55, y2: yDC, sw: 2.4 });
  P.els.push({ t: "t", x: (colA + colB) / 2, y: yDC - 6, s: `Шина постоянного тока ${s.udc} В (звено DC)`, align: "middle", size: 8.5, bold: true });
  /* общий байпас */
  const xBy = 800;
  P.els.push({ t: "t", x: xBy - 30, y: yIn + 4, s: "Резервная линия (байпас)", size: 8 });
  P.els.push({ t: "l", x1: xBy, y1: yIn, x2: xBy, y2: yStp - 12 });
  symQF(P, xBy, yIn + 24, "QF10");
  symSTP(P, xBy, yStp, "STP-байпас");
  P.els.push({ t: "l", x1: colA, y1: yOut, x2: xBy, y2: yOut, sw: 2 });
  box(P, (colA + colB) / 2 - 70, ySh, 150, 34, "ШСН ИБП (ЩС)", `выводы 230 В, ${f(R.I_out, 0)} А/лин.`);
  P.els.push({ t: "l", x1: (colA + colB) / 2, y1: yOut, x2: (colA + colB) / 2, y2: ySh });
  P.els.push({ t: "l", x1: xBy, y1: yStp + 12, x2: xBy, y2: yOut });
  P.els.push({ t: "t", x: 60, y: yOut - 6, s: "Шина 230 В ±1 %", size: 8.5, bold: true });
  /* цепи управления */
  P.els.push({ t: "l", x1: 60, y1: 566, x2: 60, y2: ySh + 17, dash: "4 3", color: "#7a3fd8" });
  P.els.push({ t: "l", x1: 60, y1: 566, x2: 920, y2: 566, dash: "4 3", color: "#7a3fd8" });
  P.els.push({ t: "t", x: 64, y: 559, s: "Цепи управления и сигнализации (сухие контакты, RS-485/Modbus, IEEE 519 THD в допуске)", size: 8, color: "#7a3fd8" });
  box(P, 840, ySh, 120, 34, "Потребители", "фидеры Ф1…Фn");
  P.els.push({ t: "l", x1: (colA + colB) / 2 + 70, y1: ySh + 17, x2: 840, y2: ySh + 17 });
  return P;
}
function schemeDC(R) {
  const P = { W: 980, H: 500, els: [] };
  const s = R.s;
  P.els.push({ t: "t", x: 20, y: 20, s: `Схема структурная ИБП постоянного тока 2×100 % — ${s.proj}`, size: 12, bold: true });
  P.els.push({ t: "t", x: 20, y: 34, s: `${s.udc} В DC ±10 %, плавающая шина (ITU/float), контроль изоляции (ТУ п.5.2). По ГОСТ 2.701-2008, ГОСТ 2.702-2011.`, size: 8 });
  const yIn = 60, yR = 100, yB = 200, ySh = 300, yL = 380;
  for (const [cx, nm] of [[260, "A"], [680, "B"]]) {
    P.els.push({ t: "l", x1: cx, y1: yIn, x2: cx, y2: yR - 26 });
    P.els.push({ t: "t", x: cx - 52, y: yIn + 2, s: `Ввод ${nm}: 3~/380 В (или 1~/220 В)`, size: 8 });
    symQF(P, cx, yIn + 22, `QF${nm === "A" ? 1 : 2}`);
    box(P, cx - 70, yR - 22, 140, 44, `ВЫПРЯМИТЕЛЬ/ЗУ-${nm}`, `${f(R.I_chg, 0)} А · ${s.udc} В · ${R.ups_kVA || f(s.P, 0)} кВт`);
    P.els.push({ t: "l", x1: cx, y1: yR + 22, x2: cx, y2: yB - 40 });
    symQF(P, cx, yB - 22, `QF${nm === "A" ? 3 : 4}`);
    P.els.push({ t: "l", x1: cx, y1: yB, x2: cx, y2: yB + 6 });
    symSA(P, cx + 90, yB + 60, `SA${nm}`);
    P.els.push({ t: "l", x1: cx, y1: yB + 6, x2: cx + 90, y2: yB + 6 });
    symBat(P, cx + 90, yB + 100, `GQ${nm}: АКБ ${R.NcellsBat} эл · ${f(R.C_bank || 0, 0)} А·ч`);
    P.els.push({ t: "l", x1: cx + 90, y1: yB + 114, x2: cx + 90, y2: yB + 130 });
    box(P, cx - 60, ySh, 120, 30, `ШПН-${nm}`, `${s.udc} В`);
    P.els.push({ t: "l", x1: cx, y1: yB + 6, x2: cx, y2: ySh });
  }
  P.els.push({ t: "l", x1: 260, y1: yB - 46, x2: 680, y2: yB - 46, dash: "6 3", color: "#b26a00" });
  P.els.push({ t: "t", x: 470, y: yB - 52, s: "сегрегация систем: разные шкафы/стеллажи (ТУ п.5.2)", align: "middle", size: 7.5, color: "#b26a00" });
  /* нагрузки с двух секций */
  box(P, 300, yL, 180, 34, "Потребители ПС (двухлучевые)", "панели с питанием от ШПН-A и ШПН-B");
  box(P, 620, yL - 48, 218, 44, "Контроль изоляции (ИМ) + ОВП", `${s.udc} В, плавающая шина`);
  P.els.push({ t: "l", x1: 260, y1: ySh + 30, x2: 260, y2: yL + 17 });
  P.els.push({ t: "l", x1: 260, y1: yL + 17, x2: 300, y2: yL + 17 });
  P.els.push({ t: "l", x1: 680, y1: ySh + 30, x2: 680, y2: yL + 17 });
  P.els.push({ t: "l", x1: 680, y1: yL + 17, x2: 480, y2: yL + 17 });
  return P;
}
function currentScheme(R) { return R.s.type === "ac" ? schemeAC(R) : schemeDC(R); }

/* SECTION: checks-spec-method */
function renderChecks(R) {
  const s = R.s, isAC = s.type === "ac", b = R.bat, Y = YAMAL_REQS;
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
    [`Срок службы АКБ ≥ ${Y.lifeYears} лет (проект Ямал СПГ)`, "ТУ п.5.1.1", b ? `${f(b.b.life, 0)} лет` : "—", b ? b.b.life >= Y.lifeYears : false],
    ["Компенсация старения 20 % и температурные поправки учтены", "ТУ п.5.6.1.32", `K стар = ${f(R.Kaging)}, K T° = ${f(R.Ktemp, 3)}`, true],
    ["Конечное напряжение разрядки не ниже паспортного", "ТУ п.5.6.1.32", `${f(s.uend)} В/эл`, s.uend >= 1.70],
    ["Степень защиты оболочек не ниже IP42", "ТУ п.5.4.1.5", s.ip, ipNum >= Y.ip],
    ["Температура в помещении АКБ 20…25 °C (проектное)", "ТУ / пояснительная записка", `${f(s.temp, 0)} °C`, s.temp >= Y.tempOk[0] && s.temp <= Y.tempOk[1]],
    ["Время автономии выдержано", "Исходные данные", `≈ ${f(R.t_real || 0, 0)} мин ≥ ${f(s.tmin, 0)} мин`, (R.t_real || 0) >= s.tmin - 0.5],
    ["Нагрузка на пол не выше допуска помещения", "ГОСТ Р МЭК 62485-2, СП", R.rackPlan ? `${f(R.rackPlan.floor, 0)} ≤ ${f(s.floor, 0)} кг/м²` : "—", R.rackPlan ? R.rackPlan.floor <= s.floor : false],
    ["Стеллажи рассчитаны на сейсмичность площадки", "ТУ п.5.4.1.22", `${f(s.seismic, 0)} баллов`, s.seismic <= 7],
    ["Соответствие IEC 62040 / IEC 60146, ЭМС IEC 61000, THD по IEEE 519", "ТУ п.5.2, п.5.4", "декларируется поставщиком", null],
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
  const s = R.s, b = R.bat, isAC = s.type === "ac", Y = YAMAL_REQS;
  const rp = R.rackPlan;
  const spec = [];
  let n = 0;
  const push = (...t) => spec.push([++n, ...t]);
  if (isAC) push("Источник бесперебойного питания двойного преобразования (VFI-AC/AC)",
    `${R.ups_kVA} кВА; вход 3~/380 В, cos φ сети ≥ 0,85, THD по IEEE 519 в допуске; выход 230 В ±1 %, 50 Гц ±1 Гц; статический байпас; η ≥ 92 %; IP не ниже ${Y.ip}; IEC 62040/60146; работа в составе 2×100 %`,
    R.nsys, "шт.", `запас ${f((R.ups_kVA / R.S_base - 1) * 100, 0)} % (ТУ ≥10 %)`);
  else push("Шкаф ИБП постоянного тока (выпрямитель/зарядное + ШПН)",
    `${R.ups_kVA || f(s.P, 0)} кВт; вход 3~/380 В; выход ${s.udc} В DC ±10 %, плавающая шина, ограничение тока по заданию заряда АКБ; η ≥ 90 %; ток ${f(R.I_chg, 0)} А; IP не ниже ${Y.ip}`,
    R.nsys, "шт.", "системы A/B — в раздельных шкафах (ТУ п.5.2)");
  if (b) {
    const perSys = b.b.cells6 ? `${b.Nser} блока×12 В (${b.Nser * 6} эл.)` : `${b.Nser} моноблока×2 В`;
    push("Батарея аккумуляторная свинцово-кислотная VRLA (GQ)",
      `${perSys} на цепочку; ${b.n} цеп. параллельно; ${f(b.b.Ah, 0)} А·ч (C10); срок службы ≥ 25 лет в буферном режиме; IEC 60896 / ГОСТ Р МЭК 60896-21; клеммы под пластинчатые наконечники`,
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
  <p><b>Схема:</b> УГО и связи по ГОСТ 2.701-2008 / 2.702-2011; структура — аналоглиста ИБП проекта Ямал (3110-G-745-EL-SLD-00102-01-D_07C).</p>
  <p><b>Нормативная база:</b> ПУЭ 7-е изд.; ГОСТ Р МЭК 60896-21-2013; ГОСТ Р МЭК 62485-2-2011; IEC 62040; IEC 60146; IEC 61000; IEEE 519; ТУ 3300-E-000-EL-SPE-00021-00-D_02U. Все коэффициенты вынесены в ibp-data.js и подлежат сверке с паспортами конкретных изделий.</p>`;
}

/* SECTION: export */
function dl(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function txtNote(R) {
  const s = R.s, b = R.bat, rp = R.rackPlan;
  const L = [];
  L.push(`РАСЧЁТНАЯ ЗАПИСКА — выбор системы ИБП (${s.proj})`);
  L.push(`Основание: ТУ 3300-E-000-EL-SPE-00021-00-D_02U (Ямал СПГ); ГОСТ Р МЭК 60896-21-2013; ГОСТ Р МЭК 62485-2-2011; ПУЭ 7-е изд.`);
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
function prims2dxf(P) {
  const H = P.H;
  let s = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;
  const y = v => (H - v).toFixed(2);
  for (const e of P.els) {
    if (e.t === "l") s += `0\nLINE\n8\n0\n10\n${e.x1.toFixed(2)}\n20\n${y(e.y1)}\n30\n0\n11\n${e.x2.toFixed(2)}\n21\n${y(e.y2)}\n31\n0\n`;
    else if (e.t === "r") { const c = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]];
      for (let i = 0; i < 4; i++) { const a = c[i], b2 = c[(i + 1) % 4]; s += `0\nLINE\n8\n0\n10\n${a[0].toFixed(2)}\n20\n${y(a[1])}\n30\n0\n11\n${b2[0].toFixed(2)}\n21\n${y(b2[1])}\n31\n0\n`; } }
    else if (e.t === "c") { const pts = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * 2 * Math.PI; pts.push([e.x + e.r * Math.cos(a), e.y + e.r * Math.sin(a)]); }
      for (let i = 0; i < pts.length - 1; i++) { s += `0\nLINE\n8\n0\n10\n${pts[i][0].toFixed(2)}\n20\n${y(pts[i][1])}\n30\n0\n11\n${pts[i + 1][0].toFixed(2)}\n21\n${y(pts[i + 1][1])}\n31\n0\n`; } }
    else if (e.t === "p") { const q = e.pts; for (let i = 0; i < q.length; i++) { const a = q[i], b2 = q[(i + 1) % q.length]; s += `0\nLINE\n8\n0\n10\n${a[0].toFixed(2)}\n20\n${y(a[1])}\n30\n0\n11\n${b2[0].toFixed(2)}\n21\n${y(b2[1])}\n31\n0\n`; } }
    else if (e.t === "t") s += `0\nTEXT\n8\n0\n10\n${e.x.toFixed(2)}\n20\n${y(e.y)}\n30\n0\n40\n${((e.size || 9) * 1.1).toFixed(2)}\n1\n${(e.s || "").replace(/[\r\n]/g, " ")}\n`;
  }
  return s + `0\nENDSEC\n0\nEOF\n`;
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
    const demo = { "p-type": "dc", "proj-name": "Ямал-оперативный-DC", "p-kw": "10", "u-dc": "110", "t-min": "60", "t-temp": "25",
      "u-end": "1.75", "red": "2x100", "bat-mode": "auto", "ip-uc": "IP42", "chg-eff": "93", "seismic": "8", "room-l": "12", "room-w": "6", "floor-load": "1500", "cable-len": "10" };
    IDS.forEach(id => { if (demo[id] !== undefined) $(id).value = demo[id]; });
    syncDeps(); run();
  };
  const last = localStorage.getItem("ibp-last");
  if (last) { try { const d = JSON.parse(last); IDS.forEach(id => { if (d[id] !== undefined) $(id).value = d[id]; }); } catch (e) {} }
  run();
}
document.addEventListener("DOMContentLoaded", boot);
