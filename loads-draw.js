/* loads-draw.js — схема и планировка по ЦИФРОВОЙ МОДЕЛИ СЕТИ loads-core:
   распределение приёмников по вводам (рабочий/резервный/ДЭС/ИБП), секционирование с АВР,
   фазность 1~(L1/L2/L3)/3~, таблица несимметрии; листы — мм, DXF стиль ESKD. */
"use strict";
(function () {
function LS() { return window.__LA ? window.__LA.state : { rows: [] }; }
function CMP() { return window.__LA && window.__LA.compute ? window.__LA.compute() : null; }
function LC() { return window.LoadsCore || {}; }
function $(id) { return document.getElementById(id); }
function NET() {
  var m = null;
  try { m = window.__NetModelUI && window.__NetModelUI.getModel && window.__NetModelUI.getModel(); } catch (e) {}
  if (!m && LS().netModel) m = LS().netModel;
  if (m && m.consumers && m.consumers.length) return m;
  return null;
}
function f1(x) { return Number(x || 0).toLocaleString("ru-RU", { maximumFractionDigits: 1 }); }
function f2(x) { return Number(x || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function f0(x) { return Number(x || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 }); }
function val(f, d) { return f && f.value != null ? f.value : d; }
function isKtp() { return $("site-type") ? $("site-type").value === "ktp" : true; }
function ikzOf(m) { return (m && m.Ikz_kA) || Number(($("ikz-input") || {}).value) || 20; }
function iudOf(Ikz) { return f1(Math.SQRT2 * 1.8 * Ikz); }
var TRG = [{ s: 250, w: 1500, d: 1050 }, { s: 400, w: 1650, d: 1150 }, { s: 630, w: 1850, d: 1300 }, { s: 1000, w: 2050, d: 1500 }, { s: 1600, w: 2300, d: 1650 }, { s: 2500, w: 2600, d: 1800 }, { s: 1e9, w: 2900, d: 2000 }];
function trSize(kVA) { for (var i = 0; i < TRG.length; i++) if (kVA <= TRG[i].s * 1.001) return TRG[i]; return TRG[TRG.length - 1]; }
/* --- примитивы --- */
function T(P, x, y, s, o) { P.els.push(Object.assign({ t: "t", x: x, y: y, s: String(s == null ? "" : s), size: 6.4 }, o || {})); }
function Ln(P, a, b, sw, col, dash) { P.els.push({ t: "l", x1: a[0], y1: a[1], x2: b[0], y2: b[1], sw: sw || 1.3, color: col, dash: dash }); }
function Nd(P, x, y) { P.els.push({ t: "n", x: x, y: y }); }
function symQFa(P, x, y, pos, l1, l2) {
  Ln(P, [x, y - 14], [x, y - 4], 1.6); Ln(P, [x, y + 4], [x, y + 14], 1.6);
  Ln(P, [x - 5, y + 5], [x + 4, y - 6], 1.6);
  P.els.push({ t: "r", x: x + 4, y: y - 9, w: 7, h: 4.5, stroke: "#223344", sw: 0.9 });
  T(P, x + 15, y - 9, pos, { size: 7.5, bold: true });
  if (l1) T(P, x + 15, y + 3, l1, { size: 5.6, color: "#33465e" });
  if (l2) T(P, x + 15, y + 13, l2, { size: 5.6, color: "#33465e" });
}
function symTR(P, x, y, pos, lines) {
  P.els.push({ t: "c", x: x - 8, y: y, r: 13 }); P.els.push({ t: "c", x: x + 8, y: y, r: 13 });
  T(P, x - 22, y - 30, pos, { size: 7.5, bold: true, align: "end" });
  (lines || []).forEach(function (ln, i) { T(P, x + 26, y - 6 + i * 9, ln, { size: 5.6, color: "#33465e" }); });
}
function symTA(P, x, y, txt) {
  P.els.push({ t: "c", x: x, y: y, r: 7 });
  P.els.push({ t: "l", x1: x - 4, y1: y + 6, x2: x + 5, y2: y - 4, sw: 1 });
  T(P, x + 10, y + 3, txt, { size: 5.4, color: "#5a6a7e" });
}
function meter(P, x, y) {
  P.els.push({ t: "r", x: x - 9, y: y - 9, w: 18, h: 18, stroke: "#33465e", sw: 0.9 });
  P.els.push({ t: "l", x1: x - 7, y1: y + 6, x2: x + 7, y2: y + 6, sw: 0.9, color: "#33465e" });
  T(P, x, y + 2, "Wh", { size: 6, align: "middle" });
  T(P, x - 13, y + 2, "A", { size: 5.4, color: "#5a6a7e" });
}
function symRec(P, x, y) {
  P.els.push({ t: "c", x: x, y: y, r: 6 });
  P.els.push({ t: "l", x1: x - 4.2, y1: y + 4.4, x2: x + 4.2, y2: y - 4.4, sw: 1.2 });
}
function symRelay(P, x, y, lbl) {
  P.els.push({ t: "r", x: x - 9, y: y - 7, w: 18, h: 14, stroke: "#1b6ef3", sw: 1.1, fill: "#eef4ff" });
  T(P, x, y + 3, lbl, { size: 5.4, align: "middle", color: "#1b6ef3", bold: true });
}
function dimH(P, x1, x2, y, label) {
  Ln(P, [x1, y], [x2, y], 0.7, "#5a6a7e");
  [[x1, 1], [x2, -1]].forEach(function (pp) { var cx = pp[0], d = pp[1];
    Ln(P, [cx - d * 6, y - 2], [cx, y], 0.8, "#5a6a7e"); Ln(P, [cx - d * 6, y + 2], [cx, y], 0.8, "#5a6a7e"); });
  T(P, (x1 + x2) / 2, y - 2, label, { size: 6, align: "middle", color: "#33465e" });
}
function dimV(P, x, y1, y2, label) {
  Ln(P, [x, y1], [x, y2], 0.7, "#5a6a7e");
  [[y1, 1], [y2, -1]].forEach(function (pp) { var cy = pp[0], d = pp[1];
    Ln(P, [x - 2, cy + d * 6], [x, cy], 0.8, "#5a6a7e"); Ln(P, [x + 2, cy + d * 6], [x, cy], 0.8, "#5a6a7e"); });
  T(P, x - 3, (y1 + y2) / 2 + 2, label, { size: 6, align: "end", color: "#33465e" });
}
/* --- доступ к модели --- */
function srcOf(m, id) { return (m.sources || []).filter(function (s) { return s.id === id; })[0] || null; }
function secById(m, id) { return (m.sections || []).filter(function (s) { return s.id === id; })[0] || null; }
function consOfSec(m, sid) { return (m.consumers || []).filter(function (c) { return (c.feedWork && c.feedWork.sectionId === sid) || (!c.feedWork && c.sectionId === sid); }); }
function secRole(m, sec, idx) {
  var src = srcOf(m, (sec.fedBy && sec.fedBy[0]) || "");
  if (!src) return { label: sec.name, role: "" };
  if (src.type === "GRID") return { label: "Ввод " + src.id + " " + (idx === 0 ? "(рабочий) " : (idx === 1 ? "(резервный) " : "(резервный " + (idx - 1) + ") ")), role: src.id };
  if (src.type === "SOURCE_DG") return { label: "ДЭС " + src.id, role: "ДЭС" };
  if (src.type === "UPS") return { label: "Шина ИБП " + src.id, role: "ИБП" };
  return { label: sec.name, role: "" };
}
function adjPanels(m) {
  (m.panels || []).forEach(function (pq) {
    var res = 0, resIds = [];
    (m.consumers || []).forEach(function (c) {
      if (c.feedReserve && c.feedWork && c.feedReserve.sectionId === pq.sectionId && c.feedReserve.sectionId !== c.feedWork.sectionId) {
        var spx = workSplitV3(c); res += spx.nR;
        for (var kk = 0; kk < spx.nR; kk++) { resIds.push((101 + m.consumers.indexOf(c)) + 'р' + (spx.nR > 1 ? (kk + 1) : '')); }
      }
    });
    pq.resUnits = res; pq.resIds = resIds;
    pq.width_disp_mm = (pq.width_mm || 0) + res * 200;
  });
}
function phStr(c) { return c.phases === 1 ? ("1~ · " + (c.phase || "")) : "3~ L1-L2-L3"; }
/* ============ ОДНОЛИНЕЙНАЯ СХЕМА ПО МОДЕЛИ ============ */
/* ====== v3: однолинейная схема (ГОСТ/ЕСКД) с Nрез, резервом на 2-й секции, фазностью ====== */
var QF_AMP = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 250, 400, 630];
function qfIn(Ir) { var x = (typeof LC().selectQf === "function") ? LC().selectQf(Ir, { factor: 1.25 }).In : null; if (x) return x; for (var i = 0; i < QF_AMP.length; i++) if (QF_AMP[i] >= Ir * 1.25) return QF_AMP[i]; return 630; }
function phLabel(c) { return c.phases === 1 ? ("U" + (c.phase || "L?")) : "3~"; }
function workSplitV3(c) {
  var q = Math.max(1, Number(c.qty) || 1);
  var nr = Math.max(0, Math.floor(Number(c.qtyNr) || 0));
  return { nW: q, nR: nr, k: 1, IrUnit: (c.Ir || 0) / q, PrUnit: (c.Pr || 0) / q };
}
var DRAWN = { w: 0, r: 0 };
function buildSingleLine() {
  var m = NET();
  DRAWN.w = 0; DRAWN.r = 0;
  if (!m) return noModelSheet("однолинейная");
  var ktp = isKtp();
  var tAll = CMP();
  function idxOf(c) { return m.consumers.indexOf(c); }
  function hasRes2(c) { return !!(c.feedReserve && c.feedWork && c.feedReserve.sectionId && c.feedReserve.sectionId !== c.feedWork.sectionId); }
  function nChainOf(c) { return hasRes2(c) ? Math.max(1, workSplitV3(c).nR) : 0; }
  function hasRes(c) { return c.feedReserve && c.feedWork && c.feedReserve.sectionId && c.feedReserve.sectionId !== c.feedWork.sectionId; }
  var cols = [];
  (m.sections || []).forEach(function (sec, i) { cols.push({ sec: sec, idx: i, cons: consOfSec(m, sec.id) }); });
  cols.forEach(function (cl) { cl.resUnits = cl.cons.reduce(function (a2, c) { return a2 + nChainOf(c); }, 0); cl.nLines = cl.cons.reduce(function (a2, c) { return a2 + workSplitV3(c).nW; }, 0); });
  var SLOTW = 44, SLOTR = 66, x = 40;
  cols.forEach(function (cl) { cl.x0 = x; cl.w = 84 + cl.nLines * SLOTW + cl.resUnits * SLOTR; x += cl.w + 110; });
  var totalW = Math.max(x + 420, 1500);
  var busY = 236, P = { W: totalW, H: 900, els: [] };
  function e(o) { P.els.push(o); }
  var Ikz = ikzOf(m), Iud = iudOf(Ikz);
  var nOp = (m.consumers || []).length, nResTot = 0;
  (m.consumers || []).forEach(function (c) { var sp = workSplitV3(c); nResTot += hasRes2(c) ? Math.max(1, sp.nR) : 0; });
  T(P, 20, 26, "Схема электрическая однолинейная — " + (ktp ? "КТП 10(6)/0,4 кВ" : "щит НКУ 0,4 кВ") + " · цифровая модель сети «" + (m.supplyMode || "2in") + "»", { size: 15, bold: true });
  T(P, 20, 40, "ГОСТ 2.702-2011 (тип С1 — однолинейная); УГО — ЕСКД (ГОСТ 2.755/2.710/2.746/2.751/2.722); шрифт 2.1.115 (3,5/2,5 мм); формат А1", { size: 7, color: "#33465e" });
  T(P, 20, 50, "Правила: основные нагрузки — СЕКЦИЯ 1 (рабочий ввод); резервные цепи (Nрез) — автоматы QF…р + КМ на СЕКЦИИ 2 (резервный ввод); особая группа — шина ИБП; резерв в ΣPр не учитывается (РТМ; ПУЭ 1.2.14).", { size: 7 });
  /* вводы/шкафы/шины */
  function secRoleV3(sec, i) {
    var src = srcOf(m, (sec.fedBy || [])[0] || "");
    if (!src) return "Ввод · " + sec.id;
    if (src.type === "GRID") return i === 0 ? "СЕКЦИЯ 1 · В1 раб." : "СЕКЦИЯ 2 · В2 рез.";
    if (src.type === "SOURCE_DG") return "Резервный ДЭС · " + sec.id;
    if (src.type === "UPS") return "ШИНА ИБП · особая гр.";
    return "Ввод · " + sec.id;
  }
  cols.forEach(function (cl, i) {
    var x0 = cl.x0, x1 = cl.x0 + cl.w - 20, cxm = x0 + 40;
    var src = srcOf(m, (cl.sec.fedBy || [])[0] || "");
    var PrW = 0, SrW = 0;
    cl.cons.forEach(function (c) { var sp = workSplitV3(c); if (c.feedWork && c.feedWork.sectionId === cl.sec.id) { PrW += c.Pr * sp.k; SrW += c.Sr * sp.k; } });
    Ln(P, [x0 + 8, busY], [x1, busY], 9);
    var IrSec = cl.sec.id === "SEC-UPS" ? ((src && src.Sn_kVA) || 10) * 1000 / (1.717 * 400) : SrW * 1000 / (1.717 * 400);
    var resOnSec = 0;
    cols.forEach(function (oc) { oc.cons.forEach(function (c) { if (hasRes(c) && c.feedReserve.sectionId === cl.sec.id) { var spx2 = workSplitV3(c); resOnSec += (spx2.nR || 1) * spx2.PrUnit; } }); });
    T(P, x0 + 24 + (cl.w - 46) / 2, busY - 26, secRoleV3(cl.sec, i) + "   ΣPр(раб)=" + f1(PrW) + " кВт · Iр=" + f0(IrSec) + " А" + (resOnSec > 0.05 ? " · рез.вх." + f1(resOnSec) + " кВт" : ""), { size: 9.5, bold: true, align: "middle" });
    T(P, x1 - 2, busY - 38, "Iкз(3)=" + f1(Ikz) + " кА; iуд=" + Iud + " кА", { size: 7, align: "end", color: "#33465e" });
    var drop = x0 + 46;
    if (ktp && cl.sec.id !== "SEC-UPS") {
      T(P, drop - 30, 72, "Ввод №" + (i + 1) + " 10(6) кВ, " + (i === 0 ? "основной" : "резервный"), { size: 7.2, align: "middle" });
      Ln(P, [drop, 76], [drop, 96]);
      e({ t: "c", x: drop + 9, y: 92, r: 9 }); Ln(P, [drop + 9, 83], [drop + 9, 101], 1.4); Ln(P, [drop + 18, 92], [drop + 36, 92], 1); e({ t: "c", x: drop + 42, y: 92, r: 6.5 }); T(P, drop + 42, 95, "A", { size: 6.2, align: "middle" }); T(P, drop - 8, 94, "TA" + (i + 1), { size: 7, bold: true, align: "end" }); T(P, drop + 22, 106, "150/5", { size: 6 }); e({ t: "r", x: drop + 56, y: 82, w: 26, h: 18, stroke: "#223344", sw: 1.1 }); Ln(P, [drop + 60, 96], [drop + 78, 96], 0.8); T(P, drop + 69, 94, "кВт·ч", { size: 5, align: "middle" }); T(P, drop + 69, 78, "P" + (i + 1), { size: 5.8, align: "middle", bold: true });
      Ln(P, [drop, 101], [drop, 122]);
      symTR(P, drop, 142, "T" + (i + 1), [(tAll ? f0(tAll.Str) : "—") + " кВА · сухой лит. IP20", "10(6)/0,4 В · Y/D · Uк 6%", "H класс · PTC · AF"]);
      Ln(P, [drop, 155], [drop, busY - 12]);
      Ln(P, [drop, busY - 12], [x0 + 60, busY - 12]);
      Ln(P, [x0 + 60, busY - 12], [x0 + 60, busY]);
      Nd(P, x0 + 60, busY);
    } else if (cl.sec.id === "SEC-UPS") {
      T(P, drop - 6, 96, "ИБП №1 · " + ((src && src.Sn_kVA) || "—") + " кВА · t авт " + ((src && src.params && src.params.autonomyMin) || 15) + " мин", { size: 6.6 });
      e({ t: "r", x: drop - 26, y: 106, w: 56, h: 40, stroke: "#c62828", sw: 1.3, fill: "#fdf1f1" });
      T(P, drop + 2, 122, "VFI", { size: 8, align: "middle", bold: true, color: "#c62828" });
      T(P, drop + 2, 132, "SS·1", { size: 6.4, align: "middle", color: "#c62828" });
      Ln(P, [drop + 2, 146], [x0 + 60, 190], 1.4);
      Ln(P, [x0 + 60, 190], [x0 + 60, busY]);
      Nd(P, x0 + 60, busY);
    } else {
      T(P, drop - 24, 84, "Ввод №" + (i + 1) + " ~400 В " + (i === 0 ? "рабочий" : "резервный"), { size: 6.6, align: "middle" });
      Ln(P, [drop, 88], [drop, 100]);
      e({ t: "c", x: drop + 8, y: 104, r: 9 }); Ln(P, [drop + 8, 95], [drop + 8, 113], 1.4); Ln(P, [drop + 17, 104], [drop + 30, 104], 1); e({ t: "c", x: drop + 36, y: 104, r: 6 }); T(P, drop + 36, 106.6, "A", { size: 6 }); T(P, drop - 2, 100, "TA" + (i + 1), { size: 6.4, bold: true, align: "end" });
      symQFa(P, drop - 10, 134, "QF" + (i + 1), qfIn((SrW * 1000) / 693 * 1.1) + " А · 4P", "эл. расцеп. LSI");
      e({ t: "r", x: drop + 86, y: 116, w: 26, h: 20, stroke: "#223344", sw: 1.2 });
      Ln(P, [drop + 90, 130], [drop + 108, 130], 0.9);
      T(P, drop + 99, 128, "кВт·ч", { size: 5.2, align: "middle" }); T(P, drop + 99, 110, "P" + (i + 1), { size: 5.6, align: "middle", bold: true }); T(P, drop + 99, 112, "P" + (i + 1), { size: 5.6, align: "middle", bold: true });
      Ln(P, [drop - 10, 149], [x0 + 60, 178], 1.3);
      Ln(P, [x0 + 60, 178], [x0 + 60, busY]);
      Nd(P, x0 + 60, busY);
    }
  });
  /* секционный АВР */
  if (cols.length >= 2) {
    var a0 = cols[0].x0 + cols[0].w - 22, a1 = cols[1].x0 + 8, mx = (a0 + a1) / 2;
    Ln(P, [a0 + 10, busY], [a1 - 10, busY], 9);
    Ln(P, [mx, busY], [mx, busY + 24], 1.8);
    e({ t: "l", x1: mx, y1: busY + 24, x2: mx - 7, y2: busY + 36, sw: 1.8 });
    e({ t: "r", x: mx + 2, y: busY + 42, w: 12, h: 8, stroke: "#223344", sw: 0.9 });
    Ln(P, [mx + 8, busY + 42], [mx + 8, busY + 50], 1.2);
    e({ t: "r", x: mx + 26, y: busY + 18, w: 20, h: 15, stroke: "#1b6ef3", sw: 1.2, fill: "#eef4ff" });
    T(P, mx + 36, busY + 29, "КМ", { size: 6.2, align: "middle", color: "#1b6ef3", bold: true });
    Ln(P, [mx + 14, busY + 46], [mx + 26, busY + 33], 0.9, "#1b6ef3", "2 3");
    T(P, mx - 8, busY + 14, "QF11", { size: 7, bold: true, align: "end" });
    T(P, mx - 14, busY + 56, "секционный", { size: 6, align: "end", color: "#1b6ef3" });
    T(P, mx - 14, busY + 65, "АВР t=0,5…10 с", { size: 5.8, align: "end", color: "#1b6ef3" });
  }
  /* фидеры */
  var laneGap = 4, kmNo = 0, maxRail = 0;
  cols.forEach(function (cl) {
    cl.unitAcc = 0;
    cl.cons.forEach(function (c, j) {
      var sp = workSplitV3(c);
      var fx0 = cl.x0 + 60 + cl.unitAcc * SLOTW + SLOTW / 2;
      var groupR = fx0 + (sp.nW - 1) * SLOTW;
      c._x = fx0 + (sp.nW - 1) * SLOTW / 2;
      var groupLX = fx0 - 14;
      var catTxt = c.category === "special" ? "особая гр." : "Кат. " + "I".repeat(Number(c.category) || 3);
      for (var u = 0; u < sp.nW; u++) {
        var fx = cl.x0 + 60 + cl.unitAcc * SLOTW + SLOTW / 2; cl.unitAcc += 1; DRAWN.w += 1;
        Ln(P, [fx, busY], [fx, busY + 12]); Nd(P, fx, busY);
        symQFa(P, fx, busY + 24, "QF" + (101 + idxOf(c)) + (sp.nW > 1 ? "-" + (u + 1) : ""), qfIn(sp.IrUnit) + " А · " + phLabel(c), catTxt + (sp.nW > 1 && u === 0 ? " · N=" + sp.nW + " шт" : ""));
        Ln(P, [fx, busY + 40], [fx, busY + (sp.nW > 1 ? 136 : 54)], 1.3);
      }
      var nm = (c.name || "").slice(0, 20);
      if (sp.nW > 1) {
        Ln(P, [fx0, busY + 136], [groupR, busY + 136], 1.3);
        T(P, c._x, busY + 128, "×" + sp.nW + " · " + f1(c.Pr) + " кВт сум.", { size: 6.2, align: "middle", color: "#33465e" });
      }
      T(P, groupLX, busY + 84, sp.nW > 1 ? nm + " ×" + sp.nW + " шт" : nm, { size: 7 });
      T(P, groupLX, busY + 99.5, phLabel(c) + (c.motor ? "·ЭД" : "") + (nChainOf(c) ? " · рез. " + nChainOf(c) + " шт" : ""), { size: 6.6, color: c.phases === 1 ? "#b26a00" : "#33465e" });
      T(P, groupLX, busY + 115, (sp.nW > 1 ? "Σ " : "") + f1(c.Pr) + " кВт · " + f0(c.Ir) + " А", { size: 6.6 });
      var cabN = cabForV3(c);
      T(P, groupLX, busY + (sp.nW > 1 ? 149 : 127), cabN.s ? (cabN.type + " " + cabN.cores + "×" + cabN.s + "·" + (c.cableLength_m || 30) + "м" + (cabN.du != null ? " ΔU " + (Math.round(cabN.du * 10) / 10) + "%" : "") + " NED") : "каб. —", { size: 6.2, color: "#33465e" });
      if (sp.nW === 1) { Ln(P, [fx0, busY + 54], [fx0, busY + 136], 1.3); symRec(P, fx0, busY + 144); }
      else symRec(P, c._x, busY + 144);
      if (c.category === "special") T(P, c._x + 12, busY + 140, "особ.", { size: 6, color: "#c62828" });
      T(P, c._x, busY + 157, "W" + (101 + idxOf(c)) + (sp.nW > 1 ? "(" + sp.nW + "×)" : ""), { size: 6, align: "middle", color: "#5a6a7e" });
    });
    /* резервные автоматы: на 2-й (резервной) секции, по одному на единицу Nрез */
    cl.cons.forEach(function (c) {
      var sp = workSplitV3(c);
      var nChain = hasRes(c) ? Math.max(1, sp.nR) : 0;
      if (!nChain) return;
      var target = cols.filter(function (cc) { return cc.sec.id === c.feedReserve.sectionId; })[0];
      if (!target) return; target.used = 1;
      target.tRes = (target.tRes || 0);
      for (var k = 0; k < nChain; k++) {
        var lrx = target.x0 + 60 + target.nLines * SLOTW + target.tRes * SLOTR + SLOTR / 2;
        target.tRes += 1; DRAWN.r += 1;
        Ln(P, [lrx, busY], [lrx, busY + 10]); Nd(P, lrx, busY);
        e({ t: "l", x1: lrx, y1: busY + 10, x2: lrx - 5, y2: busY + 22, sw: 1.6 });
        e({ t: "r", x: lrx - 4, y: busY + 28, w: 8, h: 4.6, stroke: "#223344", sw: 0.8 });
        e({ t: "l", x1: lrx, y1: busY + 12, x2: lrx, y2: busY + 24, sw: 1.6 });
        e({ t: "l", x1: lrx, y1: busY + 33, x2: lrx, y2: busY + 46, sw: 1.3 });
        T(P, lrx + 7, busY + 20, "QF" + (101 + idxOf(c)) + "р" + (nChain > 1 ? (k + 1) : ""), { size: 6.6, bold: true }); T(P, lrx + 7, busY + 28.5, "рез" + (nChain > 1 ? " " + (k + 1) : ""), { size: 5.2, color: "#1b6ef3" });
        var yr = target.busYr = (target.busYr || 148) + 18; // ниже всей текстовой зоны фидеров
        maxRail = Math.max(maxRail, yr);
        Ln(P, [lrx, busY + 46], [lrx, busY + yr], 1.2);
        Ln(P, [lrx, busY + yr], [c._x, busY + yr], 1.2, "#1b6ef3", "7 4");
        Ln(P, [c._x, busY + yr], [c._x, busY + 161], 1.2);
        Nd(P, c._x, busY + 161);
        var kx = (lrx + c._x) / 2;
        kmNo = (kmNo || 0) + 1; void 0;
        e({ t: "r", x: kx - 11, y: busY + yr - 13, w: 22, h: 10, stroke: "#1b6ef3", sw: 1.2, fill: "#eef4ff" });
        T(P, kx - 14, busY + yr - 16, "КМ" + kmNo, { size: 5.6, align: "end", bold: true, color: "#1b6ef3" });
        T(P, kx + 13, busY + yr - 16, "АВР " + f0(qfIn(sp.IrUnit)) + "А", { size: 5.0, color: "#1b6ef3" });
        Ln(P, [kx - 11, busY + yr - 8], [kx - 20, busY + yr - 8], 0.8, "#1b6ef3", "2 3");
      }
    });
  });
  function cabForV3(c) {
    var v = c.cable && c.cable.value ? Object.assign({}, c.cable.value) : {};
    var sp = workSplitV3(c);
    var n = (typeof nedSelectCable === "function") ? nedSelectCable((c.Ir || 0) * sp.k, (c.cableLength_m || 30), c.phases === 1 ? 1 : 3, c.cosPhi || 0.8, {}) : null;
    if (n && n.s) { v.s = Math.max(n.s, v.s || 0); v.cores = v.cores || (c.phases === 1 ? 3 : 5); v.du = n.dU; v.via = 1; v.type = v.type || "ВВГнг(А)-LS"; }
    else v.type = v.type || "ВВГнг(А)-LS";
    return v;
  }
  /* примечания (справа вверху) */
  var nx = totalW - 430;
  T(P, nx, 68, "Обозначения и требования (НТД РФ)", { size: 10, bold: true });
  var notes = [
    "QF101… — рабочие автоматы: по одному на каждую единицу приёмника (колонка N; при N>1 — QF101-1…-N); QF…р — резервные автоматы по числу Nрез на резервной секции через КМ местного АВР (эл.+мех. блокировки, ГОСТ 2.755/2.710). Колонка «Секция» задаёт принудительную шину потребителя.",
    "Кат. I — автоматическое восстановление питания от двух независимых вводов (ПУЭ п.1.2.14); особая группа — шина ИБП (GB + инвертор VFI, ГОСТ Р 51317.3/IEC 62040).",
    "Резервная мощность в расчёт ΣPр секций не включается (РТМ 36.18.32.4-92). Пусковые токи: самозапуск 1 ЭД — проверять.",
    "1-ф приёмники распределяются по фазам L1/L2/L3 автобалансировкой (колонка «Фаза»), контроль несимметрии — см. Табл.2 (ГОСТ 32144-2013 К2u≤5% ном.; ориентир перекоса ≤30%).",
    "Кабели — ВВГнг(А)-LS, отбор сечения каталогом NED-Plagum (IEC 60364-5-52 табл.1, ПУЭ гл.1.3): Iдоп ≥ Iр·Кр, ΔU ≤ 5%; по линии «к приёмнику» указаны L и ΔU из модели.",
    "Шины: 1 секция — рабочая, 2 — резервная (перемычка через QF11 с АВР). Т — сухие с литыми обмотками, IP20, класс H, упр. группа Y/D, Uк=6%. Iкз и уставки — уточнить расчётом РЗ (см. типовые схемы защит проекта).",
    "На листе: Табл.1 — спецификация цепей (N/Nрез, QF/QFрез, кабель), Табл.2 — фазная загрузка секций и перекос; Табл.3 — перечень сигналов АСУ Э (DCS): режимы QF/АВР, аварии ИБП/DS, U/I/T, — по интерфейсу RS-485 Modbus."
  ];
  ((m.feedErrors || []).slice(0, 4)).forEach(function (er) { notes.push("⚠ ОШИБКА МОДЕЛИ: " + er); });
  var ny = 80;
  notes.forEach(function (nt, ni) { wrapTxt(nt, 76).forEach(function (ln, ii) { T(P, nx + (ii ? 10 : 0), ny, ln, { size: 7.4, color: /ОШИБКА/.test(ln) ? "#c62828" : "#33465e" }); ny += 9.4; }); ny += 4; });
  /* Таблица 1 */
  var feederBottom = busY + Math.max(200, maxRail + 40);
  var ty = Math.max(feederBottom, ny + 10) + 26;
  T(P, 20, ty, "Таблица 1 — цепи: приёмники, автоматы (раб./рез.), кабели NED", { size: 11, bold: true });
  var heads = ["№", "Приёмник", "Кат.", "φ", "N", "Nрез", "Pр раб, кВт", "Iр раб, А", "QF раб.", "QF рез. (кажд.)", "Кабель NED", "L,м", "Раб. ввод/секц.", "Рез. ввод/секц."];
  var nums = [1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  var rowsD = [];
  (m.consumers || []).forEach(function (c, i) {
    var sp = workSplitV3(c), has = hasRes(c), cabN = cabForV3(c);
    rowsD.push([String(i + 1), (c.name || "").slice(0, 22), c.category === "special" ? "спец" : "I".repeat(Number(c.category) || 3),
      c.phases === 1 ? (c.phase || "авт") : "3~", String(c.qty || 1), sp.nR ? String(sp.nR) : "—",
      f1(c.Pr), f0(c.Ir), sp.nW > 1 ? ("QF" + (101 + i) + "-1…" + sp.nW + " · " + qfIn(sp.IrUnit) + "А ×" + sp.nW) : ("QF" + (101 + i) + " " + qfIn(c.Ir * sp.k) + "А"), (has && nChainOf(c)) ? ("QF" + (101 + i) + "р" + (sp.nR > 1 ? "…р" + sp.nR : "") + " " + qfIn(sp.IrUnit) + "А" + (nChainOf(c) > sp.nR ? " (кат.I min 1 цепь)" : "")) : "—",
      cabN.s ? (cabN.cores + "×" + cabN.s) : "—", String(c.cableLength_m || 30),
      c.feedWork ? (c.feedWork.sourceId + "/" + c.feedWork.sectionId) : "—", has ? (c.feedReserve.sourceId + "/" + c.feedReserve.sectionId) : "—"]);
  });
  var FS = 11, PADc = 6;
  function cwid(s) { return String(s).length * FS * 0.72 + 10; }
  var cw = heads.map(function (hx, i2) { var wq = cwid(hx); rowsD.forEach(function (rw) { var w2 = cwid(rw[i2]); if (w2 > wq) wq = w2; }); return Math.max(wq, 40); });
  var tx0 = 20, tyy = ty + 14, rh = 17;
  var tot = cw.reduce(function (a2, b2) { return a2 + b2; }, 0);
  function grid(yT, yB) { var xx = tx0; for (var q = 0; q <= cw.length; q++) { Ln(P, [xx, yT], [xx, yB], 3.4, "#223344"); if (q < cw.length) xx += cw[q]; } Ln(P, [tx0, yT], [tx0 + tot, yT], 4.2, "#223344"); Ln(P, [tx0, yB], [tx0 + tot, yB], 4.2, "#223344"); }
  grid(tyy, tyy + rh);
  (function () { var xx = tx0; heads.forEach(function (hx, i2) { T(P, xx + 3, tyy + rh - 5.5, hx, { size: FS, bold: true }); xx += cw[i2]; }); })();
  rowsD.forEach(function (rw, r2) { var ry = tyy + rh * (r2 + 1); grid(ry, ry + rh); var xx = tx0; rw.forEach(function (v, i2) { if (nums[i2]) T(P, xx + cw[i2] - 4, ry + rh - 5.5, v, { size: FS, align: "end" }); else T(P, xx + 3, ry + rh - 5.5, v, { size: FS }); xx += cw[i2]; }); });
  var yy = tyy + rh * (rowsD.length + 2) + 10;
  P.W = Math.max(P.W, tx0 + tot + 60);
  T(P, 20, yy, "Итого: приёмников = " + nOp + " ; рабочих автоматов на листе = " + DRAWN.w + " (=ΣN ✓) ; резервных автоматов QF…р = " + DRAWN.r + " (=Σmax(Nрез,1 по кат.I/II), каждый — отдельный автомат с КМ на резервной секции ✓). Резервная нагрузка в ΣPр не входит (РТМ).", { size: 10 });
  /* Таблица 2 — симметрия по секциям (рабочая) */
  var pbY = yy + 22;
  T(P, 20, pbY, "Таблица 2 — фазная загрузка секций (рабочие нагрузки; ГОСТ 32144-2013, порог перекоса " + (m.imbalanceThresholdPct || 15) + " %, пред. 30 %)", { size: 10, bold: true });
  var pbH = ["Секция", "Uф L1, кВт", "L2, кВт", "L3, кВт", "Перекос, %", "Заключение"];
  var pbRows = cols.map(function (cl) {
    var sums = { L1: 0, L2: 0, L3: 0 };
    cl.cons.forEach(function (c) { var sp = workSplitV3(c); var PrWk = (c.Pr || 0) * sp.k; if (c.phases === 1) { var p0 = c.phase || "L1"; if (sums[p0] === undefined) p0 = "L1"; sums[p0] += PrWk; } else { sums.L1 += PrWk / 3; sums.L2 += PrWk / 3; sums.L3 += PrWk / 3; } });
    var mx0 = Math.max(sums.L1, sums.L2, sums.L3), mn0 = Math.min(sums.L1, sums.L2, sums.L3), avg = (sums.L1 + sums.L2 + sums.L3) / 3;
    var im = avg > 0 ? (mx0 - mn0) / avg * 100 : 0;
    var verdict = im > 30 ? "✗ перекос > 30 %" : im > (m.imbalanceThresholdPct || 15) ? "⚠ >порога" : "✓ норма";
    return [cl.sec.id.replace("SEC-", "Секц. "), f1(sums.L1), f1(sums.L2), f1(sums.L3), f1(im), verdict];
  });
  var FS2 = 10;
  var cw2 = pbH.map(function (hx, i2) { var wq = String(hx).length * FS2 * 0.72 + 10; pbRows.forEach(function (rw) { var w2 = String(rw[i2]).length * FS2 * 0.72 + 10; if (w2 > wq) wq = w2; }); return Math.max(wq, 56); });
  var tot2 = cw2.reduce(function (a2, b2) { return a2 + b2; }, 0);
  var t2y = pbY + 14;
  function grid2(yT, yB) { var xx = tx0; for (var q = 0; q <= cw2.length; q++) { Ln(P, [xx, yT], [xx, yB], 3, "#223344"); if (q < cw2.length) xx += cw2[q]; } Ln(P, [tx0, yT], [tx0 + tot2, yT], 4, "#223344"); Ln(P, [tx0, yB], [tx0 + tot2, yB], 4, "#223344"); }
  grid2(t2y, t2y + 16);
  (function () { var xx = tx0; pbH.forEach(function (hx, i2) { T(P, xx + 3, t2y + 11, hx, { size: FS2, bold: true }); xx += cw2[i2]; }); })();
  pbRows.forEach(function (rw, r2) {
    var ry = t2y + 16 * (r2 + 1); grid2(ry, ry + 16);
    var xx = tx0; rw.forEach(function (v, i2) { var col = i2 === 5 ? (String(v).indexOf("✗") >= 0 ? "#c62828" : String(v).indexOf("⚠") >= 0 ? "#b26a00" : "#1b8a3f") : "#223344"; T(P, xx + (i2 ? 3 : 3), ry + 11.5, v, { size: FS2, color: col, bold: i2 === 5 }); xx += cw2[i2]; });
  });
  yy = t2y + 16 * (pbRows.length + 2) + 8;
  T(P, 20, yy, "Перераспределение: 1-ф приёмник с наибольшей загрузкой переносится на недогруженную фазу/секцию при перекосе >30 % (колонка «Фаза»); резервные цепи в перекосе не участвуют.", { size: 9, color: "#33465e" });
  P.W = Math.max(P.W, tx0 + tot2 + 60, nx + 440);
  mmSheet(P);
  P.H = yy + 150; /* запас под основную надпись по ГОСТ 2.1105 (55 мм) + поля рамки */
  mmSheet(P); sheetFrame(P, { title: "Схема электрическая однолинейная · КТП/НКУ · модель " + (m.supplyMode || "2in") }); return P;
}

function noModelSheet(k) {
  var P = { W: 900, H: 120, els: [] };
  T(P, 20, 40, "Цифровая модель сети не построена: нажмите «Обновить модель сети» (или «Проект KTP-1») — схема строится из неё.", { size: 7, color: "#c62828" });
  return mmSheet(P);
}
/* ============ СТРУКТУРА ПАНЕЛЕЙ ПО МОДЕЛИ ============ */
function buildPanel() {
  var m = NET(); if (!m) return noModelSheet("panel");
  adjPanels(m);
  var P = { W: 1600, H: 300, els: [] };
  var e = function (o) { P.els.push(o); };
  T(P, 20, 26, "Схема структуры панелей НКУ — по модели сети (панели " + ((m.panels || []).length) + ")", { size: 10, bold: true });
  var py = 60;
  (m.panels || []).forEach(function (pan, pi) {
    var scale = 0.28;
    var wpx = Math.max(340, (pan.width_disp_mm || pan.width_mm) * scale);
    var sec = secById(m, pan.sectionId);
    var role = sec ? secRole(m, sec, 0) : { label: pan.sectionId };
var cons = (pan.feederIds || []).map(function (id) { return (m.consumers || []).filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);
    var units = []; cons.forEach(function (cc2) { var n2 = workSplitV3(cc2).nW; for (var uu = 0; uu < n2; uu++) units.push({ c: cc2, u: uu, n: n2 }); });
    var resUnits = (pan.resIds || []).length;
    e({ t: "r", x: 24, y: py, w: wpx, h: 150, fill: "#f6faff", stroke: "#223344", sw: 1.3 });
    T(P, 28, py - 6, pan.name + " · секция " + pan.sectionId + (pan.sectionId === "SEC-UPS" ? " · особая гр / ИБП" : pan.sectionId === "SEC-A" ? " · рабочая" : " · резервная") + " · Ш×Г×В = " + (pan.width_disp_mm || pan.width_mm) + "×" + pan.depth_mm + "×" + pan.height_mm + " мм" + (pan.resUnits ? " (вкл. " + pan.resUnits + " рез. мод.)" : ""), { size: 6.8, bold: true });
    e({ t: "r", x: 30, y: py + 12, w: 58, h: 126, stroke: "#98a4b5", sw: 0.8 });
    T(P, 34, py + 26, "Ввод " + role.label, { size: 5 });
    T(P, 34, py + 36, f0((cons.reduce(function (a, c) { return a + (c.Sr || 0); }, 0) * 1000 / 693 || 0)) + " А", { size: 5.6 });
    var cell = Math.min(64, (wpx - 100) / Math.max(1, units.length + resUnits));
    units.forEach(function (un, j2) { var c = un.c;
      var cx2 = 96 + j2 * cell;
      e({ t: "r", x: cx2, y: py + 12, w: cell - 4, h: 126, stroke: "#98a4b5", sw: 0.8 });
      T(P, cx2 + 2, py + 24, "QF" + (101 + m.consumers.indexOf(c)) + (un.n > 1 ? "-" + (un.u + 1) : ""), { size: 4.8, bold: true });
      T(P, cx2 + 2, py + 33, (val(c.qf, "—")) + "А", { size: 4.8 });
      T(P, cx2 + 2, py + 42, c.phases === 1 ? (c.phase || "авто φ") : "3~", { size: 4.6, color: c.phases === 1 ? "#b26a00" : "#33465e" });
      T(P, cx2 + 2, py + 52, (c.name || "").slice(0, 10), { size: 4.4 });
      if (c.feedReserve) { e({ t: "r", x: cx2 + 2, y: py + 58, w: 12, h: 10, stroke: "#1b6ef3", sw: 0.8 }); T(P, cx2 + 4, py + 66, "А", { size: 4.4, color: "#1b6ef3" }); }
    });
    (pan.resIds || []).forEach(function (rid, j3) {
      var cxR = 96 + (units.length + j3) * cell;
      e({ t: "r", x: cxR, y: py + 12, w: cell - 4, h: 126, stroke: "#1b6ef3", sw: 0.9, dash: "6 3" });
      T(P, cxR + 2, py + 24, "QF" + rid, { size: 4.8, bold: true, color: "#1b6ef3" });
      T(P, cxR + 2, py + 33, "резерв", { size: 4.4, color: "#1b6ef3" });
    });
    py += 176;
  });
  mmSheet(P);
  P.H = py + 150; /* запас под штамп */
  mmSheet(P); sheetFrame(P, { title: 'Схема структура панелей НКУ' }); return P;
}
/* ============ ПЛАНИРОВКА ПО МОДЕЛИ ============ */
function layoutModel() {
  var t = CMP() || { Str: 250, Qc: 0 };
  var m = NET(); if (m) adjPanels(m);
  var b = []; var S = trSize(m && m.group && m.group.Sr ? Math.max(250, m.group.Sr / (m.supplyMode && /DES/.test(m.supplyMode) ? 2 : 2)) : t.Str);
  if (isKtp()) {
    b.push({ id: "T1", x: 700, y: 700, w: S.w, d: S.d, l: "Сухой тр-р T1 (раб. 100 %)" });
    b.push({ id: "T2", x: 700 + S.w + 1200, y: 700, w: S.w, d: S.d, l: "Сухой тр-р T2 (рез. 100 %)" });
    var panels = (m && m.panels ? m.panels : []).filter(function (p) { return !/UPS/.test(p.sectionId || ""); });
    var rowY = 700 + S.d + 1500;
    var px = 700;
    panels.forEach(function (p, i) {
      b.push({ id: p.id || ("P" + (i + 1)), x: px, y: rowY, w: (p.width_disp_mm || p.width_mm), d: p.depth_mm, l: p.name + (p.resUnits ? " (+рез " + p.resUnits + ")" : "") });
      px += p.width_mm + 1000;
    });
    if (!panels.length) { b.push({ id: "НКУ1", x: 700, y: rowY, w: 2600, d: 800, l: "Панель НКУ-1 (A)" }, { id: "НКУ2", x: 4300, y: rowY, w: 2600, d: 800, l: "Панель НКУ-2 (B)" }); px = 6600; }
    if (m && /UPS/.test(m.supplyMode || "")) b.push({ id: "УЗИК", x: px, y: rowY, w: 900, d: 600, l: "НКУ ИБП (УЗИК)" });
    if ((t.Qc || 0) > 120) b.push({ id: "УКРМ", x: 700, y: rowY + 800 + 1500, w: 1300, d: 600, l: "УКРМ-0,4" });
    b.room = { w: Math.max(px + 2000 + 700 - 0, 700 * 2 + S.w * 2 + 1200), d: rowY + 800 + 1500 + ((t.Qc || 0) > 120 ? 600 + 1000 : 200) };
  } else {
    var panels2 = (m && m.panels ? m.panels : []);
    var x2 = 700;
    panels2.forEach(function (p) { b.push({ id: p.id, x: x2, y: 1000, w: (p.width_disp_mm || p.width_mm), d: p.depth_mm, l: p.name + (p.resUnits ? " (+рез)" : "") }); x2 += p.width_mm + 1000; });
    if (!panels2.length) { b.push({ id: "НКУ", x: 700, y: 1000, w: 600 + ((m ? m.consumers.length : 4)) * 200 + 200, d: 800, l: "Панель НКУ" }); x2 = 700 + b[0].w + 1000; }
    if ((t.Qc || 0) > 120) b.push({ id: "УКРМ", x: x2, y: 1000, w: 1300, d: 600, l: "УКРМ-0,4" });
    b.room = { w: x2 + 2000, d: 1000 + 800 + 1500 + 0 };
  }
  return b;
}
function renderLayout() {
  var box = $("gd-layout"); if (!box) return;
  var mm = layoutModel(); var room = mm.room || { w: 4000, d: 3000 };
  var over = (LS().layout) || {};
  mm.forEach(function (x) { if (over[x.id] && !x.room) { x.x = over[x.id][0]; x.y = over[x.id][1]; } });
  var pad = 1500;
  var P = { W: room.w + pad * 2, H: room.d + pad * 2, els: [], kind: "lay" };
  function e2(o) { P.els.push(o); }
  T(P, pad, 46, "Планировка размещения электрооборудования (из цифровой модели сети; перемещение мышью, шаг 50 мм)", { size: 8.5, bold: true });
  Ln(P, [pad, pad], [pad + room.w, pad], 2.4); Ln(P, [pad + room.w, pad], [pad + room.w, pad + room.d], 2.4);
  Ln(P, [pad + room.w, pad + room.d], [pad, pad + room.d], 2.4); Ln(P, [pad, pad + room.d], [pad, pad], 2.4);
  dimH(P, pad, pad + room.w, pad + room.d + 140, String(room.w));
  dimV(P, pad - 160, pad, pad + room.d, String(room.d));
  var dY = pad + room.d - 1100;
  P.els.push({ t: "l", x1: pad, y1: dY + 1000, x2: pad, y2: dY, sw: 3.5, color: "#b26a00" });
  e2({ t: "c", x: pad, y: dY, r: 1000, dash: "4 3", color: "#b26a00" });
  T(P, pad + 20, dY + 40, "дверь 1000×2000, наружу", { size: 5.8, color: "#b26a00" });
  mm.forEach(function (x) {
    if (x.room) return;
    var X0 = pad + x.x, Y0 = pad + x.y;
    e2({ t: "r", x: X0, y: Y0, w: x.w, h: x.d, fill: /НКУ|панел|УЗИК/i.test(x.l) ? "#dbe8ff" : /^Сухой|тр-р|T1|T2/.test(x.l) ? "#ffe9c7" : "#e9f6e9", stroke: "#223344", sw: 1.5 });
    T(P, X0 + 6, Y0 + 22, x.l, { size: 6.8, bold: true });
    T(P, X0 + 6, Y0 + 36, "Ш×Г=" + x.w + "×" + x.d + " мм", { size: 6.2, color: "#33465e" });
    dimH(P, X0, X0 + x.w, Y0 + x.d + 26, String(x.w));
    dimV(P, X0 - 40, Y0, Y0 + x.d, String(x.d));
  });
  LS()._blocks = mm.slice();
  box._P = P;
  box.innerHTML = prims2svg(P, 0.6);
  wireDrags(box);
  renderChecks();
}
function renderChecks() {
  var chk = $("gd-check"); if (!chk) return;
  var mm = (LS()._blocks || []);
  var model = layoutModel(); var room = model.room;
  var over = LS().layout || {};
  mm.forEach(function (x) { if (over[x.id]) { x.x = over[x.id][0]; x.y = over[x.id][1]; } });
  var rows = [];
  function add(rw, f, ok) { rows.push({ r: rw, f: f + (ok ? " ✓" : " ✗"), ok: ok }); }
  var REQs = { front: 1500, backNU: 1000, trBack: 700, trSide: 700, trBetween: 1200 };
  var m = NET();
  mm.forEach(function (x) {
    var front = room.d - (x.y + x.d), back = x.y, left = x.x, right = room.w - (x.x + x.w);
    var isN = /НКУ|панел|УЗИК/i.test(x.l), isC = /УКРМ/i.test(x.l), isT = /тр-р/i.test(x.l);
    var needF = isC ? 1000 : REQs.front;
    add("Проход перед «" + x.l + "» ≥ " + needF, f0(front) + " мм", front >= needF);
    if (!isC) add("Тыловой/задний зазор «" + x.l + "» ≥ " + (isN ? REQs.backNU : REQs.trBack), f0(back), back >= (isN ? REQs.backNU : REQs.trBack));
    add("Боковой зазор «" + x.l + "» ≥ " + (isN || isC ? 500 : REQs.trSide), f0(Math.min(left, right)), Math.min(left, right) >= (isN || isC ? 500 : REQs.trSide));
  });
  for (var i2 = 0; i2 < mm.length; i2++) for (var j2 = i2 + 1; j2 < mm.length; j2++) {
    var A = mm[i2], B = mm[j2];
    var gx = Math.max(B.x - A.x - A.w, A.x - B.x - B.w), gy = Math.max(B.y - A.y - A.d, A.y - B.y - B.d);
    if (gx <= 0 && gy <= 0) add("Пересечение габаритов", A.l + " / " + B.l, false);
    else {
      var g = Math.max(gx, gy);
      var need = (/тр-р/.test(A.l) && /тр-р/.test(B.l)) ? REQs.trBetween : (/тр-р/.test(A.l + B.l) ? 1500 : 1000);
      if (g < need) add("Расстояние «" + A.id + "» ↔ «" + B.id + "» ≥ " + need, f0(g) + " мм", false);
      else add("Расстояние «" + A.id + "» ↔ «" + B.id + "» ≥ " + need, f0(g) + " мм ✓", true);
    }
  }
  add("Дверь эвакуационная (наружу) ≥900", "1000×2000", true);
  if (m && m.phaseBalance) add("Несимметрия фаз (модель сети): порог " + (m.imbalanceThresholdPct || 15) + " %", f1(m.phaseBalance.imbalancePct) + " %" + (m.phaseBalance.warning ? " — превышение" : ""), !m.phaseBalance.warning);
  if (m && m.feedErrors && m.feedErrors.length) add("Резервирование Кат.I по модели", m.feedErrors.length + " ошибок", false);
  var html = "<table style='width:100%;font-size:.82rem'><tr><th>Проверка (НТД РФ / модель сети)</th><th>Факт</th><th></th></tr>" +
    rows.map(function (i3) { return "<tr><td>" + String(i3.r).replace(/</g, "&lt;") + "</td><td>" + i3.f + "</td><td class='" + (i3.ok ? "ok" : "bad") + "'>" + (i3.ok ? "✓" : "✗") + "</td></tr>"; }).join("") + "</table>" +
    "<p class='note'>Проходы — ПУЭ (гл. 4.2/2.5), СП 256.1325800; распределение и резервирование приёмников — цифровой моделью сети; перемещайте блоки — проверки пересчитываются.</p>";
  chk.innerHTML = html;
}
/* --- перетаскивание --- */
function wireDrags(box) {
  var sv = box.querySelector("svg"); if (!sv) return;
  var P = box._P; var drag = null;
  function mmPt(ev) { var r = sv.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * P.W, y: (ev.clientY - r.top) / r.height * P.H }; }
  sv.addEventListener("pointerdown", function (ev) {
    var p = mmPt(ev); var bl = LS()._blocks || []; var pad = 1500;
    for (var i = bl.length - 1; i >= 0; i--) {
      var x = bl[i]; if (!x || x.id === "room") continue;
      var X0 = pad + x.x, Y0 = pad + x.y;
      if (p.x >= X0 && p.x <= X0 + x.w && p.y >= Y0 && p.y <= Y0 + x.d) { drag = { id: x.id, ox: p.x - x.x - pad, oy: p.y - x.y - pad }; break; }
    }
    if (drag && sv.setPointerCapture) sv.setPointerCapture(ev.pointerId);
  });
  sv.addEventListener("pointermove", function (ev) {
    if (!drag) return;
    var p = mmPt(ev); var it = (LS()._blocks || []).filter(function (z) { return z.id === drag.id; })[0]; if (!it) return;
    it.x = Math.round((p.x - drag.ox) / 50) * 50; it.y = Math.round((p.y - drag.oy) / 50) * 50;
    it.x = Math.max(0, it.x); it.y = Math.max(0, it.y);
    if (!LS().layout) LS().layout = {};
    LS().layout[it.id] = [it.x, it.y];
    renderLayout();
  });
  sv.addEventListener("pointerup", function () { drag = null; });
}
/* --- UI --- */
var lastKind = "sl";
function renderScheme(kind) {
  lastKind = kind;
  var box = $("gd-scheme"); if (!box) return;
  var P = kind === "panel" ? buildPanel() : buildSingleLine();
  box._P = P; box.dataset.kind = kind;
  box.innerHTML = prims2svg(P, 1.9); void 0;
}
function bindUi() {
  var b1 = $("btn-gsl"), b2 = $("btn-gpanel"), b3 = $("btn-glayout"), b4 = $("btn-gdxf"), b5 = $("btn-gdxf-lay"), b6 = $("btn-greset");
  if (!b1) return;
  b1.onclick = function () { renderScheme("sl"); };
  b2.onclick = function () { renderScheme("panel"); };
  b3.onclick = function () { renderLayout(); };
  b4.onclick = function () {
    var box = $("gd-scheme"); if (!box || !box._P) renderScheme(lastKind);
    if (window.__downloadPdfSheet) window.__downloadPdfSheet(box._P, (isKtp() ? "ktp" : "nku") + "-shema-1ln", "Схема электрическая однолинейная — лист А1");
  };
  b5.onclick = function () {
    renderLayout();
    if (window.__downloadPdfSheet) window.__downloadPdfSheet($("gd-layout")._P, "planirovka-04", "Планировка размещения — лист А1");
  };
  b6.onclick = function () { LS().layout = {}; renderLayout(); };
  if ($("site-type")) $("site-type").addEventListener("change", function () {
    if ($("gd-scheme")._P) renderScheme(lastKind);
    if ($("gd-layout")._P) renderLayout();
  });
  if ($("supply-mode")) $("supply-mode").addEventListener("change", function () { setTimeout(function () { try { reRenderAll(); } catch (e) {} }, 30); });
}
document.addEventListener("DOMContentLoaded", bindUi);
if (document.readyState !== "loading") bindUi();
function reRenderAll() { try { if ($("gd-scheme") && $("gd-scheme")._P) renderScheme(lastKind); if ($("gd-layout") && $("gd-layout")._P) renderLayout(); } catch (e) {} }
(function waitLa(n){ /* авто-построение листа после готовности модели (паттерн 210c01b) */
  if (window.__LA && window.LoadsCore && window.__NetModelUI) { setTimeout(function(){ try { if (!$("gd-scheme")._P) renderScheme("sl"); } catch(e) {} }, 120); return; }
  if (n < 100) setTimeout(function(){ waitLa(n+1); }, 50);
})(0);
var __prevGd = window.__gdRefresh;
window.gdTest = { buildSingleLine: buildSingleLine, buildPanel: buildPanel, layoutModel: layoutModel, NET: NET };
window.__gdRefresh = function () { if (__prevGd) try { __prevGd(); } catch (e) {} setTimeout(reRenderAll, 5); };
})();
