/**
 * Phase auto-balance L1–L3 for 1φ loads; 3φ loads count on all phases.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function balancePhases(consumers, thresholdPct) {
    var thr = thresholdPct == null ? 15 : Number(thresholdPct);
    var sums = { L1: 0, L2: 0, L3: 0 };
    var assignments = {};
    var list = (consumers || []).slice();

    list.forEach(function (c) {
      var load = Number(c.Pr != null ? c.Pr : c.Ir) || 0;
      var ph = c.phases === 1 ? (c.phase || null) : null;
      if (c.phases !== 1) {
        sums.L1 += load / 3;
        sums.L2 += load / 3;
        sums.L3 += load / 3;
        assignments[c.id] = 'L1-L2-L3';
        return;
      }
      if (ph === 'L1' || ph === 'L2' || ph === 'L3') {
        sums[ph] += load;
        assignments[c.id] = ph;
      }
    });

    list.forEach(function (c) {
      if (c.phases !== 1) return;
      if (assignments[c.id]) return;
      var load = Number(c.Pr != null ? c.Pr : c.Ir) || 0;
      var lightest = 'L1';
      if (sums.L2 < sums[lightest]) lightest = 'L2';
      if (sums.L3 < sums[lightest]) lightest = 'L3';
      sums[lightest] += load;
      assignments[c.id] = lightest;
    });

    var max = Math.max(sums.L1, sums.L2, sums.L3);
    var min = Math.min(sums.L1, sums.L2, sums.L3);
    var avg = (sums.L1 + sums.L2 + sums.L3) / 3;
    var imbalancePct = avg > 0 ? ((max - min) / avg) * 100 : 0;
    var warning = imbalancePct > thr;
    return {
      assignments: assignments,
      sums: sums,
      imbalancePct: imbalancePct,
      thresholdPct: thr,
      warning: warning,
      message: warning
        ? ('Несимметрия фаз ' + imbalancePct.toFixed(1) + '% > порога ' + thr + '% (пользовательский порог)')
        : ('Несимметрия фаз ' + imbalancePct.toFixed(1) + '% ≤ ' + thr + '%')
    };
  }

  return { balancePhases: balancePhases };
});
