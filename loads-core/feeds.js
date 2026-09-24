/**
 * Auto-assign work/reserve feeds as REAL links; ERROR if same source/section.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else { root.LoadsCore = root.LoadsCore || {}; Object.assign(root.LoadsCore, factory()); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function feedLink(sectionId, sourceId) {
    return { sectionId: sectionId || null, sourceId: sourceId || null };
  }

  function validateRedundancy(consumer) {
    var errors = [];
    var w = consumer.feedWork || {};
    var r = consumer.feedReserve || null;
    var cat = consumer.category;
    var needsReserve = cat === 1 || cat === 'I' || cat === 'special' || consumer.needsReserve;

    if (needsReserve && !r) {
      errors.push('Кат. I/special: требуется резервный ввод (feedReserve)');
    }
    if (r) {
      var sameSection = w.sectionId && r.sectionId && w.sectionId === r.sectionId;
      var sameSource = w.sourceId && r.sourceId && w.sourceId === r.sourceId;
      if (sameSection || sameSource) {
        errors.push('ERROR: рабочий и резервный вводы от одного источника/секции (' +
          (sameSection ? 'section=' + w.sectionId : '') +
          (sameSource ? ' source=' + w.sourceId : '') + ')');
      }
    }
    if (consumer.upsRequired && !(consumer.feedUps && consumer.feedUps.sourceId)) {
      errors.push('Нагрузка требует ИБП, но feedUps не назначен');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function autoAssignFeeds(consumers, sections, sources, opts) {
    opts = opts || {};
    var secA = (sections || []).find(function (s) { return s.id === 'SEC-A'; }) || (sections || [])[0];
    var secB = (sections || []).find(function (s) { return s.id === 'SEC-B'; }) || (sections || [])[1];
    var secUps = (sections || []).find(function (s) { return s.id === 'SEC-UPS'; });
    var secDes = (sections || []).find(function (s) { return s.id === 'SEC-DES'; });
    var grids = (sources || []).filter(function (s) { return s.type === 'GRID'; });
    var ups = (sources || []).find(function (s) { return s.type === 'UPS'; });
    var toggle = 0;
    var out = [];
    var allErrors = [];

    (consumers || []).forEach(function (c) {
      var cc = Object.assign({}, c);
      var cat = cc.category;
      var isI = cat === 1 || cat === 'I';
      var isSpecial = cat === 'special' || cat === 'S';

      if (cc.upsRequired || isSpecial) {
        if (secUps && ups) {
          cc.feedWork = feedLink(secUps.id, ups.id);
          cc.feedReserve = secA ? feedLink(secA.id, grids[0] && grids[0].id) : null;
          cc.feedUps = feedLink(secUps.id, ups.id);
        } else if (secA) {
          cc.feedWork = feedLink(secA.id, grids[0] && grids[0].id);
          cc.feedReserve = secB ? feedLink(secB.id, grids[1] && grids[1].id) : null;
        }
      } else if (isI) {
        cc.feedWork = feedLink(secA && secA.id, grids[0] && grids[0].id);
        cc.feedReserve = feedLink(secB && secB.id, grids[1] && grids[1].id);
        if (opts.withDes && secDes) {
          cc.feedDes = feedLink(secDes.id, secDes.fedBy[0]);
        }
      } else {
        /* правило проекта: основные нагрузки — на 1-ю секцию (рабочий ввод V1/SEC-A);
           резервные (кат. II) — на 2-ю секцию SEC-B; кат. III — без резерва */
        cc.feedWork = feedLink(secA && secA.id, grids[0] && grids[0].id);
        if (cat === 2 || cat === 'II') {
          cc.feedReserve = secB ? feedLink(secB.id, grids[1] && grids[1].id) : null;
        } else {
          cc.feedReserve = null;
        }
        toggle = toggle; void toggle;
      }

      if (c.feedWorkManual) cc.feedWork = c.feedWork;
      if (c.feedReserveManual) cc.feedReserve = c.feedReserve;

      var v = validateRedundancy(cc);
      if (!v.ok) allErrors = allErrors.concat(v.errors.map(function (e) { return cc.id + ': ' + e; }));
      cc._feedCheck = v;
      out.push(cc);
    });

    return { consumers: out, errors: allErrors, ok: allErrors.length === 0 };
  }

  return { feedLink: feedLink, validateRedundancy: validateRedundancy, autoAssignFeeds: autoAssignFeeds };
});
