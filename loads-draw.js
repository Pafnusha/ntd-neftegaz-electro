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
function phStr(c) { return c.phases === 1 ? ("1~ · " + (c.phase || "")) : "3~ L1-L2-L3"; }
/* ============ ОДНОЛИНЕЙНАЯ СХЕМА ПО МОДЕЛИ ============ */
function buildSingleLine() {
  var m = NET();
  if (!m) return noModelSheet("однолинейная");
  var ktp = isKtp();
  var secs = (m.sections || []).slice();
  var tAll = CMP();
  var nOp = (m.consumers || []).length;
  var nRes = 0;
  function idxOf(c) { return m.consumers.indexOf(c); }
  /* --- колонки секций --- */
  var cols = [];
  secs.forEach(function (sec, i) {
    var cons = consOfSec(m, sec.id);
    cols.push({ sec: sec, idx: i, cons: cons, n: cons.length });
  });
  var colW = 104, x = 40;
  cols.forEach(function (c) { c.x0 = x; c.w = 96 + c.n * colW; x += c.w + 130; });
  var totalW = Math.max(x + 400, 1400);
  var busY = 214;
  var P = { W: totalW, H: 700, els: [] };
  var e = function (o) { P.els.push(o); };
  var Ikz = ikzOf(m);
  T(P, 20, 26, "Схема электрическая однолинейная — " + (ktp ? "КТП 10(6)/0,4 кВ" : "щит НКУ 0,4 кВ") + " · цифровая модель сети (" + (m.supplyMode || "2in") + ")", { size: 10, bold: true });
  var nResTot = (m.consumers || []).filter(function (c) { return c.feedReserve && c.feedWork && c.feedReserve.sectionId && c.feedReserve.sectionId !== c.feedWork.sectionId; }).length;
  T(P, 20, 40, "ГОСТ 2.702-2011/2.701-2008; УГО — ГОСТ 2.7х ЕСКД. Рабочих аппаратов QF 101…10" + (100 + nOp) + " — N=" + nOp + " (по числу приёмников); резервных QF…р — M=" + nResTot + ". Резервная нагрузка в расчёт мощности не входит (РТМ 36.18.32.4-92, ПУЭ п.1.2.14): резервные аппараты подключены ко второй секции шин через местные АВР.", { size: 6.2, color: "#33465e" });
  var resSlots = {};
  function cabFor(c) {
    var v = c.cable && c.cable.value ? Object.assign({}, c.cable.value) : {};
    var n = (typeof nedSelectCable === "function") ? nedSelectCable(c.Ir || 0, c.cableLength_m || 30, c.phases === 1 ? 1 : 3, c.cosPhi || 0.8, {}) : null;
    if (n && n.s) { v.s = Math.max(n.s, v.s || 0); v.cores = v.cores || (c.phases === 1 ? 3 : 5); v.du = n.dU; v.via = "NED-Plagum"; }
    v.type = v.type || "ВВГнг(А)-LS";
    return v;
  }
  function hasRes(c) { return c.feedReserve && c.feedWork && c.feedReserve.sectionId && c.feedReserve.sectionId !== c.feedWork.sectionId; }
  cols.forEach(function (cl, i) {
    var cx0 = cl.x0, cx1 = cl.x0 + cl.w - 26, cx = (cx0 + cx1) / 2;
    var role = secRole(m, cl.sec, i);
    Ln(P, [cx0 + 48, busY], [cx1 - 6, busY], 3.2);
    var PrWork = cl.cons.reduce(function (s, c) { return s + (c.Pr || 0); }, 0);
    var SrWork = cl.cons.reduce(function (s, c) { return s + (c.Sr || 0); }, 0);
    var PrRes = cl.cons.reduce(function (s, c) { return s + (hasRes(c) ? (c.Pr || 0) : 0); }, 0);
    T(P, cx0 + 2, busY - 8, role.label + " · секция " + cl.sec.id + " · ΣРр раб. " + f1(PrWork) + " кВт · Iр " + f0(SrWork * 1000 / (1.717 * 400)) +
      " А; резерв на секции " + f1(PrRes) + " кВт (в ΣРр не входит)", { size: 6.3, bold: true });
    var src = srcOf(m, (cl.sec.fedBy || [])[0] || "");
    if (ktp && cl.sec.id !== "SEC-UPS") {
      T(P, cx - 96, 60, "Ввод №" + (i + 1) + ": 10(6) кВ от ПС (секция РУВН " + (i + 1) + ")", { size: 5.8 });
      Ln(P, [cx - 30, 64], [cx - 30, 80]);
      symTA(P, cx - 16, 74, "150/5");
      Ln(P, [cx - 30, 80], [cx - 30, 98]);
      symTR(P, cx - 30, 116, "T" + (i + 1), [(tAll ? f0(tAll.Str) : "—") + " кВА · сухой литой · IP20 · F/H", "Uк=6% · 10(6)/0,4 · Y/D", "термозащита PTC · охл. AF"]);
      Ln(P, [cx - 30, 129], [cx - 30, busY]);
      Nd(P, cx - 30, busY);
    } else if (ktp && cl.sec.id === "SEC-UPS") {
      T(P, cx - 112, 78, "ИБП-1 · " + ((src && src.Sn_kVA) || "—") + " кВА · авто " + ((src && src.params && src.params.autonomyMin) || 15) + " мин", { size: 6, bold: true });
      T(P, cx - 112, 90, "VFI·SS·1 · стат.байпас · питание спец. нагрузки", { size: 5.6, color: "#5a6a7e" });
      Ln(P, [cx - 30, 102], [cx - 30, busY]); Nd(P, cx - 30, busY);
    } else {
      T(P, cx - 96, 58, "Ввод №" + (i + 1) + " ~400 В (секция ПС " + (i + 1) + ")", { size: 5.8 });
      Ln(P, [cx - 30, 62], [cx - 30, 80]);
      symQFa(P, cx - 30, 92, "QF" + (i + 1), f0(val(src && src.Sn_kVA ? src.Sn_kVA * 1000 / (1.717 * 400) : 250, 250)) + " А", "эл. расцеп. LSI" + (i ? " · АВР" : " (рабочий)"));
      meter(P, cx + 10, 96);
      Ln(P, [cx - 30, 106], [cx - 30, busY]); Nd(P, cx - 30, busY);
      T(P, cx - 78, 124, "учёт ПА/Вт · TA", { size: 5.2, color: "#5a6a7e" });
    }
    resSlots[cl.sec.id] = resSlots[cl.sec.id] || 0;
    cl.cons.forEach(function (c, j) {
      c._x = cx0 + 56 + (j + 0.5) * ((cl.w - 66) / Math.max(1, cl.n));
      c._sec = cl;
    });
  });
  /* --- фидеры раб. + резервные --- */
  var reserveLinks = [];
  cols.forEach(function (cl) {
    cl.cons.forEach(function (c, j) {
      var fx = c._x, cx0 = cl.x0;
      var qf = val(c.qf, "—"); var cab = c.cable && c.cable.value ? c.cable.value : null;
      var catStr = c.category === "special" ? "спец" : "Кат." + "I".repeat(Number(c.category) || 3);
      Ln(P, [fx, busY], [fx, busY + 14]); Nd(P, fx, busY);
      symQFa(P, fx, busY + 26, "QF" + (101 + idxOf(c)), qf + " А · " + (c.phases === 1 ? "2P·" + (c.phase || "") : "4P·3~"), "раб · " + catStr);
      Ln(P, [fx, busY + 42], [fx, busY + 104], 1.2);
      if (hasRes(c)) { symRelay(P, fx + 30, busY + 58, "АВР"); }
      T(P, fx - 48, busY + 72, (c.name || "").slice(0, 21), { size: 5.6 });
      T(P, fx - 48, busY + 80, phStr(c) + (c.motor ? "·ЭД" : "") + (Number(c.qty) > 1 ? " · " + c.qty + " шт" : ""), { size: 5.2, color: c.phases === 1 ? "#b26a00" : "#33465e" });
      T(P, fx - 48, busY + 88, f1(c.Pr) + " кВт · " + f0(c.Ir) + " А (рез. " + f0(c.Ir) + " А)", { size: 5.2 });
      var cabN = cabFor(c);
      var cabTxt = cabN.s ? (cabN.type + " " + cabN.cores + "×" + cabN.s + " · L=" + (c.cableLength_m || 30) + " м" + (cabN.du != null ? " · ΔU=" + Math.round(cabN.du * 10) / 10 + "%" : "") + (cabN.via ? " · NED" : "")) : "каб. —";
      T(P, fx - 48, busY + 96, cabTxt, { size: 5.0, color: "#33465e" });
      symRec(P, fx, busY + 110);
      if (hasRes(c)) reserveLinks.push({ c: c, fx: fx, cl: cl });
    });
  });
  reserveLinks.forEach(function (rl, k) {
    var c = rl.c;
    var target = cols.filter(function (cc) { return cc.sec.id === c.feedReserve.sectionId; })[0];
    if (!target) return;
    nRes += 1;
    var slot = resSlots[target.sec.id] = (resSlots[target.sec.id] || 0) + 1;
    var lx = Math.max(target.x0 + 50 + slot * 2, Math.min(rl.fx + 16 + k * 2, target.x0 + target.w - 40));
    Ln(P, [lx, busY], [lx, busY + 14]); Nd(P, lx, busY);
    symQFa(P, lx, busY + 30, "QF" + (101 + idxOf(c)) + "р", val(c.qf, "—") + " А", "резерв");
    var yj = busY + 52 + (idxOf(c) % 3) * 6;
    Ln(P, [lx, busY + 46], [lx, yj], 1.2);
    Ln(P, [lx, yj], [rl.fx, yj], 1.2);
    Ln(P, [rl.fx, yj], [rl.fx, yj + 4], 1.2);
    Nd(P, rl.fx, yj);
    Ln(P, [rl.fx + 30, busY + 50], [lx + 30, busY + 40], 0.7, "#1b6ef3", "3 2");
    T(P, (rl.fx + lx) / 2 + 10, busY + 40, "блокировка эл.+мех.", { size: 4.4, color: "#1b6ef3", align: "middle" });
  });
  /* --- таблица 1 --- */
  var ty = busY + 210;
  T(P, 20, ty, "Таблица 1 — распределение приёмников по вводам и аппаратам (по цифровой модели сети)", { size: 12, bold: true });
  var heads = ["№ п/п", "Наименование приёмника", "Кат.", "φ", "Pr, кВт", "Qr, квар", "Sr, кВ·А", "Ir, А", "QF раб.", "QF рез.", "Кабель NED", "L, м", "Раб. ввод/секция", "Рез. ввод/секция"];
  var nums  = [1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  var rowsD = [];
  (m.consumers || []).forEach(function (c, i) {
    var has = !!hasRes(c); var cabN = cabFor(c);
    rowsD.push([String(i + 1), (c.name || "").slice(0, 24), c.category === "special" ? "спец" : "I".repeat(Number(c.category) || 3),
      c.phases === 1 ? (c.phase || "авт") : "3~", f1(c.Pr), f1(c.Qr), f1(c.Sr), f0(c.Ir),
      "QF" + (101 + i) + " " + f0(val(c.qf, "—")) + " А", has ? "QF" + (101 + i) + "р" : "—",
      cabN.s ? (cabN.cores + "×" + cabN.s) : "—", String(c.cableLength_m || 30),
      c.feedWork ? (c.feedWork.sourceId + "/" + c.feedWork.sectionId) : "—", has ? (c.feedReserve.sourceId + "/" + c.feedReserve.sectionId) : "—"]);
  });
  var FS = 10.5, PAD = 4;
  function tw(s) { return String(s).length * FS * 0.72 + 0; }
  var cw = heads.map(function (hx, i2) { var wq = String(heads[i2]).length * FS * 0.72 + 10; rowsD.forEach(function (rw) { var w2 = String(rw[i2]).length * FS * 0.72 + 8; if (w2 > wq) wq = w2; }); return Math.max(wq, 36); });
  var tx0 = 20, tyy = ty + 14, rh = 16;
  var tot = cw.reduce(function (aq, bq) { return aq + bq; }, 0);
  function grid(yT, yB) { var xx = tx0; for (var q = 0; q <= cw.length; q++) { Ln(P, [xx, yT], [xx, yB], 3.2, "#223344"); if (q < cw.length) xx += cw[q]; } Ln(P, [tx0, yT], [tx0 + tot, yT], 4, "#223344"); Ln(P, [tx0, yB], [tx0 + tot, yB], 4, "#223344"); }
  grid(tyy, tyy + rh);
  (function () { var xx = tx0; heads.forEach(function (hx, i2) { T(P, xx + 2, tyy + rh - 5, hx, { size: FS, bold: true }); xx += cw[i2]; }); })();
  rowsD.forEach(function (rw, r2) { var ry = tyy + rh * (r2 + 1); grid(ry, ry + rh); var xx = tx0; rw.forEach(function (cellv, i2) { if (nums[i2]) T(P, xx + cw[i2] - 3, ry + rh - 5, cellv, { size: FS, align: "end" }); else T(P, xx + 2, ry + rh - 5, cellv, { size: FS }); xx += cw[i2]; }); });
  var yy = tyy + rh * (rowsD.length + 2) + 10;
  P.W = Math.max(P.W, tx0 + tot + 60);
  T(P, 20, yy, "Итого: N приёмников = " + nOp + " · рабочих QF = " + nOp + " · резервных QF…р = " + nRes + ". Резервные цепи в расчёт ΣРр секций не входят (РТМ 36.18.32.4-92). Кабели — каталог NED-Plagum (IEC 60364-5-52, табл.1), ПУЭ гл.1.3, ΔU ≤ 5 %.", { size: 11 });
  yy += 14;
  /* --- таблица 2 --- */
  var pbY = yy + 14;
  T(P, 20, pbY, "Таблица 2 — несимметрия фаз секций (ГОСТ 32144-2013: K2u≤5% норм./7% макс. для 0,4 кВ; ориентир перекоса по мощн. ≤30 %; порог проекта " + (m.imbalanceThresholdPct || 15) + " %)", { size: 6.6, bold: true });
  cols.forEach(function (cl, i) {
    var sums = { L1: 0, L2: 0, L3: 0 };
    cl.cons.forEach(function (c) {
      var Pr = c.Pr || 0;
      if (c.phases !== 1) { sums.L1 += Pr / 3; sums.L2 += Pr / 3; sums.L3 += Pr / 3; }
      else if (c.phase) sums[c.phase] += Pr;
    });
    var avg = (sums.L1 + sums.L2 + sums.L3) / 3, imbp = avg > 0 ? (Math.max(sums.L1, sums.L2, sums.L3) - Math.min(sums.L1, sums.L2, sums.L3)) / avg * 100 : 0;
    var hasW = imbp > 30, hasT = !hasW && imbp > (m.imbalanceThresholdPct || 15);
    var resIn = cl.cons.reduce(function (s, c) { return s + (hasRes(c) && c.feedReserve.sectionId === cl.sec.id ? (c.Pr || 0) : 0); }, 0);
    T(P, 20, pbY + 13 + i * 9, "Секц. " + cl.sec.id + ": L1=" + f1(sums.L1) + " · L2=" + f1(sums.L2) + " · L3=" + f1(sums.L3) + " кВт · несимметрия " + f1(imbp) + "%" +
      (hasW ? " ✗>30" : hasT ? " >порога!" : " ✓") + (resIn ? " (вх. резерв " + f1(resIn) + " кВт)" : ""), { size: 12, color: hasW ? "#c62828" : hasT ? "#b26a00" : "#1b8a3f" });
  });
  /* --- примечания --- */
  var nx = Math.min(P.W, totalW) - 400;
  T(P, nx, 60, "Обозначения и требования НТД РФ", { size: 7.5, bold: true });
  var notes = [
    "QF(101…101+N-1) — рабочие аппараты (N=числу приёмников, сечения и QF — по расчёту Ir); QF…р — резервные аппараты Kat.I/II/спец (M=" + nRes + "); питание Kat.I — по двум независимым вводам с АВР (ПУЭ п.1.2.14).",
    "Резервные электроприёмники/режимы с автоматическим включением в расчётные мощности секций не входят (РТМ 36.18.32.4-92); проверяются условия самозапуска одного ЭД.",
    "1-ф. приёмники распределены по фазам автобалансировкой/принудительно (колонка «Фаза»); контроль несимметрии — ГОСТ 32144-2013 (К2u) и таблицы 2; целевой перекос ≤30 %.",
    "Резерв. цепь выполнена через местный АВР (контактор + блокировки эл./мех., ГОСТ 2.755) на второй секции; секционный QF11 t=0,5 с (сеть-сеть), ДЭС — АВР t=10 с.",
    "Кабели ВВГнг(А)-LS (не распространяют горение, ГОСТ 31565-2012), сечения — ПУЭ гл.1.3 + ΔU ≤5 %; УГО: ГОСТ 2.710/2.755/2.722/2.730; объём модели: supplyMode=" + (m.supplyMode || "2in") + "."
  ];
  ((m.feedErrors || []).slice(0, 5)).forEach(function (er) { notes.push("ОШИБКА МОДЕЛИ: " + er); });
  var ny = 72;
  notes.forEach(function (nt) { wrapTxt(nt, 62).forEach(function (ln, ii) { T(P, nx + (ii ? 8 : 0), ny, ln, { size: 11, color: /ОШИБКА/.test(ln) ? "#c62828" : "#33465e" }); ny += 12.6; }); ny += 6; });
  P.H = Math.max(ny + 90, yy + 80);
  P.W = Math.max(totalW, nx + 400);
  return mmSheet(P);
}
function noModelSheet(k) {
  var P = { W: 900, H: 120, els: [] };
  T(P, 20, 40, "Цифровая модель сети не построена: нажмите «Обновить модель сети» (или «Проект KTP-1») — схема строится из неё.", { size: 7, color: "#c62828" });
  return mmSheet(P);
}
/* ============ СТРУКТУРА ПАНЕЛЕЙ ПО МОДЕЛИ ============ */
function buildPanel() {
  var m = NET(); if (!m) return noModelSheet("panel");
  var P = { W: 1600, H: 300, els: [] };
  var e = function (o) { P.els.push(o); };
  T(P, 20, 26, "Схема структуры панелей НКУ — по модели сети (панели " + ((m.panels || []).length) + ")", { size: 10, bold: true });
  var py = 60;
  (m.panels || []).forEach(function (pan, pi) {
    var scale = 0.28;
    var wpx = Math.max(320, pan.width_mm * scale);
    var sec = secById(m, pan.sectionId);
    var role = sec ? secRole(m, sec, 0) : { label: pan.sectionId };
    var cons = (pan.feederIds || []).map(function (id) { return (m.consumers || []).filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);
    e({ t: "r", x: 24, y: py, w: wpx, h: 150, fill: "#f6faff", stroke: "#223344", sw: 1.3 });
    T(P, 28, py - 6, pan.name + " · секция " + pan.sectionId + " · Ш×Г×В = " + pan.width_mm + "×" + pan.depth_mm + "×" + pan.height_mm + " мм", { size: 6.6, bold: true });
    e({ t: "r", x: 30, y: py + 12, w: 58, h: 126, stroke: "#98a4b5", sw: 0.8 });
    T(P, 34, py + 26, "Ввод " + role.label, { size: 5 });
    T(P, 34, py + 36, f0((cons.reduce(function (a, c) { return a + (c.Sr || 0); }, 0) * 1000 / 693 || 0)) + " А", { size: 5.6 });
    var cell = Math.min(64, (wpx - 100) / Math.max(1, cons.length));
    cons.forEach(function (c, j2) {
      var cx2 = 96 + j2 * cell;
      e({ t: "r", x: cx2, y: py + 12, w: cell - 4, h: 126, stroke: "#98a4b5", sw: 0.8 });
      T(P, cx2 + 2, py + 24, "QF" + (101 + m.consumers.indexOf(c)), { size: 4.8, bold: true });
      T(P, cx2 + 2, py + 33, (val(c.qf, "—")) + "А", { size: 4.8 });
      T(P, cx2 + 2, py + 42, c.phases === 1 ? (c.phase || "авто φ") : "3~", { size: 4.6, color: c.phases === 1 ? "#b26a00" : "#33465e" });
      T(P, cx2 + 2, py + 52, (c.name || "").slice(0, 10), { size: 4.4 });
      if (c.feedReserve) { e({ t: "r", x: cx2 + 2, y: py + 58, w: 12, h: 10, stroke: "#1b6ef3", sw: 0.8 }); T(P, cx2 + 4, py + 66, "А", { size: 4.4, color: "#1b6ef3" }); }
    });
    py += 176;
  });
  P.H = py + 20;
  return mmSheet(P);
}
/* ============ ПЛАНИРОВКА ПО МОДЕЛИ ============ */
function layoutModel() {
  var t = CMP() || { Str: 250, Qc: 0 };
  var m = NET();
  var b = []; var S = trSize(m && m.group && m.group.Sr ? Math.max(250, m.group.Sr / (m.supplyMode && /DES/.test(m.supplyMode) ? 2 : 2)) : t.Str);
  if (isKtp()) {
    b.push({ id: "T1", x: 700, y: 700, w: S.w, d: S.d, l: "Сухой тр-р T1 (раб. 100 %)" });
    b.push({ id: "T2", x: 700 + S.w + 1200, y: 700, w: S.w, d: S.d, l: "Сухой тр-р T2 (рез. 100 %)" });
    var panels = (m && m.panels ? m.panels : []).filter(function (p) { return !/UPS/.test(p.sectionId || ""); });
    var rowY = 700 + S.d + 1500;
    var px = 700;
    panels.forEach(function (p, i) {
      b.push({ id: p.id || ("P" + (i + 1)), x: px, y: rowY, w: p.width_mm, d: p.depth_mm, l: p.name });
      px += p.width_mm + 1000;
    });
    if (!panels.length) { b.push({ id: "НКУ1", x: 700, y: rowY, w: 2600, d: 800, l: "Панель НКУ-1 (A)" }, { id: "НКУ2", x: 4300, y: rowY, w: 2600, d: 800, l: "Панель НКУ-2 (B)" }); px = 6600; }
    if (m && /UPS/.test(m.supplyMode || "")) b.push({ id: "УЗИК", x: px, y: rowY, w: 900, d: 600, l: "НКУ ИБП (УЗИК)" });
    if ((t.Qc || 0) > 120) b.push({ id: "УКРМ", x: 700, y: rowY + 800 + 1500, w: 1300, d: 600, l: "УКРМ-0,4" });
    b.room = { w: Math.max(px + 2000 + 700 - 0, 700 * 2 + S.w * 2 + 1200), d: rowY + 800 + 1500 + ((t.Qc || 0) > 120 ? 600 + 1000 : 200) };
  } else {
    var panels2 = (m && m.panels ? m.panels : []);
    var x2 = 700;
    panels2.forEach(function (p) { b.push({ id: p.id, x: x2, y: 1000, w: p.width_mm, d: p.depth_mm, l: p.name }); x2 += p.width_mm + 1000; });
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
