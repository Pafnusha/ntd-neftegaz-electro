/**
 * Cable ampacity catalog (A) — simplified continuous current for Cu PVC/XLPE in air.
 * Based on typical ПУЭ ch.1.3 order-of-magnitude values; parametric ΔU check separate.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; root.LoadsCore.CABLE_CATALOG = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    typeDefault: 'ВВГнг(А)-LS',
    note: 'Iдоп ориентировочно для Cu в воздухе; коэффициенты прокладки/темп. — параметризуются пользователем.',
    sections: [
      { s: 1.5, iDop: 19 }, { s: 2.5, iDop: 27 }, { s: 4, iDop: 38 }, { s: 6, iDop: 50 },
      { s: 10, iDop: 70 }, { s: 16, iDop: 90 }, { s: 25, iDop: 115 }, { s: 35, iDop: 140 },
      { s: 50, iDop: 175 }, { s: 70, iDop: 215 }, { s: 95, iDop: 260 }, { s: 120, iDop: 300 },
      { s: 150, iDop: 340 }, { s: 185, iDop: 390 }, { s: 240, iDop: 460 }, { s: 300, iDop: 520 }
    ],
    rOhmKm: { 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727, 35: 0.524, 50: 0.387, 70: 0.268, 95: 0.193, 120: 0.153, 150: 0.124, 185: 0.0991, 240: 0.0754, 300: 0.0601 },
    xOhmKm: 0.08
  };
});
