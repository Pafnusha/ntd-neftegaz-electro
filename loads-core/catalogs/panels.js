/**
 * Panel / NCU module catalog — DIN modules and cabinet size heuristics.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; root.LoadsCore.PANEL_CATALOG = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    note: 'Габариты условные по числу фидеров; уточнять по каталогу НКУ производителя.',
    moduleWidthMm: 200,
    inletWidthMm: 600,
    sectionWidthMm: 600,
    depthMm: 800,
    heightMm: 2200,
    dinModulesPerFeeder: 4,
    cabinets: [
      { id: 'NKU-600', w: 600, d: 800, h: 2200, din: 24 },
      { id: 'NKU-800', w: 800, d: 800, h: 2200, din: 36 },
      { id: 'NKU-1000', w: 1000, d: 800, h: 2200, din: 48 },
      { id: 'NKU-1200', w: 1200, d: 800, h: 2200, din: 60 }
    ]
  };
});
