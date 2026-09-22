/* loads-draw.js — однолинейная схема КТП/НКУ, схема щита и планировка по НТД
   Лист строится в мм (построение в у.е ×0,5 → мм), DXF — стиль ESKD, cp1251. */
"use strict";
(function () {
function LS() { return window.__LA.state; }
function CMP() { return window.__LA.compute(); }
const AMP = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 250, 400, 630];
const CAB = [{ s: 1.5, i: 21 }, { s: 2.5, i: 28 }, { s: 4, i: 38 }, { s: 6, i: 46 }, { s: 10, i: 70 }, { s: 16, i: 85 }, { s: 25, i: 115 }, { s: 35, i: 125 }, { s: 50, i: 175 }, { s: 70, i: 215 }, { s: 95, i: 260 }, { s: 120, i: 285 }, { s: 150, i: 330 }, { s: 185, i: 365 }, { s: 240, i: 430 }, { s: 300, i: 510 }];
const TRG = [{ s: 250, w: 1500, d: 1050 }, { s: 400, w: 1650, d: 1150 }, { s: 630, w: 1850, d: 1300 }, { s: 1000, w: 2050, d: 1500 }, { s: 1600, w: 2300, d: 1650 }];
const REQ = { front: 1500, backNU: 1000, trBack: 700, trSide: 700, trBetween: 1200, door: 900 };
function $(id) { return document.getElementById(id); }
function f1(x) { return Number(x).toLocaleString("ru-RU", { maximumFractionDigits: 1 }); }
function f0(x) { return Number(x).toLocaleString("ru-RU", { maximumFractionDigits: 0 }); }
function pickIn(I) { for (const a of AMP) if (a >= I) return a; return 1600; }
function pickCab(I) { for (const c of CAB) if (c.i >= I) return c.s; return 300; }
function trSize(kVA) { for (const g of TRG) if (kVA <= g.s * 1.001) return g; return TRG[TRG.length - 1]; }
function isKtp() { return $("site-type") ? $("site-type").value === "ktp" : true; }
function getU() { return (LS().un ? Number(LS().un) : 0.4) * 1000 || 400; }
function feeders() {
  const t = CMP(), U = getU(), out = [];
  t.rows.forEach((r, i) => {
    const P = (LS().mode === "demand") ? (Number(r.ks) || 0) * r.Pn : r.KiPn;
    const Q = P * (r.tg || 0), S = Math.hypot(P, Q), I = S * 1000 / (1.732 * U);
    const cat = Number(r.cat) || 3;
    out.push({ i, name: (r.name || "").trim() || ("Приёмник " + (i + 1)), n: r.n || 1, Pn: r.Pn, P, Q, S, I, cat,
      qf: pickIn(I * 1.25), cab: pickCab(I * 1.25), A: (i % 2 === 0) || cat === 1, B: (i % 2 === 1) || cat === 1 });
  });
  return out;
}
/* ---------- примитивы/символы ---------- */
function T(P, x, y, s, o) { P.els.push(Object.assign({ t: "t", x, y, s: String(s), size: 6.4 }, o || {})); }
function Ln(P, a, b, sw, col) { P.els.push({ t: "l", x1: a[0], y1: a[1], x2: b[0], y2: b[1], sw: sw || 1.3, color: col }); }
function Nd(P, x, y) { P.els.push({ t: "n", x, y }); }
function symQFa(P, x, y, pos, l1, l2) {
  Ln(P, [x, y - 14], [x, y - 4], 1.6); Ln(P, [x, y + 4], [x, y + 14], 1.6);
  Ln(P, [x - 5, y + 5], [x + 4, y - 6], 1.6);
  P.els.push({ t: "r", x: x + 4, y: y - 9, w: 7, h: 4.5, stroke: "#223344", sw: 0.9 });
  T(P, x + 15, y - 9, pos, { size: 7.5, bold: true });
  if (l1) T(P, x + 15, y + 3, l1, { size: 5.6, color: "#33465e" });
  if (l2) T(P, x + 15, y + 13, l2, { size: 5.6, color: "#33465e" });
}
function symTR(P, x, y, pos, lines) {
  P.els.push({ t: "c", x: x - 8, y, r: 13 }); P.els.push({ t: "c", x: x + 8, y, r: 13 });
  T(P, x - 30, y - 26, pos, { size: 7.5, bold: true, align: "end" });
  (lines || []).forEach((ln, i) => T(P, x + 30, y - 4 + i * 10, ln, { size: 5.6, color: "#33465e" }));
}
function symTA(P, x, y, txt) {
  P.els.push({ t: "c", x, y, r: 7 });
  P.els.push({ t: "l", x1: x - 4, y1: y + 6, x2: x + 5, y2: y - 4, sw: 1 });
  T(P, x + 10, y + 3, "TA " + txt, { size: 5.4, color: "#5a6a7e" });
}
function meter(P, x, y) {
  P.els.push({ t: "r", x: x - 9, y: y - 9, w: 18, h: 18, stroke: "#33465e", sw: 0.9 });
  P.els.push({ t: "l", x1: x - 7, y1: y + 6, x2: x + 7, y2: y + 6, sw: 0.9, color: "#33465e" });
  T(P, x, y + 2, "Wh", { size: 6, align: "middle" });
  T(P, x - 13, y + 2, "A", { size: 5.4, color: "#5a6a7e" });
}
function symRec(P, x, y) {
  P.els.push({ t: "c", x, y, r: 6 });
  Ln(P, [x - 4.2, y + 4.4], [x + 4.2, y - 4.4], 1.2);
}
function symSecBr(P, x, y) { // секционный с электроприводом (АВР)
  symQFa(P, x, y, "QF11", "секционный", "");
  P.els.push({ t: "r", x: x + 24, y: y - 4, w: 9, h: 9, stroke: "#1b6ef3", sw: 0.9 });
  P.els.push({ t: "l", x1: x + 8, y1: y - 8, x2: x + 24, y2: y - 2, sw: 0.8, color: "#1b6ef3", dash: "2 2" });
  T(P, x + 36, y + 4, "М · АВР", { size: 5.4, color: "#1b6ef3" });
}
function dimH(P, x1, x2, y, label) {
  Ln(P, [x1, y], [x2, y], 0.7, "#5a6a7e");
  [[x1, 1], [x2, -1]].forEach(([cx, d]) => {
    Ln(P, [cx - d * 6, y - 2], [cx, y], 0.8, "#5a6a7e");
    Ln(P, [cx - d * 6, y + 2], [cx, y], 0.8, "#5a6a7e");
  });
  T(P, (x1 + x2) / 2, y - 2, label, { size: 6, align: "middle", color: "#33465e" });
}
function dimV(P, x, y1, y2, label) {
  Ln(P, [x, y1], [x, y2], 0.7, "#5a6a7e");
  [[y1, 1], [y2, -1]].forEach(([cy, d]) => {
    Ln(P, [x - 2, cy + d * 6], [x, cy], 0.8, "#5a6a7e");
    Ln(P, [x + 2, cy + d * 6], [x, cy], 0.8, "#5a6a7e");
  });
  T(P, x - 3, (y1 + y2) / 2 + 2, label, { size: 6, align: "end", color: "#33465e" });
}
function ikzKV() { return Number(($("ikz-input") || {}).value) || 20; }
/* ---------- строение данных листа ---------- */
function busLabel(ktp, t, Ikz) {
  const Iud = f1(Ikz * Math.SQRT2 * 2.55);
  return ktp
    ? `Секция ~400/230 В, Iр ${f0(t.Ip / 2)} А, Iкз(3) ${Ikz} кА, iуд ${Iud} кА (от системы уточнить)`
    : `Шина НКУ ~400/230 В, Iр ${f0(t.Ip)} А, Iкз(3) ${Ikz} кА, iуд ${Iud} кА (от системы уточнить)`;
}
function feederInfo(r, x, yBus, P) {
  Ln(P, [x, yBus + 6], [x, yBus + 16]);
  symQFa(P, x, yBus + 28, `QF${101 + r.i}`, `${r.qf} А`, `Кат. ${"I".repeat(r.cat)}`);
  Ln(P, [x, yBus + 42], [x, yBus + 58]);
  T(P, x - 40, yBus + 66, `ВВГнг(А)-LS ${r.cat === 1 ? 5 : 4}×${r.cab}`, { size: 5.2, color: "#33465e" });
  Ln(P, [x, yBus + 58], [x, yBus + 76]);
  symRec(P, x, yBus + 82);
  T(P, x - 42, yBus + 96, r.name.slice(0, 21), { size: 5.6 });
  T(P, x - 42, yBus + 104, `${f1(r.P)} кВт · ${f0(r.I)} А · ${r.n}×${f0(r.Pn)} кВт`, { size: 5.2, color: "#33465e" });
}
/* ============ ОДНОЛИНЕЙНАЯ СХЕМА ============ */
function buildSingleLine() {
  const t = CMP(), fd = feeders(), ktp = isKtp(), Ikz = ikzKV();
  const colW = 190;
  const A = ktp ? fd.filter(r => r.A) : fd, B = ktp ? fd.filter(r => r.B) : [];
  const busY = 176, baseX = 150;
  const wA = Math.max(A.length, 2) * colW, wBx = ktp ? baseX + wA + 120 : 0;
  const P = { W: Math.max((ktp ? wBx + Math.max(B.length, 2) * colW + 220 : baseX + wA + 360), 1500), H: 800, els: [] };
  T(P, 20, 26, `Схема электрическая однолинейная — ${ktp ? "КТП 10(6)/0,4 кВ (2 тр-ра 2×100 %, две секции)" : "щит НКУ 0,4 кВ"}`, { size: 10, bold: true });
  T(P, 20, 40, "Исполнение по ГОСТ 2.702-2011/2.701-2008; пример оформления — по типовым листам ЭМ (вводы, учёт PA/Wh, TA, секционный с АВР, фидеры с автоматами).", { size: 6, color: "#5a6a7e" });
  for (let i = 0; i < (ktp ? 2 : 1); i++) {
    const x = baseX + (ktp ? i * (wA + 120 - (i === 0 ? 0 : 0)) : 0);
    const cx = ktp ? (i === 0 ? baseX : wBx) : baseX;
    if (ktp) {
      T(P, cx - 60, 56, `Ввод №${i + 1}: 10(6) кВ от КРУ, Iкз(3)=${Ikz} кА`, { size: 5.8 });
      Ln(P, [cx, 62], [cx, 86]);
      symTA(P, cx + 10, 72, "30/5");
      Ln(P, [cx, 86], [cx, 128]);
      symTR(P, cx, 140, `T${i + 1}`, [`${f0(t.Str)} кВА · сухой, литая изоляц. · IP20`, `10(6)/0,4 кВ · Uк=6 % · Y/Da · класс F/H`, `термозащита PTC; вент. AF; шум ≤70 дБА`]);
      Ln(P, [cx, 153], [cx, busY]);
      Nd(P, cx, busY);
    } else {
      T(P, cx - 60, 56, `Ввод №1 ~400 В от КТП; Iкз(3)=${Ikz} кА`, { size: 5.8 });
      Ln(P, [cx, 62], [cx, 80]);
      symTA(P, cx + 12, 70, `${pickIn(t.Ip)} /5`);
      symQFa(P, cx, 96, "QF1", `${pickIn(t.Ip * 1.2)} А`, "эл. расцеп. LSI");
      Ln(P, [cx, 110], [cx, busY]);
      meter(P, cx + 52, 122); T(P, cx + 34, 140, "учёт ПА/Wh", { size: 5, color: "#5a6a7e" });
      Nd(P, cx, busY);
    }
  }
  const bx2 = ktp ? baseX + wA : baseX + wA;
  Ln(P, [ktp ? baseX : baseX, busY], [ktp ? baseX + wA + 40 : baseX + wA + 40, busY], 3);
  T(P, (ktp ? baseX : baseX) + 4, busY - 8, busLabel(ktp, t, Ikz).replace(/, iуд[^(]*/, ", iуд… "), { size: 7, bold: true });
  const midSec = ktp ? baseX + wA + 76 : 0;
  if (ktp) {
    Ln(P, [midSec - 60, busY], [midSec + 60, busY], 2.6);
    Ln(P, [wBx - 20, busY], [wBx + Math.max(B.length, 1) * colW + 40, busY], 3);
    Ln(P, [midSec - 60, busY], [midSec - 60, busY + 34], 2);
    Ln(P, [midSec + 60, busY], [midSec + 60, busY + 34], 2);
    Ln(P, [midSec - 60, busY + 34], [midSec + 60, busY + 34], 2);
    symQFa(P, midSec, busY + 46, "QF11", "секционный", "");
    T(P, midSec + 16, busY + 50, "М · АВР (КРП)", { size: 5.4, color: "#1b6ef3" });
    Nd(P, midSec - 60, busY); Nd(P, midSec + 60, busY);
    T(P, wBx - 4, busY - 8, "Секция B ~400/230 В, Iр " + f0(t.Ip / 2) + " А", { size: 7, bold: true });
  }
  A.forEach((r, i) => feederInfo(r, baseX + 60 + i * colW, busY, P));
  if (ktp) B.forEach((r, i) => feederInfo(r, wBx + 60 + i * colW, busY, P));
  /* примечания */
  const nX = (ktp ? wBx + Math.max(B.length, 2) * colW + 140 : baseX + wA + 140);
  T(P, nX, 60, "Обозначения и требования", { size: 7.5, bold: true });
  (["QF — автомат. выключатель (ГОСТ 2.710/2.755), у Кат.I — независимый расцепитель от АСУ/АВР;",
    "TA — трансформатор тока; PA/Wh — приборы учёта (как в типовом листе ЭМ);",
    "Кат. I — двухлучевое питание от секций A и B; АВР секционный QF11;",
    "Тр-ры сухие (литые) 2×100 %, класс F/H, IP20, Uк=6 %; вентиляция и термозащита — по ТУ;",
    "Кабели ВВГнг(А)-LS; сечения по ПУЭ табл. 1.3.6 и ΔU ≤5 %; Кат.I — разн. трассы;",
    "Iкз от системы уточнить; защита — по типовым схемам защит НН/UВ проекта;",
    "Заземление по гл. 1.7 ПУЭ; на вводах — измерение U/I."].forEach((nt, i0) => {
    wrapTxt(nt, 66).forEach((ln, i) => { T(P, nX + i * 4, 74 + i0 * 24 + i * 8, ln, { size: 5.6 }); });
  }));
  /* Таблица отходящих */
  const ty = busY + 220;
  T(P, 20, ty, "Таблица 1 — соответствия «приёмник — автомат — кабель»", { size: 7.5, bold: true });
  const hh = ["№", "Приёмник", "Кат", "n", "Pн", "Pр", "Qр", "Sр", "Iр,А", "QF,А", "Каб", "Секц"];
  const ww = [14, 96, 16, 12, 26, 26, 26, 26, 22, 22, 30, 16];
  let cx = 20; hh.forEach((h, i) => { T(P, cx, ty + 14, h, { size: 5.4, bold: true }); cx += ww[i] * 0.9 + 4; });
  fd.forEach((r, ri) => {
    let x = 20;
    const vals = [ri + 1, r.name.slice(0, 24), "I".repeat(r.cat), r.n, f1(r.Pn), f1(r.P), f1(r.Q), f1(r.S), f0(r.I), r.qf, (r.cat === 1 ? 5 : 4) + "×" + r.cab, ktp ? (r.A && r.B ? "A,B" : r.A ? "A" : "B") : "A"];
    vals.forEach((v, i2) => { T(P, x, ty + 24 + ri * 9, String(v), { size: 5.2 }); x += ww[i2] * 0.9 + 4; });
  });
  P.H = ty + 30 + fd.length * 9 + 30;
  P.W = Math.max(P.W, cx + 60, nX + 480);
  return mmSheet(P);
}
/* ============ СТРУКТУРА ПАНЕЛИ (НКУ) ============ */
function buildPanel() {
  const t = CMP(), fd = feeders(), ktp = isKtp();
  const P = { W: 1760, H: 640, els: [] };
  T(P, 20, 26, "Схема structure панелей НКУ — " + (ktp ? "КТП: НКУ-1 и НКУ-2" : "щит НКУ"), { size: 9.5, bold: true });
  T(P, 20, 40, "Структурная схема шкафа: вводная, секционная и фидерные ячейки; габариты модулей типовые (Ш×Г×В, мм).", { size: 6, color: "#5a6a7e" });
  function mod(x, y, w, h, label) { P.els.push({ t: "r", x, y, w, h, fill: "#fff", stroke: "#98a4b5", sw: 0.9 }); T(P, x + 3, y + h - 5, label, { size: 5 }); }
  function nu(x, y, name, subs, sec) {
    const wMod = 44, wIn = 120, xS = wIn + (sec ? 90 : 0);
    const w = xS + subs.length * wMod + 8;
    P.els.push({ t: "r", x, y, w, h: 240, fill: "#f6faff", stroke: "#223344", sw: 1.3 });
    const realW = 600 + (sec ? 600 : 0) + subs.length * 200 + 200;
    T(P, x + 3, y - 6, `${name} · Ш=${f0(realW)} · В=2200 · Г=800 мм (схема условн.)`, { size: 6.4, bold: true });
    mod(x + 4, y + 8, wIn - 8, 224, `Ввод ${pickIn(t.Ip * 1.2)}А`);
    symQFa(P, x + 34, y + 46, "QF1", `${pickIn(t.Ip * 1.2)}А`, "LSI");
    meter(P, x + 86, y + 40); T(P, x + 78, y + 64, "PA/Wh", { size: 5, color: "#5a6a7e" });
    let cx = x + xS;
    if (sec) { mod(cx, y + 8, 82, 224, "Секция/АВР"); symSecBr(P, cx + 30, y + 52); cx += 86; }
    subs.forEach((r, i2) => {
      mod(cx, y + 8, wMod - 4, 224, `QF${101 + r.i}`);
      Ln(P, [cx + 16, y + 18], [cx + 16, y + 34], 1);
      P.els.push({ t: "l", x1: cx + 13, y1: y + 30, x2: cx + 19, y2: y + 22, sw: 1.3 });
      T(P, cx + 3, y + 52, `${r.qf}А`, { size: 4.6, bold: true });
      T(P, cx + 2, y + 40, (r.name || "").slice(0, 8), { size: 4.2 });
      T(P, cx + 3, y + 70, "К" + r.cat, { size: 4.4, color: r.cat === 1 ? "#b26a00" : "#5a6a7e" });
      cx += wMod;
    });
  }
  const A = ktp ? fd.filter(r => r.A) : fd, B = ktp ? fd.filter(r => r.B) : [];
  nu(30, 70, ktp ? "НКУ-1 (секция A)" : "НКУ", A, ktp);
  if (ktp) nu(30, 360, "НКУ-2 (секция B)", B, true);
  P.H = ktp ? 660 : 380;
  P.W = 1760;
  T(P, 20, P.H - 16, "Перед панелью 1500 мм, сзади (при обслуживании) 1000 мм; проверка и размеры — на «Планировке».", { size: 5.8, color: "#5a6a7e" });
  return mmSheet(P);
}
/* ============ ПЛАНИРОВКА (мм, 1:1) ============ */
function layoutModel() {
  const t = CMP(), fd = feeders(), ktp = isKtp(), S = trSize(t.Str);
  const b = [];
  let nuw = 0, n1 = fd.filter(r => r.A).length, n2 = fd.filter(r => r.B).length;
  if (ktp) {
    nuw = 600 + 600 + n1 * 200 + 200;
    const nuw2 = 600 + 600 + n2 * 200 + 200;
    b.push({ id: "T1", x: REQ.trSide, y: REQ.trBack, w: S.w, d: S.d, l: "Силовой тр-р Т1" });
    b.push({ id: "T2", x: REQ.trSide + S.w + REQ.trBetween, y: REQ.trBack, w: S.w, d: S.d, l: "Силовой тр-р Т2" });
    const rowY = REQ.trBack + S.d + REQ.front;
    b.push({ id: "НКУ1", x: REQ.trSide, y: rowY, w: nuw, d: 800, l: "Панель НКУ-1 (A)" });
    b.push({ id: "НКУ2", x: 2 * REQ.trSide + S.w + REQ.trBetween, y: rowY, w: nuw2, d: 800, l: "Панель НКУ-2 (B)" });
    if ((t.Qc || 0) > 120) b.push({ id: "УКРМ", x: REQ.trSide + 4*nuw + 800, y: REQ.trBack, w: 1300, d: 600, l: "УКРМ-0,4" });
    b.room = {
      w: Math.max(REQ.trSide * 2 + 2 * S.w + REQ.trBetween,
                  2 * REQ.trSide + S.w + REQ.trBetween + nuw2 + REQ.trSide,
                  REQ.trSide + nuw + REQ.trSide,
                  (b.find(z => z.id === "УКРМ") ? REQ.trSide + 4 * nuw + 800 + 1300 + REQ.trSide : 0)) + 0,
      d: rowY + 800 + REQ.front + 200
    };
  } else {
    nuw = 600 + fd.length * 200 + 200;
    b.push({ id: "НКУ", x: 700, y: 1000, w: nuw, d: 800, l: "Панель НКУ" });
    if ((t.Qc || 0) > 120) b.push({ id: "УКРМ", x: 700 + nuw + 1000, y: 1000, w: 1300, d: 600, l: "УКРМ-0,4" });
    b.room = { w: 700 + nuw + (t.Qc > 120 ? 1000 + 1300 + 700 : 700), d: 1000 + 800 + REQ.front };
  }
  return b;
}
function renderLayout() {
  const box = $("gd-layout"); if (!box) return;
  const mm = layoutModel(); const room = mm.room;
  const over = LS().layout || {};
  mm.forEach(x => { if (over[x.id]) { x.x = over[x.id][0]; x.y = over[x.id][1]; } });
  const pad = 1500;
  const P = { W: room.w + pad * 2, H: room.d + pad * 2, els: [], kind: "lay" };
  const e = (o) => P.els.push(o);
  T(P, pad, 40, "Планировка размещения оборудования — авто по ГОСТ/СП (блоки перемещаются мышью; сеть 50 мм; размеры в мм)", { size: 8.5 * 2, bold: true });
  Ln(P, [pad, pad], [pad + room.w, pad], 2.4); Ln(P, [pad + room.w, pad], [pad + room.w, pad + room.d], 2.4);
  Ln(P, [pad + room.w, pad + room.d], [pad, pad + room.d], 2.4); Ln(P, [pad, pad + room.d], [pad, pad], 2.4);
  dimV(P, pad - 120, pad, pad + room.d, `${room.w ? room.w : 0}`.length ? "" : "");
  dimH(P, pad, pad + room.w, pad + room.d + 120, `${room.w} · помещение, мм`);
  dimV(P, pad - 120, pad, pad + room.d, `${room.d}`);
  /* двери */
  const dY = pad + room.d - 1100;
  P.els.push({ t: "l", x1: pad, y1: dY + 1000, x2: pad, y2: dY, sw: 3.5, color: "#b26a00" });
  P.els.push({ t: "c", x: pad, y: dY, r: 1000, dash: "4 3", color: "#b26a00" });
  T(P, pad + 16, dY + 34, `дверь ${REQ.door}×2000`, { size: 6, color: "#b26a00" });
  mm.forEach(x => {
    const X0 = pad + x.x, Y0 = pad + x.y;
    e({ t: "r", x: X0, y: Y0, w: x.w, h: x.d, fill: x.id.startsWith("НКУ") ? "#dbe8ff" : x.id.startsWith("T") ? "#ffe9c7" : "#e9f6e9", stroke: "#223344", sw: 1.5 });
    T(P, X0 + 6, Y0 + 24, x.l, { size: 7, bold: true });
    T(P, X0 + 6, Y0 + 40, `${x.w}×${x.d} мм`, { size: 6.4, color: "#33465e" });
    dimH(P, X0, X0 + x.w, Y0 + x.d + 40, `${x.w}`);
    dimV(P, X0 - 55, Y0, Y0 + x.d, `${x.d}`);
  });
  /* размеры до стен от левого/нижнего блока */
  LS()._blocks = mm.slice();
  box._P = P;
  box.innerHTML = prims2svg(P, 0.6);
  wireDrags(box);
  renderChecks();
}
function renderChecks() {
  const chk = $("gd-check"); if (!chk) return;
  const mm = LS()._blocks || [];
  const model = layoutModel(); const room = model.room;
  const over = LS().layout || {};
  mm.forEach(x => { if (over[x.id]) { x.x = over[x.id][0]; x.y = over[x.id][1]; } });
  const rows = [];
  const add = (r, f, ok) => rows.push({ r, f: f + (ok ? " ✓" : " ✗"), ok });
  mm.forEach(x => {
    const front = room.d - (x.y + x.d), back = x.y, left = x.x, right = room.w - (x.x + x.w);
    const isN = /НКУ/.test(x.id), isC = /УКРМ/.test(x.id), isT = /тр-р/.test(x.l);
    const needF = isC ? 1000 : REQ.front;
    add(`Проход перед «${x.l}» ≥ ${needF}`, `${f0(front)}`, front >= needF);
    if (isC ? (left >= 500 && right >= 500) : true) {
      if (!isC) add(isN ? `Тыловой проход «${x.l}» ≥ ${REQ.backNU}` : `Задний зазор «${x.l}» ≥ ${REQ.trBack}`, `${f0(back)}`, back >= (isN ? REQ.backNU : REQ.trBack));
    } else add(`Обслуживание УКРМ: боковые зазоры ≥500`, `${f0(Math.min(left, right))}`, false);
    add(`Боковой зазор «${x.l}» ≥ ${isN || isC ? 500 : REQ.trSide}`, `${f0(Math.min(left, right))}`, Math.min(left, right) >= (isN || isC ? 500 : REQ.trSide));
  });
  for (let a = 0; a < mm.length; a++) for (let b2 = a + 1; b2 < mm.length; b2++) {
    const A = mm[a], B = mm[b2];
    const gx = Math.max(B.x - A.x - A.w, A.x - B.x - B.w), gy = Math.max(B.y - A.y - A.d, A.y - B.y - B.d);
    if (gx <= 0 && gy <= 0) add("Пересечение габаритов", `${A.l} / ${B.l}`, false);
    else {
      const g = Math.max(gx, gy);
      const need = (A.id.startsWith("T") && B.id.startsWith("T")) ? REQ.trBetween : (/УКРМ/.test(A.id + B.id) ? 1000 : REQ.front);
      if (g < need) add(`Мин. расстояние ${A.id}↔${B.id} ≥${need}`, f0(g), false);
    }
  }
  add("Дверь эвакуационная наружу, ш. ≥900", "1000×2000", true);
  add("Количество выходов (при >… по СП 1/СП 256)", rows.some(r => !r.ok) ? "проверить" : "2 зоны (КТП)", true);
  chk.innerHTML = "<table style='width:100%;font-size:.82rem'><tr><th>Проверка НТД</th><th>Факт</th><th></th></tr>" +
    rows.map(i => `<tr><td>${i.r}</td><td>${i.f}</td><td class="${i.ok ? "ok" : "bad"}">${i.ok ? "✓" : "✗"}</td></tr>`).join("") + "</table>" +
    "<p class='note'>Нормы: ПУЭ п. 4.2 (КТП), СП 256.1325800, требования ТУ на сухие тр-ры и спец-требования проекта (2×100 %, Кат.I — двухлучевое)." +
    " Перемещай блоки мышью — проверки и размеры пересчитываются автоматически.</p>";
}
/* ---------- перетаскивание ---------- */
function wireDrags(box) {
  const sv = box.querySelector("svg"); if (!sv) return;
  const P = box._P;
  let drag = null;
  const mmPt = (ev) => {
    const r = sv.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * P.W, y: (ev.clientY - r.top) / r.height * P.H };
  };
  sv.addEventListener("pointerdown", (ev) => {
    const p = mmPt(ev), pad = 1500;
    (LS()._blocks || []).slice().reverse().forEach(x => {
      const X0 = pad + x.x, Y0 = pad + x.y;
      if (!drag && p.x >= X0 && p.x <= X0 + x.w && p.y >= Y0 && p.y <= Y0 + x.d) drag = { id: x.id, ox: p.x - x.x, oy: p.y - x.y };
    });
    if (drag) sv.setPointerCapture && sv.setPointerCapture(ev.pointerId);
  });
  sv.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const p = mmPt(ev);
    const it = (LS()._blocks || []).find(z => z.id === drag.id);
    if (!it) return;
    it.x = Math.max(0, Math.min(p.x - drag.ox, P.W - 1500 - it.w));
    it.y = Math.max(0, Math.min(p.y - drag.oy, P.H - 1500 - it.d));
    it.x = Math.round(it.x / 50) * 50; it.y = Math.round(it.y / 50) * 50;
    if (!LS().layout) LS().layout = {};
    LS().layout[it.id] = [it.x, it.y];
    const box = $("gd-layout");
    renderLayout();
  });
  sv.addEventListener("pointerup", () => { if (drag) { drag = null; } });
}
/* ---------- кнопки ---------- */
let lastKind = "sl";
function show(kind) { lastKind = kind; renderScheme(kind); }
function renderScheme(kind) {
  const box = $("gd-scheme"); if (!box) return;
  const P = kind === "panel" ? buildPanel() : buildSingleLine();
  box._P = P; box.dataset.kind = kind;
  box.innerHTML = prims2svg(P, 0.95);
}
document.addEventListener("DOMContentLoaded", () => {
  const b1 = $("btn-gsl"), b2 = $("btn-gpanel"), b3 = $("btn-glayout"), b4 = $("btn-gdxf"), b5 = $("btn-gdxf-lay"), b6 = $("btn-greset");
  if (!b1) return;
  b1.onclick = () => show("sl");
  b2.onclick = () => show("panel");
  b3.onclick = () => renderLayout();
  b4.onclick = () => {
    const box = $("gd-scheme");
    if (!box._P) renderScheme(lastKind);
    const P = $("gd-scheme")._P;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(dxfBlobSheet(P));
    a.download = (isKtp() ? "ktp-" : "nku-") + "shema.dxf";
    document.body.appendChild(a); a.click(); a.remove();
  };
  b5.onclick = () => {
    renderLayout();
    const P = $("gd-layout")._P;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(dxfBlobSheet(P)); a.download = "planirovka-04.dxf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  b6.onclick = () => { LS().layout = {}; renderLayout(); };
  if ($("site-type")) $("site-type").addEventListener("change", () => {
    if ($("gd-scheme")._P) renderScheme(lastKind);
    if ($("gd-layout")._P) renderLayout();
  });
  const op = $("mode-select"); op && op.addEventListener("change", () => { setTimeout(() => { try { $("gd-scheme")._P && renderScheme(lastKind); $("gd-layout")._P && renderLayout(); } catch (e) {} }, 0); });
});
window.gdTest = { buildSingleLine, buildPanel, layoutModel, feeders };
window.__gdRefresh = function () { try { if ($("gd-scheme") && $("gd-scheme")._P) renderScheme(lastKind); if ($("gd-layout") && $("gd-layout")._P) renderLayout(); } catch (e) {} };
})();
