/**
 * Formula registry — TZ §41. Do not invent clause numbers.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; root.LoadsCore.FORMULAS = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return [
    { id: 'F-PN', formula: 'Pн = Σ(n·pн)', document: 'РТМ 36.18.32.4-92', section: 'Ф3636-92', paragraph: '', applicability: 'узел до 1 кВ', source: 'РТМ', implementation: 'rtmGroup', test: 'loads-core/tests' },
    { id: 'F-NE', formula: 'nэ = (ΣPн)² / Σ(n·pн²)', document: 'РТМ 36.18.32.4-92', section: 'nэ', paragraph: '', applicability: 'группа ЭП', source: 'РТМ', implementation: 'rtmGroup', test: 'loads-core/tests' },
    { id: 'F-PP', formula: 'Pр = Кр · Σ(Ки·Pн)', document: 'РТМ 36.18.32.4-92', section: 'Ф3636-92', paragraph: '', applicability: 'до 1 кВ', source: 'РТМ', implementation: 'rtmPower', test: 'loads-core/tests' },
    { id: 'F-QP', formula: 'Qр = 1,1·Σ(КиPн)·tgφср при nэ≤10', document: 'РТМ 36.18.32.4-92', section: 'Ф3636-92', paragraph: '', applicability: 'до 1 кВ', source: 'РТМ', implementation: 'rtmPower', test: 'loads-core/tests' },
    { id: 'F-IP3', formula: 'Ip = Sр/(√3·Uн)', document: 'РТМ 36.18.32.4-92', section: 'ток', paragraph: '', applicability: '3ф', source: 'РТМ', implementation: 'ip3', test: 'loads-core/tests' },
    { id: 'F-IP1', formula: 'Ip = Sр/Uн', document: 'РТМ / ТЗ п.7', section: 'ток', paragraph: '', applicability: '1ф L-N и L-L', source: 'ТЗ', implementation: 'ip1', test: 'loads-core/tests' },
    { id: 'F-SC', formula: 'Iкз по Zс+Zт+Zкаб (упрощ.)', document: 'ГОСТ 28249-93', section: '', paragraph: '', applicability: 'уточнить', source: 'stub', implementation: 'faultAtEnd', test: 'ТРЕБУЕТ ПРОВЕРКИ НОРМАТИВНОЙ БАЗЫ' }
  ];
});
