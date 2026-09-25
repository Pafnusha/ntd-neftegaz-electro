/**
 * Digital electrical network model — consumers + sources/sections/ATS + derived picks.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./field'),
      require('./calculations/currents'),
      require('./calculations/phase-balance'),
      require('./sources/sources'),
      require('./sections/sections'),
      require('./ats/ats'),
      require('./feeds'),
      require('./breakers/select-qf'),
      require('./cables/select-cable'),
      require('./checks/project-check'),
      require('./norms/rules'),
      require('./catalogs/panels')
    );
  } else {
    root.LoadsCore = root.LoadsCore || {};
    var LC = root.LoadsCore;
    var api = factory(LC, LC, LC, LC, LC, LC, LC, LC, LC, LC, LC.NORMATIVE_RULES, LC.PANEL_CATALOG);
    Object.assign(LC, api);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (
  fieldApi, currApi, phaseApi, srcApi, secApi, atsApi, feedsApi, qfApi, cabApi, chkApi, norms, panelCat
) {
  'use strict';

  function uid(prefix) { return (prefix || 'c') + Math.random().toString(36).slice(2, 9); }

  function makeConsumer(o) {
    o = o || {};
    var cat = o.category != null ? o.category : (o.cat != null ? o.cat : 3);
    return {
      id: o.id || uid('N'),
      name: o.name || '',
      qty: o.qty != null ? o.qty : (o.n != null ? o.n : 1),
      qtyNr: (function () { var qq = Number(o.qty != null ? o.qty : (o.n != null ? o.n : 1)) || 1; var qn = Number(o.qtyNr != null ? o.qtyNr : o.nr) || 0; return Math.max(0, Math.floor(qn)); })(),
      Pn_kW: o.Pn_kW != null ? o.Pn_kW : (o.pnUnit != null ? o.pnUnit : 0),
      ki: o.ki != null ? o.ki : 0.7,
      ks: o.ks != null ? o.ks : 0.5,
      cosPhi: o.cosPhi != null ? o.cosPhi : 0.8,
      eta: o.eta != null ? o.eta : 0.95,
      U_kV: o.U_kV != null ? o.U_kV : 0.4,
      f_Hz: o.f_Hz != null ? o.f_Hz : 50,
      phases: o.phases != null ? o.phases : 3,
      phase: o.phase || null,
      category: cat,
      motor: !!o.motor,
      start: o.start || null,
      vfd: !!o.vfd,
      softStarter: !!o.softStarter,
      desRequired: !!o.desRequired,
      upsRequired: !!o.upsRequired || cat === 'special',
      panelId: o.panelId || null,
      sectionId: o.sectionId || null,
      cableLength_m: o.cableLength_m != null ? o.cableLength_m : 30,
      laying: o.laying || 'air',
      kLay: o.kLay != null ? o.kLay : 1,
      duLimPct: o.duLimPct != null ? o.duLimPct : 5,
      feedWork: o.feedWork || null,
      feedReserve: o.feedReserve || null,
      feedWorkManual: !!o.feedWorkManual,
      feedReserveManual: !!o.feedReserveManual,
      feedUps: o.feedUps || null,
      feedDes: o.feedDes || null,
      qf: o.qf || null,
      cable: o.cable || null,
      mode: o.mode || 'auto'
    };
  }

  function createEmptyModel(opts) {
    opts = opts || {};
    var mode = opts.supplyMode || '2in';
    var built = srcApi.buildSourcesForMode(mode, opts);
    var sections = secApi.defaultKtpSections(built.sources);
    var ats = atsApi.defaultAtsForMode(mode, sections, built.sources);
    return {
      version: 3,
      name: opts.name || 'project',
      supplyMode: mode,
      Un_kV: opts.Un_kV || 0.4,
      Ikz_kA: opts.Ikz_kA != null ? opts.Ikz_kA : 20,
      imbalanceThresholdPct: opts.imbalanceThresholdPct != null ? opts.imbalanceThresholdPct : 15,
      rtm: opts.rtm || { mode: 'rtm', krTable: 'table1', ko: 0.9, cosTarget: 0.95 },
      sources: built.sources,
      sections: sections,
      ats: ats,
      panels: [],
      consumers: [],
      sc: { stub: true, note: 'Полный расчёт КЗ не реализован; Iкз — параметр проекта', Ikz_kA: opts.Ikz_kA != null ? opts.Ikz_kA : 20 },
      norms: norms || []
    };
  }

  function enrichConsumer(c, rtmMode) {
    var Pn = (Number(c.qty) || 0) * (Number(c.Pn_kW) || 0);
    var pow = currApi.calcConsumerPowers({
      Pn: Pn, ki: c.ki, ks: c.ks, cosPhi: c.cosPhi, eta: c.eta, Ukv: c.U_kV, phases: c.phases, mode: rtmMode || 'rtm'
    });
    c.Pn = pow.Pn; c.Pr = pow.Pr; c.Qr = pow.Qr; c.Sr = pow.Sr; c.Ir = pow.Ir; c.tg = pow.tg;
    return c;
  }

  function pickEquipment(c, force) {
    var qfPick = qfApi.pickQf(c.Ir, { factor: c.motor && !c.vfd ? 1.5 : 1.25 });
    if (!fieldApi.isManual(c.qf) || force) {
      c.qf = fieldApi.setAuto(c.qf, qfPick.In, qfPick.source);
    }
    c.qfCheck = qfPick.check;
    var cabPick = cabApi.pickCable(c.Ir, {cosPhi: c.cosPhi || 0.8, 
      L: c.cableLength_m, phases: c.phases, UlineV: (c.U_kV || 0.4) * 1000, duLimPct: c.duLimPct, kLay: c.kLay
    });
    if (!fieldApi.isManual(c.cable) || force) {
      c.cable = fieldApi.setAuto(c.cable, {
        s: cabPick.s, type: cabPick.type, cores: cabPick.cores, iDop: cabPick.iDop, duPct: cabPick.duPct
      }, cabPick.source);
    }
    c.cableCheck = cabPick.checks;
    return c;
  }

  function buildPanels(model) {
    var cat = panelCat || { moduleWidthMm: 200, inletWidthMm: 600, sectionWidthMm: 600, depthMm: 800, heightMm: 2200 };
    var bySec = {};
    (model.consumers || []).forEach(function (c) {
      var sid = (c.feedWork && c.feedWork.sectionId) || c.sectionId || 'SEC-A';
      if (!bySec[sid]) bySec[sid] = [];
      bySec[sid].push(c);
    });
    var panels = [];
    Object.keys(bySec).forEach(function (sid, idx) {
      var feeds = bySec[sid];
      var w = (cat.inletWidthMm || 600) + feeds.length * (cat.moduleWidthMm || 200);
      var din = feeds.length * (cat.dinModulesPerFeeder || 4) + 12;
      panels.push({
        id: 'PANEL-' + (idx + 1),
        name: 'НКУ / панель ' + sid,
        sectionId: sid,
        width_mm: w,
        depth_mm: cat.depthMm || 800,
        height_mm: cat.heightMm || 2200,
        dinModules: din,
        feederIds: feeds.map(function (f) { return f.id; }),
        basis: 'Ширина = ввод ' + (cat.inletWidthMm || 600) + ' мм + Nфид×' + (cat.moduleWidthMm || 200) +
          ' мм; DIN ≈ N×' + (cat.dinModulesPerFeeder || 4) + '+12 (эвристика каталога панелей)'
      });
    });
    model.panels = panels;
    return panels;
  }

  function recalculate(model, opts) {
    opts = opts || {};
    var rtmMode = (model.rtm && model.rtm.mode) || 'rtm';
    model.consumers = (model.consumers || []).map(function (c) {
      enrichConsumer(c, rtmMode);
      pickEquipment(c, opts.forcePicks);
      return c;
    });
    var feedRes = feedsApi.autoAssignFeeds(model.consumers, model.sections, model.sources, {
      withDes: /DES/.test(model.supplyMode || '')
    });
    model.consumers = feedRes.consumers;
    model.feedErrors = feedRes.errors;
    model.consumers.forEach(function (c) { pickEquipment(c, false); });
    model.phaseBalance = phaseApi.balancePhases(
      model.consumers.map(function (c) { return { id: c.id, phases: c.phases, Pr: c.Pr, phase: c.phase }; }),
      model.imbalanceThresholdPct
    );
    model.consumers.forEach(function (c) {
      if (c.phases === 1 && !c.phase) c.phase = model.phaseBalance.assignments[c.id];
    });
    buildPanels(model);
    model.group = currApi.groupSums(model.consumers);
    model.checklist = chkApi.runProjectChecks(model);
    model.sc = model.sc || { stub: true };
    model.sc.Ikz_kA = model.Ikz_kA;
    return model;
  }

  function toJSON(model) { return JSON.stringify(model, null, 2); }

  function fromJSON(text) {
    var data = typeof text === 'string' ? JSON.parse(text) : text;
    var model = createEmptyModel({
      supplyMode: data.supplyMode || '2in', Un_kV: data.Un_kV, Ikz_kA: data.Ikz_kA,
      imbalanceThresholdPct: data.imbalanceThresholdPct, name: data.name, rtm: data.rtm
    });
    if (data.sources) model.sources = data.sources;
    if (data.sections) model.sections = data.sections;
    if (data.ats) model.ats = data.ats;
    if (data.panels) model.panels = data.panels;
    if (data.sc) model.sc = data.sc;
    model.consumers = (data.consumers || []).map(makeConsumer);
    (data.consumers || []).forEach(function (src, i) {
      if (src.qf) model.consumers[i].qf = src.qf;
      if (src.cable) model.consumers[i].cable = src.cable;
      if (src.feedWork) model.consumers[i].feedWork = src.feedWork;
      if (src.feedReserve) model.consumers[i].feedReserve = src.feedReserve;
      if (src.mode) model.consumers[i].mode = src.mode;
      if (src.phase) model.consumers[i].phase = src.phase;
    });
    return recalculate(model);
  }

  function setConsumerManualQf(model, consumerId, In) {
    var c = model.consumers.find(function (x) { return x.id === consumerId; });
    if (!c) return model;
    c.qf = fieldApi.setManual(c.qf, In, 'user');
    c.mode = 'manual';
    return model;
  }

  function revertConsumerAuto(model, consumerId) {
    var c = model.consumers.find(function (x) { return x.id === consumerId; });
    if (!c) return model;
    c.mode = 'auto';
    c.qf = fieldApi.resetToAuto(null, 'auto');
    c.cable = fieldApi.resetToAuto(null, 'auto');
    return recalculate(model, { forcePicks: true });
  }

  return {
    uid: uid, makeConsumer: makeConsumer, createEmptyModel: createEmptyModel, enrichConsumer: enrichConsumer,
    recalculate: recalculate, buildPanels: buildPanels, toJSON: toJSON, fromJSON: fromJSON,
    setConsumerManualQf: setConsumerManualQf, revertConsumerAuto: revertConsumerAuto
  };
});
