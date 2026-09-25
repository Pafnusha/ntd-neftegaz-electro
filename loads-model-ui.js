(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function LC() { return window.LoadsCore; }

  var netModel = null;

  function fwLink(model, sel){
    if (!sel) return null;
    var src = sel === 'UPS' ? ((model.sources.find(function(x){return x.type==='UPS'}))||{}).id : sel;
    var sec = (model.sections||[]).find(function(s2){ return (s2.fedBy||[]).indexOf(src)>=0; });
    return { sectionId: sec?sec.id:'SEC-A', sourceId: src };
  }
  function syncFromRtmRows() {
    var LA = window.__LA;
    if (!LA || !LC() || !LC().createEmptyModel) return null;
    var st = LA.state;
    var mode = ($('supply-mode') && $('supply-mode').value) || '2in';
    var m = LC().createEmptyModel({
      name: 'from-rtm',
      supplyMode: mode,
      Un_kV: st.un || 0.4,
      Ikz_kA: Number(($('ikz-input') || {}).value) || 20,
      imbalanceThresholdPct: Number(($('imb-threshold') || {}).value) || 15,
      rtm: { mode: st.mode, krTable: st.krTable, ko: st.ko, cosTarget: st.cosTarget }
    });
    // rename DES to V3 if present
    m.sources.forEach(function (s) {
      if (s.type === 'SOURCE_DG') { s.id = 'V3'; s.name = '\u0414\u042d\u0421 V3'; }
    });
    m.sections.forEach(function (sec) {
      if (sec.id === 'SEC-DES') {
        var des = m.sources.find(function (x) { return x.type === 'SOURCE_DG'; });
        if (des) sec.fedBy = [des.id];
      }
    });
    (st.rows || []).forEach(function (r, i) {
      var secMap = { A: ['SEC-A', 'V1'], B: ['SEC-B', 'V2'], U: ['SEC-UPS', 'UPS'] };
      var fwOwn = (r.sec && secMap[r.sec]) ? fwLink(m, secMap[r.sec][1]) : null;
      var resOwn = null;
      if (fwOwn && r.sec !== 'U') resOwn = fwLink(m, r.sec === 'B' ? 'V1' : 'V2');
      var c = LC().makeConsumer({
        id: r.netId || ('EP-' + (i + 1)),
        name: r.name,
        qty: r.n,
        qtyNr: Number(r.nr)||0,
        Pn_kW: r.pnUnit,
        ki: r.ki,
        ks: r.ks,
        cosPhi: r.cosPhi,
        eta: r.eta != null ? r.eta : 0.95,
        U_kV: r.U_kV || st.un || 0.4,
        phases: r.phases || 3,
        category: r.cat === 'special' ? 'special' : (r.cat || 3),
        motor: !!r.motor,
        vfd: !!r.vfd,
        softStarter: !!r.softStarter,
        upsRequired: !!r.upsRequired || r.cat === 'special',
        cableLength_m: r.cableLength_m != null ? r.cableLength_m : 30,
        qf: r.qf,
        cable: r.cable,
        mode: r.equipMode || 'auto',
        phase: r.phase || null,
        feedWork: fwOwn || (r.fw ? fwLink(m, r.fw) : (r.feedWork || null)),
        feedReserve: (r.fr === '-' || (fwOwn && !resOwn && !(Number(r.nr) > 0) )) ? null : (fwOwn ? (r.fr ? fwLink(m, r.fr) : (resOwn || (r.feedReserve || null))) : (r.fr ? fwLink(m, r.fr) : (r.feedReserve || null))),
        feedWorkManual: !!(fwOwn || r.fw),
        feedReserveManual: !!(r.fr) || !!(fwOwn && resOwn)
      });
      m.consumers.push(c);
    });
    netModel = LC().recalculate(m);
    perSectionBalance(netModel);
    st.netModel = netModel;
    return netModel;
  }

  function renderModelPanel() {
    var box = $('net-model-summary');
    if (!box || !netModel) return;
    var g = netModel.group || {};
    var pb = netModel.phaseBalance || {};
    var hasR = function(c){ return c.feedReserve && c.feedWork && c.feedReserve.sectionId && c.feedReserve.sectionId!==c.feedWork.sectionId; };
    var nRes = (netModel.consumers||[]).filter(hasR).length;
    var wU = 0, rU = 0; (netModel.consumers || []).forEach(function (c2) { wU += Math.max(1, Number(c2.qty) || 1); if (c2.feedReserve && c2.feedWork && c2.feedReserve.sectionId !== c2.feedWork.sectionId) rU += Math.max(1, Number(c2.qtyNr) || 0); });
    var gc = $('gd-counts'); if (gc) gc.textContent = 'QF рабочих (ΣN): ' + wU + ' · QF резервных: ' + rU;
    var src = (netModel.sources || []).map(function (s) { return s.id + '(' + s.type + ')'; }).join(', ');
    var err = (netModel.feedErrors || []).join('<br>') || '\u043d\u0435\u0442';
    box.innerHTML =
      '<div class="totals">' +
      '<div class="metric"><div class="lbl">\u0420\u0435\u0436\u0438\u043c \u043f\u0438\u0442\u0430\u043d\u0438\u044f</div><div class="val" style="font-size:.95rem">' + (netModel.supplyMode || '') + '</div></div>' +
      '<div class="metric"><div class="lbl">\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438</div><div class="val" style="font-size:.75rem">' + src + '</div></div>' +
      '<div class="metric"><div class="lbl">\u03a3Pr \u043c\u043e\u0434\u0435\u043b\u0438, \u043a\u0412\u0442</div><div class="val">' + (g.Pr != null ? g.Pr.toFixed(2) : '\u2014') + '</div></div>' +
      '<div class="metric"><div class="lbl">\u03a3Sr, \u043a\u0412\u00b7\u0410</div><div class="val">' + (g.Sr != null ? g.Sr.toFixed(2) : '\u2014') + '</div></div>' +
      '<div class="metric ' + (pb.warning ? 'hi' : '') + '"><div class="lbl">\u041d\u0435\u0441\u0438\u043c\u043c\u0435\u0442\u0440\u0438\u044f</div><div class="val">' + (pb.imbalancePct != null ? pb.imbalancePct.toFixed(1) + '%' : '\u2014') + '</div></div>' +
      '<div class="metric"><div class="lbl">\u041f\u0430\u043d\u0435\u043b\u0438</div><div class="val">' + ((netModel.panels || []).length) + '</div></div>' +
      '<div class="metric hi"><div class="lbl">QF раб. / QF рез. (N/M)</div><div class="val">' + (netModel.consumers||[]).length + ' / ' + nRes + '</div></div>' +
      '</div>' +
      '<p class="note">\u041e\u0448\u0438\u0431\u043a\u0438 \u0440\u0435\u0437\u0435\u0440\u0432\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f: <span class="' + ((netModel.feedErrors || []).length ? 'bad' : 'ok') + '">' + err + '</span></p>' +
      '<p class="note">L1/L2/L3 \u043a\u0412\u0442: ' +
      (pb.sums ? (pb.sums.L1.toFixed(2) + ' / ' + pb.sums.L2.toFixed(2) + ' / ' + pb.sums.L3.toFixed(2)) : '\u2014') +
      '. ' + (pb.message || '') + '</p>';

    var pan = $('net-panels');
    if (pan) {
      pan.innerHTML = '<table class="ep" style="min-width:0"><thead><tr><th>\u041f\u0430\u043d\u0435\u043b\u044c</th><th>\u0421\u0435\u043a\u0446\u0438\u044f</th><th>\u0428\u00d7\u0413\u00d7\u0412</th><th>DIN</th><th>\u041e\u0441\u043d\u043e\u0432\u0430\u043d\u0438\u0435</th></tr></thead><tbody>' +
        (netModel.panels || []).map(function (p) {
          return '<tr><td>' + p.name + '</td><td>' + p.sectionId + '</td><td>' + p.width_mm + '\u00d7' + p.depth_mm + '\u00d7' + p.height_mm +
            '</td><td>' + p.dinModules + '</td><td style="font-size:.75rem">' + (p.basis || '') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }

    var chk = $('net-checklist');
    if (chk && LC().formatChecklistHtml && netModel.checklist) {
      chk.innerHTML = LC().formatChecklistHtml(netModel.checklist);
    }

    var cons = $('net-consumers');
    if (cons) {
      cons.innerHTML = '<table class="ep" style="min-width:1100px"><thead><tr>' +
        '<th>ID</th><th>\u0418\u043c\u044f</th><th>\u03c6</th><th>\u041a\u0430\u0442</th><th>Pr</th><th>Ir,\u0410</th><th>QF</th><th>\u041a\u0430\u0431\u0435\u043b\u044c</th><th>\u0420\u0430\u0431.</th><th>\u0420\u0435\u0437.</th><th>\u0424\u0430\u0437\u0430</th><th>\u0420\u0435\u0436.</th>' +
        '</tr></thead><tbody>' +
        (netModel.consumers || []).map(function (c) {
          var qf = c.qf && c.qf.value != null ? c.qf.value : '\u2014';
          var qfM = c.qf && c.qf.mode === 'manual' ? ' \u270e' : '';
          var cab = c.cable && c.cable.value ? (c.cable.value.cores + '\u00d7' + c.cable.value.s) : '\u2014';
          var cabM = c.cable && c.cable.mode === 'manual' ? ' \u270e' : '';
          var fw = c.feedWork ? (c.feedWork.sourceId + '/' + c.feedWork.sectionId) : '\u2014';
          var fr = c.feedReserve ? (c.feedReserve.sourceId + '/' + c.feedReserve.sectionId) : '\u2014';
          return '<tr><td>' + c.id + '</td><td>' + (c.name || '') + '</td><td>' + c.phases + '</td><td>' + c.category +
            '</td><td>' + (c.Pr != null ? c.Pr.toFixed(2) : '') + '</td><td>' + (c.Ir != null ? c.Ir.toFixed(1) : '') +
            '</td><td>' + qf + qfM + '</td><td>' + cab + cabM + '</td><td>' + fw + '</td><td>' + fr +
            '</td><td>' + (c.phase || (c.phases === 3 ? '3\u03c6' : '')) + '</td><td>' + (c.mode || 'auto') + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
  }

  function refresh() {
    try {
      syncFromRtmRows();
      renderModelPanel();
    } catch (e) {
      console.error(e);
      var box = $('net-model-summary');
      if (box) box.innerHTML = '<p class="bad">\u041e\u0448\u0438\u0431\u043a\u0430 \u043c\u043e\u0434\u0435\u043b\u0438: ' + e.message + '</p>';
    }
  }

  function loadKtp1() {
    if (!LC() || !LC().buildKtp1Demo) return alert('LoadsCore \u043d\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d');
    var mode = ($('supply-mode') && $('supply-mode').value) || '2in+DES+UPS';
    netModel = LC().buildKtp1Demo(mode);
    var LA = window.__LA;
    if (LA) {
      LA.state.rows = netModel.consumers.map(function (c) {
        return {
          id: 'r' + Math.random().toString(36).slice(2, 8),
          netId: c.id,
          name: c.name,
          n: c.qty, nr: (c.qtyNr||0),
          pnUnit: c.Pn_kW,
          ki: c.ki,
          cosPhi: c.cosPhi,
          ks: c.ks,
          cat: c.category === 'special' ? 'special' : Number(c.category) || 3,
          phases: c.phases,
          eta: c.eta,
          motor: c.motor,
          upsRequired: c.upsRequired,
          cableLength_m: c.cableLength_m,
          U_kV: c.U_kV,
          qf: c.qf,
          cable: c.cable,
          equipMode: c.mode,
          phase: c.phase,
          fw: (c.feedWork && c.feedWork.sourceId==='UPS-1')?'UPS':(c.feedWork&&c.feedWork.sourceId)||'',
          fr: (c.feedReserve? ((c.feedReserve.sourceId==='UPS-1')?'UPS':c.feedReserve.sourceId) : (c.category===3||c.category==='III'?'-':'')),
          feedWork: c.feedWork,
          feedReserve: c.feedReserve,
          feedWorkManual: !!c.feedWorkManual,
          feedReserveManual: !!c.feedReserveManual
        };
      });
      LA.state.netModel = netModel;
      LA.state.un = 0.4;
      if ($('un-input')) $('un-input').value = '0.4';
      // trigger RTM re-render
      if (typeof window.__loadsRenderRows === 'function') window.__loadsRenderRows();
      else if (LA.renderRows) LA.renderRows();
      document.dispatchEvent(new CustomEvent('loads-model-imported'));
    }
    renderModelPanel();
    try { window.__gdRefresh && window.__gdRefresh(); } catch (e) {}
  }

  function exportModelJson() {
    refresh();
    if (!netModel) return;
    var blob = new Blob([LC().toJSON(netModel)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (netModel.name || 'network-model') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function perSectionBalance(mm){
    try {
      var bySec = {};
      (mm.consumers || []).forEach(function (c) { var k = (c.feedWork && c.feedWork.sectionId) || '?'; (bySec[k] = bySec[k] || []).push(c); });
      Object.keys(bySec).forEach(function (k) {
        var list = bySec[k];
        var sums = { L1: 0, L2: 0, L3: 0 };
        function wk(c){ var q = Math.max(1, c.qty||1); var nr = Math.max(0, Math.min(c.qtyNr||0, Math.max(0, q - 1))); return (c.Pr || 0) * (q - nr) / q; }
        list.forEach(function (c) {
          if (c.phases !== 1) { sums.L1 += wk(c) / 3; sums.L2 += wk(c) / 3; sums.L3 += wk(c) / 3; return; }
          if (c.phaseManual && c.phase) sums[c.phase] += wk(c);
        });
        list.filter(function (c) { return c.phases === 1 && !c.phaseManual; }).sort(function (a2, b2) { return wk(b2) - wk(a2); }).forEach(function (c) {
          var best = ['L1','L2','L3'].sort(function (l2, r2) { return sums[l2] - sums[r2]; })[0];
          c.phase = best; sums[best] += wk(c);
        });
        list.filter(function (c) { return c.phases === 1 && !c.phase; }).forEach(function (c) { c.phase = 'L1'; });
      });
      var all = { sums: { L1: 0, L2: 0, L3: 0 } };
      (mm.consumers || []).forEach(function (c) { if (c.phases !== 1) { all.sums.L1 += (c.Pr||0)/3; } else if (c.phase) all.sums[c.phase] += c.Pr; });
      mm.phaseBalanceWorkBySection = bySec;
    } catch (e) { console.warn('balance', e); }
  }
  function bind() {
    var b1 = $('btn-net-refresh');
    var b2 = $('btn-ktp1');
    var b3 = $('btn-export-model');
    var b4 = $('btn-revert-auto');
    if (b1) b1.onclick = refresh;
    if (b2) b2.onclick = loadKtp1;
    if (b3) b3.onclick = exportModelJson;
    if (b4) b4.onclick = function () {
      if (!netModel || !LC().revertConsumerAuto) return;
      (netModel.consumers || []).forEach(function (c) {
        LC().revertConsumerAuto(netModel, c.id);
      });
      // push back to RTM rows
      var LA = window.__LA;
      if (LA && LA.state.rows) {
        LA.state.rows.forEach(function (r) {
          var c = netModel.consumers.find(function (x) { return x.id === r.netId; });
          if (c) { r.qf = c.qf; r.cable = c.cable; r.equipMode = 'auto'; }
        });
      }
      renderModelPanel();
    };
    if ($('supply-mode')) $('supply-mode').onchange = refresh;
    if ($('imb-threshold')) $('imb-threshold').oninput = refresh;

    // Hook RTM paint
    var prev = window.__gdRefresh;
    window.__gdRefresh = function () {
      try { refresh(); } catch (e) {}
      if (typeof prev === 'function') try { prev(); } catch (e) {}
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    setTimeout(refresh, 50);
  });

  window.__NetModelUI = { refresh: refresh, loadKtp1: loadKtp1, getModel: function () { return netModel; } };
})();
