/**
 * Supply sources: grid (Vin), SOURCE_DG (DES), UPS.
 * Modes: 2in / 2in+DES / 3in / 2in+UPS / 2in+DES+UPS
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SUPPLY_MODES = {
    '2in': { label: '2 ввода', grids: 2, des: false, ups: false },
    '2in+DES': { label: '2 ввода + ДЭС', grids: 2, des: true, ups: false },
    '3in': { label: '3 ввода', grids: 3, des: false, ups: false },
    '2in+UPS': { label: '2 ввода + ИБП', grids: 2, des: false, ups: true },
    '2in+DES+UPS': { label: '2 ввода + ДЭС + ИБП', grids: 2, des: true, ups: true }
  };

  function makeSource(opts) {
    opts = opts || {};
    return {
      id: opts.id || ('SRC-' + Math.random().toString(36).slice(2, 7)),
      type: opts.type || 'GRID',
      name: opts.name || opts.id,
      Un_kV: opts.Un_kV != null ? opts.Un_kV : 0.4,
      Sn_kVA: opts.Sn_kVA || 0,
      Pn_kW: opts.Pn_kW || 0,
      cosPhi: opts.cosPhi != null ? opts.cosPhi : 0.8,
      Ikz_kA: opts.Ikz_kA != null ? opts.Ikz_kA : null,
      params: opts.params || {}
    };
  }

  function buildSourcesForMode(mode, params) {
    params = params || {};
    var m = SUPPLY_MODES[mode] || SUPPLY_MODES['2in'];
    var sources = [];
    for (var i = 1; i <= m.grids; i++) {
      sources.push(makeSource({
        id: 'V' + i,
        type: 'GRID',
        name: 'Ввод V' + i,
        Un_kV: params.Un_kV || 0.4,
        Sn_kVA: params.gridSn_kVA || 0,
        Ikz_kA: params.Ikz_kA != null ? params.Ikz_kA : 20
      }));
    }
    if (m.des) {
      sources.push(makeSource({
        id: 'V3-DES',
        type: 'SOURCE_DG',
        name: 'ДЭС (SOURCE_DG)',
        Un_kV: params.Un_kV || 0.4,
        Pn_kW: params.desPn_kW || 100,
        cosPhi: params.desCos || 0.8,
        params: { startMode: params.desStart || 'auto', fuel: 'diesel' }
      }));
    }
    if (m.ups) {
      sources.push(makeSource({
        id: 'UPS-1',
        type: 'UPS',
        name: 'ИБП UPS-1',
        Un_kV: params.Un_kV || 0.4,
        Sn_kVA: params.upsSn_kVA || 10,
        params: { autonomyMin: params.upsAutonomyMin || 15, bypass: true }
      }));
    }
    return { mode: mode, modeMeta: m, sources: sources };
  }

  return { SUPPLY_MODES: SUPPLY_MODES, makeSource: makeSource, buildSourcesForMode: buildSourcesForMode };
});
