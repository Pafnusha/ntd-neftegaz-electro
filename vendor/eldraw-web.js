/* eldraw-web.js — интеграция библиотеки vaganchik/eldraw (DXF R2010 ЕСКД, УГО ГОСТ 2.755…)
   в модули «Нагрузки», «Нагрузки 2.0», «Расчёт ИБП» через Pyodide (Python в браузере).
   Первый запуск качает运行时 (~20 МБ с jsdelivr: pyodide+numpy+matplotlib), колёса ezdxf/eldraw
   лежат в /vendor. Результаты: SVG-лист прямо в странице, кнопка «Скачать DXF», панель замечаний ERC. */
(function () {
  "use strict";
  var CDN = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/";
  var V = (document.baseURI || location.href).replace(/[^/]*$/, "") + "vendor/";
  var py = null, bridgeSrc = null, job = null;

  function el(id) { return document.getElementById(id); }
  function status(msg, err) { var s = el("ed-status"); if (s) { s.textContent = msg; s.style.color = err ? "#c62828" : "#5a6a7e"; } }

  function ensurePanel() {
    if (el("edraw-panel")) return;
    var p = document.createElement("section");
    p.id = "edraw-panel";
    p.className = "panel";
    p.innerHTML =
      '<h2 style="margin:0 0 6px;font-size:15px">Отрисовка ЕСКД-схемы движком eldraw <span style="font-size:11px;color:#5a6a7e">(vaganchik/eldraw · DXF R2010 AutoCAD/nanoCAD · УГО ГОСТ 2.755/2.702 · Python в браузере)</span></h2>' +
      '<div class="toolbar" style="gap:8px;display:flex;flex-wrap:wrap;align-items:center;margin-bottom:6px">' +
      '<button type="button" class="primary" id="ed-run">Построить DXF-лист (eldraw)</button>' +
      '<button type="button" id="ed-dxf" hidden>Скачать DXF</button>' +
      '<span id="ed-status" style="font-size:12px;color:#5a6a7e"></span></div>' +
      '<div id="ed-erc" style="font:12px/1.5 monospace;white-space:pre-wrap;background:#f6f8fb;border:1px solid #d7dfe8;border-radius:6px;padding:6px 8px;max-height:150px;overflow:auto;display:none"></div>' +
      '<div id="ed-view" style="margin-top:8px;overflow:auto;border:1px solid #d7dfe8;border-radius:6px;background:#fff"></div>';
    var host = el("toggles-row") || el("ktp-geo") || el("netcard") || document.querySelector("main") || document.body;
    var anchor = el("b-xls") || el("b-dxf") || el("b-panel") || el("b-net");
    if (anchor && anchor.closest("section")) anchor.closest("section").appendChild(p); else host.appendChild(p);
  }

  function loadScript(u) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = u; s.onload = res; s.onerror = function () { rej(Error("no " + u)); }; document.head.appendChild(s); }); }

  function bootPy() {
    if (py) return Promise.resolve();
    status("Загрузка Python-среды (первый раз ~20 МБ)…");
    return (window.loadPyodide ? Promise.resolve() : loadScript(CDN + "pyodide.js"))
      .then(function () { return window.loadPyodide({ indexURL: CDN }); })
      .then(function (p) { py = p; return py.loadPackage(["micropip", "numpy", "matplotlib"]); })
      .then(function () { status("Установка ezdxf/eldraw…"); return py.runPythonAsync("import micropip\nawait micropip.install('" + V + "pyparsing-3.3.3-py3-none-any.whl')\nawait micropip.install('" + V + "typing_extensions-4.16.0-py3-none-any.whl')\nawait micropip.install('" + V + "fonttools-4.66.1-py3-none-any.whl')\nawait micropip.install('" + V + "ezdxf-1.4.4-py3-none-any.whl')\nawait micropip.install('" + V + "eldraw-0.1.0-py3-none-any.whl')"); })
      .then(function () {
        if (bridgeSrc) return bridgeSrc;
        return fetch(V + "eldraw-bridge.py").then(function (r) { return r.text(); }).then(function (t) { bridgeSrc = t; return t; });
      })
      .then(function (t) { status("Компиляция моста…"); py.globals.set("_BRIDGE", t); return py.runPythonAsync("import sys, types\nmod = types.ModuleType('eldraw_bridge_web')\nexec(compile(_BRIDGE, 'eldraw_bridge.py', 'exec'), mod.__dict__)\nsys.modules['eldraw_bridge_web'] = mod"); });
  }

  function toBytes(b64) {
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  }

  function run(provider) {
    ensurePanel();
    var btn = el("ed-run"); btn.disabled = true;
    var spec;
    try { spec = provider(); } catch (e) { status("Нет данных схемы: " + e.message, 1); btn.disabled = false; return; }
    bootPy().then(function () {
      status("Рисую лист по ГОСТ…");
      py.globals.set("SPEC_JSON", JSON.stringify(spec));
      return py.runPythonAsync("import json\nfrom eldraw_bridge_web import build\n_res = build(json.loads(SPEC_JSON))\njson.dumps(_res)");
    }).then(function (js) {
      var r = JSON.parse(js);
      el("ed-view").innerHTML = r.svg;
      var box = el("ed-erc"); box.style.display = "block";
      box.textContent = "ERC: " + (r.erc.length ? r.erc.join("\n") : "чисто");
      var bytes = toBytes(r.dxf_b64);
      var blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/dxf" }));
      var d = el("ed-dxf"); d.hidden = false; d.onclick = function () { var a = document.createElement("a"); a.href = blobUrl; a.download = ((spec.title || "ols") + ".ols").replace(/[^\wа-яё.-]+/gi, "_") + ".dxf"; document.body.appendChild(a); a.click(); a.remove(); };
      status("Готово: " + r.stats.sections + " секц., " + r.stats.feeders + " фидеров. Временем первого запуска не мерить — среды уже прогрета.");
      btn.disabled = false;
    }).catch(function (e) { status("Ошибка eldraw: " + (e && e.message || e), 1); btn.disabled = false; });
  }

  /* ---------- провайдеры спек по страницам ---------- */
  function specN2() {
    var N = window.__N2 || (window.N2 && window.N2) || null;
    var st = N.state, res = N.res, conf = N.conf;
    var byId = {}; res.rowsById.forEach(function (c) { byId[c.id] = c; });
    function fe(row) { var c = byId[row.id] || {}; return {
      ref: "QF" + (201 + st.rows.indexOf(row)), name: row.name, poles: row.kind === "ups" ? 3 : (String(row.ph) === "1~220" ? 1 : 3),
      In: c.In, curve: "C", P: Math.round(c.Pr*10)/10, Pn: Math.round(c.Pn*10)/10, I: Math.round(c.Icalc||0), phase: (N.phaseAssign[row.id] || "L1"),
      cable: c.mark, len: row.L, spz: row.spz, reserve: row.kind === "reserve", grp: String(st.rows.indexOf(row) + 1) }; }
    var secs = [];
    var srcs = conf.tpl === "A"
      ? [{ label: "Сеть 10(6) кВ · Т1 " + conf.tr + " кВА", qs: "QS1", qf: "QF01", qfIn: Math.round(conf.tr / (0.693) / 10) + "", qsIn: "" }, { label: "ДЭС 0,4 кВ " + conf.dg + " кВА", qs: "QS2", qf: "QF02", qfIn: Math.round(conf.dg / 0.693 / 10) + "" }]
      : [{ label: "Сеть №1 · Т1 " + conf.tr + " кВА", qs: "QS1", qf: "QF01", qfIn: "" }, { label: "Сеть №2 · Т2 " + conf.tr2 + " кВА", qs: "QS2", qf: "QF03", qfIn: "" }, { label: "ДЭС 10 кВ · ТЗ " + conf.dg + " кВА", qs: "QS3", qf: "QF05", qfIn: "" }];
    var n = conf.tpl === "A" ? 2 : 3;
    for (var i = 1; i <= n; i++) {
      var rows = st.rows.filter(function (r) { return r.sec === "Секция " + i && r.kind !== "ups"; });
      var sc = (N.secCalc["Секция " + i] || {}).p;
      secs.push({ label: "СЕКЦИЯ " + i, source: srcs[i - 1] || {}, sumP: sc ? (Math.round(sc.Pp * 10) / 10) : "", feeders: rows.map(fe) });
    }
    var up = st.rows.filter(function (r) { return r.kind === "ups"; });
    if (up.length) secs.push({ label: "СЕКЦИЯ ИБП", source: { label: "ИБП VFI " + (conf.ups || 10) + " кВА", qs: "QS4", qf: "QF06", qfIn: "" }, feeders: up.map(fe) });
    return { title: "ОЛС " + (el("objname") ? el("objname").value : "Нагрузки 2.0"), format: "A2", stamp: { code: "Н2.ОЛС", title: "Схема однолинейная (Нагрузки 2.0)", org: "ЭС-Нефтегаз", by: "расчётчик" }, sections: secs };
  }

  function specV1() {
    try { window.__NetModelUI.refresh(); } catch (e) {}
    var m = window.__NetModelUI.getModel();
    if (!m) { var LA0 = window.__LA; if (LA0 && LA0.state && LA0.state.rows) { try { window.__NetModelUI.refresh(); m = window.__NetModelUI.getModel(); } catch (e) {} } }
    if (!m) return null;
    var LA = window.__LA, cmp = LA && LA.compute ? LA.compute() : null;
    var inv = {}; (LA ? LA.state.rows : []).forEach(function (r, i) { if (r.netId) inv[r.netId] = r; });
    function fe(c, idx) {
      var cable = (c.cable && c.cable.selected && c.cable.selected.candidates && c.cable.selected.candidates[0]) || (c.cable && c.cable.value) || {};
      var qf = (c.qf && c.qf.value) || {};
      return { ref: c.id ? "QF" + (101 + idx % 60) : "QF" + (101 + idx % 60), name: c.name, poles: (c.phases === 1 ? 1 : 3), In: qf.In, curve: qf.curve, P: Math.round(c.Pr || 0), I: Math.round(c.Ir || 0), phase: (c.assignedPhase && c.assignedPhase.pins && c.assignedPhase.pins[0]) || (c.phases === 1 ? "L1" : "L1-L3"), cable: (cable.type || "ВВГнг(А)-LS") + " " + (cable.cores || (c.phases === 1 ? 3 : 5)) + "×" + (cable.s || "?"), len: c.cableLength_m || 100, spz: !!(inv[c.id]&&inv[c.id].spz), grp: String(idx + 1) };
    }
    var srcMap = {}; (m.sources || []).forEach(function (s) { srcMap[s.id] = s; });
    var groups = {};
    (m.consumers || []).forEach(function (c, i) { var k = (c.feedWork && c.feedWork.sectionId) || "X"; (groups[k] = groups[k] || []).push(fe(c, i)); });
    var order = (m.sections || []).map(function (s) { return s.id; });
    var secs = order.filter(function (k) { return groups[k]; }).map(function (k) {
      var s = (m.sections || []).filter(function (x) { return x.id === k; })[0] || {};
      var src = (s.fedBy && s.fedBy.length && srcMap[s.fedBy[0]]) || {};
      return { label: s.name || k, source: { label: (src.type === "GRID" ? "Сеть через Т" + (order.indexOf(k) + 1) : src.type) + (src.Sn_kVA ? " · " + src.Sn_kVA + " кВА" : ""), qs: "QS" + (order.indexOf(k) + 1), qf: "QF0" + (order.indexOf(k) + 1) }, sumP: (cmp && cmp.perGroup && cmp.perGroup[k]) ? Math.round(cmp.perGroup[k].P) : "", feeders: groups[k] };
    });
    if (!secs.length) return null;
    return { title: "ОЛС КТП/НКУ 0,4 кВ — " + m.name, format: "A2", stamp: { code: "1х.ОЛС", title: "Схема электрическая однолинейная", org: "ЭС-Нефтегаз", by: "гл. специалист" }, sections: secs };
  }

  function specIBP() {
    function val(id, d) { var e = document.getElementById(id); return e ? (e.value || e.textContent || d) : d; }
    var grps = [];
    try {
      document.querySelectorAll("#grp-table tr").forEach(function (tr, i) {
        var cells = tr.querySelectorAll("td"); if (cells.length && i) {
          grps.push({ name: "Группа ИБП " + i, P: parseFloat(cells[1] ? cells[1].textContent.replace(",", ".") : 1) || 1, I: parseFloat(cells[2] ? cells[2].textContent.replace(",", ".") : 5) || 5 });
        }
      });
    } catch (e) {}
    if (!grps.length) grps = [{ name: "ЩП АСУ ТП (ИБП 10 кВА)", P: 3, I: 14 }, { name: "АУПТ/СОУЭ (ИБП)", P: 1.5, I: 7 }];
    return { title: "ОЛС системы гарантированного питания (ИБП)", format: "A3", stamp: { code: "ИБП.ОЛС", title: "Схема однолинейная ИБП", org: "ЭС-Нефтегаз" },
      sections: [{ label: "Шина ИБП 0,4 кВ", source: { label: "Сеть 0,4 кВ · выпрямитель →АКБ " + val("bat-v", "24") + "В/" + val("bat-ah", "100") + "Ач → VFI", qs: "QS0", qf: "QF00", qfIn: "" }, feeders: grps.map(function (g, i) { return { ref: "QF" + (201 + i), name: g.name, poles: 1, In: g.I, curve: "B", P: g.P, I: g.I, phase: ["L1", "L2", "L3"][i % 3], cable: "ВВГнг(А)-FRLS 3×" + (g.I < 10 ? 1.5 : 2.5), len: 30, spz: true }; }) }] };
  }

  function provider() { if (window.N2) return specN2(); if (window.__LA && window.__NetModelUI) { var s = specV1(); if (s) return s; } return specIBP(); }

  /* авто-встраивание: ждём появления тулбара (loads собирается асинхронно из чанков) */
  function mount(tries) {
    tries = tries || 0;
    if (!/nagruzki2\.html|loads\.html|ibp\.html/.test(location.pathname)) { ensurePanel(); return; }
    if (el("ed-open")) return;
    var t = document.querySelector(".toolbar") || document.querySelector(".controls");
    var ready = t && document.querySelector("#grid tbody tr, #ktp-geo, #b-calc, #btn-gsl");
    if (!ready && tries < 40) { setTimeout(function () { mount(tries + 1); }, 250); return; }
    var btn = document.createElement("button"); btn.type = "button"; btn.id = "ed-open"; btn.textContent = "Схема ЕСКД (eldraw)";
    btn.className = "secondary";
    btn.onclick = function () { run(provider); };
    if (t) t.appendChild(btn); else (document.querySelector("main") || document.body).prepend(btn);
  }
  function start() { mount(0); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
