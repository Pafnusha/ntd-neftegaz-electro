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
  { name: "Освещение аварийное", p: 2, t: 120, ph: "1~" },
  { name: "КИП и АСУ ТП (шкаф)", p: 1.5, t: 60, ph: "1~" },
  { name: "Приводы отключения", p: 6, t: 30, ph: "3~" }
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
    grps: GRP.map(g => ({ name: g.name, p: +g.p || 0, t: +g.t || 0, ph: g.ph || "auto" }))
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
  R.qf_out = breakerOf(R.I_out * 1.25);
  {
    const basePh = isAC ? (s.P >= 5 ? "3~" : "1~") : "DC";
    const fl = [{ name: "Базовая (неснимаемая)", p: s.P, t: s.tmin, ph: basePh, base: true }];
    if (s.grpOn) s.grps.forEach(g => fl.push({ name: g.name, p: g.p, t: g.t, ph: isAC ? ((g.ph && g.ph !== "auto") ? g.ph : "1~") : "DC" }));
    R.feeders = fl.map(g => feederFor(R, g));
  }

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
  P.els.push({ t: "t", x: x + 40, y: y - 14, s: pos, size: 7.5, bold: true, color: "#7a3fd8" });
  const lines = Array.isArray(inf) ? inf : (inf ? String(inf).split("\n") : []);
  lines.forEach((ln, i) => P.els.push({ t: "t", x: x + 40, y: y + 2 + i * 8, s: ln, size: 6.5, color: "#7a3fd8" }));
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
function wrapTxt(s, maxc) {
  const words = String(s).split(/\s+/);
  const out = [];
  let ln = "";
  for (const w of words) {
    if ((ln + " " + w).trim().length > maxc) { if (ln) out.push(ln.trim()); ln = w; }
    else ln += " " + w;
  }
  if (ln.trim()) out.push(ln.trim());
  return out;
}
/* ===== фидер: фазность -> полюса автомата, Iн, кабель ===== */
function feederFor(R, g) {
  const s = R.s;
  const ph = g.ph || (s.type === "ac" ? "1~" : "DC");
  let U, poles, cores, phTxt;
  if (ph === "3~") { U = 400; poles = "4P"; cores = 5; phTxt = "3~400"; }
  else if (ph === "DC") { U = s.udc; poles = "2P (+/-)"; cores = 2; phTxt = s.udc + " DC"; }
  else { U = 230; poles = "2P (L+N)"; cores = 3; phTxt = "1~230"; }
  const I = g.p * 1000 / (U * (ph === "3~" ? 1.73 : 1)) / (ph === "DC" ? 1 : Math.max(s.cos, 0.8));
  return { name: g.name, p: g.p, t: g.t, ph, phTxt, I, In: breakerOf(I * 1.25), poles, cores, s: cableOf(I * 1.25).s, base: !!g.base };
}
/* ===== ОДНОЛИНЕЙНАЯ СХЕМА ИБП: схема + Таблица 1 (сигналы в АСУ Э) + примечания ===== */
function schemeSL(R) {
  const s = R.s, ac = s.type === "ac", n = Math.max(1, R.nsys), b = R.bat;
  const feed = R.feeders || [], fN = Math.max(1, feed.length);
  const colW = 400, x0 = 215;
  const cab = upsCabOf(R.ups_kVA);
  const yQFin = 78, yVC = 150, yZ = 198, yNC = 277, ySF = 337, yQF3 = 399, yBus = 442;
  const xEndSys = x0 + (n - 1) * colW;
  const xby = xEndSys + 330, xqsb = xby + 85;
  const busL = 40, busR = Math.max(xqsb + 45, fN * 92 + 120);
  const P = { W: Math.max(1400, busR + 40), H: 900, els: [] };
  const e = t => P.els.push(t);
  const L = (x1, y1, x2, y2, sw) => e({ t: "l", x1, y1, x2, y2, sw: sw || 1.3 });
  const ND = (x, y) => e({ t: "n", x, y });
  const T = (x, y, st, o) => { const p = { t: "t", x, y, s: st, size: 6.4 }; if (o) Object.assign(p, o); e(p); };
  /* лист/шапка */
  T(16, 26, `Схема электрическая однолинейная. Система бесперебойного питания ${ac ? "переменного" : "постоянного"} тока (ИБП) — ${s.proj}`, { size: 10.5, bold: true });
  T(16, 38, `ГОСТ 2.702-2011, ГОСТ 2.701-2008; УГО — ГОСТ 2.7х ЕСКД (QF — 2.710/2.755; SA — 2.710; GB — 2.722; VC/NC/SF — 2.747). Лист 1 · ИБП-Сх-01 · стадия Р · масштаб не пропорционален.`, { size: 6.2, color: "#5a6a7e" });
  T(P.W - 16, 26, `Резервирование: ${n > 1 ? "2 системы × 100 %" : "1 система (без резерва)"} · Источник схемы: расчётный модуль ИБП`, { size: 6.5, align: "end" });
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * colW, nm = "AB".slice(i, i + 1) || String(i + 1);
    const bx = cx - 100, ox = cx + 95;
    /* шкаф */
    e({ t: "r", x: cx - 138, y: 94, w: 293, h: 352, fill: "none", stroke: "#98a4b5", sw: 0.9, dash: "8 4" });
    T(cx - 130, 104, `Шкаф ИБП-${nm} · ${R.ups_kVA}${ac ? " кВА" : " кВт"} · ${ac ? "VFI·SS·1·PF1" : "DC " + s.udc + " В ±10 %"} · IP42`, { size: 6.2, bold: true });
    T(cx - 134, 118, `габ. ${cab.L}×${cab.W}×${cab.H} мм · внутри — однолинейка шкафа`, { size: 5.4, color: "#5a6a7e" });
    /* ввод */
    T(cx - 128, yQFin - 2, `Ввод №${i + 1}: ~400 В 50 Гц от секции №${i + 1} РУ НН`, { size: 6 });
    L(cx, yQFin + 6, cx, yQFin + 14);
    symQF(P, cx, yQFin + 22, `QF${i + 1}`, [`${R.qf_in} А · 4P`, `Ir=(0,4…1)In · LSI`]);
    L(cx, yQFin + 37, cx, yVC - 18);
    symConv(P, cx, yVC, 110, 36, "rec", "", [`VC-${nm} ~400→${s.udc} В`, `Iзy ${f(R.I_chg, 0)} А · η ${f(s.chgEff * 100, 0)} %`]);
    L(cx, yVC + 18, cx, yZ);
    /* звено DC */
    L(bx - 14, yZ, ox, yZ, 2);
    ND(cx, yZ);
    T(ox - 2, yZ - 5, `звено DC ${s.udc} В`, { size: 5.8, bold: true, align: "end" });
    /* веть АКБ */
    ND(bx, yZ);
    L(bx, yZ, bx, yZ + 12);
    symQF(P, bx, yZ + 24, `QFB-${nm}`, `${R.qf_bat} А · 2P`);
    L(bx, yZ + 37, bx, yZ + 48);
    symSA(P, bx, yZ + 56, `SA-${nm}`, `т. пост. ${s.udc} В · ${R.qf_bat} А`);
    L(bx, yZ + 68, bx, yZ + 78);
    e({ t: "r", x: bx - 27, y: yZ + 78, w: 54, h: 30, fill: "#f2f5fa", stroke: "#223344", sw: 1.1 });
    T(bx, yZ + 89, `+ GB-${nm}`, { size: 6, align: "middle", bold: true });
    T(bx, yZ + 100, `− ${s.udc} В`, { size: 6, align: "middle" });
    T(bx, yZ + 116, `${R.NcellsBat} эл. · ${f(R.C_bank || 0, 0)} А·ч (C10)`, { size: 5.6, align: "middle" });
    T(bx, yZ + 124, `I разр ${f(R.I_max, 0)} А · t ${f(R.Tend || 0, 0)} мин`, { size: 5.6, align: "middle" });
    T(bx, yZ + 132, `VRLA · ≥${b ? b.b.life : 25} лет · ГОСТ 2.722`, { size: 5.6, align: "middle" });
    T(bx, yZ + 141, `шкаф АБ · ВВГнг-LS ${R.s_bat_cable} мм² ${f(s.cableLen, 0)} м`, { size: 5.2, align: "middle", color: "#33465e" });
    /* выход */
    if (ac) {
      L(ox, yZ, ox, yNC - 18); ND(ox, yZ);
      symConv(P, ox, yNC, 130, 32, "inv", "", [`NC-${nm} ~230 В ±1 % · 50 Гц ±1 Гц`, `S ${R.ups_kVA} кВА · I ${f(R.I_out, 0)} А`]);
      L(ox, yNC + 16, ox, ySF - 15);
      symSTP(P, ox, ySF, `SF-${nm}`, `${f(R.I_out, 0)} А`);
      L(ox, ySF + 15, ox, yQF3 - 15);
      symQF(P, ox, yQF3, `QF${i ? 4 : 3}`, [`${R.qf_out} А · 4P · LSI`, `незав. расцеп. (откл. от АСУ Э)`]);
      L(ox, yQF3 + 15, ox, yBus); ND(ox, yBus);
    } else {
      L(ox, yZ, ox, yQF3 - 15); ND(ox, yZ);
      symQF(P, ox, yQF3, `QF${i ? 4 : 3}`, [`${R.qf_out} А · 2P · LSI`, `незав. расцеп. (откл. от АСУ Э)`]);
      L(ox, yQF3 + 15, ox, yBus); ND(ox, yBus);
    }
    if (n === 1) T(cx + 160, yQFin + 8, "Ввод №2 (резервный) не применён — без резервирования", { size: 5.6, color: "#8a97a8" });
  }
  /* байпас AC */
  if (ac) {
    T(xby - 60, 66, `Резервная (байпасная) линия ~400 В`, { size: 6 });
    L(xby, 70, xby, yQFin + 2);
    symQF(P, xby, yQFin + 16, "QF10", `${R.qf_in} А · 4P`);
    L(xby, yQFin + 31, xby, yNC - 18);
    symSTP(P, xby, yNC, "SF10", `байпас I ${f(R.I_out, 0)} А`);
    L(xby, yNC + 15, xby, ySF);
    symSA(P, xby, ySF + 12, "QSB", [`ремонтный байпас`, `блокировка с QF${n > 1 ? "3/QF4" : "3"}`]);
    L(xby, ySF + 28, xby, yBus);
    ND(xby, yBus);
    T(xby - 68, 56, `Шкаф байпаса · ${upsCabOf(R.ups_kVA).L}×${upsCabOf(R.ups_kVA).W}×${upsCabOf(R.ups_kVA).H}`, { size: 5.6, bold: true });
    L(x0 + 95, ySF + 34, xby, ySF + 34, 1.4);
    for (let i = 0; i < n; i++) { const ox = x0 + i * colW + 95; e({ t: "n", x: ox, y: ySF + 34 }); }
    T((x0 + 95 + xby) / 2, ySF + 28, `обходная линия ~400/230 В к выходам NC (через SF${n > 1 ? "…SF10" : ""})`, { size: 5.6, align: "middle", color: "#5a6a7e" });
  } else {
    const px = xEndSys + 200;
    L(xEndSys + 95, yZ, px, yZ, 2);
    e({ t: "r", x: px - 70, y: yZ + 26, w: 165, h: 46, fill: "#f6f8f6", stroke: "#223344" });
    T(px - 64, yZ + 42, `ПКИ — контроль изоляции`, { size: 6, bold: true });
    T(px - 64, yZ + 54, `шин ${s.udc} В (плавающая) · авария → АСУ Э`, { size: 5.2 });
    L(px, yZ + 26, px, yZ, 1); ND(px, yZ);
  }
  /* шина ЩГП/ШПН */
  L(busL, yBus, busR, yBus, 3);
  T(busL + 2, yBus - 6, ac ? `ЩГП ИБП (ШСН) ~400/230 В 50 Гц · L1,L2,L3,N,PE · Iкз(3) принять ${f(R.Ikz3 || 14.6, 1)} кА` : `ШПН-A/B ${s.udc} В — две взаимно резервируемые секции`, { bold: true, size: 7.5 });
  T(busR - 4, yBus - 6, `УЗИП II классе`, { size: 5.8, align: "end", color: "#5a6a7e" });
  /* фидеры */
  const step = Math.min(92, (busR - 90) / fN);
  feed.forEach((g, j) => {
    const x = 62 + j * step;
    L(x, yBus, x, yBus + 10); e({ t: "n", x, y: yBus });
    symQF(P, x, yBus + 24, `QF${101 + j}`, [`${g.In} А · ${g.poles}`, g.ph === "DC" ? "Iт.о=10Iр · нез. расц." : "Ir=(0,8…1)In", "незав. расцеп."]);
    L(x, yBus + 40, x, yBus + 50);
    if (g.ph !== "DC") {
      const xs = [-14, 0, 14];
      const fl = g.ph === "3~" ? ["L1", "L2", "L3"] : ["L", "N", "PE"];
      xs.forEach((d, k) => { L(x, yBus + 50, x + d, yBus + 56, 0.9); ND(x + d, yBus + 56); fl[k] && T(x + d, yBus + 62, fl[k], { size: 5, align: "middle", color: "#33465e" }); });
      L(x - 14, yBus + 64, x + 14, yBus + 64, 0.9);
      L(x, yBus + 64, x, yBus + 70);
      if (g.ph === "3~") T(x - 27, yBus + 55, "N", { size: 5, align: "middle", color: "#33465e" });
    } else { T(x - 11, yBus + 57, "+", { size: 6, align: "middle" }); T(x + 11, yBus + 57, "−", { size: 6, align: "middle" }); L(x, yBus + 50, x, yBus + 69, 1.1); }
    L(x, yBus + 70, x, yBus + 90);
    T(x + 6, yBus + 81, `ВВГнг(А)-LS ${g.cores}×${g.s}`, { size: 5, color: "#33465e" });
    e({ t: "c", x, y: yBus + 84, r: 6 });
    L(x - 4.3, yBus + 90, x + 4.3, yBus + 78, 1.2);
    T(x, yBus + 99, `W${j + 1}`, { size: 5.4, align: "middle" });
    e({ t: "r", x: x - 40, y: yBus + 104, w: 80, h: 22, fill: "#fff", stroke: "#223344", sw: 1 });
    T(x, yBus + 112, g.name.slice(0, 20), { size: 5.2, align: "middle" });
    T(x, yBus + 119, `${f(g.p, 1)} кВт · ${g.phTxt}${g.base ? " · баз." : ""} · t=${f(g.t, 0)} мин`, { size: 5.2, align: "middle" });
  });
  /* таблица сигналов */
  const sig = signalRows(R, ac, n, fN);
  const yTbl = yBus + 150;
  T(40, yTbl, "Таблица 1 — Перечень сигналов, передаваемых от электрооборудования системы ИБП в АСУ Э", { size: 8, bold: true });
  T(40, yTbl + 10, "Интерфейс: RS-485, Modbus RTU, через УСПД (шкаф байпаса). Карта регистров — по документации Поставщика. ДС — дискретный, АИ — аналоговый сигнал.", { size: 6, color: "#33465e" });
  const CW = 178;
  const half = Math.ceil(sig.length / 2);
  function drawSig(tx, rows, off) {
    let y = yTbl + 22;
    T(tx + 2, y, "№", { size: 5.6, bold: true });
    T(tx + 14, y, "Наименование сигнала", { size: 5.6, bold: true });
    T(tx + CW - 34, y, "Тип", { size: 5.6, bold: true });
    T(tx + CW - 16, y, "Ист.", { size: 5.6, bold: true });
    y += 8;
    rows.forEach((rw, i) => {
      T(tx + 2, y, String(off + i + 1), { size: 5.6 });
      T(tx + 14, y, rw[0], { size: 5.6 });
      T(tx + CW - 34, y, rw[1], { size: 5.6 });
      T(tx + CW - 16, y, rw[2], { size: 5.6 });
      y += 7.6;
    });
    L(tx, yTbl + 14, tx + CW, yTbl + 14, 0.7);
    L(tx, y + 1, tx + CW, y + 1, 0.7);
    L(tx, yTbl + 14, tx, y + 1, 0.7);
    L(tx + CW, yTbl + 14, tx + CW, y + 1, 0.7);
    L(tx + CW - 38, yTbl + 14, tx + CW - 38, y + 1, 0.5);
    L(tx + CW - 20, yTbl + 14, tx + CW - 20, y + 1, 0.5);
    return y;
  }
  const ye1 = drawSig(40, sig.slice(0, half), 0);
  const ye2 = drawSig(40 + CW + 16, sig.slice(half), half);
  /* примечания */
  const notes = notesArr(R, ac, n, fN);
  const nx0 = 40 + (CW + 16) * 2 + 10;
  T(nx0, yTbl + 2, "Примечания", { size: 8, bold: true });
  let ny = yTbl + 18;
  const nWrap = Math.max(78, Math.floor((Math.max(1400, busR + 40) - nx0 - 24) / 2.72));
  notes.forEach(nt => wrapTxt(nt, nWrap).forEach((ln, i) => { T(nx0 + (i ? 20 : 0), ny, ln, { size: 5.8 }); ny += 7.2; }));
  /* рамка листа */
  P.H = Math.max(ye1, ye2, ny) + 50;
  P.W = Math.max(P.W, 70 + fN * step + 90, nx0 + 560);
  P.els.unshift({ t: "r", x: 6, y: 6, w: P.W - 12, h: P.H - 12, fill: "none", stroke: "#33465e", sw: 1.6 });
  T(P.W - 16, P.H - 14, `Лист 1 · Листов 1 · Дата ${new Date().toLocaleDateString("ru-RU")}`, { size: 6, align: "end", color: "#5a6a7e" });
  return P;
}
function signalRows(R, ac, n, fN) {
  return [
    ["Вкл/откл вводных автоматов", "ДС", "QF1…QF" + n],
    ["Авария общая ИБП (сборная)", "ДС", "контроллер"],
    ["Напряжение сети в допуске", "ДС", "шкаф ИБП"],
    ["Работа от сети", "ДС", "шкаф ИБП"],
    ["Работа от батарей", "ДС", "шкаф ИБП"],
    ["Переход на статбайпас", "ДС", "SF1…SF" + (n + 1)],
    ["Ремонтный байпас включен", "ДС", "QSB"],
    ["Неисправность выпрямителя", "ДС", "VC1…VC" + n],
    ["Отказ обдува шкафа", "ДС", "шкаф ИБП"],
    ["Перегрев / авария датчика T°", "ДС", "датчики T°"],
    ["Разряд АКБ до УКЗН", "ДС", "контроллер"],
    ["Отключен QFB (цепь АКБ)", "ДС", "QFB-1…"],
    ["Авария изоляции (шина DC)", "ДС", ac ? "—" : "ПКИ"],
    ["Отключение фидера по t автономии", "ДС", `QF101…QF${100 + fN}`],
    [ac ? "U, I, P, f, cos φ вход/выход" : "U, I, P выходной цепи DC", "АИ", "шкаф ИБП"],
    [ac ? "Напряжение и ток звена DC" : "Напряжение шины DC", "АИ", "VC-колонки"],
    ["Ток заряда АКБ", "АИ", "VC-колонки"],
    ["T° воздуха и АКБ", "АИ", "датчики T°"],
    ["Состояние АКБ (U,I,R,SOS/SOH)", "АИ", "контроль АКБ"],
    ["Загрузка ИБП % / остаток мин", "АИ", "шкаф ИБП"],
  ];
}
function notesArr(R, ac, n, fN) {
  const s = R.s, b = R.bat;
  return [
    `1. Номиналы вводных и выходных автоматов ИБП (QF1…QF${n + 2}, QF10) указаны предварительно и подлежат уточнению Поставщиком, в т.ч. по корректному учёту тока заряда АКБ (${f(R.I_chg, 0)} А) и токам КЗ на шинах РУ НН.`,
    `2. Автоматические выключатели QF1…QF${n + 2} — с электронными расцепителями с защитами LSI (L — перегрузка, Ir=(0,4…1)In; S — отсечка с выдержкой; I — отсечка мгновенная); фидерные автоматы ЩГП — с независимыми расцепителями.`,
    `3. В щите ЩГП (ШСН) / ШПН предусмотрено автоматическое отключение групп потребителей по истечении заявленного времени автономного питания от ИБП (для каждой группы — своё t мин; отключение — независимыми расцепителями QF101…QF${100 + fN} по сигналу УСПД/контроллера ИБП).`,
    `4. В ЩГП (ШСН) и ШПН установить УЗИП II класса для защиты от атмосферных и коммутационных перенапряжений; выполнить координацию с защитой ИБП.`,
    `5. Фазность фидерных автоматов: 2P (L+N, цепь 1~230 В), 4P (цепи 3~400 В), 2P (+/−, цепи постоянного тока); отходящие линии — кабели марок ВВГнг(А)-LS, сечения по расчёту (ΔU ≤ 2 %, ПУЭ табл. 1.3.6).`,
    `6. АКБ: ${b ? `${R.NcellsBat} эл. по ${b.b.cells6 ? "12" : "2"} В · ${f(R.C_bank || 0, 0)} А·ч (C10) на цепочку, батарей на систему — ${R.bat.n}; VRLA (ГОСТ Р МЭК 60896-21), срок службы ≥ ${b.b.life} лет` : "—"}; ветвь АКБ защищена QFB и разъединена SA у плюсового вывода (ГОСТ Р МЭК 62485-2); зазоры между блоками 10…20 мм.`,
    `7. Предельное время автономии — ≈ ${f(R.t_real || 0, 0)} мин (с учётом деградации 20 % и температуры ${f(s.temp, 0)} °C); требуемое — ${f(R.Tend || s.tmin, 0)} мин (ступенчатый график см. раздел 3 модуля).`,
    `8. Кабели между шкафом ИБП и шкафом АБ (звено DC ${s.udc} В) — комплектно с ИБП; L=${f(s.cableLen, 0)} м; падение ΔU ≤ 2 %.`,
    `9. Защитное и функциональное заземление — по гл. 1.7 ПУЭ; не менее двух точек присоединения шины ФЗШ к ГЗШ на каждый шкаф.`,
    `10. Внутри каждого шкафа — однолинейная электрическая схема и паспортная табличка (нерж. сталь); окраска RAL 7035; подвод кабелей снизу; секционирование 2b; на вводах — амперметр и вольтметр; на лицевой панели — мнемосхема и индикация.`,
    `11. Схема выполнена укрупнённо: THDi-фильтр, вторичные цепи и аппараты, требуемые опросным листом/вендор-листом, условно не показаны, но входят в объём поставки.`,
  ];
}

function currentScheme(R) { return schemeSL(R); }

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
  const fd = (R.feeders || []);
  if (fd.length) {
    push("Аппарат защиты групповой сети ЩГП/ШПН", fd.map(g => `«${g.name.slice(0,14)}» — ${g.In} А ${g.poles}`).join("; "), fd.length, "шт.", "QF101…; независимые расцепители: авт. отключение по истечении времени автономии группы");
    push("Кабели фидеров гарантированного питания", fd.map(g => `${g.cores}×${g.s}`).join("; "), "по трассам", "м", "ВВГнг(А)-LS; см. однолинейную схему");
  }
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
  <p><b>Схема электрическая однолинейная:</b> правила выполнения — ГОСТ 2.701-2008, ГОСТ 2.702-2011; УГО — ГОСТ 2.7х ЕСКД. Состав листа: однолинейная схема (вводы, шкафы ИБП, ветви АКБ с QFB/SA, байпас и ремонтный QSB, щит ЩГП/ШПН с фидерами), Таблица 1 (сигналы в АСУ Э: ДС/АИ, RS-485/Modbus RTU через УСПД) и примечания. Фазность фидерного автомата: 1~230 В — 2P(L+N), 3~400 В — 4P, DC — 2P(+/−); у каждого QF — In, уставка Ir, отсечка. Экспорт: SVG и DXF R12 (NanoCAD / AutoCAD / Компас-3D; DWG — Save As в NanoCAD).</p>
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
  tb.innerHTML = "<tr><th>№</th><th>Наименование нагрузки</th><th>Мощность, кВт</th><th>Время от АКБ, мин</th><th>Фазность (тип цепи фидера)</th><th></th></tr>" +
    GRP.map((g, i) => `<tr><td>${i + 1}</td><td><input class="nm" data-g="name" data-i="${i}" value="${String(g.name || "").replace(/"/g, "&quot;")}"></td>
      <td><input type="number" step="0.1" min="0" data-g="p" data-i="${i}" value="${g.p}"></td>
      <td><input type="number" step="5" min="1" data-g="t" data-i="${i}" value="${g.t}"></td>
      <td><select data-g="ph" data-i="${i}">${(val("p-type") === "ac" ? [["1~","1~230 В · 2P(L+N)"],["3~","3~400 В · 4P"],["DC","DC · 2P(+/−)"]] : [["DC","DC 2P(+/−)"]]).map(o => `<option value="${o[0]}" ${(g.ph || (val("p-type") === "ac" ? "1~" : "DC")) === o[0] ? "selected" : ""}>${o[1]}</option>`).join("")}</select></td>
      <td><button type="button" class="btn-del" data-del="${i}" title="Удалить группу">✕</button></td></tr>`).join("");
}
function saveGrps() { try { localStorage.setItem("ibp-grps", JSON.stringify(GRP)); } catch (e) {} }
function wireGrp() {
  $("btn-load-add").onclick = () => { GRP.push({ name: "Нагрузка-" + (GRP.length + 1), p: 1, t: 30, ph: val("p-type") === "ac" ? "1~" : "DC" }); saveGrps(); renderGrpTable(); run(); };
  $("grp-table").addEventListener("input", ev => {
    const ds = ev.target.dataset;
    if (ds && ds.i !== undefined && ds.g) {
      GRP[+ds.i][ds.g] = (ds.g === "name" || ds.g === "ph") ? ev.target.value : (parseFloat(ev.target.value) || 0);
      saveGrps(); if (ds.g === "p" || ds.g === "t") renderGrpTable(); run();
    } });
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
    renderGrpTable();
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
    GRP = [{ name: "Аварийное освещение", p: 3, t: 90, ph: "1~" }, { name: "КИП и АСУ ТП (шкаф)", p: 2, t: 60, ph: "1~" }, { name: "Приводы отключения", p: 5, t: 30, ph: "DC" }];
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
