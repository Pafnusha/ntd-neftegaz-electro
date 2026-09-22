(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function makeAts(opts) {
    opts = opts || {};
    return {
      id: opts.id || 'ATS-1',
      name: opts.name || 'АВР',
      type: 'ATS',
      sections: opts.sections || ['SEC-A', 'SEC-B'],
      sources: opts.sources || [],
      params: Object.assign({
        transferTime_s: 0.5,
        mode: 'auto',
        priority: ['GRID', 'SOURCE_DG']
      }, opts.params || {})
    };
  }

  function defaultAtsForMode(mode, sections, sources) {
    var list = [];
    var secIds = (sections || []).map(function (s) { return s.id; });
    if (secIds.indexOf('SEC-A') >= 0 && secIds.indexOf('SEC-B') >= 0) {
      list.push(makeAts({
        id: 'ATS-SEC',
        name: 'АВР секционный QF11',
        sections: ['SEC-A', 'SEC-B'],
        sources: (sources || []).filter(function (s) { return s.type === 'GRID'; }).map(function (s) { return s.id; })
      }));
    }
    if (secIds.indexOf('SEC-DES') >= 0) {
      list.push(makeAts({
        id: 'ATS-DES',
        name: 'АВР ДЭС',
        sections: ['SEC-A', 'SEC-B', 'SEC-DES'],
        sources: (sources || []).map(function (s) { return s.id; }),
        params: { transferTime_s: 10, mode: 'auto', priority: ['GRID', 'SOURCE_DG'] }
      }));
    }
    return list;
  }

  return { makeAts: makeAts, defaultAtsForMode: defaultAtsForMode };
});
