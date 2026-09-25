/**
 * RTM 36.18.32.4-92 group calculation (F636-92).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function tgFromCos(c) {
    c = Number(c);
    if (!isFinite(c) || c <= 0 || Math.abs(c) >= 1) return 0;
    return Math.tan(Math.acos(Math.min(0.999999, Math.max(0.000001, c))));
  }

  function rtmGroup(rows) {
    var Pn = 0, KiPn = 0, sumNPn2 = 0, wq = 0, i, r;
    for (i = 0; i < (rows || []).length; i++) {
      r = rows[i];
      var n = Math.max(0, Number(r.n) || 0);
      var pu = Number(r.pnUnit != null ? r.pnUnit : r.PnUnit) || 0;
      var ki = Number(r.ki) || 0;
      var p = n * pu;
      Pn += p;
      KiPn += ki * p;
      sumNPn2 += n * pu * pu;
      wq += ki * p * tgFromCos(r.cosPhi);
    }
    var ne = sumNPn2 > 0 && Pn > 0 ? (Pn * Pn) / sumNPn2 : 0;
    if (ne < 1 && Pn > 0) ne = 1;
    return {
      n: (rows || []).length,
      Pn: Pn,
      KiPn: KiPn,
      ne: ne,
      kiAvg: Pn > 0 ? KiPn / Pn : 0,
      tgAvg: KiPn > 0 ? wq / KiPn : 0,
      sumNPn2: sumNPn2
    };
  }

  function rtmPower(g, kr) {
    var k = Number(kr);
    if (!(k > 0)) k = 1;
    var Pp = k * g.KiPn;
    var Qp = g.ne > 0 && g.ne <= 10 ? 1.1 * g.KiPn * g.tgAvg : g.KiPn * g.tgAvg;
    var Sp = Math.sqrt(Pp * Pp + Qp * Qp);
    return { kr: k, Pp: Pp, Qp: Qp, Sp: Sp };
  }

  function ip3(Sp_kVA, U_V) {
    return (Number(Sp_kVA) || 0) * 1000 / (Math.sqrt(3) * (Number(U_V) || 380));
  }
  function ip1(Sp_kVA, U_V) {
    return (Number(Sp_kVA) || 0) * 1000 / (Number(U_V) || 220);
  }

  var TR_NOM = [250, 400, 630, 1000, 1250, 1600, 2000, 2500];
  function pickTransformer(Sp, kLoad, nTr) {
    var k = (Number(kLoad) > 0 && Number(kLoad) <= 1) ? Number(kLoad) : 0.8;
    var n = Math.max(1, Number(nTr) || 1);
    var need = (Number(Sp) || 0) / (n * k);
    var Sn = TR_NOM[TR_NOM.length - 1], i;
    for (i = 0; i < TR_NOM.length; i++) if (TR_NOM[i] >= need - 1e-9) { Sn = TR_NOM[i]; break; }
    var loadPct = Sn > 0 ? (Number(Sp) || 0) / (n * Sn) * 100 : 0;
    return { Sn: Sn, n: n, kLoad: k, need: need, loadPct: loadPct, reservePct: Math.max(0, 100 - loadPct), ok: loadPct <= k * 100 + 1e-6 };
  }

  return { tgFromCos: tgFromCos, rtmGroup: rtmGroup, rtmPower: rtmPower, ip3: ip3, ip1: ip1, pickTransformer: pickTransformer, TR_NOM: TR_NOM };
});
