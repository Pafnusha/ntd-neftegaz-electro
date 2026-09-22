(function (root, factory) {
  var deps = function () {
    if (typeof module === 'object' && module.exports) {
      return { catalog: require('../catalogs/breakers'), field: require('../field') };
    }
    return {
      catalog: root.LoadsCore.BREAKER_CATALOG,
      field: root.LoadsCore
    };
  };
  var api = function (D) {
    'use strict';
    function pickQf(Ib, opts) {
      opts = opts || {};
      var ratings = (D.catalog && D.catalog.ratings) || [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 250, 400, 630];
      var factor = opts.factor != null ? opts.factor : 1.25;
      var need = (Number(Ib) || 0) * factor;
      var In = ratings[ratings.length - 1];
      for (var i = 0; i < ratings.length; i++) {
        if (ratings[i] >= need - 1e-9) { In = ratings[i]; break; }
      }
      var ok = In >= (Number(Ib) || 0);
      return {
        In: In,
        Ib: Number(Ib) || 0,
        factor: factor,
        check: { Ib_le_In: ok, message: ok ? ('Ib=' + (Number(Ib) || 0).toFixed(1) + ' ≤ In=' + In) : ('Ib > In') },
        source: 'catalog:' + ((D.catalog && D.catalog.series) || 'typical')
      };
    }

    function applyQfField(consumer, Ib, force) {
      var F = D.field;
      var existing = consumer.qf;
      if (!force && F.isManual && F.isManual(existing)) return existing;
      var pick = pickQf(Ib, { factor: consumer.motor ? 1.5 : 1.25 });
      return F.field ? F.field(pick.In, pick.source, 'auto') : { value: pick.In, source: pick.source, mode: 'auto' };
    }

    return { pickQf: pickQf, applyQfField: applyQfField };
  };
  if (typeof module === 'object' && module.exports) module.exports = api(deps());
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, api(deps())); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
