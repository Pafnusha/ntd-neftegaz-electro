/* nagruzki2.js — «Нагрузки 2.0»: автоматизированный расчёт нагрузок и генерация ОЛС НКУ/КТП.
   ТЗ: два потока РТМ 36.18.32.4-92, greedy-балансировка фаз, ΔU (5 %/3 % свет), упрощ. КЗ/отсечка,
   СПЗ/ВНИИПО (-FR, огнелоток), шаблоны ОЛС А/Б, блок-замки, экспорт Excel/Word/PDF.
   Работает офлайн в браузере; примитивы листа — loads-gost.js (mmSheet/prims2svg/sheetFrame), PDF — loads-ned.js. */
"use strict";
(function () {

/* ===== SECTION:data ===== */
/* Таблицы Кр РТМ 36.18.32.4-92 (табл.1 — по n_э и Ki; табл.2 — укрупнённая) */
var NE1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100];
var KI1 = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
var T1 = [[8,5.33,4,2.67,2,1.6,1.33,1.14,1],[6.22,4.33,3.39,2.45,1.98,1.6,1.33,1.14,1],[4.05,2.89,2.31,1.74,1.45,1.34,1.22,1.14,1],[3.24,2.35,1.91,1.47,1.25,1.21,1.12,1.06,1],[2.84,2.09,1.72,1.35,1.16,1.16,1.08,1.03,1],[2.64,1.96,1.62,1.28,1.11,1.13,1.06,1.01,1],[2.49,1.86,1.54,1.23,1.12,1.1,1.04,1,1],[2.37,1.78,1.48,1.19,1.1,1.08,1.02,1,1],[2.27,1.71,1.43,1.16,1.09,1.07,1.01,1,1],[2.18,1.65,1.39,1.13,1.07,1.05,1,1,1],[2.11,1.61,1.35,1.1,1.06,1.04,1,1,1],[2.04,1.56,1.32,1.08,1.05,1.03,1,1,1],[1.99,1.52,1.29,1.06,1.04,1.01,1,1,1],[1.94,1.49,1.27,1.05,1.02,1,1,1,1],[1.89,1.46,1.25,1.03,1,1,1,1,1],[1.85,1.43,1.23,1.02,1,1,1,1,1],[1.81,1.41,1.21,1,1,1,1,1,1],[1.78,1.39,1.19,1,1,1,1,1,1],[1.75,1.36,1.17,1,1,1,1,1,1],[1.72,1.35,1.16,1,1,1,1,1,1],[1.69,1.33,1.15,1,1,1,1,1,1],[1.67,1.31,1.13,1,1,1,1,1,1],[1.64,1.3,1.12,1,1,1,1,1,1],[1.62,1.28,1.11,1,1,1,1,1,1],[1.6,1.27,1.1,1,1,1,1,1,1],[1.51,1.21,1.05,1,1,1,1,1,1],[1.44,1.16,1,1,1,1,1,1,1],[1.4,1.13,1,1,1,1,1,1,1],[1.35,1.1,1,1,1,1,1,1,1],[1.3,1.07,1,1,1,1,1,1,1],[1.25,1.03,1,1,1,1,1,1,1],[1.2,1,1,1,1,1,1,1,1],[1.16,1,1,1,1,1,1,1,1],[1.13,1,1,1,1,1,1,1,1],[1.1,1,1,1,1,1,1,1,1]];
var KI2 = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
var R2 = [[1, 1], [2, 3], [4, 6], [7, 9], [10, 11], [12, 14], [15, 19], [20, 29], [30, 49], [50, 9999]];
var T2 = [[8,5.33,4,2.67,2,1.6,1.33,1.14],[5.01,3.44,2.69,1.9,1.52,1.24,1.11,1],[2.94,2.17,1.8,1.42,1.23,1.14,1.08,1],[2.28,1.73,1.46,1.19,1.06,1.04,1,0.97],[1.31,1.12,1.02,1,0.98,0.96,0.94,0.93],[1.2,1,0.96,0.95,0.94,0.93,0.92,0.91],[1.1,0.97,0.91,0.9,0.9,0.9,0.9,0.9],[0.8,0.8,0.8,0.85,0.85,0.85,0.9,0.9],[0.75,0.75,0.75,0.75,0.75,0.8,0.85,0.85],[0.65,0.65,0.65,0.7,0.7,0.75,0.8,0.8]];
function lerp(a, b, t) { return a + (b - a) * t; }
function bracket(arr, x) { if (x <= arr[0]) return [0, 0]; for (var i = 1; i < arr.length; i++) if (x <= arr[i]) return [i - 1, i]; return [arr.length - 1, arr.length - 1]; }
function lookupKr1(ne, ki) { if (!(ne > 0) || !(ki >= 0)) return 1; if (ki >= 0.9) return 1; if (ki < 0.1) ki = 0.1; if (ne > 100) { var f = Math.max(0, Math.min(1, (ki - 0.1) / 0.8)); return lerp(1.1, 1, f); } var ii = bracket(NE1, ne), jj = bracket(KI1, ki); var tNe = NE1[ii[1]] === NE1[ii[0]] ? 0 : (ne - NE1[ii[0]]) / (NE1[ii[1]] - NE1[ii[0]]); var tKi = KI1[jj[1]] === KI1[jj[0]] ? 0 : (ki - KI1[jj[0]]) / (KI1[jj[1]] - KI1[jj[0]]); return lerp(lerp(T1[ii[0]][jj[0]], T1[ii[1]][jj[0]], tNe), lerp(T1[ii[0]][jj[1]], T1[ii[1]][jj[1]], tNe), tKi); }
function lookupKr2(ne, ki) { if (!(ne > 0) || !(ki >= 0)) return 1; var n = Math.max(1, ne), rowIdx = R2.length - 1, i; for (i = 0; i < R2.length; i++) if (n >= R2[i][0] && n <= R2[i][1]) { rowIdx = i; break; } var row = T2[rowIdx]; if (ki >= 0.7) return row[row.length - 1]; if (ki <= KI2[0]) return row[0]; var jj = bracket(KI2, ki); var t = KI2[jj[1]] === KI2[jj[0]] ? 0 : (ki - KI2[jj[0]]) / (KI2[jj[1]] - KI2[jj[0]]); return lerp(row[jj[0]], row[jj[1]], t); }
function lookupKr(mode, ne, ki) { return mode === "table2" ? lookupKr2(ne, ki) : lookupKr1(ne, ki); }

/* Справочники оборудования (ТЗ 2.3) */
var QF_RAT = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600];
function pickQf(Ir) { var need = Ir * 1.1; for (var i = 0; i < QF_RAT.length; i++) if (QF_RAT[i] >= need - 1e-9) return QF_RAT[i]; return QF_RAT[QF_RAT.length - 1]; }
function qfTrip(row) { /* кривая эл.-магн. расцепителя: свет/слаботочка — 3..5In, общ. силовая — 10In, двигатель — по Кп */
  var s = String(row.name || "").toLowerCase();
  if (row.motor) return Math.max(10, Math.round((Number(row.kp) || 7) * 1.35));
  if (/свет|освещ|пожар|спз|сигнал|аку|щит управлен|розетк/.test(s)) return 5;
  return 10;
}
/* Iдоп, А (4-жильн., режим «работа»): медь в воздухе/лотке и в земле; алюминий — контроль допустимости */
var CABLE_DB = {
  cuAir:   { s: [1.5,2.5,4,6,10,16,25,35,50,70,95,120,150,185,240,300], i: [19,26,36,46,61,80,101,122,141,172,205,232,262,296,345,395], r0: 0.0175, x0: [0.115,0.11,0.1,0.096,0.09,0.087,0.083,0.08,0.078,0.075,0.072,0.07,0.068,0.066,0.063,0.06] },
  cuEarth: { s: [4,6,10,16,25,35,50,70,95,120,150,185,240,300], i: [41,50,63,79,99,119,137,167,198,224,252,285,333,381], r0: 0.0175, x0: [0.096,0.092,0.088,0.084,0.081,0.079,0.077,0.074,0.071,0.069,0.067,0.065,0.062,0.06] },
  alAir:   { s: [2.5,4,6,10,16,25,35,50,70,95,120,150,185,240], i: [28,32,39,50,64,82,99,117,141,166,189,212,240,278], r0: 0.028, x0: [0.11,0.1,0.096,0.09,0.087,0.083,0.08,0.078,0.075,0.072,0.07,0.068,0.066,0.063] },
  alEarth: { s: [4,6,10,16,25,35,50,70,95,120,150,185,240], i: [32,39,50,64,82,99,117,141,166,189,212,240,278], r0: 0.028, x0: [0.096,0.092,0.088,0.084,0.081,0.079,0.077,0.074,0.071,0.069,0.067,0.065,0.062] }
};
var LAY_INFO = { tray: { db: "cuAir", k: 1.0, ru: "в лотке/на эстакаде" }, air: { db: "cuAir", k: 1.0, ru: "открыто" }, pipe: { db: "cuAir", k: 0.8, ru: "в трубе/гофре" }, ground: { db: "cuEarth", k: 1.0, ru: "в земле" } };

var TR_DB = { pick: function (Sn) { var pk = Sn <= 400 ? 6.1 : Sn <= 630 ? 9.7 : Sn <= 1000 ? 12.2 : Sn <= 1600 ? 16.5 : 23.5 * Sn / 2500; return { Sn: Sn, uk: 6, pk: pk }; } };
/* Демо-объект: куст насосов + электрообогрев (северные районы) + СПЗ (ВНИИПО) */
function demoRows() {
  function R(o) { return Object.assign({ kind: "work", cat: "III", spz: false, ph: "3~380", sec: "Секция 1", ki: 0.7, cosPhi: 0.82, L: 100, lay: "tray", phase: "auto", motor: false, kp: 7 }, o); }
  return [
    R({ name: "Насосы центробежные НС-1…4 (куст)", n: 4, pnUnit: 55, cat: "II", ki: 0.8, cosPhi: 0.85, L: 220, motor: true, kp: 6.5, ph: "3~380", sec: "Секция 1" }),
    R({ name: "Насосы центробежные НС-1…4 (куст)", n: 4, pnUnit: 55, kind: "reserve", cat: "II", ki: 0.8, cosPhi: 0.85, L: 220, motor: true, kp: 6.5, ph: "3~380", sec: "Секция 2" }),
    R({ name: "Насосы консольные НК-1…3", n: 3, pnUnit: 22, cat: "III", ki: 0.6, cosPhi: 0.8, L: 140, motor: true, ph: "3~380", sec: "Секция 2" }),
    R({ name: "Компрессор воздуха КИПиА КВ-1/2", n: 2, pnUnit: 15, cat: "II", ki: 0.65, cosPhi: 0.82, L: 90, motor: true, sec: "Секция 1" }),
    R({ name: "Шкафы электрообогрева устьев ШУО-1…6", n: 6, pnUnit: 18, cat: "II", ki: 0.7, cosPhi: 0.98, L: 480, lay: "ground", ph: "1~220", sec: "Секция 2" }),
    R({ name: "Греющий кабель трубопровода (обогрев)", n: 1, pnUnit: 90, cat: "II", ki: 0.6, cosPhi: 0.98, L: 650, lay: "ground", ph: "3~380", sec: "Секция 2" }),
    R({ name: "Освещение площадки куста (НУ)", n: 12, pnUnit: 0.25, cat: "III", ki: 0.9, cosPhi: 0.9, L: 180, lay: "pipe", ph: "1~220", sec: "Секция 1" }),
    R({ name: "Аварийное освещение (СПЗ)", n: 2, pnUnit: 1.1, cat: "I", spz: true, ki: 1, cosPhi: 0.9, L: 120, ph: "1~220", sec: "Секция 2" }),
    R({ name: "Шкаф АСУ ТП / АИИС КУЭ (UPS-1)", n: 1, pnUnit: 3, kind: "ups", cat: "I", spz: false, ki: 1, cosPhi: 0.95, L: 45, ph: "1~220", sec: "Секция 3" }),
    R({ name: "Пожарная сигнализация и оповещение (СПЗ)", n: 1, pnUnit: 1.5, kind: "ups", cat: "I", spz: true, ki: 1, cosPhi: 0.95, L: 80, ph: "1~220", sec: "Секция 3" }),
    R({ name: "Щит управления технологией ЩУТ", n: 1, pnUnit: 25, cat: "I", ki: 0.7, cosPhi: 0.9, L: 60, lay: "air", ph: "3~380", sec: "Секция 1" }),
    R({ name: "Щит освещения бытового корпуса", n: 1, pnUnit: 12, cat: "III", ki: 0.5, cosPhi: 0.88, L: 260, lay: "pipe", ph: "3~380", sec: "Секция 1" }),
    R({ name: "Компрессор воздуха КИПиА КВ-1/2", n: 2, pnUnit: 15, kind: "reserve", cat: "II", ki: 0.65, cosPhi: 0.82, L: 90, motor: true, sec: "Секция 2" }),
    R({ name: "Ремонтная мастерская (освещение, розетки)", n: 6, pnUnit: 0.4, cat: "III", ki: 0.6, cosPhi: 0.9, L: 200, lay: "pipe", ph: "1~220", sec: "Секция 2" })
  ];
}

/* ===== SECTION:engine ===== */
var APP = { version: "2.0" };
function tgFromCos(c) { c = Number(c); if (!isFinite(c) || c <= 0 || c >= 1) return 0.75; return Math.tan(Math.acos(Math.min(0.999, Math.max(0.05, c)))); }
function rowU(row) { return String(row.ph || "3~380").indexOf("220") >= 0 ? 220 : 380; }
function isLight(row) { return /освещ|свет|нумер|автоматик.*свет/i.test(String(row.name || "")); }

/* Расчёт группы по РТМ: rows — только рабочий поток одной секции (ТЗ 2.2.1) */
function rtmGroup(rows) {
  var Pn = 0, KiPn = 0, sumNPn2 = 0, wq = 0, i, r;
  for (i = 0; i < rows.length; i++) {
    r = rows[i]; var n = Math.max(0, Number(r.n) || 0), pu = Number(r.pnUnit) || 0, ki = Number(r.ki) || 0;
    var p = n * pu; Pn += p; KiPn += ki * p; sumNPn2 += n * pu * pu; wq += ki * p * tgFromCos(r.cosPhi);
  }
  var ne = sumNPn2 > 0 && Pn > 0 ? (Pn * Pn) / sumNPn2 : 0; if (ne < 1 && Pn > 0) ne = 1;
  var kiAvg = Pn > 0 ? KiPn / Pn : 0, tgAvg = KiPn > 0 ? wq / KiPn : 0;
  return { n: rows.length, Pn: Pn, KiPn: KiPn, ne: ne, kiAvg: kiAvg, tgAvg: tgAvg, sumNPn2: sumNPn2 };
}
/* Pр,Qр группы с учётом таблицы Кр и правила 1,1 при n_э≤10 (ТЗ 2.2) */
function rtmPower(g, conf) {
  var kr = conf.krOverride ? (Number(conf.krManual) || 1) : lookupKr(conf.krTable, g.ne, g.kiAvg);
  var Pp = kr * g.KiPn;
  var Qp = g.ne > 0 && g.ne <= 10 ? 1.1 * g.KiPn * g.tgAvg : g.KiPn * g.tgAvg;
  var Sp = Math.sqrt(Pp * Pp + Qp * Qp);
  var ko = isFinite(Number(conf.ko)) ? Number(conf.ko) : 1;
  var tg2 = tgFromCos(Number(conf.cosTarget) || 0.95);
  var Pk = Pp * ko, Qk = Qp * ko;
  var tg1 = Pk > 0 ? Qk / Pk : 0;
  var Qcu = Math.max(0, Pk * (tg1 - tg2)); /* ТЗ: Q_ку = Pр·Kо·(tgφ1 − tgφ2) */
  return { kr: kr, Pp: Pp, Qp: Qp, Sp: Sp, Qcu: Qcu, tg2: tg2 };
}

function faultAtEnd(base, s, L_m, lay) {
  var db = CABLE_DB[(lay === "ground") ? "cuEarth" : "cuAir"];
  var iS = Math.max(0, db.s.indexOf(s)); if (db.s[iS] !== s) { for (var q = 0; q < db.s.length; q++) if (db.s[q] >= s) { iS = q; break; } }
  var Rl = db.r0 * (Number(L_m) || 0) / s;             /* Ом: ρ·L/S */
  var Xl = db.x0[iS] * (Number(L_m) || 0) / 1000;
  var R1 = base.Rs + Rl, X1 = base.Xs + Xl;
  var Z1 = Math.sqrt(R1 * R1 + X1 * X1);
  var I3 = 400 / (1.732 * Z1);
  var Z0 = Math.sqrt(Math.pow(base.Rs + 3 * Rl, 2) + Math.pow(base.Xs + 3 * Xl, 2));
  var I1 = 3 * 400 / (1.732 * (Z0 + 2 * Z1));
  return { I3: I3, I1: I1 };
}
/* Выбор сечения с ΔU и правилом освещения 3 % (ТЗ 2.3/4.1) */
function selectRow(row, conf, pairIr) {
  var U = rowU(row), n = Math.max(1, Number(row.n) || 1), pu = Number(row.pnUnit) || 0;
  var PnTot = n * pu, ki = Number(row.ki) || 0, cos = Number(row.cosPhi) || 0.8, tg = tgFromCos(cos);
  var Pr = ki * PnTot, Qr = Pr * tg, Sr = Math.sqrt(Pr * Pr + Qr * Qr);
  var Ir3 = Sr / (1.732 * U / 1000 * cos) * cos; /* = Sr·1000/(1.732U) */
  Ir3 = U === 380 ? (Sr * 1000) / (1.732 * 380) : Pr * 1000 / (220 * cos);
  var Ires = pairIr || 0;
  var Icalc = Math.max(Ir3, Ires);
  var layKey = row.lay || "tray", info = LAY_INFO[layKey];
  var dbName = layKey === "ground" ? "cuEarth" : "cuAir";
  var db = CABLE_DB[dbName], klay = info.k;
  var lim = isLight(row) ? 3 : 5;
  var iSel = -1, duBest = null;
  for (var i = 0; i < db.s.length; i++) {
    var s = db.s[i];
    if (db.i[i] * klay < Icalc) continue;
    var r0 = db.r0, x0 = db.x0[i], Lkm = (Number(row.L) || 0) / 1000;
    var sin = tg / Math.sqrt(1 + tg * tg);
    var du = U === 380
      ? 100 * 1.732 * Icalc * Lkm * (r0 * cos + x0 * sin) / 380
      : 100 * 2 * Icalc * Lkm * (r0 * cos + x0 * sin) / 220;
    if (du <= lim) { iSel = i; duBest = du; break; }
    if (iSel < 0) { iSel = i; duBest = du; }
  }
  var warned = false;
  if (iSel < 0) { iSel = db.s.length - 1; duBest = null; warned = true; }
  var sCable = db.s[iSel];
  var sin0 = tg / Math.sqrt(1 + tg * tg), r0 = db.r0, x0 = db.x0[iSel], Lkm = (Number(row.L) || 0) / 1000;
  var duFin = U === 380 ? 100 * 1.732 * Icalc * Lkm * (r0 * cos + x0 * sin0) / 380 : 100 * 2 * Icalc * Lkm * (r0 * cos + x0 * sin0) / 220;
  var nextS = db.s[Math.min(db.s.length - 1, iSel + 1)];
  var mark = cableMark(row, db, sCable);
  var InQf = pickQf(Icalc);
  var trip = qfTrip(row);
  var flt = faultAtEnd(conf.__base, sCable, row.L, row.lay);
  return {
    Pn: PnTot, Pr: Pr, Qr: Qr, Ir: Ir3, Icalc: Icalc, s: sCable, du: duFin, duLimit: lim,
    nextS: nextS, mark: mark, In: InQf, trip: trip, I1end: flt.I1, I3end: flt.I3,
    okDu: duFin != null && duFin <= lim + 1e-9, okTrip: flt.I1 >= 1.25 * InQf * trip, motor: !!row.motor
  };
}
function cableMark(row, db, s) {
  var m;
  if (row.spz || row.cat === "I" || row.kind === "ups") m = "ВВГнг(А)-FRLS";
  else if ((row.lay || "tray") === "ground") m = "ВБШвнг(А)-LS";
  else m = "ВВГнг(А)-LS";
  return m + " " + (rowU(row) === 220 ? "3" : "5") + "×" + s;
}

/* ===== SECTION:ui ===== */
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function f1(x) { return isFinite(x) ? (Math.round(x * 10) / 10).toLocaleString("ru-RU") : "—"; }
function f0(x) { return isFinite(x) ? Math.round(x).toLocaleString("ru-RU") : "—"; }
function uid() { return "r" + Math.random().toString(36).slice(2, 8); }

var KINDS = [["work", "Рабочая"], ["reserve", "Резервная"], ["ups", "ИБП (UPS)"]];
var CATSOPT = [["I", "I"], ["II", "II"], ["III", "III"]];
var SECS = ["Секция 1", "Секция 2", "Секция 3"];
var COLS = [
  { k: "name", l: "Наименование ЭП", t: "text" },
  { k: "kind", l: "Тип", t: "sel", o: KINDS },
  { k: "cat", l: "Кат.", t: "sel", o: CATSOPT },
  { k: "spz", l: "СПЗ", t: "chk" },
  { k: "ph", l: "φ/U", t: "sel", o: [["3~380", "3~ 380"], ["1~220", "1~ 220"]] },
  { k: "sec", l: "Секция", t: "sel", o: SECS.map(function (s) { return [s, s.replace("Секция", "Секц.")]; }) },
  { k: "n", l: "n, шт", t: "num", w: 46 },
  { k: "pnUnit", l: "Pн ед., кВт", t: "num", w: 64 },
  { k: "ki", l: "Ki", t: "num", w: 46 },
  { k: "cosPhi", l: "cosφ", t: "num", w: 48 },
  { k: "L", l: "L, м", t: "num", w: 56 },
  { k: "lay", l: "Прокладка", t: "sel", o: [["tray", "лоток"], ["air", "открыто"], ["pipe", "труба"], ["ground", "земля"]] },
  { k: "phase", l: "Фаза (1~)", t: "sel", o: [["auto", "автобаланс"], ["L1", "L1"], ["L2", "L2"], ["L3", "L3"]] },
  { k: "motor", l: "Двиг.", t: "chk" },
  { k: "kp", l: "Kп", t: "num", w: 44 }
];
var CCOLS = [
  { k: "Pn", l: "Pн= n·Pн.ед, кВт" }, { k: "Pr", l: "Pр=Ki·Pн, кВт" }, { k: "Qr", l: "Q, квар" },
  { k: "Ir", l: "Iр, А" }, { k: "Icalc", l: "Iрасч max" },
  { k: "s", l: "S, мм²" }, { k: "mark", l: "Марка кабеля" }, { k: "du", l: "ΔU/норма,%" },
  { k: "In", l: "QF А×In" }, { k: "I1end", l: "Iкз1ф кл, кА" }, { k: "st", l: "Статус" }
];

var state = { rows: demoRows().map(function (r) { r.id = uid(); return r; }) };
var gridBuilt = false, draggingTr = null;

function buildGrid() {
  var gh = $("grid").querySelector("thead");
  var h = "<tr><th>⠿</th><th>№</th>";
  COLS.forEach(function (c) { h += "<th>" + c.l + "</th>"; });
  CCOLS.forEach(function (c) { h += "<th>" + c.l + "</th>"; });
  gh.innerHTML = h + "<th></th></tr>";
  gridBuilt = true;
}
function rowCells(row, i) {
  var h = '<tr data-id="' + row.id + '" class="' + (row.kind === "reserve" ? "rowres" : row.kind === "ups" ? "rowups" : "") + '">';
  h += '<td class="handle" title="Перетащить за ручку">⠿</td><td>' + (i + 1) + "</td>";
  COLS.forEach(function (c) {
    var v = row[c.k];
    if (c.t === "text") h += '<td><input type="text" data-k="' + c.k + '" value="' + esc(v) + '"></td>';
    else if (c.t === "num") h += '<td><input type="number" step="any" data-k="' + c.k + '" value="' + esc(v) + '"' + (c.k === "kp" && !row.motor ? " disabled" : "") + ' style="width:' + (c.w || 60) + 'px"></td>';
    else if (c.t === "sel") {
      h += '<td><select data-k="' + c.k + '"' + (c.k === "phase" && String(row.ph) !== "1~220" ? " disabled" : "") + ">";
      c.o.forEach(function (o) { h += '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; });
      h += "</select></td>";
    } else if (c.t === "chk") h += '<td style="text-align:center"><input type="checkbox" data-k="' + c.k + '"' + (v ? " checked" : "") + "></td>";
  });
  CCOLS.forEach(function (c) { h += '<td class="num" data-c="' + c.k + '">—</td>'; });
  h += '<td><button type="button" data-a="dup" title="Дублировать">⧉</button> <button type="button" data-a="del" title="Удалить строку">✕</button></td></tr>';
  return h;
}
function renderGrid() {
  if (!gridBuilt) buildGrid();
  $("grid").querySelector("tbody").innerHTML = state.rows.map(rowCells).join("");
  $("grid-foot").textContent = "Строк: " + state.rows.length +
    " (раб. " + state.rows.filter(function (r) { return r.kind === "work"; }).length +
    " · рез. " + state.rows.filter(function (r) { return r.kind === "reserve"; }).length +
    " · ИБП " + state.rows.filter(function (r) { return r.kind === "ups"; }).length +
    "). Рабочий и резервный потоки одного ЭП связываются по одинаковому Наименованию; сечение/автомат — по max(Iр.осн, Iр.рез) (ТЗ п.4.1).";
  recalc();
}
function paintCells() {
  var byId = {}; APP.res.rowsById.forEach(function (x) { byId[x.id] = x; });
  Array.prototype.forEach.call(document.querySelectorAll("#grid tbody tr"), function (tr) {
    var c = byId[tr.dataset.id]; if (!c) return;
    Array.prototype.forEach.call(tr.querySelectorAll("td[data-c]"), function (td) {
      var k = td.dataset.c, v = c[k];
      if (v == null || (typeof v === "number" && !isFinite(v))) { td.textContent = "—"; return; }
      if (k === "mark" || k === "st") { td.innerHTML = v; }
      else if (k === "In") td.innerHTML = v + "<br><span style='font-size:10px;color:#7c13af'>" + c.trip + "·In</span>";
      else if (k === "du") { td.textContent = f1(v) + " / " + c.duLimit; td.style.color = v > c.duLimit ? "var(--bad)" : "var(--ok)"; }
      else if (k === "I1end") { td.textContent = f1(v / 1000); td.style.color = c.okTrip ? "" : "var(--bad)"; }
      else td.textContent = Math.abs(v) >= 100 ? f0(v) : f1(v);
    });
    var row = state.rows.filter(function (r) { return r.id === tr.dataset.id; })[0];
    tr.className = (row.kind === "reserve" ? "rowres" : row.kind === "ups" ? "rowups" : "") + (tr === draggingTr ? " dragging" : "");
    var kpInp = tr.querySelector('[data-k="kp"]'); if (kpInp) kpInp.disabled = !row.motor;
    var phSel = tr.querySelector('[data-k="phase"]'); if (phSel) phSel.disabled = String(row.ph) !== "1~220";
  });
}
function paintTotals() {
  var conf = APP.conf, html = "";
  SECS.forEach(function (secName) {
    var s = APP.secCalc[secName]; if (!s || !(s.p && s.p.Pp > 0 || s.gRes && s.gRes.Pn > 0)) return;
    var p = s.p || { kr: 0, Pp: 0, Qp: 0, Sp: 0, Qcu: 0 };
    var I3 = conf.__base.I3;
    html += '<div class="tot"><b>' + secName + " · рабочий поток (РТМ)</b>" +
      '<div class="m">Pн=' + f1(s.g.Pn) + " кВт · ΣKiPн=" + f1(s.g.KiPn) + " · n_э=" + f1(s.g.ne) + " · Ki_ср=" + f1(s.g.kiAvg) + " · tgφ=" + f1(s.g.tgAvg) + "</div>" +
      '<div class="m">Кр=' + f1(p.kr) + " → <b>Pр=" + f1(p.Pp) + " кВт · Qр=" + f1(p.Qp) + " квар · Sр=" + f1(p.Sp) + " кВА · Iр=" + f0(p.Sp * 1000 / (1.732 * 400)) + " А</b>" + (s.g.ne > 0 && s.g.ne <= 10.01 ? " <span class='note'>(Qр с коэф. 1,1: n_э≤10)</span>" : "") + "</div>" +
      '<div class="m">Q_КУ (Kо=' + f1(conf.ko) + ", cosцели=" + f1(conf.cosTarget) + ") = <b>" + f0(p.Qcu) + " квар</b> · Iкз.3ф шин=" + f1(I3 / 1000) + " кА · iуд=" + f1(conf.__base.iud * 1.41 / 1000 * 1.275) + " кА</div>" +
      (s.pRes ? '<div class="m" style="color:var(--warn)">резервный поток (в ΣPр не входит): ΣPрез=' + f1(s.gRes.KiPn) + " кВт, Sрез=" + f1(s.pRes.Sp) + " кВА</div>" : "") +
      (s.gUps.Pn > 0 ? '<div class="m" style="color:var(--bad)">ИБП-поток секции: ' + f1(s.gUps.KiPn) + " кВт (не суммируется)</div>" : "") +
      (APP.skew[secName] && APP.skew[secName].avg > 0.05 ? '<div class="m">фазы L1/L2/L3: ' + f1(APP.skew[secName].sums.L1) + "/" + f1(APP.skew[secName].sums.L2) + "/" + f1(APP.skew[secName].sums.L3) + " кВт · перекос " + f1(APP.skew[secName].skew) + " %</div>" : "") +
      "</div>";
  });
  var tw = rtmGroup(works()); var pw = tw.Pn > 0 ? rtmPower(tw, conf) : null;
  html += '<div class="tot" style="background:#eef7ee;border-color:#bcd9bc"><b>Узел в целом (рабочие 1+2+3)</b>' + (pw ? '<div class="m">Pр=' + f1(pw.Pp) + " кВт · Qр=" + f1(pw.Qp) + " · Sр=" + f1(pw.Sp) + " кВА ·ΣQ_КУ=" + f0(pw.Qcu) + " квар</div>" : "<div class='m'>—</div>") + "</div>";
  $("tots").innerHTML = html || '<span class="note">нет рабочих данных</span>';
}
function paintWarns() {
  $("warnlist").innerHTML = APP.warns.length ? APP.warns.map(function (w) { return '<li class="' + w.lv + '">' + (w.lv === "e" ? "✗ " : w.lv === "w" ? "⚠ " : "ℹ ") + esc(w.m) + "</li>"; }).join("") : '<li style="color:var(--ok)">✓ Замечаний нет</li>';
}
function works() { return state.rows.filter(function (r) { return r.kind === "work"; }); }

function renderRtmTable() {
  var el = $("rtmtable"); if (!el) return;
  var byId = {}; APP.res.rowsById.forEach(function (c) { byId[c.id] = c; });
  var h = "<table class='grid' style='font-size:12px'><thead><tr><th>Секция / поток</th><th>Поз.</th><th>Наименование</th><th>n</th><th>Pн.ед</th><th>Pн, кВт</th><th>Ki</th><th>cosφ</th><th>tgφ</th><th>Ki·Pн</th><th>Q,квар</th><th>n·P².ед</th></tr></thead><tbody>";
  SECS.forEach(function (sname) {
    var sc = APP.secCalc[sname]; var g = sc.g; if (!g || !g.Pn) return;
    var p = sc.p || {};
    h += "<tr><th colspan='12' style='background:#e8eef6;text-align:left'>СЕКЦИЯ " + sname.slice(-1) + " — рабочий поток РТМ: ΣPн=" + f1(g.Pn) + " · ΣKiPн=" + f1(g.KiPn) + " · n_э=" + f1(g.ne) + " · Ki_ср=" + f1(g.kiAvg) + " · tgφ=" + f1(g.tgAvg) + " · Кр=" + f1(p.kr || 0) + (g.ne <= 10.01 ? " (1,1Σ при n_э≤10)" : "") + " → Pр=<b>" + f1(p.Pp || 0) + "</b> · Qр=" + f1(p.Qp || 0) + " · Sр=" + f1(p.Sp || 0) + " кВА · Iр=" + f0((p.Sp || 0) * 1000 / (1.732 * 400)) + " А · Q_КУ=" + f0(p.Qcu || 0) + " квар</th></tr>";
    state.rows.filter(function (r) { return r.sec === sname && r.kind === "work"; }).forEach(function (r) {
      var c = byId[r.id], tg = tgFromCos(r.cosPhi);
      h += "<tr><td></td><td>W" + (201 + state.rows.indexOf(r)) + "</td><td>" + esc(r.name) + "</td><td>" + r.n + "</td><td>" + f1(r.pnUnit) + "</td><td>" + f1(c.Pn) + "</td><td>" + f1(r.ki) + "</td><td>" + f1(r.cosPhi) + "</td><td>" + f1(tg) + "</td><td>" + f1(c.Pr) + "</td><td>" + f1(c.Qr) + "</td><td>" + f0(r.n * r.pnUnit * r.pnUnit) + "</td></tr>";
    });
    if (sc.pRes) h += "<tr><td></td><td colspan='11' style='color:var(--warn)'>Резервный поток (в ΣPр не входит): ΣPрез=" + f1(sc.gRes.KiPn) + " кВт · Sрез=" + f1(sc.pRes.Sp) + " кВА — сечения/автоматы по max(Iраб,Iрез)</td></tr>";
    if (sc.gUps.Pn) h += "<tr><td></td><td colspan='11' style='color:var(--bad)'>Поток ИБП: ΣP=" + f1(sc.gUps.KiPn) + " кВт — от шины ИБП, в ΣPр не входит</td></tr>";
  });
  el.innerHTML = h + "</tbody></table>";
}
function readConf() {
  return {
    tpl: $("tpl").value, un: Number($("un").value), skz: Number($("skz").value), tr: Number($("tr1").value), tr2: Number($("tr2").value), uk: Number($("uk").value),
    dg: Number($("dg").value), ups: Number($("upsn").value), krt: $("krt").value, krTable: $("krt").value,
    ko: Number($("ko").value), cosTarget: Number($("costg").value), krOverride: $("krovr").checked, krManual: Number($("krman").value)
  };
}
function recalc() {
  var conf = readConf();
  conf.__base = faultBase(conf);
  APP.conf = conf;
  runCalc(conf);
  paintCells(); paintTotals(); paintWarns(); renderRtmTable();
  APP.sheetBuilt = false;
}
function faultBase(conf) {
  var U = 0.4, U2 = 400;
  var Ssk = Math.max(10, Number(conf.skz) || 250);
  var Sn = Math.max(100, Number(conf.tr) || 1000) / 1000; /* МВА */
  var uk = Number(conf.uk) || 6;
  var Zs = U * U / Ssk;
  var tr = TR_DB.pick(Math.max(100, Number(conf.tr) || 1000)); tr.uk = uk;
  var Ztr = uk / 100 * U * U / Sn;
  var Rtr = tr.pk * U * U / (Sn * Sn) / 1000;
  var Xtr = Math.sqrt(Math.max(0, Ztr * Ztr - Rtr * Rtr));
  var Rs = Rtr, Xs = Zs + Xtr;
  var Z1 = Math.sqrt(Rs * Rs + Xs * Xs);
  var I3 = U2 / (1.732 * Z1);
  return { I3: I3, iud: 1.8 * Math.SQRT2 * I3, Rs: Rs, Xs: Xs, Z1: Z1, tr: tr };
}
function rowIrOf(row) {
  var U = rowU(row), n = Math.max(0, Number(row.n) || 0), pu = Number(row.pnUnit) || 0, ki = Number(row.ki) || 0, cos = Number(row.cosPhi) || 0.8;
  var tg = tgFromCos(cos), Pr = ki * n * pu, Sr = Math.sqrt(Pr * Pr + (Pr * tg) * (Pr * tg));
  return U === 380 ? (Sr * 1000) / (1.732 * 380) : (Pr * 1000) / (220 * cos);
}
/* Полный пересчёт: два потока РТМ по секциям, greedy-фазы, ΔU/КЗ по строкам, предупреждения (ТЗ 2.2–2.3, 4) */
function runCalc(conf) {
  var byId = {}, i, r;
  var works = state.rows.filter(function (row) { return row.kind === "work"; });
  var resers = state.rows.filter(function (row) { return row.kind === "reserve"; });
  var upss = state.rows.filter(function (row) { return row.kind === "ups"; });
  var irs = {}; state.rows.forEach(function (row) { irs[row.id] = rowIrOf(row); });
  /* greedy балансировка фаз по секции (только 1~220 c phase=auto) */
  var assign = {};
  state.rows.forEach(function (row) { assign[row.id] = (String(row.ph) === "1~220" && row.phase !== "auto") ? row.phase : null; });
  SECS.forEach(function (secName) {
    var secRows = state.rows.filter(function (row) { return row.sec === secName && String(row.ph) === "1~220"; });
    var sum = { L1: 0, L2: 0, L3: 0 };
    secRows.filter(function (row) { return assign[row.id]; }).forEach(function (row) { sum[assign[row.id]] += (Number(row.ki) || 0) * (Number(row.n) || 0) * (Number(row.pnUnit) || 0); });
    var autos = secRows.filter(function (row) { return !assign[row.id]; }).sort(function (a2, b2) { return (b2.ki * b2.n * b2.pnUnit) - (a2.ki * a2.n * a2.pnUnit); });
    autos.forEach(function (row) {
      var minp = ["L1", "L2", "L3"].sort(function (a2, b2) { return sum[a2] - sum[b2]; })[0];
      assign[row.id] = minp; sum[minp] += (Number(row.ki) || 0) * (Number(row.n) || 0) * (Number(row.pnUnit) || 0);
    });
  });
  APP.phaseAssign = assign;
  /* Потоки РТМ по секциям: рабочий — в итоги; Резерв и ИБП — отдельно (не в ΣPр) */
  var secCalc = {};
  SECS.forEach(function (secName) {
    var g = rtmGroup(works.filter(function (row) { return row.sec === secName; }));
    var pw = g.Pn > 0 ? rtmPower(g, conf) : null;
    var gRes = rtmGroup(resers.filter(function (row) { return row.sec === secName; }));
    var pRes = gRes.Pn > 0 ? rtmPower(gRes, conf) : null;
    var gUps = rtmGroup(upss.filter(function (row) { return row.sec === secName; }));
    secCalc[secName] = { g: g, p: pw, gRes: gRes, pRes: pRes, gUps: gUps };
  });
  APP.secCalc = secCalc;
  var warn = [];
  /* Подбор каждой строки: max(Iраб,Iрез) по паре имён (ТЗ 4.1) */
  var rowsById = state.rows.map(function (row) {
    var partner = state.rows.filter(function (p2) { return p2.id !== row.id && p2.name && p2.name === row.name; });
    var pairIr = 0;
    partner.forEach(function (p2) { pairIr = Math.max(pairIr, irs[p2.id]); });
    pairIr = pairIr > irs[row.id] ? pairIr : (partner.length ? pairIr : 0);
    var c = selectRow(row, conf, partner.length ? Math.max(irs[row.id], pairIr) : irs[row.id]);
    c.id = row.id; void byId;
    c.tip = (!c.okDu ? "ΔU=" + f1(c.du) + "% > " + c.duLimit + "% — предложено S=" + c.nextS + " мм²" : "") + (!c.okTrip ? " | Iкз.одн.к.л(" + f0(c.I1end) + " А) < 1,25·Iотс(" + f0(c.In * c.trip) + " А)" : "");
    c.st = (c.okDu && c.okTrip ? "<span style=\"color:var(--ok)\">✓</span>" : "") + (c.okDu ? "" : "<span style=\"color:var(--bad)\">ΔU✗</span> ") + (c.okTrip ? "" : "<span style=\"color:var(--bad)\">отс✗</span>");
    if (c.motor) { var Ipu = (Number(row.kp) || 7) * c.Ir * 1.2; if (Ipu > 0.8 * c.In * c.trip) warn.push({ lv: "w", m: "«" + row.name + "»: пусковой ток ≈" + f0(Ipu) + " А > 0,8·Iотс " + f0(0.8 * c.In * c.trip) + " А — увеличить уставку/УПП (ТЗ 4.2)" }); }
    if (!c.okDu) warn.push({ lv: "e", m: "«" + row.name + "»: ΔU=" + f1(c.du) + "% > " + c.duLimit + (isLight(row) ? " % (освещение)" : " %") + " → следующее сечение " + c.nextS + " мм²" });
    if (!c.okTrip) warn.push({ lv: "e", m: "«" + row.name + "»: не проходит чувствительность КЗ (Iкз.одн=" + f1(c.I1end / 1000) + " кА < 1,25·I.отс) — увеличить сечение" });
    return c;
  });
  /* предупреждения по источникам (ТЗ 4.3) */
  SECS.forEach(function (secName, si) {
    var s = secCalc[secName]; if (!s.p) return;
    var trSn = (si === 0 ? conf.tr : si === 1 ? conf.tr2 : conf.tr) * 0.9;
    var loadPct = s.p.Sp / trSn * 100;
    if (loadPct > 90) warn.push({ lv: "e", m: secName + ": загрузка тр-ра " + f1(loadPct) + " % > 90 % (рац. использование ресурсов)" });
    else if (loadPct > 85) warn.push({ lv: "w", m: secName + ": загрузка тр-ра " + f1(loadPct) + " % (близко к 90 %)" });
  });
  (function () {
    var resP = resers.reduce(function (a2, row) { return a2 + (Number(row.ki) || 0) * (Number(row.n) || 0) * (Number(row.pnUnit) || 0); }, 0);
    if (resP > conf.dg * 0.8) warn.push({ lv: "e", m: "ΣP резервных=" + f1(resP) + " кВт > 0.8·S дизельгенератора (" + f0(conf.dg * 0.8) + " кВт) — ТЗ 4.3" });
    var upP = upss.reduce(function (a2, row) { return a2 + (Number(row.ki) || 0) * (Number(row.n) || 0) * (Number(row.pnUnit) || 0); }, 0);
    if (upP > (conf.ups || 10) * 0.9) warn.push({ lv: "w", m: "ΣP ИБП=" + f1(upP) + " кВт > 90 % S ИБП (" + conf.ups + " кВА)" });
    if (conf.tpl === "A" && state.rows.some(function (row) { return row.sec === "Секция 3"; })) warn.push({ lv: "i", m: "Шаблон А не содержит СЕКЦИИ 3 — строки на Секции 3 справочные (включите вариант Б)" });
    works.filter(function (row) { return row.cat === "I" && !state.rows.some(function (p2) { return p2.kind !== "work" && p2.name === row.name; }); })
      .forEach(function (row) { warn.push({ lv: "i", m: "Кат. I «" + row.name + "»: резервный поток с тем же наименованием не задан (АВР не собирается)" }); });
  })();
  /* перекос фаз (ГОСТ 32144-2013) */
  var skew = {};
  SECS.forEach(function (secName) {
    var sums = { L1: 0, L2: 0, L3: 0 };
    works.filter(function (row) { return row.sec === secName; }).forEach(function (row) {
      var p = (Number(row.ki) || 0) * (Number(row.n) || 0) * (Number(row.pnUnit) || 0);
      if (String(row.ph) === "1~220") { if (!sums[assign[row.id]]) sums[assign[row.id]] = 0; sums[assign[row.id]] += p; }
      else { sums.L1 += p / 3; sums.L2 += p / 3; sums.L3 += p / 3; }
    });
    var avg = (sums.L1 + sums.L2 + sums.L3) / 3;
    var sk = avg > 0 ? (Math.max(sums.L1, sums.L2, sums.L3) - Math.min(sums.L1, sums.L2, sums.L3)) / avg * 100 : 0;
    skew[secName] = { sums: sums, skew: sk, avg: avg };
    if (avg > 0.1 && sk > 30) warn.push({ lv: "e", m: secName + ": перекос " + f1(sk) + " % > 30 % (ГОСТ 32144-2013)" });
  });
  APP.skew = skew;
  APP.warns = warn;
  APP.res = { rowsById: rowsById };
}

/* ===== SECTION:ols ===== */
/* УГО (ГОСТ 2.755/2.710/2.721/2.751) поверх примитивов loads-gost */
var P = null;
function T2d(x, y, s, o) { P.els.push(Object.assign({ t: "t", x: x, y: y, s: String(s), size: o && o.size || 5.5, color: (o && o.color) || "#223344", bold: !!(o && o.bold), align: (o && o.align) || "start" }, {})); }
function L2(x1, y1, x2, y2, w, col, dash) { P.els.push({ t: "l", x1: x1, y1: y1, x2: x2, y2: y2, sw: w || 1.1, color: col || "#223344", dash: dash || null }); }
function C2(x, y, r, col) { P.els.push({ t: "c", x: x, y: y, r: r, stroke: col || "#223344" }); }
function R2d(x, y, w, h, col, fill) { P.els.push({ t: "r", x: x, y: y, w: w, h: h, color: col || "#223344", sw: 1, fill: fill || "none" }); }
function Nd(x, y, col) { P.els.push({ t: "n", x: x, y: y, r: 1.8, color: col || "#223344" }); }
function symQFsmall(x, y, label, res) {
  var col = res ? "#e67e22" : "#223344", dash = res ? "4 2.4" : null;
  L2(x, y, x, y + 5, 1.3, col, null);
  L2(x, y + 5, x + 4.5, y + 12.5, 1.5, col, null);
  R2d(x - 3.2, y + 8.4, 3.4, 3.4, col, "#fff");
  L2(x, y + 12.5, x, y + 18, 1.3, col, dash);
  T2d(x - 4, y + 9.5, label, { size: 4.6, bold: true, align: "end", color: res ? "#b26a00" : "#223344" });
}
function lockSym(x, y) { /* блок-замок эл.+мех. блокировки (ТЗ 2.4) */
  R2d(x - 2.2, y - 1, 4.4, 3.4, "#c62828", "#fff");
  R2d(x - 1.2, y - 3.4, 2.4, 2.4, "#c62828", "none");
  T2d(x + 3.4, y + 2, "&&", { size: 4, color: "#c62828", bold: true });
}
function fireTray(x, y, h) { /* символ огнестойкого лотка СПЗ (ВНИИПО) */
  L2(x - 1.5, y, x - 1.5, y + h, 0.7, "#c62828"); L2(x + 1.5, y, x + 1.5, y + h, 0.7, "#c62828");
  for (var yy = y + 2; yy < y + h; yy += 3.2) L2(x - 1.5, yy, x + 1.5, yy - 1.2, 0.5, "#c62828");
}
function mSym(x, y, lbl) { C2(x, y, 4.2); T2d(x, y + 1.8, "M", { size: 4.8, align: "middle", bold: true }); T2d(x, y + 8, lbl, { size: 3.8, align: "middle", color: "#33465e" }); }
function symATS(x, y) {
  R2d(x - 7, y - 5, 14, 10, "#1b6ef3", "#eef4ff");
  T2d(x, y - 0.5, "АВР", { size: 4.2, align: "middle", bold: true, color: "#1b6ef3" });
  T2d(x, y + 3.4, "t=0,5…10с", { size: 2.8, align: "middle", color: "#1b6ef3" });
}

function buildOls() {
  var conf = APP.conf;
  if (!conf) recalc(); conf = APP.conf;
  var byId = {}; APP.res.rowsById.forEach(function (c) { byId[c.id] = c; });
  var rowById = {}; state.rows.forEach(function (r) { rowById[r.id] = r; });
  var SECSN = conf.tpl === "A" ? 2 : 3;
  function consOf(i) { return state.rows.filter(function (r) { return r.sec === "Секция " + i; }); }
  var P1 = { W: 2100, H: 900, els: [] }; P = P1;
  var busY = 250, topY = 64;
  var FS0 = 8.5 /* базовый чертёжный (на бумаге А1 после ×0,5 и вписывания ≥ 2,5…3,5 мм по ГОСТ 2.304) */;
  T2d(16, 30, "Схема электрическая однолинейная (ОЛС) — " + (conf.tpl === "A" ? "вариант А: 2 секции + АВР + ДЭС 0,4 кВ на СЕКЦИИ 2" : "вариант Б: 3 секции + секционные выключатели + ДЭС 10 кВ через ТЗ на СЕКЦИИ 3"), { size: 16, bold: true });
  T2d(16, 44, "Исполнение по ГОСТ 2.702-2011 (тип С1); УГО: ГОСТ 2.755 (выключатели), 2.710 (цепи/блокировки), 2.721 (трансформаторы), 2.751 (перем. контакты), 2.722 (ток/нагрузка); шрифты — ГОСТ 2.304 серии 5/3.5/2.5", { size: FS0, color: "#33465e" });
  T2d(16, 54, "Основные цепи — сплошная основная линия; резервные и ИБП — штриховые (оранжевый/красный); цепи СПЗ — штриховая линия огнестойкого лотка и индекс «-FR» (разъяснения ВНИИПО); блокировки вводов/секционных — замки «(Э)/(М)»", { size: FS0, color: "#33465e" });
  var geo = {}, x0 = 24, UPSX = null;
  var slotWork = 72, slotRes = 86;
  [1, 2, 3].forEach(function (i) {
    if (i > (conf.tpl === "A" ? 2 : 3)) return;
    var wRows = consOf(i).filter(function (r) { return r.kind !== "reserve"; });
    var rRows = consOf(i).filter(function (r) { return r.kind === "reserve"; });
    var g = { cons: wRows, res: rRows, x0: x0 };
    g.w = 130 + wRows.length * slotWork + rRows.length * slotRes;
    geo[i] = g; x0 += g.w + 34;
  });
  var upsTop = state.rows.filter(function (r) { return r.kind === "ups"; });
  if (conf.tpl === "A" && upsTop.length) { UPSX = { x0: x0, cons: upsTop, w: 118 + upsTop.length * slotWork }; x0 += UPSX.w + 10; }
  P1.W = Math.max(x0 + 180, 1500);
  function symTR2(cx, cy, name, txt, col) {
    col = col || "#223344"; C2(cx - 7, cy, 9, col); C2(cx + 7, cy, 9, col);
    T2d(cx - 19, cy + 3, name, { size: 10, bold: true, align: "end", color: col });
    var ls = wrapTxt(String(txt), 16);
    ls.forEach(function (ln, li) { T2d(cx + 20, cy - 4 + li * 9, ln, { size: FS0, color: col }); });
  }
  function feedTop(i) {
    var g = geo[i], cx = g.x0 + 42, bx1 = g.x0 + 6, bx2 = g.x0 + g.w - 6;
    if (i === 1) {
      T2d(cx - 14, topY + 4, "Сеть 10(6) кВ, Sк.з.=" + conf.skz + " МВА", { size: FS0, align: "end" });
      L2(cx, topY - 6, cx, topY + 14, 1.6);
      C2(cx - 7, topY + 20, 8); C2(cx + 8, topY + 20, 5); T2d(cx + 8, topY + 22, "A", { size: 6, align: "middle" });
      T2d(cx - 18, topY + 24, "TA1", { size: FS0, bold: true, align: "end" });
      L2(cx - 2, topY + 30, cx, topY + 44, 1.4);
      symTR2(cx, topY + 58, "T1", conf.tr + " кВА · 10(6)/0,4 · Y/D · Ук" + conf.uk + "%");
      L2(cx, topY + 72, cx, busY - 26, 1.6);
      symQFsmall(cx - 12, busY - 60, "QF01", false); T2d(cx - 26, busY - 44, qfInI(conf.tr) + " А · 4P·LSI", { size: FS0, align: "end" });
      Nd(cx, busY);
    } else if (i === 2 && conf.tpl === "A") {
      T2d(cx - 14, topY + 4, "ДЭС 0,4 кВ · " + conf.dg + " кВА · cosφ 0,8", { size: FS0, align: "end", color: "#b26a00" });
      L2(cx, topY + 8, cx, topY + 26, 1.6, "#b26a00");
      C2(cx, topY + 34, 9, "#b26a00"); T2d(cx, topY + 37, "Г", { size: 9, align: "middle", bold: true, color: "#b26a00" });
      L2(cx, topY + 43, cx, busY - 60, 1.6, "#b26a00", "6 3");
      symQFsmall(cx - 12, busY - 46, "QF02", true); T2d(cx - 26, busY - 30, qfInI(conf.dg) + " А · 4P", { size: FS0, align: "end", color: "#b26a00" });
      Nd(cx, busY);
    } else if (i === 2) {
      T2d(cx - 14, topY + 4, "Сеть 10(6) кВ (рез.)", { size: FS0, align: "end" });
      C2(cx - 7, topY + 16, 8); C2(cx + 8, topY + 16, 5);
      L2(cx - 2, topY + 24, cx, topY + 38, 1.4);
      symTR2(cx, topY + 54, "T2", conf.tr2 + " кВА · Ук" + conf.uk + "%");
      L2(cx, topY + 68, cx, busY - 60, 1.6);
      symQFsmall(cx - 12, busY - 46, "QF03", false);
      Nd(cx, busY);
    } else {
      T2d(cx - 14, topY + 4, "ДЭС 10 кВ · " + conf.dg + " кВА", { size: FS0, align: "end", color: "#b26a00" });
      L2(cx, topY + 8, cx, topY + 22, 1.6, "#b26a00");
      C2(cx, topY + 30, 9, "#b26a00"); T2d(cx, topY + 33, "Г", { size: 9, align: "middle", bold: true, color: "#b26a00" });
      L2(cx, topY + 39, cx, topY + 48, 1.6, "#b26a00");
      symTR2(cx, topY + 62, "T3", conf.dg + " кВА · 10/0,4", "#b26a00");
      L2(cx, topY + 76, cx, busY - 52, 1.6, "#b26a00", "6 3");
      symQFsmall(cx - 12, busY - 40, "QF05", true);
      Nd(cx, busY);
    }
    L2(bx1, busY, bx2, busY, 5.5);
    T2d(cx + (bx2 - bx1) / 2 - 42, busY - 10, "СЕКЦИЯ " + i + " · 0,4 кВ", { size: 11, bold: true, align: "middle" });
    var ss = APP.secCalc["Секция " + i];
    if (ss && ss.p) T2d(bx2 - 4, busY - 10, "ΣPр=" + f1(ss.p.Pp) + " кВт · Sр=" + f1(ss.p.Sp) + " кВА", { size: FS0, align: "end", color: "#33465e" });
    if (conf.un === 10 || (geo[1] && i === 1)) {}
  }
  function qfInI(kva) { return pickQf(kva * 1000 / (1.732 * 400)); }
  [1, 2, 3].forEach(function (i) { if (geo[i]) feedTop(i); });
  if (UPSX) {
    var ux = UPSX.x0 + 42;
    T2d(ux, topY - 6, "ИБП VFI · " + (conf.ups || 10) + " кВА", { size: 9.5, bold: true, align: "middle", color: "#c62828" });
    R2d(ux - 26, topY + 2, 52, 24, "#c62828", "#fdf1f1"); T2d(ux, topY + 17, "VFI · SS1", { size: FS0, align: "middle", color: "#c62828" });
    L2(ux, topY + 26, ux, busY + 72, 1.5, "#c62828", "6 3");
    L2(ux - 16, busY + 72, ux + 16, busY + 72, 3, "#c62828");
    T2d(ux + 20, busY + 66, "шина ИБП", { size: FS0, color: "#c62828" });
    Nd(ux, busY + 72, "#c62828");
  }
  if (conf.tpl === "A" && geo[1] && geo[2]) {
    var a0 = geo[1].x0 + geo[1].w - 6, a1 = geo[2].x0 + 6, mx = (a0 + a1) / 2;
    L2(a0, busY, a1, busY, 3.4);
    L2(mx, busY, mx, busY + 10, 1.6); symQFsmall2(mx, busY + 10, "QF11");
    symATS(mx + 46, busY + 20); lockSym(mx - 16, busY + 26);
    T2d(mx, busY + 60, "секционный QF11 + АВР (Э)/(М)", { size: FS0, align: "middle", color: "#1b6ef3" });
  } else if (conf.tpl === "B") {
    [[1, 2, "QF11"], [2, 3, "QF12"]].forEach(function (p2) {
      var g1 = geo[p2[0]], g2 = geo[p2[1]]; if (!g1 || !g2) return;
      var a0 = g1.x0 + g1.w - 6, a1 = g2.x0 + 6, mx = (a0 + a1) / 2;
      L2(a0, busY, a1, busY, 3.4);
      L2(mx, busY, mx, busY + 10, 1.6); symQFsmall2(mx, busY + 10, p2[2]);
      lockSym(mx - 16, busY + 26); T2d(mx, busY + 46, "секционный " + p2[2] + " (Э)/(М)", { size: FS0, align: "middle", color: "#1b6ef3" });
    });
    if (geo[1]) { var m2 = geo[1].x0 + geo[1].w / 2; symATS(m2, busY + 64); T2d(m2, busY + 82, "АВР секции 1–2", { size: FS0, align: "middle", color: "#1b6ef3" }); }
  }
  function symQFsmall2(x, y, label) {
    L2(x, y, x, y + 6, 1.6); L2(x, y + 6, x + 7, y + 17, 1.7); R2d(x - 5, y + 11, 5.4, 5.4, "#223344", "#fff"); L2(x, y + 17, x, y + 26, 1.6);
    T2d(x - 8, y + 15, label, { size: 8.5, align: "end", bold: true });
  }
  var feedMaxBot = busY + 90;
  function escPh(r) { if (String(r.ph) === "1~220") return "1~ " + APP.phaseAssign[r.id]; return "3~"; }
  function drawConn(cx, r) {
    var c = byId[r.id];
    var isRes = r.kind === "reserve", isUps = r.kind === "ups";
    var col = isRes ? "#e67e22" : isUps ? "#c62828" : "#223344";
    L2(cx, busY, cx, busY + 14, 1.4, col); Nd(cx, busY, col);
    var qfY = busY + 16;
    L2(cx - 2, qfY + 16, cx - 2, qfY + 30, 1.4, col);
    L2(cx - 2, qfY + 30, cx + 5, qfY + 44, 1.5, col);
    R2d(cx - 8.5, qfY + 37.5, 5.5, 5.5, col, "#fff");
    L2(cx - 2, qfY + 44, cx - 2, qfY + 58, 1.4, col, (isRes || isUps) ? "6 3" : null);
    var qn = "QF" + (201 + state.rows.indexOf(r));
    T2d(cx - 2, qfY + 8, qn, { size: 8.2, align: "middle", bold: true, color: col });
    T2d(cx - 12, qfY + 30, "In=" + c.In + " А", { size: FS0, align: "end", color: col });
    if (String(r.ph) === "1~220") T2d(cx - 12, qfY + 40, "1~" + APP.phaseAssign[r.id], { size: FS0, align: "end", color: "#e07b00" });
    else T2d(cx - 12, qfY + 40, "отс." + c.trip + "·In", { size: 8, align: "end", color: "#33465e" });
    var lineY = qfY + 58, lineH = 34;
    L2(cx - 2, lineY, cx - 2, lineY + lineH, 1.4, col, (isRes || isUps) ? "6 3" : null);
    if (r.spz) { fireTray(cx, lineY + 2, lineH - 6); T2d(cx + 6, lineY + 12, "лоток огнестойкий, -FR", { size: 7.5, color: "#c62828" }); }
    var yL = lineY + lineH + 8;
    if (r.motor) { C2(cx, yL + 8, 8); T2d(cx, yL + 11, "M", { size: 9, align: "middle", bold: true }); yL += 20; T2d(cx, yL, "Pн=" + f1(r.pnUnit) + " кВт·Кп" + (r.kp || 7), { size: FS0, align: "middle" }); yL += 9; }
    else { R2d(cx - 9, yL, 18, 11, col, "#fff"); T2d(cx, yL + 8, "H", { size: 9, align: "middle", bold: true }); yL += 19; }
     var nm = String(r.name || "").slice(0, 26);
    var nl = wrapTxt(nm, Math.max(9, Math.floor(56 / (FS0 * 0.55))));
    nl.forEach(function (ln, li) { T2d(cx, yL + 3 + li * 8.6, ln, { size: FS0, align: "middle", bold: li === 0, color: (isRes || isUps) ? col : "#223344" }); });
    yL += 4 + nl.length * 8.6;
    T2d(cx, yL, "W" + (201 + state.rows.indexOf(r)) + " · " + f1(c.Pr) + " кВт", { size: FS0, align: "middle", bold: true }); yL += 8.6;
    T2d(cx, yL, "Iр=" + f0(c.Icalc) + " А · S=" + c.s + " мм²", { size: 8, align: "middle" }); yL += 8.6;
    var mtag = /FRLS/.test(c.mark) ? "нг(А)-FRLS" : (c.mark.indexOf("ВБ") >= 0 ? "ВБШв" : "ВВГнг-LS");
    var core = (String(r.ph) === "1~220" || r.kind === "ups") ? "3×" : "5×";
    T2d(cx, yL, mtag + " " + core + c.s + " · L" + r.L + "м", { size: 8, align: "middle", color: "#33465e" }); yL += 8.6;
    T2d(cx, yL, "ΔU=" + f1(c.du) + " % · Iкз=" + f1(c.I1end / 1000) + " кА", { size: 8, align: "middle", color: (c.okDu && c.okTrip) ? "#1b8a3f" : "#c62828" }); yL += 8.6;
    if (isRes) {
      var wrow = works().filter(function (p2) { return p2.name === r.name; })[0];
      T2d(cx, yL, "резерв " + (wrow ? "к W" + (201 + state.rows.indexOf(wrow)) : "цепь"), { size: 8, align: "middle", color: "#b26a00" }); yL += 8.6;
    }
    if (isUps && r.spz) T2d(cx, yL, "СПЗ АУПТ/СОУЭ", { size: 8, align: "middle", color: "#c62828" });
    feedMaxBot = Math.max(feedMaxBot, yL + 12);
  }
  [1, 2, 3].forEach(function (i) {
    var g = geo[i]; if (!g) return;
    var xx = g.x0 + 56 + slotWork / 2;
    g.cons.forEach(function (r) { drawConn(xx, r); xx += slotWork; });
    g.res.forEach(function (r) { drawConn(xx, r); xx += slotRes; });
  });
  if (UPSX) {
    var xx2 = UPSX.x0 + 34 + slotWork / 2;
    UPSX.cons.forEach(function (r) {
      var y = busY + 72; L2(r === UPSX.cons[0] ? xx2 - 0 : xx2, y, xx2, y, 1.5, "#c62828");
      Nd(xx2, y, "#c62828");
      drawConnAt(xx2, r, y);
      xx2 += slotWork;
    });
    function drawConnAt(cx, r, startY) {
      var c = byId[r.id];
      L2(cx, startY, cx, startY + 14, 1.4, "#c62828", "6 3");
      var qfY = startY + 14;
      L2(cx - 2, qfY + 16, cx - 2, qfY + 30, 1.4, "#c62828");
      L2(cx - 2, qfY + 30, cx + 5, qfY + 44, 1.5, "#c62828");
      R2d(cx - 8.5, qfY + 37.5, 5.5, 5.5, "#c62828", "#fff");
      L2(cx - 2, qfY + 44, cx - 2, qfY + 66, 1.4, "#c62828", "6 3");
      T2d(cx - 12, qfY + 42, "QF" + (201 + state.rows.indexOf(r)), { size: 9, align: "end", bold: true, color: "#c62828" });
      T2d(cx - 12, qfY + 52, "In=" + c.In + " А", { size: FS0, align: "end", color: "#c62828" });
      var yL = qfY + 66;
      R2d(cx - 9, yL + 2, 18, 11, "#c62828", "#fff"); T2d(cx, yL + 10, "H", { size: 9, align: "middle", bold: true });
      var nm = String(r.name || "").slice(0, 26);
      wrapTxt(nm, 9).forEach(function (ln, li) { T2d(cx, yL + 22 + li * 8.6, ln, { size: FS0, align: "middle", color: "#c62828" }); });
      var yL2 = yL + 24 + wrapTxt(nm, 9).length * 8.6;
      T2d(cx, yL2 + 4, "ИБП · " + f1(c.Pr) + " кВт · " + f0(r.L) + " м · -FR", { size: 8, align: "middle", color: "#c62828" });
      feedMaxBot = Math.max(feedMaxBot, yL2 + 12);
    }
  }
  /* ===== Таблица 1 — расчётно-спецификационные цепи ===== */
  var ty = feedMaxBot + 34;
  T2d(14, ty, "Таблица 1 — расчётно-спецификационные цепи (по строкам ведомости нагрузок)", { size: 12, bold: true });
  var heads = ["№", "Наименование цепи (ЭП)", "Тип", "Кат", "φ/U", "Секц", "n", "Pн, кВт", "Ki", "Iр, А", "кабель S·L, марка", "ΔU", "QF (In·отс)", "Iкз1ф кл. кА", "СПЗ"];
  var rowsD = state.rows.map(function (r, i) {
    var c = byId[r.id];
    return [String(i + 1), String(r.name).slice(0, 30), r.kind === "work" ? "раб" : r.kind === "reserve" ? "рез" : "ИБП", r.cat, String(r.ph).replace("~", ""), r.sec.replace("Секция ", "С"), String(r.n), f1(c.Pn), f1(r.ki), f0(c.Icalc), c.s + " мм²·" + r.L + " м·" + c.mark, f1(c.du) + (c.okDu ? " ✓" : " ✗"), c.In + "×" + c.trip, f1(c.I1end / 1000), r.spz ? "-FR" : "—"];
  });
  var FS1 = 9;
  function cwid(s) { return String(s).length * FS1 * 0.62 + 10; }
  var colw = heads.map(function (h3, i3) { var w = cwid(h3); rowsD.forEach(function (rw) { var w2 = cwid(rw[i3]); if (w2 > w) w = w2; }); return Math.min(Math.max(w, 30), 300); });
  var tw3 = colw.reduce(function (a2, b2) { return a2 + b2; }, 0);
  P1.W = Math.max(P1.W, 24 + tw3 + 60);
  var tyy = ty + 16, rh = 17;
  function gridT(yT, yB) { var q = 14; for (var qq = 0; qq <= colw.length; qq++) { L2(q, yT, q, yB, 0.7); if (qq < colw.length) q += colw[qq]; } L2(14, yT, 14 + tw3, yT, 0.8); L2(14, yB, 14 + tw3, yB, 0.8); }
  gridT(tyy, tyy + rh);
  (function () { var q = 14; heads.forEach(function (h3, i3) { T2d(q + 3, tyy + 12, h3, { size: FS1, bold: true }); q += colw[i3]; }); })();
  rowsD.forEach(function (rw, ri) { var ry2 = tyy + rh * (ri + 1); gridT(ry2, ry2 + rh); var q = 14; rw.forEach(function (v, i3) { T2d(q + 3, ry2 + 12, v, { size: FS1, color: i3 === 11 && /✗/.test(v) ? "#c62828" : (i3 === 12 && /✗/.test(String(rw[11])) ? "#c62828" : "#223344") }); q += colw[i3]; }); });
  var yy = tyy + rh * (rowsD.length + 1) + 14;
  /* ===== Таблица 2 — расчёт по РТМ 36.18.32.4-92 (пояс нагрузки) ===== */
  T2d(14, yy, "Таблица 2 — расчёт электрических нагрузок по РТМ 36.18.32.4-92 (рабочий поток; резерв и ИБП — отдельными строками в ΣPр не входят)", { size: 12, bold: true });
  var h4 = ["Секция/поток", "поз.", "Наименование", "n", "Pн.ед кВт", "Pн кВт", "Ki", "cosφ", "tgφ", "KiPн кВт", "Q кв.", "n·Pн.ед²"];
  var rws = [];
  SECS.forEach(function (sname) {
    var g = (APP.secCalc[sname] || {}).g; if (!g || !g.Pn) return;
    rws.push(["СЕКЦИЯ " + sname.slice(-1) + " — рабочий", "", "— итого по секции: ΣPн=" + f1(g.Pn) + "; ΣKiPн=" + f1(g.KiPn) + "; ΣnP²=" + f0(g.sumNPn2) + "; n_э=" + f1(g.ne) + "; Ki_ср=" + f1(g.kiAvg) + "; tgφ_ср=" + f1(g.tgAvg) + "; Кр=" + f1((APP.secCalc[sname].p || {}).kr), "", "", "", "", "", "", "", "", "", ""]);
    state.rows.filter(function (r) { return r.sec === sname && r.kind === "work"; }).forEach(function (r, k) {
      var c = byId[r.id]; var tg = tgFromCos(r.cosPhi);
      rws.push(["", "W" + (201 + state.rows.indexOf(r)), String(r.name).slice(0, 34), String(r.n), f1(r.pnUnit), f1(c.Pn), f1(r.ki), f1(r.cosPhi), f1(tg), f1(c.Pr), f1(c.Qr), f0(Math.max(0, r.n * r.pnUnit * r.pnUnit))]);
    });
    var p = APP.secCalc[sname].p;
    if (p && isFinite(p.Pp)) rws.push(["", "", "Pр=Кр·ΣKiPн=" + f1(p.Pp) + " кВт; Qр=" + f1(p.Qp) + " квар" + ((APP.secCalc[sname].g.ne <= 10.01 && APP.secCalc[sname].g.ne > 0) ? " (1,1·Σ при n_э≤10)" : "") + "; Sр=" + f1(p.Sp) + " кВА; Iр=" + f0(p.Sp * 1000 / (1.732 * 400)) + " А; Q_КУ=" + f0(p.Qcu) + " квар", "", "", "", "", "", "", "", "", "", ""]);
    var gr = APP.secCalc[sname].gRes; if (gr.Pn) rws.push(["резервный поток", "", "ΣPрез(Ki·Pн)=" + f1(gr.KiPn) + " кВт; в ΣPр не входит; сечения/автоматы — по max(Iраб,Iрез)", "", "", "", "", "", "", "", "", ""]);
    var gu = APP.secCalc[sname].gUps; if (gu.Pn) rws.push(["поток ИБП", "", "ΣP(ИБП)=" + f1(gu.KiPn) + " кВт — от шины ИБП (VFI)", "", "", "", "", "", "", "", "", ""]);
  });
  var FS2 = 9;
  function cwid2(s) { return String(s).length * FS2 * 0.62 + 10; }
  var colw2 = h4.map(function (h3, i3) { var w = cwid2(h3); rws.forEach(function (rw) { var w2 = cwid2(rw[i3]); if (w2 > w) w = w2; }); return Math.min(Math.max(w, 44), 430); });
  var tw4 = colw2.reduce(function (a2, b2) { return a2 + b2; }, 0);
  P1.W = Math.max(P1.W, 24 + tw4 + 60);
  var t2y = yy + 16, rh2 = 16.5;
  function gridT2(yT, yB) { var q = 14; for (var qq = 0; qq <= colw2.length; qq++) { L2(q, yT, q, yB, 0.6); if (qq < colw2.length) q += colw2[qq]; } L2(14, yT, 14 + tw4, yT, 0.7); L2(14, yB, 14 + tw4, yB, 0.7); }
  gridT2(t2y, t2y + rh2);
  (function () { var q = 14; h4.forEach(function (h3, i3) { T2d(q + 3, t2y + 11, h3, { size: FS2, bold: true }); q += colw2[i3]; }); })();
  rws.forEach(function (rw, ri) {
    var ry2 = t2y + rh2 * (ri + 1); gridT2(ry2, ry2 + rh2); var q = 14;
    var secRow = !!rw[0];
    rw.forEach(function (v, i3) { T2d(q + 3, ry2 + 10.5, v, { size: FS2, bold: secRow && i3 < 3, color: secRow ? "#0b3d69" : "#223344" }); q += colw2[i3]; });
  });
  var ys = t2y + rh2 * (rws.length + 1) + 16;
  T2d(14, ys, "Токи КЗ (упрощённо): Iкз.3ф.шин = " + f1(conf.__base.I3 / 1000) + " кА; iуд = " + f1(conf.__base.iud / 1000) + " кА; Sк.з сети = " + conf.skz + " МВА; Т " + conf.tr + " кВА Ук " + conf.uk + " %. Отключающая способность ≥ 50 кА; чувствительность — по Табл.1 (1,25·Iотс).", { size: FS0, color: "#33465e" });
  T2d(14, ys + 11, "Резервные нагрузки и ИБП в ΣP_node не суммируются (РТМ). Кат. I восстановл. автоматически от двух невзаимозависимых вводов с АВР (ПУЭ 1.2.14). Кабели СПЗ — ВВГнг(А)-FRLS в огнестойких лотках (ВНИИПО).", { size: FS0, color: "#b26a00" });
  T2d(14, ys + 22, "Примечания к ОЛС: (Э)/(М) — электрическая/механическая блокировка; «Г» — синхронный генератор ДЭС; «M» — двигатель; «H» — нагрузка (линейка); W2xx — позиция по ведомости; 1~L2 — фаза однофазной цепи (автобалансировка).", { size: FS0, color: "#33465e" });
  P1.H = ys + 40;
  if (window.mmSheet) mmSheet(P1);
  if (window.sheetFrame) sheetFrame(P1, { title: "ОЛС НКУ/КТП — вариант " + conf.tpl + " (Нагрузки 2.0)" });
  APP.P = P1; APP.sheetBuilt = true;
  return P1;
}
function renderOls() {
  var pp = buildOls();
  $("sheetcard").hidden = false;
  $("sheetbox").innerHTML = window.prims2svg ? prims2svg(pp, 1.15) : "—";
}

/* ===== SECTION:export ===== */
function download(name, mime, content) {
  var blob = content instanceof Blob ? content : new Blob([content], { type: mime + ";charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a"); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 8000);
}
function xlsEsc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
function exportXls() {
  if (!APP.res) recalc();
  var byId = {}; APP.res.rowsById.forEach(function (c) { byId[c.id] = c; });
  var head = ["№", "Наименование", "Тип", "Кат", "СПЗ", "φ/U", "Секция", "n", "Pн ед", "Pн", "Ki", "cosφ", "tgφ", "Pр", "Qр", "L,м", "Прокладка", "Фаза", "Iрасч", "S,мм²", "Кабель", "ΔU%", "QF In", "отсечка×In", "Iкз1ф кл., кА"];
  var rows = state.rows.map(function (r, i) {
    var c = byId[r.id];
    return [i + 1, r.name, r.kind === "work" ? "Рабочая" : r.kind === "reserve" ? "Резервная" : "ИБП", r.cat, r.spz ? "да" : "", r.ph, r.sec, r.n, r.pnUnit, c.Pn, r.ki, r.cosPhi, f1(tgFromCos(r.cosPhi)), c.Pr, c.Qr, r.L, LAY_INFO[r.lay || "tray"].ru, APP.phaseAssign[r.id] || "3~", f0(c.Icalc), c.s, c.mark, f1(c.du), c.In, c.trip, f1(c.I1end / 1000)];
  });
  function sheet(name, h2, rr) {
    var s = "<Row>" + h2.map(function (x) { return '<Cell ss:StyleID="b"><Data ss:Type="String">' + xlsEsc(x) + "</Data></Cell>"; }).join("") + "</Row>";
    rr.forEach(function (rw) { s += "<Row>" + rw.map(function (v) { var t = typeof v === "number" || (v !== "" && isFinite(v)) ? "Number" : "String"; return "<Cell><Data ss:Type=" + t + ">" + xlsEsc(v) + "</Data></Cell>"; }).join("") + "</Row>"; });
    return "<Worksheet ss:Name='" + name + "'><Table>" + s + "</Table></Worksheet>";
  }
  var t1 = [["Итог рабочий", "", "", ""]];
  SECS.forEach(function (sname) {
    var g = APP.secCalc[sname]; if (!g || !g.p) return;
    t1.push([sname + " (рабочий РТМ)", f1(g.p.Pp), f1(g.p.Qp), f1(g.p.Sp)]);
    t1.push([sname + " n_э / Кр", f1(g.g.ne), f1(g.p.kr), f0(g.p.Qcu) + " квар КУ"]);
    if (g.pRes) t1.push([sname + " (резерв, не в ΣPр)", f1(g.pRes.Pp), f1(g.pRes.Qp), f1(g.pRes.Sp)]);
    if (g.gUps.Pn) t1.push([sname + " (ИБП поток)", f1(g.gUps.KiPn), "", ""]);
  });
  var spec = [["Автомат QF", "In, A", "Отсечка", "Кол-во"], ["QF ввод/секц 01…12", "по расчёту", "LSI", String(state.rows.length + 2)]];
  state.rows.forEach(function (r, i) { var c = byId[r.id]; spec.push(["QF" + (201 + i) + " " + String(r.name).slice(0, 30), c.In, c.trip + "×In", r.n]); });
  spec.push(["Кабель", "S, мм²", "L, м", "Марка"]);
  state.rows.forEach(function (r, i) { var c = byId[r.id]; spec.push([String(r.name).slice(0, 30), c.s, r.L, c.mark]); });
  var xml = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="b"><Font ss:Bold="1"/></Style></Styles>' +
    sheet("Ведомость нагрузок", head, rows) + sheet("Расчёт РТМ", ["Секция/поток","Поз","Наименование","n","Pн ед","Pн","Ki","cos","tg","KiPн","Q","nP²"], (function () {
    var out = [], byId2 = {}; APP.res.rowsById.forEach(function (c) { byId2[c.id] = c; });
    SECS.forEach(function (sname) {
      var sc = APP.secCalc[sname], g = sc.g, p = sc.p || {};
      if (!g || !g.Pn) return;
      out.push(["СЕКЦИЯ " + sname.slice(-1), "", "ΣPн=" + f1(g.Pn) + "; ΣKiPн=" + f1(g.KiPn) + "; n_э=" + f1(g.ne) + "; Кр=" + f1(p.kr || 0) + "; Pр=" + f1(p.Pp || 0) + "; Qр=" + f1(p.Qp || 0) + "; Sр=" + f1(p.Sp || 0) + "; Qку=" + f0(p.Qcu || 0), "", "", "", "", "", "", "", "", ""]);
      state.rows.filter(function (r) { return r.sec === sname && r.kind === "work"; }).forEach(function (r) {
        var c = byId2[r.id], tg = tgFromCos(r.cosPhi);
        out.push([sname, "W" + (201 + state.rows.indexOf(r)), r.name, r.n, r.pnUnit, c.Pn, r.ki, r.cosPhi, f1(tg), c.Pr, c.Qr, f0(r.n * r.pnUnit * r.pnUnit)]);
      });
      if (sc.pRes) out.push([sname + " резерв", "", "ΣPрез=" + f1(sc.gRes.KiPn) + " кВт (в ΣPр не входит; max-ток на кабель)", "", "", "", "", "", "", "", "", ""]);
      if (sc.gUps.Pn) out.push([sname + " ИБП", "", "ΣP=" + f1(sc.gUps.KiPn) + " кВт (шина ИБП)", "", "", "", "", "", "", "", "", ""]);
    });
    return out;
  })()) + sheet("Итоги РТМ", ["Группа", "Pр кВт", "Qр квар", "Sр кВА"], t1) + sheet("Спецификация МТР", ["Наименование", "1", "2", "3"], spec) + "</Workbook>";
  download("nagruzki2-vedomost.xls", "application/vnd.ms-excel", xml);
}
function exportDoc(svgPng) {
  if (!APP.res) recalc();
  var conf = APP.conf, css = "<style>body{font:12pt 'Times New Roman',serif}h1{font-size:15pt}h2{font-size:13pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:3px 6px;font-size:9.5pt}th{background:#e8eef6}</style>";
  var byId = {}; APP.res.rowsById.forEach(function (c) { byId[c.id] = c; });
  var body = "<h1>Пояснительная записка. Автоматизированный расчёт электрических нагрузок и выбор аппаратуры (НКУ/КТП 0,4 кВ)</h1>";
  body += "<h2>1. Исходные данные</h2><table><tr><th>Параметр</th><th>Значение</th></tr>" +
    "<tr><td>Шаблон ОЛС</td><td>" + (conf.tpl === "A" ? "А — 2 секции + АВР + ДЭС 0,4 кВ" : "Б — 3 секции + секционные + ДЭС 10 кВ через ТЗ") + "</td></tr>" +
    "<tr><td>Напряжение</td><td>" + conf.un + " кВ; Sк.з сети 10 кВ = " + conf.skz + " МВА</td></tr>" +
    "<tr><td>Трансформаторы</td><td>Т1 = " + conf.tr + " кВА; Т2 = " + conf.tr2 + " кВА; Uк = " + conf.uk + " %</td></tr>" +
    "<tr><td>ДЭС / ИБП</td><td>" + conf.dg + " кВА / " + conf.ups + " кВА</td></tr>" +
    "<tr><td>Методика</td><td>РТМ 36.18.32.4-92: Pр=Кр·ΣKi·Pн; Qр=1,1·ΣKiPн·tgφ при n_э≤10; Кр по " + (conf.krt === "table1" ? "табл.1" : "табл.2") + "; Кс(одновр)=" + conf.ko + "; cosφ цели " + conf.cosTarget + "</td></tr></table>";
  body += "<h2>2. Токи короткого замыкания (упрощённый расчёт)</h2><p>Iкз.3ф на шинах 0,4 кВ = <b>" + f1(conf.__base.I3 / 1000) + " кА</b>; ударный iуд = <b>" + f1(conf.__base.iud / 1000) + " кА</b>. Iкз.одн в конце линий и проверка чувствительности (1,25·Iотс) — по Таблице 1 ведомости." + 
    " Отключающая способность аппаратов ≥ " + (conf.__base.I3 / 1000 > 35 ? "50" : "36") + " кА.</p>";
  body += "<h2>3. Результаты расчёта по секциям</h2><table><tr><th>Секция</th><th>Pн, кВт</th><th>ΣKi·Pн</th><th>n_э</th><th>Ki ср</th><th>Кр</th><th>Pр, кВт</th><th>Qр, квар</th><th>Sр, кВА</th><th>Q_КУ</th><th>Перекос, %</th></tr>";
  SECS.forEach(function (sname) {
    var s = APP.secCalc[sname]; if (!s || !s.p) return;
    body += "<tr><td>" + sname + "</td><td>" + f1(s.g.Pn) + "</td><td>" + f1(s.g.KiPn) + "</td><td>" + f1(s.g.ne) + "</td><td>" + f1(s.g.kiAvg) + "</td><td>" + f1(s.p.kr) + "</td><td><b>" + f1(s.p.Pp) + "</b></td><td>" + f1(s.p.Qp) + "</td><td>" + f1(s.p.Sp) + "</td><td>" + f0(s.p.Qcu) + "</td><td>" + f1((APP.skew[sname] || {}).skew || 0) + "</td></tr>";
  });
  body += '</table><h2>3.1. Ведомость расчёта по РТМ (позиции W — как на ОЛС)</h2><table><tr><th>Поз</th><th>Наименование</th><th>Секция</th><th>n</th><th>Pн,кВт</th><th>Ki</th><th>cosφ</th><th>Ki·Pн,кВт</th><th>Q,квар</th></tr>';
  body += state.rows.filter(function (r) { return r.kind === "work"; }).map(function (r) { var c = (APP.res.rowsById.filter(function (x) { return x.id === r.id; })[0] || {}); return "<tr><td>W" + (201 + state.rows.indexOf(r)) + "</td><td>" + esc(r.name) + "</td><td>" + r.sec + "</td><td>" + r.n + "</td><td>" + f1(c.Pn) + "</td><td>" + f1(r.ki) + "</td><td>" + f1(r.cosPhi) + "</td><td>" + f1(c.Pr) + "</td><td>" + f1(c.Qr) + "</td></tr>"; }).join("");
  body += "</table><p>Резервные нагрузки и нагрузки ИБП в ΣPр не включаются (РТМ), используются для выбора сечений/автоматов по max-току и для схем АВР; сводка по секциям (n_э, Кр, 1,1-коэф., Q_КУ) — таблица раздела 3.</p>";
  body += "<h2>4. Однолинейная схема</h2>";
  if (svgPng) body += '<img src="' + svgPng + '" style="width:100%"/>';
  body += "<h2>5. Спецификация оборудования (МТР, укрупнённо)</h2><table><tr><th>Позиция</th><th>Тип/номинал</th><th>Кол.</th></tr>";
  var qfs = {}; var cabs = {};
  state.rows.forEach(function (r, i) { var c = byId[r.id]; qfs["Автомат QF " + c.In + " A, кр." + c.trip] = (qfs["Автомат QF " + c.In + " A, кр." + c.trip] || 0) + Number(r.n || 1); cabs[c.mark] = (cabs[c.mark] || 0) + (Number(r.L) * (r.n > 1 ? 1 : 1)) / 1000; });
  Object.keys(qfs).forEach(function (k) { body += "<tr><td>" + k + "</td><td>ВА/BA07 или аналог, Icu≥50 кА</td><td>" + qfs[k] + "</td></tr>"; });
  Object.keys(cabs).forEach(function (k) { body += "<tr><td>Кабель " + k + "</td><td>" + (String(k).indexOf("FR") >= 0 ? "огнестойкий (СПЗ/ВНИИПО)" : "ВВГнг-LS класс") + "</td><td>" + f1(cabs[k]) + " км</td></tr>"; });
  body += "</table>";
  if (APP.warns.length) { body += "<h2>6. Предупреждения расчёта</h2><ul>" + APP.warns.map(function (w) { return "<li>" + esc(w.m) + "</li>"; }).join("") + "</ul>"; }
  var html = "\ufeff<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>" + css + "</head><body><div class=Section1>" + body + "</div></body></html>";
  download("nagruzki2-poyasnitelnica.doc", "application/msword", html);
}

/* Отдельный документ: Ведомость электрических нагрузок по РТМ (А3, альбомная) */
function exportRtmDoc() {
  if (!APP.res) recalc();
  var conf = APP.conf, byId = {}; APP.res.rowsById.forEach(function (c) { byId[c.id] = c; });
  var obj = ($("obj") || {}).value || "Объект", cust = ($("cust") || {}).value || "";
  var css = "<style>@page{size:420mm 297mm;margin:8mm;} body{font:11pt 'Times New Roman',serif}"+
    "h1{font-size:15pt;text-align:center;margin:2mm 0}h2{font-size:12.5pt;margin:4mm 0 2mm}"+
    "table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #333;padding:2.2px 4px;text-align:right;vertical-align:middle}"+
    "td.l,th.l{text-align:left}.i{background:#dce9f7}.r{background:#fdeadd}.u{background:#f6dede}.g{background:#e9f5e9}"+
    ".sign td{border:none;text-align:left;font-size:10pt;padding-top:6mm}</style>";
  var num = 0;
  var rows = "";
  function tr(r, cls) {
    var c = byId[r.id], tg = tgFromCos(r.cosPhi);
    return "<tr class='" + cls + "'><td>" + (++num) + "</td><td class='l'>" + esc(r.name) + "</td><td>" + (r.kind === "work" ? "раб" : r.kind === "reserve" ? "рез" : "ИБП") + "</td><td>" + r.cat + "</td><td>" + (r.spz ? "да" : "") + "</td><td>" + (String(r.ph) === "1~220" ? "1~220 " + (APP.phaseAssign[r.id] || "") : "3~380") + "</td><td>" + r.n + "</td><td>" + f1(r.pnUnit) + "</td><td>" + f1(c.Pn) + "</td><td>" + f1(r.ki) + "</td><td>" + f1(r.cosPhi) + "</td><td>" + f1(tg) + "</td><td><b>" + f1(c.Pr) + "</b></td><td>" + f1(c.Qr) + "</td><td>" + f1(c.Sr = Math.sqrt(c.Pr * c.Pr + c.Qr * c.Qr)) + "</td><td>" + f0(c.Icalc) + "</td><td class='l'>" + c.s + " мм² · L" + r.L + "м</td><td>" + c.In + "</td></tr>";
  }
  SECS.forEach(function (sname) {
    var sc = APP.secCalc[sname], g = sc.g, p = sc.p; if (!g || (!g.Pn && !sc.gRes.Pn && !sc.gUps.Pn)) return;
    if (g.Pn) rows += "<tr class='i'><td colspan='18' class='l'><b>СЕКЦИЯ " + sname.slice(-1) + " — рабочий поток</b></td></tr>";
    state.rows.filter(function (r) { return r.sec === sname && r.kind === "work"; }).forEach(function (r) { rows += tr(r, ""); });
    if (p) rows += "<tr class='g'><td></td><td class='l' colspan='6'><b>Итого секция (РТМ): n_э=" + f1(g.ne) + " · Ki_ср=" + f1(g.kiAvg) + " · tgφ_ср=" + f1(g.tgAvg) + " · Кр=" + f1(p.kr) + ((g.ne > 0 && g.ne <= 10.01) ? " (Qр×1,1 при n_э≤10)" : "") + " · Kо=" + f1(conf.ko) + " · Q_КУ=" + f0(p.Qcu) + " квар</b></td><td>" + f1(g.Pn) + "</td><td></td><td></td><td></td><td><b>" + f1(p.Pp) + "</b></td><td><b>" + f1(p.Qp) + "</b></td><td><b>" + f1(p.Sp) + "</b></td><td><b>" + f0(p.Sp * 1000 / (1.732 * 400)) + "</b></td><td>—</td><td>—</td></tr>";
    var gr = sc.gRes;
    if (gr && gr.Pn) {
      rows += "<tr class='r'><td colspan='18' class='l'><b>СЕКЦИЯ " + sname.slice(-1) + " — резервный поток (в ΣPр секции не входит, РТМ/ПУЭ 1.2.14)</b></td></tr>";
      state.rows.filter(function (r) { return r.sec === sname && r.kind === "reserve"; }).forEach(function (r) { rows += tr(r, "r"); });
      if (sc.pRes) rows += "<tr class='r'><td></td><td class='l' colspan='6'><b>Итого резерв секции: ΣPрез(Ki·Pн)=" + f1(gr.KiPn) + " кВт · Sрез=" + f1(sc.pRes.Sp) + " кВА · выбор сечений/автоматов по max(Iраб,Iрез)</b></td><td>" + f1(gr.Pn) + "</td><td></td><td></td><td></td><td>" + f1(sc.pRes.Pp) + "</td><td>" + f1(sc.pRes.Qp) + "</td><td>" + f1(sc.pRes.Sp) + "</td><td>" + f0(sc.pRes.Ir || sc.pRes.Sp * 1000 / (1.732 * 400)) + "</td><td>—</td><td>—</td></tr>";
    }
    var gu = sc.gUps;
    if (gu && gu.Pn) {
      rows += "<tr class='u'><td colspan='18' class='l'><b>СЕКЦИЯ " + sname.slice(-1) + " — поток ИБП (шина ИБП VFI, в ΣPр не входит)</b></td></tr>";
      state.rows.filter(function (r) { return r.sec === sname && r.kind === "ups"; }).forEach(function (r) { rows += tr(r, "u"); });
    }
  });
  (function () {
    var wAll = rtmGroup(works()); var pAll = wAll.Pn ? rtmPower(wAll, conf) : null;
    rows += "<tr class='g'><td></td><td class='l' colspan='7'><b>ИТОГО узел 0,4 кВ — рабочий поток (по всем секциям)</b></td><td>" + f1(wAll.Pn) + "</td><td></td><td></td><td></td><td><b>" + (pAll ? f1(pAll.Pp) : "—") + "</b></td><td><b>" + (pAll ? f1(pAll.Qp) : "—") + "</b></td><td><b>" + (pAll ? f1(pAll.Sp) : "—") + "</b></td><td><b>" + (pAll ? f0(pAll.Sp * 1000 / (1.732 * 400)) : "—") + "</b></td><td>—</td><td>—</td></tr>";
  })();
  var head = "«Ведомость электрических нагрузок» · Обозначение НТД-ЭЛ-ВН-«__» · Лист 1 — записка по РТМ 36.18.32.4-92 (форма А3)";
  var html = "\ufeff<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Ведомость нагрузок РТМ</title>" + css + "</head><body><div class=Section1>" +
    "<h1>ВЕДОМОСТЬ ЭЛЕКТРИЧЕСКИХ НАГРУЗОК 0,4 кВ<br><span style='font-size:12pt'>расчёт по РТМ 36.18.32.4-92</span></h1>" +
    "<table><tr><td class='l'>Объект: <b>" + esc(obj) + "</b></td><td class='l'>Заказчик: " + esc(cust) + "</td><td class='l'>Дата: " + new Date().toLocaleDateString("ru-RU") + "</td><td class='l'>Режим: " + (conf.tpl === "A" ? "2 секции + АВР + ДЭС 0,4 кВ" : "3 секции + секционные + ДЭС 10 кВ") + "</td></tr>" +
    "<tr><td class='l'>Трансформаторы: Т1=" + conf.tr + " кВА, Т2=" + conf.tr2 + " кВА, Ук=" + conf.uk + " %</td><td class='l'>ДЭС: " + conf.dg + " кВА · ИБП: " + conf.ups + " кВА</td><td class='l'>Sк.з. сети 10 кВ: " + conf.skz + " МВА</td><td class='l'>Кр по " + (conf.krt === "table1" ? "табл.1" : "табл.2") + " РТМ; cosφ цели " + conf.cosTarget + "; Kо=" + conf.ko + "</td></tr></table><br>" +
    "<table><thead><tr><th>№</th><th class='l'>Наименование электроприёмника</th><th>Тип</th><th>Кат.</th><th>СПЗ</th><th>φ/U·фаза</th><th>к-во n</th><th>Pн ед., кВт</th><th>ΣPн, кВт</th><th>Ki</th><th>cosφ</th><th>tgφ</th><th>Pр=Кр·ΣKiPн, кВт</th><th>Qр, квар</th><th>Sр, кВА</th><th>Iр, А</th><th class='l'>Кабель (S·L)</th><th>QF, А</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<p style='font-size:9pt'>Примечания: 1) Резервные нагрузки и нагрузки ИБП в расчётные ΣPр секций не включаются (РТМ 36.18.32.4-92); питание электроприёмников кат. I — от двух независимых вводов с АВР (ПУЭ п.1.2.14). 2) При n_э≤10 Qр принимается с коэффициентом 1,1. 3) 1-фазные приёмники распределены по фазам L1/L2/L3 автобалансировкой из условия перекоса ≤30 % (ГОСТ 32144-2013). 4) Сечения кабелей и номиналы автоматов выбраны по max(Iр раб, Iр рез) с проверкой ΔU≤5 % (3 % — освещение) и чувствительности Iкз.одн≥1,25·I отсечки; трассы СПЗ — каб. ВВГнг(А)-FRLS в огнестойких лотках (разъяснения ВНИИПО). 5) Токи КЗ — упрощённый расчёт, уточнить расчётом РЗ.</p>" +
    "<table class='sign'><tr><td>Разработал (гл. специалист по электроснабжению)</td><td>______________________ / ______________________ /</td><td>«___» ____________ 20___ г.</td></tr>" +
    "<tr><td>Проверил</td><td>______________________ / ______________________ /</td><td>«___» ____________ 20___ г.</td></tr>" +
    "<tr><td>Утвердил</td><td>______________________ / ______________________ /</td><td>«___» ____________ 20___ г.</td></tr></table>" +
    "</div></body></html>";
  download("vedomost-nagruzok-RTM-A3.doc", "application/msword", new Blob([html], { type: "application/msword" }));
}
/* ===== SECTION:boot ===== */
function wire() {
  var tbody = $("grid").querySelector("tbody");
  var lastFocus = null;
  tbody.addEventListener("input", function (e) {
    var t = e.target, k = t.dataset && t.dataset.k; if (!k) return;
    var tr = t.closest("tr"), row = state.rows.filter(function (r) { return r.id === tr.dataset.id; })[0]; if (!row) return;
    if (t.type === "checkbox") row[k] = t.checked;
    else if (t.tagName === "SELECT") row[k] = t.value;
    else row[k] = t.value === "" ? 0 : Number(t.value);
    if (k === "ph" && row[k] === "3~380") row.phase = "auto";
    scheduleRecalc();
  });
  var pending = null;
  function scheduleRecalc() { if (pending) clearTimeout(pending); pending = setTimeout(function () { pending = null; recalc(); }, 120); }
  tbody.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-a]"); if (!btn) return;
    var tr = btn.closest("tr"), id = tr.dataset.id, i = state.rows.map(function (x) { return x.id; }).indexOf(id);
    if (btn.dataset.a === "del") { state.rows.splice(i, 1); renderGrid(); }
    else { var c = JSON.parse(JSON.stringify(state.rows[i])); c.id = uid(); c.name += " (копия)"; state.rows.splice(i + 1, 0, c); renderGrid(); }
  });
  /* клавиатура (ТЗ 3: hotkeys) */
  $("grid").addEventListener("keydown", function (e) {
    var t = e.target, tr = t.closest && t.closest("tr"); if (!tr) return;
    var cells = tr.querySelectorAll("input,select");
    var iRow = Array.prototype.indexOf.call($("grid").querySelectorAll("tbody tr"), tr);
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); var nr = { id: uid(), name: "", kind: "work", cat: "III", spz: false, ph: "3~380", sec: "Секция 1", n: 1, pnUnit: 1, ki: 0.7, cosPhi: 0.8, L: 50, lay: "tray", phase: "auto", motor: false, kp: 7 }; state.rows.push(nr); renderGrid(); var f = $("grid").querySelectorAll("tbody tr")[state.rows.length - 1].querySelector('[data-k="name"]'); f.focus(); return; }
    if (e.key === "Enter" && t.tagName === "INPUT") { e.preventDefault(); var nx = cells[Array.prototype.indexOf.call(cells, t) + 1]; if (nx) nx.focus(); else { var tr2 = tr.nextSibling; if (tr2) tr2.querySelector("input").focus(); } return; }
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault(); var j = iRow + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= state.rows.length) return;
      var tmp = state.rows[iRow]; state.rows[iRow] = state.rows[j]; state.rows[j] = tmp;
      renderGrid(); var ftr = $("grid").querySelectorAll("tbody tr")[j]; ftr.querySelectorAll("input,select")[Array.prototype.indexOf.call(cells, t)].focus();
    }
  });
  /* drag-and-drop строк */
  tbody.addEventListener("mousedown", function (e) { if (e.target.closest(".handle")) { var tr = e.target.closest("tr"); tr.setAttribute("draggable", "true"); draggingTr = draggingTr === tr ? null : tr; } });
  tbody.addEventListener("dragstart", function (e) { if (draggingTr) { e.dataTransfer.setDragImage && draggingTr; try { e.dataTransfer.setData("text/plain", draggingTr.dataset.id); } catch (x) { } } else { draggingTr = e.target.closest("tr"); draggingTr.setAttribute("draggable", "true"); } });
  tbody.addEventListener("dragover", function (e) { if (!draggingTr) return; e.preventDefault(); });
  tbody.addEventListener("drop", function (e) {
    if (!draggingTr) return; e.preventDefault();
    var to = e.target.closest("tr"); if (!to || to === draggingTr) { draggingTr = null; renderGrid(); return; }
    var id = draggingTr.dataset.id, from = state.rows.map(function (r) { return r.id; }).indexOf(id);
    var ti = state.rows.map(function (r) { return r.id; }).indexOf(to.dataset.id);
    state.rows.splice(ti, 0, state.rows.splice(from, 1)[0]);
    draggingTr = null; renderGrid();
  });
  /* тулбар */
  ["tpl", "un", "skz", "tr1", "tr2", "uk", "dg", "upsn", "krt", "ko", "costg", "krovr", "krman"].forEach(function (id) { var el = $(id); if (el) el.addEventListener("input", function () { $("krman").disabled = !$("krovr").checked; recalc(); }); });
  $("b-add").onclick = function () { state.rows.push({ id: uid(), name: "", kind: "work", cat: "III", spz: false, ph: "3~380", sec: "Секция 1", n: 1, pnUnit: 1, ki: 0.7, cosPhi: 0.8, L: 50, lay: "tray", phase: "auto", motor: false, kp: 7 }); renderGrid(); };
  $("b-dup").onclick = function () { if (!state.rows.length) return; var c = JSON.parse(JSON.stringify(state.rows[state.rows.length - 1])); c.id = uid(); state.rows.push(c); renderGrid(); };
  $("b-del").onclick = function () { if (state.rows.length > 1) { state.rows.pop(); renderGrid(); } };
  $("b-sortname").onclick = function () { state.rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), "ru"); }); renderGrid(); };
  $("b-demo").onclick = function () { state.rows = demoRows().map(function (r) { r.id = uid(); return r; }); renderGrid(); };
  $("b-save").onclick = function () { download("nagruzki2-state.json", "application/json", JSON.stringify({ conf: readConf(), rows: state.rows }, null, 1)); };
  $("b-load").onclick = function () { $("f-json").click(); };
  $("f-json").onchange = function () {
    var f = this.files && this.files[0]; this.value = ""; if (!f) return;
    var rd = new FileReader(); rd.onload = function () {
      try { var d = JSON.parse(rd.result); if (d.conf) Object.keys(d.conf).forEach(function (k) { var m = { tpl: "tpl", un: "un", skz: "skz", tr: "tr1", tr2: "tr2", uk: "uk", dg: "dg", ups: "upsn", krt: "krt", ko: "ko", cosTarget: "costg", krOverride: "krovr", krManual: "krman" }[k]; if (m) $(m).value = d.conf[k]; }); } catch (e) { alert(e.message); }
      if (Array.isArray(d.rows)) state.rows = d.rows; renderGrid();
    }; rd.readAsText(f);
  };
  $("b-ols").onclick = function () { renderOls(); $("sheetcard").scrollIntoView({ behavior: "smooth" }); };
  $("b-pdf").onclick = function () {
    if (!APP.sheetBuilt) renderOls();
    if (!window.__downloadPdfSheet) { alert("PDF-модуль не загружен (loads-ned.js)"); return; }
    __downloadPdfSheet(APP.P, "nagruzki2-ols-" + APP.conf.tpl, "Нагрузки 2.0 — ОЛС (лист А1)");
  };
  $("b-xls").onclick = exportXls;
  $("b-rtmdoc").onclick = exportRtmDoc;
  $("b-doc").onclick = function () {
    if (!APP.sheetBuilt) renderOls();
    if (window.svgSheetToJpeg) {
      svgSheetToJpeg(APP.P, 1.6, function (jpg) {
        var uri = null;
        if (jpg) {
          try {
            var CH2 = 8192, sb = "";
            for (var off = 0; off < jpg.length; off += CH2) sb += String.fromCharCode.apply(null, jpg.subarray(off, Math.min(off + CH2, jpg.length)));
            uri = "data:image/jpeg;base64," + btoa(sb);
          } catch (e) { uri = null; }
        }
        exportDoc(uri);
      });
    } else exportDoc(null);
  };
  $("krovr").addEventListener("change", function () { $("krman").disabled = !this.checked; });
}
boot();
function boot() {
  ["tpl", "un", "skz", "tr1", "tr2", "uk", "dg", "upsn", "krt", "ko", "costg", "krman"].forEach(function (id) { if (!$(id)) console.warn("no input", id); });
  renderGrid(); wire();
}
window.N2 = { state: state, get res() { return APP.res; }, get conf() { return APP.conf; }, get secCalc() { return APP.secCalc; }, get phaseAssign(){return APP.phaseAssign;}, get skew(){return APP.skew;}, get warns(){return APP.warns;}, recalc: recalc, lookupKr: lookupKr, rtmGroup: rtmGroup, rtmPower: rtmPower, selectRow: selectRow, rowIrOf: rowIrOf };

})();
