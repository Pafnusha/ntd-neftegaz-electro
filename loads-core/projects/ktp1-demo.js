/**
 * Built-in test project KTP-1 (no Yamal).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../model'));
  } else {
    root.LoadsCore = root.LoadsCore || {};
    root.LoadsCore.buildKtp1Demo = factory(root.LoadsCore).buildKtp1Demo;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (modelApi) {
  'use strict';

  function buildKtp1Demo(supplyMode) {
    var mode = supplyMode || '2in+DES+UPS';
    var model = modelApi.createEmptyModel({
      name: 'KTP-1',
      supplyMode: mode,
      Un_kV: 0.4,
      Ikz_kA: 20,
      imbalanceThresholdPct: 15,
      desPn_kW: 100,
      upsSn_kVA: 10
    });
    model.sources = model.sources.map(function (s) {
      if (s.type === 'SOURCE_DG') { s.id = 'V3'; s.name = 'ДЭС V3 (SOURCE_DG)'; }
      return s;
    });
    var des = model.sources.find(function (s) { return s.type === 'SOURCE_DG'; });
    if (des) {
      model.sections = model.sections.map(function (sec) {
        if (sec.id === 'SEC-DES') sec.fedBy = [des.id];
        return sec;
      });
    }

    var rows = [
      { id: 'N-101', name: 'N-101 Насос', qty: 1, Pn_kW: 18.5, phases: 3, U_kV: 0.4, category: 1, ki: 0.8, cosPhi: 0.85, eta: 0.92, motor: true, start: 'DOL', cableLength_m: 40 },
      { id: 'N-102', name: 'N-102 Вентилятор', qty: 1, Pn_kW: 15, phases: 3, U_kV: 0.4, category: 2, ki: 0.75, cosPhi: 0.85, eta: 0.9, motor: true, cableLength_m: 35 },
      { id: 'N-103', name: 'N-103 Компрессор', qty: 1, Pn_kW: 7.5, phases: 3, U_kV: 0.4, category: 1, ki: 0.7, cosPhi: 0.82, eta: 0.9, motor: true, cableLength_m: 25 },
      { id: 'ShchO-1', name: 'ЩО-1 Освещение', qty: 1, Pn_kW: 10, phases: 1, U_kV: 0.4, category: 2, ki: 0.9, cosPhi: 0.95, eta: 1, cableLength_m: 50 },
      { id: 'ShchS-1', name: 'ЩС-1 Силовые розетки', qty: 1, Pn_kW: 5, phases: 1, U_kV: 0.4, category: 1, ki: 0.6, cosPhi: 0.9, eta: 1, cableLength_m: 30 },
      { id: 'Server-1', name: 'Server (ИБП)', qty: 1, Pn_kW: 3, phases: 1, U_kV: 0.4, category: 'special', ki: 1, cosPhi: 0.95, eta: 1, upsRequired: true, cableLength_m: 15 }
    ];

    rows.forEach(function (r) {
      model.consumers.push(modelApi.makeConsumer(r));
    });

    var n101 = model.consumers.find(function (c) { return c.id === 'N-101'; });
    if (n101) {
      n101.feedWork = { sectionId: 'SEC-A', sourceId: 'V1' };
      n101.feedReserve = { sectionId: 'SEC-B', sourceId: 'V2' };
      n101.feedWorkManual = true;
      n101.feedReserveManual = true;
    }

    return modelApi.recalculate(model);
  }

  return { buildKtp1Demo: buildKtp1Demo };
});
