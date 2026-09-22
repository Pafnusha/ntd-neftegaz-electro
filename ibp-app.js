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
let GRP = [
  { name: "Освещение аварийное", p: 2, t: 120 },
  { name: "КИП и АСУ ТП (шкаф)", p: 1.5, t: 60 },
  { name: "Приводы отключения", p: 6, t: 30 }
];
try { const g0 = localStorage.getItem("ibp-grps"); if (g0) GRP = JSON.parse(g0); } catch (e) {}
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
    seismic: num("seismic"), cableLen: num("cable-len"),
    grpOn: $("grp-on") ? $("grp-on").checked : false,
    grps: GRP.map(g => ({ name: g.name, p: +g.p || 0, t: +g.t || 0 }))
  };
  return s;
}
function validate(s) {
  const e = [];
  if (s.P <= 0) e.push("Укажите мощность базовой нагрузки (>0).");
  if (s.tmin <= 0) e.push("Укажите время автономии (>0).");
  if (s.type === "ac") { if (s.cos < 0.5 || s.cos > 1) e.push("cos φ должен быть 0,5…1."); if (s.eff <= 0.5 || s.eff > 1) e.push("КПД инвертора должен быть 50…100%."); }
  if (s.kodn <= 0 || s.kodn > 1) e.push("Коэффициент одновременности — 0…1.");
  if (s.kzap < 1) e.push("Коэффициент запаса должен быть ≥1 (по ТУ ≥1,10).");
  if (uEndRangeErr(s)) e.push("Конечное напряжение 1,6…1,9 В/эл.");
  if (s.batMode === "manual" && (s.batAh <= 0 || s.batV <= 0)) e.push("Для ручного ввода укажите V и А·ч блока АКБ.");
  if (s.roomL <= 2 || s.roomW <= 2) e.push("Габариты помещения — не менее 2×2 м.");
  if (s.grpOn) s.grps.forEach((g, i) => { if (g.p <= 0 || g.t <= 0) e.push(`Группа ${i + 1} «${g.name}»: укажите мощность и время (>0).`); });
  return e;
}
function uEndRangeErr(s) { return s.uend < 1.6 || s.uend > 1.9; }

/* SECTION: calc */
function calc(s) {
  const R = { s };
  /* --- 2.x Мощность ИБП --- */
  const isAC = s.type === "ac";
  R.Uout = isAC ? 230 : s.udc;
  R.Ppeak = s.grpOn ? s.P + s.grps.reduce((a, g) => a + (+g.p || 0), 0) : s.P; // пик мгновенной нагрузки с группами
  R.S_kVA = isAC ? R.Ppeak / s.cos : R.Ppeak;                              // полная мощность нагрузки, кВА/кВт
  R.S_base = R.S_kVA * s.kodn;
  R.S_inst = isAC ? R.S_base * (1 - s.motX + s.motX * s.motK) : R.S_base;
  R.nsys = s.red === "2x100" ? 2 : (s.red === "n1" ? 2 : 1);
  R.S1req = Math.max(R.S_base, R.S_inst) * s.kzap;
  R.ups_kVA = upsOf(R.S1req);
  R.marginEff = R.ups_kVA ? R.ups_kVA / R.S_kVA : null;
  R.I_out = isAC ? R.ups_kVA * 1000 / 230 : R.ups_kVA * 1000 / s.udc;
  R.I_in = isAC ? R.ups_kVA * 1000 * 1.15 / 230 : R.ups_kVA * 1000 * 1.15 / s.udc;

  /* --- 3.x АКБ: ступенчатый график по ГОСТ Р МЭК 60896-21-2013 --- */
  R.warn = [];
  const eff = isAC ? s.eff : 1;
  const list = [{ name: "Базовая (неснимаемая)", p: s.P, t: s.tmin }];
  if (s.grpOn) s.grps.forEach(g => list.push({ name: g.name, p: g.p, t: g.t }));
  R.loadList = list;
  const TK = [...new Set(list.map(x => x.t).filter(x => x > 0))].sort((a, b2) => a - b2);
  const segs = [];
  let t0 = 0;
  for (const tk of TK) {
    const pkW = list.filter(x => x.t >= tk).reduce((a2, x) => a2 + x.p, 0) * s.kodn / eff;
    if (tk > t0) segs.push({ t0, t1: tk, dt: tk - t0, pkW });
    t0 = tk;
  }
  R.Tend = TK.length ? TK[TK.length - 1] : s.tmin;
  R.checkPts = TK; R.segs = segs;
  R.NcellsMin = isAC ? NaN : Math.ceil(s.udc * 0.9 / s.uend);
  let N = isAC ? Math.ceil(s.udc / 2) : Math.max(Math.ceil(s.udc / 2), R.NcellsMin);
  R.Ncells = N;
  R.I_max = segs.length ? segs[0].pkW * 1000 / (N * s.uend) : 0;
  const segEnd = segs.length ? segs[segs.length - 1].t1 : 0;
  const tailP = segs.length ? segs[segs.length - 1].pkW : 0;
  const cumAt = (T) => { // отданные А·ч к моменту T (после последней ступени — последней мощностью)
    let ahc = 0;
    for (const sg of segs) { if (T <= sg.t0) break; const dt = Math.min(T, sg.t1) - sg.t0; ahc += sg.pkW * 1000 / (N * s.uend) * dt / 60; }
    if (T > segEnd) ahc += tailP * 1000 / (N * s.uend) * (T - segEnd) / 60;
    return ahc;
  };
  R.C_req = 0; let critT = s.tmin;
  for (const tp of R.checkPts) { const c = cumAt(tp) / ktOf(tp, s.uend); if (c > R.C_req) { R.C_req = c; critT = tp; } }
  if (!isFinite(R.C_req) || R.C_req <= 0) { R.C_req = R.I_max * (s.tmin / 60) / ktOf(s.tmin, s.uend); critT = s.tmin; }
  R.Kt = ktOf(critT, s.uend); R.critT = critT; R.cumAt = cumAt;
  R.PbatW = segs.length ? segs[0].pkW * 1000 : 0;
  const alpha = ALPHA_TEMP[critT <= 120 ? "short" : "long"];
  R.alpha = alpha; R.Ktemp = 1 + alpha * (s.temp - 20);
  R.Kaging = TU_REQS.agingK;
  R.C_corr = R.C_req / R.Ktemp * R.Kaging;

  /* выбор/учёт батареи */
  let bat;
  if (s.batMode === "auto") {
    let best = null;
    for (const b2 of BATTERIES) {
      const cand = evalBattery(b2, R);
      if (!cand) continue;
      const score = (cand.b.life >= TU_REQS.lifeYears ? 0 : 1e6) + cand.util;
      if (!best || score < best.score) best = { ...cand, score };
    }
    bat = best || null;
  } else {
    const b2 = { id: "manual", name: "АКБ (ручной ввод)", V: s.batV || 12, Ah: s.batAh || 100,
      cells6: (s.batV || 12) >= 12, mass: +(0.28 * (s.batAh || 100) * (s.batV || 12) / 12).toFixed(1),
      L: 513, W: 240, H: 225, life: s.batLife, vrla: true, note: "параметры — оценка пользователя" };
    bat = evalBattery(b2, R);
  }
  R.bat = bat;
  if (bat) {
    R.NcellsBat = bat.NcellsBat;
    R.C_bank = bat.n * bat.b.Ah;
    R.t_real = realAutonomy(R, bat);
    R.cellsTotal = R.NcellsBat * bat.n * R.nsys;
    R.massCell = bat.b.cells6 ? bat.b.mass / 6 : bat.b.mass;
    R.massBatt = R.cellsTotal * R.massCell;
    if (!isAC && bat.b.cells6 && R.NcellsBat > 0 && R.NcellsBat * 2 > s.udc * 1.12)
      R.warn.push(`Для сети ${s.udc} В нежелательны 12-В блоки: ${R.NcellsBat / 6}×12 В = ${R.NcellsBat / 6 * 12} В вне допуска ±10 %. Рекомендуем 2-В моноблоки (см. базу).`);
    if (R.t_real < R.Tend - 0.5) R.warn.push(`Фактическая предельная автономия ${f(R.t_real, 0)} мин < требуемой ${f(R.Tend, 0)} мин — увеличьте ёмкость АКБ.`);
    if (s.grpOn) {
      const miss = R.loadList.filter(g => R.t_real < g.t - 0.5).map(g => `${g.name} (${f(g.t, 0)} мин)`);
      if (miss.length) R.warn.push("Время автономии НЕ выдержано группами: " + miss.join(", "));
      else R.warn.push("Все группы нагрузок по времени автономии обеспечены ✓");
    }
  } else R.warn.push("АКБ не подобрана: увеличьте базу или введите параметры вручную.");

  /* --- 4.x Стеллажи и нагрузка на пол --- */
  R.rackPlan = bat ? pickRack(R, bat, s) : null;

  /* --- зарядное устройство, кабели, автоматы --- */
  R.C_total = bat ? R.C_bank * R.nsys : 0;
  R.I_chg = R.PbatW / s.udc / s.chgEff + (R.C_bank || 0) / 10;
  R.qf_chg = breakerOf(R.I_chg * 1.25);
  R.s_bat_cable = Math.max(cableOf(R.I_max * 1.25).s, sminForDU(R.I_max, s));
  R.qf_bat = breakerOf(R.I_max * 1.25);
  R.s_in_cable = cableOf(R.I_in * 1.25).s;
  R.qf_in = breakerOf(R.I_in * 1.25);
  return R;
}
function sminForDU(I, s) { const need = 2 * 0.0175 * s.cableLen * I / (0.02 * s.udc); return cableOf(need).s; }
function evalBattery(b, R) {
  if (!b || b.V <= 0 || b.Ah <= 0) return null;
  const Nser = b.cells6 ? Math.ceil(R.Ncells / 6) : R.Ncells;
  const NcellsBat = b.cells6 ? Nser * 6 : Nser;
  const n = Math.max(1, Math.ceil(R.C_corr / b.Ah));
  const util = (n * b.Ah) / R.C_corr;
  return { b, n, util, Nser, NcellsBat };
}
function realAutonomy(R, bat) {
  const Ccap = bat.n * bat.b.Ah * R.Ktemp / R.Kaging;
  const reqAt = (T) => (R.cumAt ? R.cumAt(T) : R.I_max * (T / 60)) / ktOf(T, R.s.uend);
  let lo = 1, hi = 5760;
  for (let i = 0; i < 42; i++) { const mid = (lo + hi) / 2; if (reqAt(mid) <= Ccap) lo = mid; else hi = mid; }
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
    metric("Автономия предельная", "≥ " + f(R.Tend, 0) + " мин · факт. ≈ " + f(R.t_real, 0) + " мин", R.t_real >= R.Tend - 0.5 ? "good" : "bad") +
    metric("Элементов всего", f(R.cellsTotal, 0) + " шт", "") : "";
  let cum = 0;
  const rows = (R.segs || []).map((g, i) => {
    cum += g.pkW * 1000 / (R.Ncells * s.uend) * g.dt / 60;
    const kt = ktOf(g.t1, s.uend);
    return `<tr><td>${i + 1}</td><td>${g.t0}…${g.t1}</td><td>${f(g.pkW, 1)}</td><td>${f(g.pkW * 1000 / (R.Ncells * s.uend), 0)}</td>
      <td>${f(cum, 1)}</td><td>${f(kt, 2)}</td><td><b>${f(cum / kt, 0)}</b></td><td class="note">${R.loadList.filter(x => x.t >= g.t1).map(x => x.name).join("; ")}</td></tr>`;
  }).join("");
  const grpVerdict = (R.loadList || []).map(g => `<li>${g.name} — ${f(g.p, 1)} кВт · ${f(g.t, 0)} мин — <b class="${(R.t_real || 0) >= g.t - 0.5 ? "ok" : "bad"}">${(R.t_real || 0) >= g.t - 0.5 ? "✓ обеспечено" : "✗ НЕ обеспечено"}</b></li>`).join("");
  const fml = [
    `N эл. = ⌈U шины / 2 В⌉${s.type === "dc" ? ` (и ≥ 0,9·Uном/U кон = ${f(R.NcellsMin, 0)} по ТУ)` : ""} = ${R.Ncells} эл.`,
    `Ступенчатый график (критическая точка — максимум приведённой ёмкости, t = ${f(R.critT, 0)} мин):` +
    `<table><tr><th>№</th><th>интервал, мин</th><th>P на АКБ, кВт</th><th>I, А</th><th>Σ А·ч</th><th>K t(t)</th><th>C треб., А·ч</th><th>В работе</th></tr>${rows}</table>`,
    `C треб. = max Σ(I·Δt)/K t = ${f(R.C_req, 0)} А·ч (K t — по разрядной характеристике ГОСТ Р МЭК 60896-21 при U кон = ${f(s.uend)} В/эл.)`,
    `K T° = 1 + α·(T − 20 °C) = ${f(R.Ktemp, 3)} (α = ${f(R.alpha, 3)} 1/°C, ${R.critT <= 120 ? "t ≤ 2 ч" : "t > 2 ч"}); K старения = ${f(R.Kaging, 2)} (20 % по ТУ п.5.6.1.32)`,
    `C расч. = C треб. / K T° · K стар = ${f(R.C_corr, 0)} А·ч на ОДНУ систему`,
    b ? `Принято: ${b.b.name.trim()} — ${b.Nser} шт. последовательно (${b.NcellsBat} эл.), ${b.n} цеп. параллельно → ${f(R.C_bank, 0)} А·ч/система; предельная автономия ≈ ${f(R.t_real, 0)} мин:<ul style="margin:.2rem 0 .2rem 1.2rem">${grpVerdict}</ul>` : "АКБ не подобрана",
    `Кабель АКБ→ИБP: I расч = 1,25·I макс = ${f(R.I_max * 1.25, 0)} А → ${R.s_bat_cable} мм² (медь, ПУЭ табл. 1.3.6 и ΔU ≤ 2 % при L = ${f(s.cableLen, 0)} м); QF батареи = ${R.qf_bat} А`,
    `Выпрямитель/зарядное: I = P макс/(U·η) + C 10-ч = ${f(R.I_chg, 1)} А → номинал ${R.qf_chg} А, КПД ${f(s.chgEff * 100, 0)} % (ТУ ≥ 90 %)`
  ].map(x => x.startsWith("<table>") ? x : `<div class="f">${x}</div>`).join("");
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
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 15, y: y + 12 + i * 8, s: ln, size: 6.5, color: "#33465e" }));
}
function symSA(P, x, y, pos, inf) { // разъединитель: ножевой контакт, видимый разрыв (ГОСТ 2.710)
  P.els.push({ t: "l", x1: x, y1: y + 11, x2: x, y2: y + 4, sw: 1.6 });
  P.els.push({ t: "l", x1: x - 4, y1: y + 4, x2: x + 4, y2: y - 8, sw: 1.8 });
  P.els.push({ t: "c", x: x - 4, y: y + 5, r: 1.5 });
  P.els.push({ t: "t", x: x + 12, y: y - 8, s: pos, size: 7.5, bold: true });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 12, y: y + 1 + i * 8, s: ln, size: 6.5, color: "#33465e" }));
}
function symBat(P, x, y, pos, inf) { // аккумуляторная батарея: цепочка элементов (ГОСТ 2.722)
  P.els.push({ t: "l", x1: x, y1: y - 34, x2: x, y2: y - 26, sw: 1.4 });
  for (let i = 0; i < 2; i++) {
    P.els.push({ t: "l", x1: x - 9, y1: y - 22 + i * 8, x2: x + 9, y2: y - 22 + i * 8, sw: 2 });
    P.els.push({ t: "l", x1: x - 3.5, y1: y - 18 + i * 8, x2: x + 3.5, y2: y - 18 + i * 8, sw: 1.4 });
  }
  P.els.push({ t: "l", x1: x - 6, y1: y + 5, x2: x + 6, y2: y + 5, sw: 1.8 });
  P.els.push({ t: "l", x1: x - 4, y1: y + 9, x2: x + 4, y2: y + 9, sw: 1.4 });
  P.els.push({ t: "l", x1: x, y1: y + 5, x2: x, y2: y - 2 });
  P.els.push({ t: "t", x: x - 14, y: y - 24, s: "+", size: 8 });
  P.els.push({ t: "t", x: x - 14, y: y + 8, s: "\u2212", size: 8 });
  P.els.push({ t: "t", x: x - 22, y: y - 34, s: pos, size: 8, bold: true, align: "end" });
  const ls = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  ls.forEach((ln, i) => P.els.push({ t: "t", x: x + 25, y: y - 30 + i * 9, s: ln, size: 6.5, color: "#33465e" }));
}
function symSTP(P, x, y, pos, inf) { // статический переключатель: встречно-параллельные тиристоры (ГОСТ 2.747)
  P.els.push({ t: "l", x1: x, y1: y - 15, x2: x, y2: y - 8, sw: 1.4 });
  P.els.push({ t: "l", x1: x, y1: y + 15, x2: x, y2: y + 8, sw: 1.4 });
  P.els.push({ t: "p", pts: [[x - 6, y + 5], [x + 6, y + 5], [x, y - 4]] });
  P.els.push({ t: "l", x1: x - 6, y1: y - 4, x2: x + 6, y2: y - 4, sw: 1.3 });
  P.els.push({ t: "p", pts: [[x - 6, y - 5], [x + 6, y - 5], [x, y + 4]] });
  P.els.push({ t: "l", x1: x - 6, y1: y + 4, x2: x + 6, y2: y + 4, sw: 1.3 });
  P.els.push({ t: "t", x: x + 40, y: y - 8, s: pos, size: 7.5, bold: true, color: "#7a3fd8" });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 40, y: y + i * 8, s: ln, size: 6.5, color: "#7a3fd8" }));
}
function symConv(P, x, y, w, h, kind, pos, inf) { // преобразователь (ГОСТ 2.747/2.721)
  P.els.push({ t: "r", x: x - w / 2, y: y - h / 2, w, h, fill: "#f6faff", stroke: "#223344", sw: 1.4 });
  const a = kind === "rec" ? ["~", "\u2393"] : ["\u2393", "~"]; // вход/выход
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
function wEst(str, size) { return String(str).length * (size || 7) * 0.56; }
function schemeAC(R) {
  const s = R.s, n = R.nsys, isRed = n > 1;
  const b = R.bat;
  const vcInfo = [`3~/380 В —> ${s.udc} В DC, I зy ${f(R.I_chg, 0)} А`, `вых. 230 В ±1 %, 50 Гц ±1 Гц, S ${R.ups_kVA || "—"} кВА`],
    gbInfo = [`${R.NcellsBat}×${b ? b.b.V : 2} В · ${f(R.C_bank || 0, 0)} А·ч (C10)`,
      `I разр ${f(R.I_max, 0)} А · U кон ${f(s.uend)} В/эл`,
      `t ступ.: ${R.loadList.map(g => `${f(g.p, 1)} кВт/${f(g.t, 0)} мин`).join(", ")}`];
  const infoW = Math.max(wEst(vcInfo[0], 6.5), wEst(vcInfo[1], 6.5), wEst(gbInfo[2], 6.5), wEst(`S ${R.ups_kVA || "—"} кВА · I вых ${f(R.I_out, 0)} А`, 6.5));
  const colStep = Math.max(360, infoW + 200);
  const x0 = 210, yDC = 208, yOut = isRed ? 402 : 402;
  const xE = x0 + (n - 1) * colStep;
  const xBy = xE + colStep * 0.78;
  const shnX = (x0 + (isRed ? xBy : xE + 60)) / 2 - 95;
  const loads = R.loadList, loadBoxW = Math.max(270, 24 + Math.max(...loads.map(g => wEst(`Ф${g.name} · ${g.p} кВт · ${g.t} мин`, 6.8))));
  const P = { W: Math.max(1060, xBy + (isRed ? 240 : 200), shnX + 120 + loadBoxW + 60), H: 500 + loads.length * 13 + 90, els: [] };
  P.els.push({ t: "t", x: 20, y: 22, s: `Схема электрическая структурная. ИБП переменного тока${isRed ? " 2×100 %" : ""} — ${s.proj}`, size: 11.5, bold: true });
  P.els.push({ t: "t", x: 20, y: 38, s: `ГОСТ 2.702-2011/2.701-2008; УГО — ГОСТ 2.7х ЕСКД. Класс VFI·SS·1·PF1 (ГОСТ IEC 62040-3-2024). Резервирование: ${isRed ? "2 системы × 100 %, байпас общий" : "1 система (без резерва)"}.`, size: 8 });
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * colStep, nm = "AB"[i] || String(i + 1);
    P.els.push({ t: "t", x: cx, y: 58, s: `Ввод ${nm}: 3~/380 В, I вх ${f(R.I_in, 0)} А`, size: 8, align: "middle" });
    wire(P, [[cx, 64], [cx, 79]]); symQF(P, cx, 92, `QF${i * 2 + 1}`, `${R.qf_in} А`);
    wire(P, [[cx, 106], [cx, 128]]);
    symConv(P, cx, 150, 130, 44, "rec", `VC-${nm}`, vcInfo);
    wire(P, [[cx, 172], [cx, yDC]]);
    wire(P, [[cx, yDC], [cx, 240]]);
    symConv(P, cx, 262, 130, 44, "inv", `NC-${nm}`, [`I вых ${f(R.I_out, 0)} А · η ≥ 92 %`, `косв. нагрузка ${f(s.P, 1)} кВт cos φ ${f(s.cos)}`]);
    wire(P, [[cx, 284], [cx, 330]]);
    symSTP(P, cx, 344, `SF-${nm}`, `I ном ${f(R.I_out, 0)} А`);
    wire(P, [[cx, 358], [cx, yOut]]);
    const bx = cx - 150;
    wire(P, [[bx, yDC], [bx, 226]]);
    symQF(P, bx, 240, `QF-${nm}`, [`${R.qf_bat} А`, `I расч ${f(R.I_max * 1.25, 0)} А`]);
    wire(P, [[bx, 254], [bx, 276]]);
    symSA(P, bx, 288, `SA-${nm}`, `${R.qf_bat} А`);
    wire(P, [[bx, 294], [bx, 318]]);
    symBat(P, bx, 352, `GB-${nm}`, gbInfo);
  }
  for (let i = 0; i < n; i++) { P.els.push({ t: "n", x: x0 + i * colStep, y: yDC }, { t: "n", x: x0 + i * colStep - 150, y: yDC }); }
  P.els.push({ t: "l", x1: x0 - 150, y1: yDC, x2: xE + 20, y2: yDC, sw: 2.6 });
  P.els.push({ t: "t", x: (x0 + xE) / 2 - 65, y: yDC - 8, s: "Шина постоянного тока (звено DC)", size: 8.5, bold: true, align: "middle" });
  const shnEnd = isRed ? xBy : (xE + 20);
  if (isRed) {
    P.els.push({ t: "t", x: xBy - 12, y: 58, s: "Резервная (байпасная) линия 3~/380 В", size: 8, align: "middle" });
    wire(P, [[xBy, 64], [xBy, 92]]);
    symQF(P, xBy, 106, "QF9", `${R.qf_in} А`);
    wire(P, [[xBy, 120], [xBy, 330]]);
    symSTP(P, xBy, 344, "SF9", `I ном ${f(R.I_out, 0)} А`);
    wire(P, [[xBy, 358], [xBy, yOut]]);
    P.els.push({ t: "n", x: xBy, y: yOut });
  }
  P.els.push({ t: "l", x1: x0, y1: yOut, x2: shnEnd, y2: yOut, sw: 2.6 });
  for (let i = 0; i < n; i++) P.els.push({ t: "n", x: x0 + i * colStep, y: yOut });
  P.els.push({ t: "t", x: Math.min(xE + 90, shnEnd - 40), y: yOut - 7, s: "Шина 230 В ±1 %, 50 Гц ±1 Гц — плавающая нейтраль (ТУ п.5.2)", size: 8.5, align: "middle", bold: true });
  box(P, shnX, 430, 210, 42, "ШСН (ЩС) — щит собств. нужд", `вводной QF ${R.qf_in} А · I ном ${f(R.I_out, 0)} А`);
  wire(P, [[shnX + 100, yOut], [shnX + 100, 430]]);
  P.els.push({ t: "n", x: shnX + 100, y: yOut });
  /* фидеры нагрузок с разным временем автономии */
  const ly = 502;
  box(P, shnX + 230, ly - 30, loadBoxW, 26 + loads.length * 13, "Фидеры ИБП (группы нагрузки)", null);
  wire(P, [[shnX + 210, 451], [shnX + 230, 451], [shnX + 230, ly - 4]], 1.2);
  loads.forEach((g, j) => P.els.push({ t: "t", x: shnX + 240, y: ly + 16 + j * 13, s: `Ф${j + 1} — ${g.name} — ${f(g.p, 1)} кВт — t = ${f(g.t, 0)} мин`, size: 6.8 }));
  P.els.push({ t: "l", x1: 90, y1: P.H - 34, x2: P.W - 40, y2: P.H - 34, dash: "5 3", color: "#7a3fd8", sw: 1.1 });
  P.els.push({ t: "t", x: 94, y: P.H - 41, s: "Цепи управления и сигнализации: RS-485/Modbus RTU, «сухие контакты», контроль изоляции, датчики T° (компенсация заряда), ОПС", size: 7.5, color: "#7a3fd8" });
  P.els.push({ t: "t", x: 20, y: P.H - 12, s: "QF — автоматический выключатель (ГОСТ 2.710/2.755); SA — разъединитель; GB — батарея (ГОСТ 2.722); VC/NC — выпрямитель/инвертор (ГОСТ 2.747); SF — статический переключатель. Параметры — из разделов 2–4.", size: 7, color: "#5a6a7e" });
  return P;
}
function schemeDC(R) {
  const s = R.s, n = R.nsys, b = R.bat;
  const avrInfo = [`3~/380 В —> ${s.udc} В ±10 %, ${R.ups_kVA || f(s.P, 0)} кВт`, `I ${f(R.I_chg, 0)} А · η ${f(s.chgEff * 100, 0)} % · 2×100 %`];
  const gbInfo = [`${R.NcellsBat}×2 В · ${f(R.C_bank || 0, 0)} А·ч · VRLA`,
    `I разр ${f(R.I_max, 0)} А · U кон ${f(s.uend)} В`,
    `t ступ.: ${R.loadList.map(g => `${f(g.p, 1)} кВт/${f(g.t, 0)} мин`).join("; ")}`];
  const infoW = Math.max(wEst(avrInfo[0], 6.5), wEst(gbInfo[2], 6.5));
  const colStep = Math.max(360, infoW + 230);
  const x0 = 250, yB = 168;
  const xE = x0 + (n - 1) * colStep;
  const loads = R.loadList, loadBoxW = Math.max(280, 24 + Math.max(...loads.map(g => wEst(`Ф${g.name} · ${g.p} кВт · ${g.t} мин`, 6.8))));
  const P = { W: Math.max(1060, xE + colStep * 0.6 + 240, xE + 240), H: 470 + loads.length * 13 + 100, els: [] };
  P.els.push({ t: "t", x: 20, y: 22, s: `Схема электрическая структурная. ИБП постоянного тока 2×100 % — ${s.proj}`, size: 11.5, bold: true });
  P.els.push({ t: "t", x: 20, y: 38, s: `ГОСТ IEC 62040-5-3-2024 (UPS DC), безопасность — ГОСТ IEC 62040-1-2024, ЭМС — ГОСТ IEC 62040-2. ГОСТ 2.702-2011; УГО — ГОСТ 2.7х ЕСКД. Систем: ${n}.`, size: 8 });
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * colStep, nm = "AB"[i] || String(i + 1);
    P.els.push({ t: "t", x: cx, y: 60, s: `Ввод ${nm}: сеть 3~/380 В`, size: 8, align: "middle" });
    wire(P, [[cx, 66], [cx, 78]]); symQF(P, cx, 92, `QF${i + 1}`, `${R.qf_in} А`);
    wire(P, [[cx, 106], [cx, 128]]);
    symConv(P, cx, 150, 150, 44, "rec", `VC-${nm}`, avrInfo);
    wire(P, [[cx, 172], [cx, yB]]);
    const bx = cx - 120;
    wire(P, [[bx, yB], [bx, 196]]);
    symQF(P, bx, 210, `QF${i + 3}`, [`${R.qf_bat} А`, `I расч ${f(R.I_max * 1.25, 0)} А`]);
    wire(P, [[bx, 224], [bx, 252]]);
    symSA(P, bx, 266, `SA-${nm}`, `${R.qf_bat} А`);
    wire(P, [[bx, 276], [bx, 320]]);
    symBat(P, bx, 356, `GB-${nm}`, gbInfo);
    P.els.push({ t: "n", x: bx, y: yB }, { t: "n", x: cx, y: yB }, { t: "n", x: cx + 88, y: yB });
    /* шпн */
    box(P, cx - 80, 420, 160, 40, `ШПН-${nm} ${s.udc} В`, `QF отх. ≤ ${Math.ceil(R.I_out / 6)} А`);
    wire(P, [[cx + 88, yB], [cx + 88, 400], [cx, 400], [cx, 420]]);
  }
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * colStep;
    P.els.push({ t: "l", x1: cx - 140, y1: yB, x2: cx + 112, y2: yB, sw: 2.6 });
    P.els.push({ t: "t", x: cx - 14, y: yB - 7, s: `Шина DC-${"AB"[i] || i + 1} ${s.udc} В`, size: 8, align: "middle", bold: true });
  }
  if (n > 1) P.els.push({ t: "t", x: 20, y: P.H - 66, s: "Системы A и B разнесены конструктивно: раздельные шкафы, шины и стеллажи (ТУ п.5.2).", size: 7.5, color: "#b26a00" });
  const ly = 500;
  box(P, x0 - 150, ly - 14, loadBoxW, 30 + loads.length * 13, "Фидеры ШПН (группы нагрузки с разным t)", null);
  wire(P, [[x0 - 80, 460], [x0 - 80, ly - 14]], 1.2);
  loads.forEach((g, j) => P.els.push({ t: "t", x: x0 - 140, y: ly + 18 + j * 13, s: `Ф${j + 1} — ${g.name} — ${f(g.p, 1)} кВт — t = ${f(g.t, 0)} мин`, size: 6.8 }));
  box(P, xE - 120, P.H - 210, 210, 40, "Контроль изоляции", `${s.udc} В, плавающая шина`);
  wire(P, [[xE - 15, P.H - 210], [xE - 15, yB]], 1);
  P.els.push({ t: "n", x: xE - 15, y: yB });
  P.els.push({ t: "l", x1: 90, y1: P.H - 34, x2: P.W - 40, y2: P.H - 34, dash: "5 3", color: "#7a3fd8", sw: 1.1 });
  P.els.push({ t: "t", x: 94, y: P.H - 41, s: "Цепи управления и сигнализации: «сухие контакты», RS-485, датчики T° у АКБ (компенсация заряда, ТУ п.5.6.1.32)", size: 7.5, color: "#7a3fd8" });
  P.els.push({ t: "t", x: 20, y: P.H - 12, s: "VC — выпрямитель/зарядное; GB — батарея (ГОСТ 2.722); QF — автомат; SA — разъединитель; ШПН — щит постоянного напряжения. Параметры — из расчёта.", size: 7, color: "#5a6a7e" });
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
    [(s.grpOn ? "Ступенчатый график автономии выдержан (все группы)" : "Время автономии выдержано"), "Исходные данные, ГОСТ Р МЭК 60896-21",
      `предельно ≈ ${f(R.t_real || 0, 0)} мин ≥ требуемого ${f(R.Tend || s.tmin, 0)} мин`, (R.t_real || 0) >= (R.Tend || s.tmin) - 0.5],
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
  <p><b>Ступенчатый график (группы с разным временем):</b> по каждой границе T считаем отданные А·ч ∑I·Δt и приводим к C10 делением на K<sub>t</sub>(T); требуемая ёмкость — максимум по всем T. После отключения всех ступеней расчёт продолжается последней ступенью (фактическое «время до отключения»).</p>
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
  L.push("", "3. РАСЧЁТ АКБ (ГОСТ Р МЭК 60896-21)" + (s.grpOn ? " — ступенчатый график" : ""));
  if (s.grpOn && R.segs) { L.push("  Ступенчатый график (P на шинах АКБ):"); R.segs.forEach((g2, i2) => L.push(`    Ступень ${i2 + 1}: ${g2.t0}…${g2.t1} мин — ${f(g2.pkW, 1)} кВт`)); }
  L.push(`  N = ${R.Ncells} эл; I макс = ${f(R.I_max, 1)} А; K t = ${f(R.Kt)}; C треб = ${f(R.C_req, 0)} Ач; K T = ${f(R.Ktemp, 3)}; K стар = ${f(R.Kaging)}`);
  L.push(`  C расч = ${f(R.C_corr, 0)} Ач/система; ${b ? `принято: ${b.b.name} ${b.Nser} посл. × ${b.n} цеп.; ёмкость ${f(R.C_bank, 0)} Ач; автономия ≈ ${f(R.t_real, 0)} мин; элементов всего ${R.cellsTotal}` : "АКБ не подобрана"}`);
  if (rp) L.push("", "4. СТЕЛЛАЖИ", `  ${rp.rk.name}: ${rp.nr} на систему, ${rp.racksTotal} всего; масса заряж. ${f(rp.load, 0)} кг; нагрузка на пол ${f(rp.floor, 0)} кг/м2 (допуск ${f(s.floor, 0)}) ${rp.floor <= s.floor ? "— выдерживается" : "— ПРЕВЫШЕНА"}`);
  L.push("", "5. СПЕЦИФИКАЦИЯ");
  (R.spec || []).forEach(r => L.push(`  ${r[0]}. ${r[1]} — ${r[2]}; кол-во ${r[3]} ${r[4]}. ${r[5] || ""}`));
  L.push("", "6. ПРОВЕРКА СООТВЕТСТВИЯ");
  (R.checksOut || []).forEach(c => L.push(`  [${c[3] === null ? "и" : c[3] ? "x" : "!"}] ${c[0]} — ${c[2]}`));
  return L.join("\r\n");
}
/* ---- DXF R12, кодировка Windows-1251: кириллица читается в NanoCAD/AutoCAD ---- */
const CP1251 = (() => {
  const m = {};
  "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("").forEach((c, i) => { m[c] = 0xC0 + i; });
  "абвгдежзийклмнопрстуфхцчшщъыьэюя".split("").forEach((c, i) => { m[c] = 0xE0 + i; });
  m["Ё"] = 0xA8; m["ё"] = 0xB8; m["°"] = 0xB0; m["±"] = 0xB1;
  m["·"] = 0xB7; m["№"] = 0xB9; m["«"] = 0xAB; m["»"] = 0xBB;
  return m;
})();
const DXF_TRANS = (() => {
  const m = {};
  m["—"] = "-"; m["–"] = "-"; m["‘"] = "'"; m["’"] = "'";
  m["“"] = "\""; m["”"] = "\""; m["…"] = "...";
  m["→"] = "->"; m["←"] = "<-"; m["≤"] = "<="; m["≥"] = ">="; m["≈"] = "~";
  m["×"] = "x"; m["÷"] = "/"; m["⎓"] = "="; m["−"] = "-";
  m["α"] = "a"; m["β"] = "b"; m["η"] = "n"; m["φ"] = "f"; m["π"] = "p";
  m["Σ"] = "S"; m["Δ"] = "D"; m["Ω"] = "Om"; m["µ"] = "u"; m["²"] = "2"; m["√"] = "kv.";
  m["§"] = "p."; m["†"] = "+"; m["•"] = "-";
  return m;
})();
function dxfSanitize(str) { // оставляем ASCII и cp1251-символы; прочее — транслитерация
  let out = "";
  for (const ch of String(str)) {
    const c = ch.codePointAt(0);
    if (c === 10 || c === 13 || c === 59) out += " ";
    else if (c < 127) out += ch;
    else if (DXF_TRANS[ch] !== undefined) out += DXF_TRANS[ch];
    else if (CP1251[ch] !== undefined) out += ch;
    else out += "?";
  }
  return out;
}
function dxfBytes(str) { // строка → байты Windows-1251
  const a = [];
  for (const ch of str) {
    const c = ch.codePointAt(0);
    a.push(c < 127 ? c : (CP1251[ch] !== undefined ? CP1251[ch] : 0x3F));
  }
  return new Uint8Array(a);
}
function prims2dxf(P) {
  /* DXF R12 (ASCII + ANSI_1251): LINE, CIRCLE, TEXT. Только левое выравнивание,
     центрирование compensated сдвигом X — так текст не «ломается» ни в одном редакторе. */
  const H = P.H;
  const y = (v) => (H - v).toFixed(2);
  let o = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1251\n0\nENDSEC\n";
  o += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n1\n0\nLAYER\n2\nSCHEME\n70\n0\n62\n7\n6\nCONTINUOUS\n0\nLAYER\n2\nTEXT\n70\n0\n62\n3\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n";
  o += "0\nSECTION\n2\nENTITIES\n";
  for (const e of P.els) {
    if (e.t === "l") o += `0\nLINE\n8\nSCHEME\n10\n${e.x1.toFixed(2)}\n20\n${y(e.y1)}\n30\n0\n11\n${e.x2.toFixed(2)}\n21\n${y(e.y2)}\n31\n0\n`;
    else if (e.t === "r") {
      const c = [[e.x, e.y], [e.x + e.w, e.y], [e.x + e.w, e.y + e.h], [e.x, e.y + e.h]];
      for (let i = 0; i < 4; i++) {
        const q = c[i], r2 = c[(i + 1) % 4];
        o += `0\nLINE\n8\nSCHEME\n10\n${q[0].toFixed(2)}\n20\n${y(q[1])}\n30\n0\n11\n${r2[0].toFixed(2)}\n21\n${y(r2[1])}\n31\n0\n`;
      }
    } else if (e.t === "c" || e.t === "n") {
      o += `0\nCIRCLE\n8\nSCHEME\n10\n${e.x.toFixed(2)}\n20\n${y(e.y)}\n30\n0\n40\n${(e.r || 2.2).toFixed(2)}\n`;
    } else if (e.t === "p") {
      const q = e.pts;
      for (let i = 0; i < q.length; i++) {
        const a2 = q[i], r2 = q[(i + 1) % q.length];
        o += `0\nLINE\n8\nSCHEME\n10\n${a2[0].toFixed(2)}\n20\n${y(a2[1])}\n30\n0\n11\n${r2[0].toFixed(2)}\n21\n${y(r2[1])}\n31\n0\n`;
      }
    } else if (e.t === "t") {
      const sz = +(((e.size || 9) * 1.15).toFixed(2));
      const txt = dxfSanitize(e.s || "");
      const wE = txt.length * sz * 0.52 + 3;
      let tx = e.x;
      if (e.align === "middle") tx -= wE / 2; else if (e.align === "end") tx -= wE;
      o += `0\nTEXT\n8\nTEXT\n10\n${tx.toFixed(2)}\n20\n${(y(e.y) - sz * 0.2).toFixed(2)}\n30\n0\n40\n${sz.toFixed(2)}\n1\n${txt}\n`;
    }
  }
  return o + "0\nENDSEC\n0\nEOF\n";
}
function dxfBlob(P) { return new Blob([dxfBytes(prims2dxf(P))], { type: "application/dxf" }); }
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
function renderGrpTable() {
  const tb = $("grp-table"); if (!tb) return;
  tb.innerHTML = "<tr><th>№</th><th>Наименование нагрузки</th><th>Мощность, кВт</th><th>Время от АКБ, мин</th><th></th></tr>" +
    GRP.map((g, i) => `<tr><td>${i + 1}</td><td><input class="nm" data-g="name" data-i="${i}" value="${String(g.name || "").replace(/"/g, "&quot;")}"></td>
      <td><input type="number" step="0.1" min="0" data-g="p" data-i="${i}" value="${g.p}"></td>
      <td><input type="number" step="5" min="1" data-g="t" data-i="${i}" value="${g.t}"></td>
      <td><button type="button" class="btn-del" data-del="${i}" title="Удалить группу">✕</button></td></tr>`).join("");
}
function saveGrps() { try { localStorage.setItem("ibp-grps", JSON.stringify(GRP)); } catch (e) {} }
function wireGrp() {
  $("btn-load-add").onclick = () => { GRP.push({ name: "Нагрузка-" + (GRP.length + 1), p: 1, t: 30 }); saveGrps(); renderGrpTable(); run(); };
  $("grp-table").addEventListener("input", ev => {
    const ds = ev.target.dataset;
    if (ds && ds.i !== undefined && ds.g) { GRP[+ds.i][ds.g] = ds.g === "name" ? ev.target.value : (parseFloat(ev.target.value) || 0); saveGrps(); run(); } });
  $("grp-table").addEventListener("click", ev => {
    const d = ev.target.dataset && ev.target.dataset.del;
    if (d !== undefined) { GRP.splice(+d, 1); saveGrps(); renderGrpTable(); run(); } });
}
const IDS = ["p-type", "proj-name", "p-kw", "p-cos", "p-eff", "p-kodn", "p-kzap", "p-mot-x", "p-mot-k", "t-min", "t-temp", "u-dc", "u-end",
  "red", "bat-mode", "bat-name", "bat-ah", "bat-v", "bat-life", "ip-uc", "chg-eff", "room-l", "room-w", "floor-load", "seismic", "cable-len", "grp-on"];
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
  renderUps(R); renderBat(R); renderRacks(R); renderLayout(R);
  $("out-scheme").innerHTML = prims2svg(currentScheme(R));
  renderChecks(R); renderSpec(R); renderMethod(R);
}
function boot() {
  fillBatSelect(); renderGrpTable(); wireGrp();
  $("p-type").addEventListener("change", () => {
    const ac = val("p-type") === "ac", u = $("u-dc");
    if (ac && +(u.value) < 200) u.value = "240";
    if (!ac && +(u.value) > 150) u.value = "110";
  });
  IDS.forEach(id => { const el = $(id); el && el.addEventListener("input", run); el && el.addEventListener("change", run); });
  $("btn-print").onclick = () => window.print();
  $("btn-xls").onclick = () => { run(); if (LAST_R) dl(`IBP_${LAST_R.s.proj}.xls`, makeXls(LAST_R)); };
  $("btn-txt").onclick = () => { if (LAST_R) dl(`IBP_${LAST_R.s.proj}_zapiska.txt`, new Blob(["\ufeff" + txtNote(LAST_R)], { type: "text/plain;charset=utf-8" })); };
  $("btn-svg").onclick = () => { if (LAST_R) dl(`IBP_${LAST_R.s.proj}_shema.svg`, new Blob([prims2svg(currentScheme(LAST_R))], { type: "image/svg+xml" })); };
  $("btn-dxf").onclick = () => { if (LAST_R) dl(`IBP_${LAST_R.s.proj}_shema.dxf`, dxfBlob(currentScheme(LAST_R))); };
  $("btn-save").onclick = () => {
    const d = {}; IDS.forEach(id => { d[id] = id === "grp-on" ? $("grp-on").checked : val(id); });
    d.GRP = GRP; d._date = new Date().toISOString();
    dl(`IBP_${val("proj-name")}_project.json`, new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
    localStorage.setItem("ibp-last", JSON.stringify(d));
  };
  $("btn-load").onclick = () => $("file-load").click();
  $("file-load").onchange = ev => {
    const fl = ev.target.files[0]; if (!fl) return; const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        IDS.forEach(id => { if (d[id] !== undefined) { if (id === "grp-on") $("grp-on").checked = !!d[id]; else $(id).value = d[id]; } });
        if (Array.isArray(d.GRP)) { GRP = d.GRP; renderGrpTable(); }
        syncDeps(); run(); $("err-box").innerHTML = '<span class="ok">Проект загружен.</span>';
      } catch (e) { $("err-box").innerHTML = "✗ Неверный файл проекта: " + e.message; $("err-box").className = "bad"; }
    };
    rd.readAsText(fl);
  };
  $("btn-demo").onclick = () => {
    const demo = { "p-type": "dc", "proj-name": "Оперативная-DC-110", "p-kw": "10", "u-dc": "110", "t-min": "60", "t-temp": "25",
      "u-end": "1.75", "red": "2x100", "bat-mode": "auto", "ip-uc": "IP42", "chg-eff": "93", "seismic": "8", "room-l": "12", "room-w": "6", "floor-load": "1500", "cable-len": "10" };
    IDS.forEach(id => { if (id !== "grp-on" && demo[id] !== undefined) $(id).value = demo[id]; });
    $("grp-on").checked = true;
    GRP = [{ name: "Аварийное освещение", p: 3, t: 90 }, { name: "КИП и АСУ ТП (шкаф)", p: 2, t: 60 }, { name: "Приводы отключения", p: 5, t: 30 }];
    renderGrpTable();
    saveGrps(); syncDeps(); run();
  };
  const last = localStorage.getItem("ibp-last");
  if (last) {
    try {
      const d = JSON.parse(last);
      IDS.forEach(id => { if (d[id] !== undefined) { if (id === "grp-on") $("grp-on").checked = !!d[id]; else $(id).value = d[id]; } });
      if (Array.isArray(d.GRP)) { GRP = d.GRP; renderGrpTable(); }
    } catch (e) {}
  }
  run();
}
document.addEventListener("DOMContentLoaded", boot);
