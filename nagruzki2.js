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
  paintCells(); paintTotals(); paintWarns();
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
  var busY = 210, topY = 56;
  T2d(16, 26, "Схема электрическая однолинейная (ОЛС) — " + (conf.tpl === "A" ? "вариант А: 2 секции, АВР, ДЭС 0,4 кВ на СЕКЦИИ 2" : "вариант Б: 3 секции, секционные выключатели, ДЭС 10 кВ с ТЗ на СЕКЦИИ 3"), { size: 11, bold: true });
  T2d(16, 36, "ГОСТ 2.702-2011 (С1); УГО ГОСТ 2.755/2.710/2.721/2.751/2.710; цвет: основной — чёрный, резерв/ИБП — оранжевый пунктир; СПЗ — огнелоток и индекс -FR (ВНИИПО)", { size: 5.2, color: "#33465e" });
  T2d(16, 44, "Блокировки вводов и секционного аппарата — электрическая+механическая («&&»/замок). Iкз — упрощённый расчёт, уточнить расчётом РЗ.", { size: 5.2, color: "#33465e" });
  var geo = {}, x0 = 30, UPSX = null;
  var slotWork = 30, slotRes = 42;
  [1, 2, 3].forEach(function (i) {
    if (i > SECSN) return;
    var wRows = consOf(i).filter(function (r) { return r.kind !== "reserve"; });
    var rRows = consOf(i).filter(function (r) { return r.kind === "reserve"; });
    var g = { cons: wRows, res: rRows, x0: x0 };
    g.w = 64 + wRows.length * slotWork + rRows.length * slotRes + (i <= 2 ? 0 : 40);
    geo[i] = g; x0 += g.w + 26;
  });
  var upsRows = conf.tpl === "A" ? state.rows.filter(function (r) { return r.kind === "ups"; }) : [];
  if (conf.tpl === "A") { var uu = state.rows.filter(function (r) { return r.kind === "ups"; }); if (uu.length) { UPSX = { x0: x0, cons: uu, w: 64 + uu.length * 34 }; x0 += UPSX.w + 10; } }
  var totalW = Math.max(x0 + 330, 1400);
  P1.W = totalW;
  /* вводы */
  function feedTop(i) {
    var g = geo[i], cx = g.x0 + 34, bx1 = g.x0 + 6, bx2 = g.x0 + g.w - 6;
    L2(cx, topY + 8, cx, busY - 14, 1.6);
    if (i === 1) { T2d(cx - 30, topY, "Сеть 10(6) кВ; Sк.з=" + conf.skz + " МВА", { size: 5 }); C2(cx - 4, topY + 14, 5); C2(cx + 7, topY + 14, 3.4); T2d(cx + 7, topY + 15.3, "A", { size: 3, align: "middle" }); T2d(cx - 12, topY + 16, "TA1", { size: 4, align: "end" }); L2(cx - 8, topY + 22, cx, topY + 34, 1.2); symTR2(cx, topY + 46, "T1", conf.tr + " кВА · 10(6)/0,4 · Ук=" + conf.uk + "%"); L2(cx, topY + 56, cx, busY - 14, 1.6); symQFsmall(cx - 9, busY - 34, "QF01", false); }
    else if (i === 2 && conf.tpl === "A") { T2d(cx - 26, topY, "ДЭС 0,4 кВ · " + conf.dg + " кВА (АВР, т.п. 600 об/мин)", { size: 5 }); L2(cx, topY + 6, cx, topY + 26, 1.6); C2(cx, topY + 32, 6); T2d(cx, topY + 34, "Г", { size: 5, align: "middle", bold: true }); symQFsmall(cx - 9, topY + 52, "QF02", false); L2(cx, topY + 88, cx, busY - 14, 1.6); }
    else if (i === 2) { T2d(cx - 30, topY, "Сеть 10(6) кВ (рез. ввод)", { size: 5 }); C2(cx - 4, topY + 12, 5); C2(cx + 7, topY + 12, 3.4); L2(cx - 8, topY + 18, cx, topY + 30, 1.2); symTR2(cx, topY + 42, "T2", conf.tr2 + " кВА · Ук=" + conf.uk + "%"); symQFsmall(cx - 9, busY - 34, "QF03", false); L2(cx, busY - 14, cx, busY - 14, 0); }
    else { T2d(cx - 30, topY, "ДЭС 10 кВ · " + conf.dg + " кВА → ТЗ 10/0,4", { size: 5, color: "#b26a00" }); C2(cx, topY + 30, 6); T2d(cx, topY + 32, "Г", { size: 5, align: "middle", bold: true, color: "#b26a00" }); L2(cx, topY + 36, cx, topY + 42, 1.6, "#b26a00"); symTR2(cx, topY + 52, "T3", conf.dg + " кВА · 10/0,4", "#b26a00"); L2(cx, topY + 62, cx, busY - 14, 1.6, "#b26a00"); symQFsmall(cx - 9, busY - 34, "QF05", true); }
    L2(bx1, busY, bx2, busY, 5);
    T2d(cx, busY - 6, "СЕКЦИЯ " + i + " · 0,4 кВ", { size: 6.2, bold: true, align: "middle" });
    Nd(cx, busY);
  }
  function symTR2(cx, cy, name, txt, col) {
    col = col || "#223344"; C2(cx - 5, cy, 6.5, col); C2(cx + 5, cy, 6.5, col);
    T2d(cx - 14, cy + 2, name, { size: 5, bold: true, align: "end", color: col });
    var w1 = txt.length * 2.4 + 6; T2d(cx + 14, cy + 1, txt, { size: 3.8, color: col }); void w1;
  }
  [1, 2, 3].forEach(function (i) { if (geo[i]) feedTop(i); });
  if (UPSX) { var ux = UPSX.x0 + 24; T2d(UPSX.x0, topY, "ИБП (VFI) " + (conf.ups || 10) + " кВА", { size: 5, bold: true, color: "#c62828" }); R2d(ux - 16, topY + 6, 32, 16, "#c62828", "#fdf1f1"); T2d(ux, topY + 16, "VFI·SS1", { size: 4, align: "middle", color: "#c62828" }); L2(ux, topY + 22, ux, busY + 54, 1.3, "#c62828"); R2d(ux - 12, busY + 54, 24, 7, "#c62828"); Nd(ux, busY + 61); }
  /* АВР/секционные + блокировки */
  if (conf.tpl === "A") {
    var a = geo[1].x0 + geo[1].w - 6, b = geo[2].x0 + 6, mx = (a + b) / 2;
    L2(a, busY, b, busY, 3.2);
    L2(mx, busY, mx, busY + 12, 1.5); symQFsmall2(mx, busY + 12, "QF11");
    L2(mx, busY + 30, mx, busY, 0);
    symATS(mx + 26, busY + 16); lockSym(mx - 11, busY + 22);
    T2d(mx, busY + 44, "секционный + АВР (эл.+мех. блокировка)", { size: 4.2, align: "middle", color: "#1b6ef3" });
  } else {
    [[1, 2, "QF11"], geo[2] && geo[3] ? [2, 3, "QF12"] : null].filter(Boolean).forEach(function (p2) {
      var g1 = geo[p2[0]], g2 = geo[p2[1]]; var a = g1.x0 + g1.w - 6, b = g2.x0 + 6, mx = (a + b) / 2;
      L2(a, busY, b, busY, 3.2);
      L2(mx, busY, mx, busY + 12, 1.5); symQFsmall2(mx, busY + 12, p2[2]); lockSym(mx - 11, busY + 20);
      T2d(mx, busY + 36, "секционный " + p2[2], { size: 4.2, align: "middle", color: "#1b6ef3" });
    });
    if (geo[2]) { var m2 = (geo[1].x0 + geo[1].w + geo[2].x0) / 2; symATS(m2, busY + 58); T2d(m2, busY + 72, "АВР секц.1–2", { size: 4, align: "middle", color: "#1b6ef3" }); }
  }
  function symQFsmall2(x, y, label) {
    L2(x, y, x, y + 4, 1.4); L2(x, y + 4, x + 4.5, y + 11, 1.5); R2d(x - 3.2, y + 7, 3.4, 3.4, "#223344", "#fff"); L2(x, y + 11, x, y + 16, 1.4); T2d(x - 5, y + 8.5, label, { size: 4.4, align: "end", bold: true });
  }
  /* фидеры */
  var feedMaxBot = busY;
  function drawConn(cx, r) {
    var y = busY + 8, isRes = r.kind === "reserve", isUps = r.kind === "ups";
    var col = isRes ? "#e67e22" : isUps ? "#c62828" : "#223344";
    L2(cx, busY, cx, y + 2, 1.2, "#223344");
    Nd(cx, busY);
    symQFsmall(cx, y + 2, "QF" + (201 + state.rows.indexOf(r)), isRes || isUps);
    var yy = y + 34;
    var c = byId[r.id];
    L2(cx, y + 20, cx, yy + 10, 1.2, col, (isRes || isUps) ? "3.2 2" : null);
    if (r.spz) { fireTray(cx, y + 24, 14); T2d(cx + 3.2, y + 33, "огнелоток", { size: 2.8, color: "#c62828" }); }
    T2d(cx + 4, yy, escPh(r), { size: 3.6, color: col, align: "start" });
    T2d(cx + 4, yy + 5, (c.mark || "").slice(0, 18), { size: 3.5, color: "#33465e" });
    if (r.motor) mSym(cx, yy + 15, "М " + f0(r.pnUnit) + "кВт");
    else { R2d(cx - 7, yy + 11, 14, 7, col, "#fff"); T2d(cx, yy + 15.8, "Н", { size: 4, align: "middle" }); }
    var nm = String(r.name || "").slice(0, 15);
    T2d(cx + 4, yy + 24, nm + (r.n > 1 ? " ×" + r.n : ""), { size: 3.8, color: col });
    var pair = r.kind === "work" ? state.rows.filter(function (p2) { return p2.kind !== "work" && p2.name === r.name; })[0] : null;
    if (r.kind === "work" && pair) T2d(cx + 4, yy + 29, "рез: QF" + (201 + state.rows.indexOf(pair)) + " · С" + pair.sec.replace(/[^123]/g, ""), { size: 3.4, color: "#b26a00" });
    feedMaxBot = Math.max(feedMaxBot, yy + 34);
  }
  function escPh(r) { if (String(r.ph) === "1~220") return "1~ " + APP.phaseAssign[r.id]; return "3~"; }
  [1, 2, 3].forEach(function (i) {
    var g = geo[i]; if (!g) return;
    var xx = g.x0 + 44;
    g.cons.forEach(function (r) { drawConn(xx, r); xx += slotWork; });
    g.res.forEach(function (r) {
      drawConn(xx, r);
      var wrow = works().filter(function (p2) { return p2.name === r.name; })[0];
      if (wrow) {
        /* штриховой перенос резерва к рабочей цепи (пункт ТЗ 2.4 — оба пути на ОЛС) */
        var gi = null; [1, 2, 3].forEach(function (i2) { if (geo[i2] && geo[i2].cons.indexOf(wrow) >= 0) gi = i2; });
      }
      xx += slotRes;
    });
  });
  if (UPSX) { var xx2 = UPSX.x0 + 12; UPSX.cons.forEach(function (r) { drawConn2(xx2, r); xx2 += 34; }); }
  function drawConn2(cx, r) {
    var c = byId[r.id]; var y = busY + 61;
    L2(UPSX.x0 + 24, y, cx, y, 1.2, "#c62828");
    symQFsmall(cx, y + 2, "QF" + (201 + state.rows.indexOf(r)), true);
    L2(cx, y + 20, cx, y + 32, 1.2, "#c62828", "3.2 2");
    T2d(cx + 4, y + 38, escPh(r), { size: 3.6, color: "#c62828" });
    T2d(cx + 4, y + 43, (c.mark || "").slice(0, 15), { size: 3.4, color: "#33465e" });
    R2d(cx - 7, y + 13 + 22, 14, 7, "#c62828", "#fff"); T2d(cx, y + 38.8, "Н", { size: 4, align: "middle" });
    T2d(cx + 4, y + 48, String(r.name || "").slice(0, 14), { size: 3.7, color: "#c62828" });
    if (r.spz) fireTray(cx, y + 22, 12);
    feedMaxBot = Math.max(feedMaxBot, y + 52);
  }
  /* таблица спецификации + итоги */
  var ty = feedMaxBot + 18;
  T2d(14, ty, "Таблица 1 — расчётно-спецификационная ведомость цепей", { size: 7.5, bold: true });
  var heads = ["№", "Наименование", "Тип", "Кат", "φ", "Секц", "n", "Pн_ед", "Pн", "Ki", "cos", "Iрасч", "S,L,кабель", "ΔU", "QF (отсечка)", "Iкз1ф кл.", "СПЗ"];
  var cx2 = [], xx3 = 14;
  var rowsD = state.rows.map(function (r, i) {
    var c = byId[r.id];
    return [String(i + 1), String(r.name).slice(0, 24), r.kind === "work" ? "раб" : r.kind === "reserve" ? "рез" : "ИБП", r.cat, String(r.ph).replace("~", ""), r.sec.replace("Секция ", "С"), String(r.n), f1(r.pnUnit), f1(c.Pn), f1(r.ki), f1(r.cosPhi), f0(c.Icalc), c.s + "мм²·" + r.L + "м·" + c.mark.split(" ").slice(0, 1), f1(c.du) + "%", "QF" + (201 + i) + " " + c.In + "A·" + c.trip, f1(c.I1end / 1000) + " кА", r.spz ? "FR" : "—"];
  });
  var colw = heads.map(function (h3, i3) { var w = Math.max(String(h3).length, 4) * 2.6 + 6; rowsD.forEach(function (rw) { var w2 = String(rw[i3]).length * 2.6 + 5; if (w2 > w) w = w2; }); return Math.min(w, 120); });
  var tw3 = colw.reduce(function (a2, b2) { return a2 + b2; }, 0);
  rowsD.forEach(function (rw) { var w = String(rw[1]).length * 2.6 + 6; if (w > colw[1]) colw[1] = Math.min(w, 130); });
  P1.W = Math.max(P1.W, 340 + tw3);
  function gridRows(yT) {
    L2(14, yT, 14 + tw3, yT, 0.5, "#223344"); L2(14, yT - 8, 14, yT, 0.5); L2(14 + tw3, yT - 8, 14 + tw3, yT, 0.5);
    var q = 14; colw.forEach(function (w) { L2(q, yT - 8, q, yT, 0.4); q += w; });
    L2(q, yT - 8, q, yT, 0.5);
  }
  P1.W = Math.max(P1.W, 340 + tw3); void cx2;
  gridRows(ty + 8 + 3);
  (function () { var q = 14; heads.forEach(function (h3, i3) { T2d(q + 2, ty + 9, h3, { size: 3.9, bold: true }); q += colw[i3]; }); })();
  rowsD.forEach(function (rw, ri) { var ry2 = ty + 8 + 3 + (ri + 1) * 10; gridRows(ry2); var q = 14; rw.forEach(function (v, i3) { T2d(q + 2, ry2 - 3, v, { size: 3.8 }); q += colw[i3]; }); });
  var yb = ty + 8 + 3 + (rowsD.length + 1) * 10 + 10;
  SECS.forEach(function (sname, si) {
    var s = APP.secCalc[sname]; if (!s || !s.p) return;
    T2d(14, yb + si * 9, sname + ": Pр=" + f1(s.p.Pp) + " кВт · Qр=" + f1(s.p.Qp) + " квар · Sр=" + f1(s.p.Sp) + " кВА · n_э=" + f1(s.g.ne) + (s.g.ne <= 10.01 ? " (<10 → 1,1)" : "") + " · Кр=" + f1(s.p.kr) + " · Q_ку=" + f0(s.p.Qcu) + " квар", { size: 5.2 });
  });
  var ysrc = yb + SECSN * 9 + 8;
  T2d(14, ysrc, "К.З.: Iкз.3ф(шины)=" + f1(APP.conf.__base.I3 / 1000) + " кА · iуд=" + f1(APP.conf.__base.iud / 1000) + " кА · T1 " + conf.tr + " кВА Ук" + conf.uk + "% · Sкз сети " + conf.skz + " МВА (упрощённо, ПУЭ гл.1.3; чувствительность — см. Табл.1).", { size: 5.2, color: "#33465e" });
  T2d(14, ysrc + 8, "Резервный поток ΣPрез=" + f1((APP.secCalc["Секция 1"] && APP.secCalc["Секция 1"].gRes.KiPn || 0) + ((APP.secCalc["Секция 2"] || {}).gRes ? APP.secCalc["Секция 2"].gRes.KiPn : 0) + ((APP.secCalc["Секция 3"] || {}).gRes ? APP.secCalc["Секция 3"].gRes.KiPn : 0)) + " кВт на ОЛС — оранжевым пунктиром, в ΣPр секций не входит (РТМ 36.18.32.4-92; ПУЭ 1.2.14 — питание кат.I от двух независимых вводов).", { size: 5, color: "#b26a00" });
  P1.H = ysrc + 90;
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
function download(name, mime, text) {
  var a = document.createElement("a"), u = "data:" + mime + ";charset=utf-8," + encodeURIComponent(text);
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
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
    sheet("Ведомость нагрузок", head, rows) + sheet("Итоги РТМ", ["Группа", "Pр кВт", "Qр квар", "Sр кВА"], t1) + sheet("Спецификация МТР", ["Наименование", "1", "2", "3"], spec) + "</Workbook>";
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
  body += "</table><p>Резервные нагрузки и нагрузки ИБП в ΣPр не включаются (РТМ), используются для выбора сечений/автоматов по max-току и для схем АВР.</p>";
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
  $("b-doc").onclick = function () {
    if (!APP.sheetBuilt) renderOls();
    if (window.svgSheetToJpeg) {
      svgSheetToJpeg(APP.P, 2, function (jpg, w, h) {
        var png = jpg ? "data:image/jpeg;base64," + btoa(String.fromCharCode.apply(null, (function () { var out = []; for (var i = 0; i < jpg.length; i++) out.push(jpg[i]); return out; })())) : null;
        exportDoc(png);
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
