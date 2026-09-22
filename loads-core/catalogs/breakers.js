/**
 * Simplified QF catalog (In A). Parametric — engineer verifies against manufacturer tables.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; root.LoadsCore.BREAKER_CATALOG = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    series: 'IEC/GOST typical In (parametric catalog)',
    note: 'Номиналы типовые; конкретный аппарат и кривую отключения уточнять по каталогу производителя.',
    ratings: [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 630, 800, 1000, 1250, 1600]
  };
});
