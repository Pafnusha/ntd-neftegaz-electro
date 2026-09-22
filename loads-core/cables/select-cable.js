(function (root, factory) {
  var deps = function () {
    if (typeof module === 'object' && module.exports) {
      return { catalog: require('../catalogs/cables'), field: require('../field') };
    }
    return { catalog: root.LoadsCore.CABLE_CATALOG, field: root.LoadsCore };
  };
  var api = function (D) {
    'use strict';
    function duPct(I, L, s, phases, UlineV) {
      var cat = D.catalog || {};
      var R = (cat.rOhmKm && cat.rOhmKm[s]) || 1.15;
      var X = cat.xOhmKm != null ? cat.xOhmKm : 0.08;
      var cos = 0.85, sin = Math.sqrt(Math.max(0, 1 - cos * cos));
      var U = UlineV || 400;
      if (phases === 1) {
        return (2 * I * (R * cos + X * sin) * L / 1000) / (U / Math.sqrt(3)) * 100;
      }
      return (Math.sqrt(3) * I * (R * cos + X * sin) * L / 1000) / U * 100;
    }

    function pickCable(Ib, opts) {
      opts = opts || {};
      var sections = (D.catalog && D.catalog.sections) || [];
      var kLay = opts.kLay != null ? opts.kLay : 1;
      var need = (Number(Ib) || 0) / (kLay > 0 ? kLay : 1);
      var chosen = sections[sections.length - 1] || { s: 300, iDop: 520 };
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].iDop >= need - 1e-9) { chosen = sections[i]; break; }
      }
      var L = Number(opts.L) || 0;
      var phases = Number(opts.phases) === 1 ? 1 : 3;
      var U = opts.UlineV || 400;
      var duLim = opts.duLimPct != null ? opts.duLimPct : 5;
      var du = L > 0 ? duPct(Number(Ib) || 0, L, chosen.s, phases, U) : 0;
      if (L > 0 && du > duLim) {
        for (var j = 0; j < sections.length; j++) {
          var d2 = duPct(Number(Ib) || 0, L, sections[j].s, phases, U);
          if (sections[j].iDop >= need && d2 <= duLim) {
            chosen = sections[j];
            du = d2;
            break;
          }
          if (j === sections.length - 1) { chosen = sections[j]; du = d2; }
        }
      }
      var ibOk = (Number(Ib) || 0) <= chosen.iDop * kLay + 1e-9;
      var duOk = !(L > 0) || du <= duLim + 1e-9;
      return {
        s: chosen.s,
        iDop: chosen.iDop,
        type: (D.catalog && D.catalog.typeDefault) || 'ВВГнг(А)-LS',
        cores: phases === 1 ? 3 : 5,
        duPct: du,
        duLimPct: duLim,
        L: L,
        checks: {
          Ib_le_Idop: ibOk,
          dU_ok: duOk,
          message: 'Ib≤Iдоп: ' + (ibOk ? 'OK' : 'FAIL') + '; ΔU=' + du.toFixed(2) + '% (лимит ' + duLim + '%)'
        },
        source: 'catalog:cable'
      };
    }

    function applyCableField(consumer, Ib, force) {
      var F = D.field;
      var existing = consumer.cable;
      if (!force && F.isManual && F.isManual(existing)) return existing;
      var pick = pickCable(Ib, {
        L: consumer.cableLength_m || 0,
        phases: consumer.phases,
        UlineV: (consumer.U_kV || 0.4) * 1000,
        duLimPct: consumer.duLimPct,
        kLay: consumer.kLay
      });
      var val = { s: pick.s, type: pick.type, cores: pick.cores, iDop: pick.iDop, duPct: pick.duPct };
      return F.field ? F.field(val, pick.source, 'auto') : { value: val, source: pick.source, mode: 'auto' };
    }

    return { pickCable: pickCable, applyCableField: applyCableField, duPct: duPct };
  };
  if (typeof module === 'object' && module.exports) module.exports = api(deps());
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, api(deps())); }
})(typeof globalThis !== 'undefined' ? globalThis : this);
