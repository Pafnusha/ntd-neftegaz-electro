/**
 * Load currents 1φ / 3φ. Units: Pn kW, U kV (line for 3φ, phase for 1φ convention: Un line).
 * Ir = Pr/(√3·U·cosφ·η) for 3φ; Ir = Pr/(Uph·cosφ·η) for 1φ with Uph = Uline/√3 if U is line.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function tgFromCos(c) {
    c = Number(c);
    if (!isFinite(c) || Math.abs(c) >= 1) return 0;
    return Math.tan(Math.acos(clamp(c, -0.999999, 0.999999)));
  }

  function calcConsumerPowers(p) {
    var Pn = Number(p.Pn) || 0;
    var ki = Number(p.ki) || 0;
    var ks = Number(p.ks) || 0;
    var cos = Number(p.cosPhi) || 0.8;
    var eta = Number(p.eta);
    if (!(eta > 0) || eta > 1) eta = 1;
    var mode = p.mode || 'rtm';
    var Pr = mode === 'demand' ? ks * Pn : ki * Pn;
    var tg = tgFromCos(cos);
    var Qr = Pr * tg;
    var Sr = Math.sqrt(Pr * Pr + Qr * Qr);
    var Ukv = Number(p.Ukv) || 0.4;
    var phases = Number(p.phases) === 1 ? 1 : 3;
    var Ir = 0;
    if (Ukv > 0 && cos > 0 && eta > 0) {
      if (phases === 1) {
        var Uph = Ukv / Math.sqrt(3);
        Ir = (Pr / (Uph * cos * eta));
      } else {
        Ir = Sr / (Math.sqrt(3) * Ukv);
        if (eta < 1 && cos > 0) Ir = Pr / (Math.sqrt(3) * Ukv * cos * eta);
      }
    }
    return { Pn: Pn, Pr: Pr, Qr: Qr, Sr: Sr, Ir: Ir, tg: tg, cosPhi: cos, eta: eta, phases: phases, Ukv: Ukv };
  }

  function groupSums(rows) {
    var Pn = 0, Pr = 0, Qr = 0, Sr = 0;
    for (var i = 0; i < rows.length; i++) {
      Pn += rows[i].Pn || 0;
      Pr += rows[i].Pr || 0;
      Qr += rows[i].Qr || 0;
    }
    Sr = Math.sqrt(Pr * Pr + Qr * Qr);
    return { Pn: Pn, Pr: Pr, Qr: Qr, Sr: Sr };
  }

  return { calcConsumerPowers: calcConsumerPowers, groupSums: groupSums, tgFromCos: tgFromCos, clamp: clamp };
});
