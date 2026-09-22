(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function makeSection(opts) {
    opts = opts || {};
    return {
      id: opts.id || 'SEC-A',
      name: opts.name || opts.id,
      Un_kV: opts.Un_kV != null ? opts.Un_kV : 0.4,
      fedBy: opts.fedBy || [],
      busbarIn_A: opts.busbarIn_A || 0,
      panelIds: opts.panelIds || []
    };
  }

  function defaultKtpSections(sources) {
    var grids = (sources || []).filter(function (s) { return s.type === 'GRID'; });
    var des = (sources || []).filter(function (s) { return s.type === 'SOURCE_DG'; });
    var secs = [
      makeSection({ id: 'SEC-A', name: 'Секция A', fedBy: grids[0] ? [grids[0].id] : ['V1'] }),
      makeSection({ id: 'SEC-B', name: 'Секция B', fedBy: grids[1] ? [grids[1].id] : ['V2'] })
    ];
    if (des.length) {
      secs.push(makeSection({ id: 'SEC-DES', name: 'Секция ДЭС', fedBy: [des[0].id] }));
    }
    var ups = (sources || []).filter(function (s) { return s.type === 'UPS'; });
    if (ups.length) {
      secs.push(makeSection({ id: 'SEC-UPS', name: 'Шина ИБП', fedBy: [ups[0].id] }));
    }
    return secs;
  }

  return { makeSection: makeSection, defaultKtpSections: defaultKtpSections };
});
