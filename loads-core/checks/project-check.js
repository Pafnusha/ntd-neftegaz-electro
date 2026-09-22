(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../feeds'), require('../norms/rules'));
  } else {
    root.LoadsCore = root.LoadsCore || {};
    var api = factory(root.LoadsCore, root.LoadsCore.NORMATIVE_RULES);
    root.LoadsCore.runProjectChecks = api.runProjectChecks;
    root.LoadsCore.formatChecklistHtml = api.formatChecklistHtml;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (feedsApi, norms) {
  'use strict';

  function runProjectChecks(model) {
    var items = [];
    function push(id, title, ok, detail, ruleId) {
      items.push({ id: id, title: title, ok: !!ok, detail: detail || '', ruleId: ruleId || null });
    }

    push('has-loads', 'Есть электроприёмники', (model.consumers || []).length > 0,
      'N=' + ((model.consumers || []).length));

    var redOk = true;
    (model.consumers || []).forEach(function (c) {
      var v = feedsApi.validateRedundancy(c);
      if (!v.ok) {
        redOk = false;
        v.errors.forEach(function (e) {
          push('redundancy-' + c.id, 'Резервирование ' + (c.id || c.name), false, e, 'PUE_CATEGORY');
        });
      }
    });
    if (redOk) push('redundancy', 'Резервирование вводов (разные секции/источники)', true, 'OK', 'PUE_CATEGORY');

    if (model.phaseBalance) {
      push('phase', 'Несимметрия фаз', !model.phaseBalance.warning, model.phaseBalance.message);
    }

    (model.consumers || []).forEach(function (c) {
      if (c.qfCheck) push('qf-' + c.id, 'QF ' + c.id, c.qfCheck.Ib_le_In !== false, c.qfCheck.message || '', 'PUE_CABLE_AMPACITY');
      if (c.cableCheck) {
        var cok = !!(c.cableCheck.Ib_le_Idop && c.cableCheck.dU_ok);
        push('cab-' + c.id, 'Кабель ' + c.id, cok, c.cableCheck.message || '', 'PUE_VOLTAGE_DROP');
      }
    });

    push('sources', 'Источники заданы', (model.sources || []).length > 0,
      'mode=' + (model.supplyMode || '?') + ', Nsrc=' + ((model.sources || []).length));

    push('sc-stub', 'КЗ: Iкз задан (полный расчёт — заглушка)', model.Ikz_kA != null && model.Ikz_kA !== '',
      'Iкз=' + model.Ikz_kA + ' кА (SC stub)', 'SC_STUB');

    var rules = norms || [];
    push('norms', 'Нормативные правила подключены', rules.length > 0, 'N rules=' + rules.length);

    var failed = items.filter(function (i) { return !i.ok; }).length;
    return { items: items, ok: failed === 0, failed: failed, passed: items.length - failed };
  }

  function formatChecklistHtml(result) {
    var rows = (result.items || []).map(function (i) {
      return '<tr><td>' + i.title + '</td><td>' + (i.detail || '') + '</td><td class="' +
        (i.ok ? 'ok' : 'bad') + '">' + (i.ok ? '✓' : '✗') + '</td></tr>';
    }).join('');
    return '<table style="width:100%;font-size:.82rem"><tr><th>Проверка проекта</th><th>Деталь</th><th></th></tr>' +
      rows + '</table><p class="note">Пройдено ' + result.passed + ' / ' + (result.passed + result.failed) + '</p>';
  }

  return { runProjectChecks: runProjectChecks, formatChecklistHtml: formatChecklistHtml };
});
