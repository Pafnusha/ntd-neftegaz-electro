/**
 * NORMATIVE_RULE objects — only real known refs; otherwise parameterized conditions.
 * Do NOT invent clause numbers.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; root.LoadsCore.NORMATIVE_RULES = factory(); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  return [
    {
      id: 'RTM_KR',
      title: 'Коэффициент расчётной нагрузки Кр',
      doc: 'РТМ 36.18.32.4-92',
      clause: 'таблицы Кр (питающие сети / шины НН)',
      condition: 'Кр = f(nэ, Ки) по табл. РТМ; ручной ввод допускается',
      parametric: false
    },
    {
      id: 'PUE_CABLE_AMPACITY',
      title: 'Допустимый длительный ток кабеля',
      doc: 'ПУЭ',
      clause: 'гл. 1.3 (выбор проводников по нагреву)',
      condition: 'Ib ≤ In ≤ Iдоп (с учётом поправочных коэффициентов прокладки — параметризуются)',
      parametric: true,
      paramNote: 'Конкретный номер таблицы уточнять по действующей редакции ПУЭ и условиям прокладки'
    },
    {
      id: 'PUE_VOLTAGE_DROP',
      title: 'Потеря напряжения',
      doc: 'ПУЭ / СП 256.1325800.2016',
      clause: 'требования к отклонениям напряжения',
      condition: 'ΔU% ≤ ΔUдоп (параметр проекта, по умолчанию 5%)',
      parametric: true,
      defaultDuPct: 5
    },
    {
      id: 'PUE_CATEGORY',
      title: 'Категория электроприёмников',
      doc: 'ПУЭ',
      clause: 'гл. 1.2 (классификация по обеспечению надёжности)',
      condition: 'Кат. I — питание от двух независимых источников; рабочий и резервный вводы не от одной секции',
      parametric: false
    },
    {
      id: 'SP256_LAYOUT',
      title: 'Размещение электрооборудования',
      doc: 'СП 256.1325800.2016',
      clause: 'требования к проходам и размещению (параметрическая проверка габаритов)',
      condition: 'Проходы перед щитами и зазоры — по СП/ПУЭ и ТУ; числа в модуле планировки — эвристика',
      parametric: true
    },
    {
      id: 'GOST_SLD',
      title: 'Оформление схем',
      doc: 'ГОСТ 2.702-2011 / ГОСТ 2.701-2008 / ГОСТ 2.710 / ГОСТ 2.755',
      clause: 'правила выполнения электрических схем',
      condition: 'Однолинейная схема формируется по модели сети',
      parametric: false
    },
    {
      id: 'SC_STUB',
      title: 'Токи КЗ',
      doc: 'ГОСТ / РД (уточнить по проекту)',
      clause: null,
      condition: 'Структура расчёта КЗ зарезервирована; коэффициенты не генерируются случайно — Iкз вводится параметром проекта',
      parametric: true,
      stub: true
    }
  ];
});
