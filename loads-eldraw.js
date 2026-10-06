/* Кнопка «ЕСКД eldraw (DXF)» — выгрузка ведомости для generate_sld.py */
(function () {
  function $(id) { return document.getElementById(id); }
  function payload() {
    var st = (window.__LA && window.__LA.state) || { rows: [] };
    var t = (window.__LA && window.__LA.compute && window.__LA.compute()) || {};
    var site = ($("site-type") || {}).value || "ktp";
    return {
      version: 3,
      engine: "eldraw-gost-2.702",
      mode: st.mode || "rtm",
      un: st.un || 0.4,
      ko: st.ko,
      cosTarget: st.cosTarget,
      kr: t.kr,
      site: site,
      title: (site === "ktp" ? "КТП 10(6)/0,4 кВ" : "Щит НКУ 0,4 кВ") + ". Схема электрическая однолинейная",
      organization: "ЭС-Нефтегаз",
      doc_code: "ЭМ.001.000",
      rows: (st.rows || []).map(function (r) {
        return {
          name: r.name, n: r.n, nr: Number(r.nr) || 0, sec: r.sec || "",
          ph: r.phases === 1 ? (r.phase ? ("1" + r.phase) : "1auto") : "3",
          pnUnit: r.pnUnit, ki: r.ki, cosPhi: r.cosPhi, ks: r.ks,
          cat: r.cat || 3, cableLength_m: r.cableLength_m, qf: r.qf, cable: r.cable
        };
      })
    };
  }
  function download() {
    var blob = new Blob([JSON.stringify(payload(), null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rtm-loads-eldraw.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
    try {
      alert("Сохранён rtm-loads-eldraw.json\n\npython3 eldraw-loads/generate_sld.py rtm-loads-eldraw.json -o output/sld-eskd\n\nDXF — nanoCAD / AutoCAD / КОМПАС.");
    } catch (e) {}
  }
  function mount() {
    if ($("btn-eldraw") && !$("btn-eldraw")._eldrawBound) {
      $("btn-eldraw").onclick = download;
      $("btn-eldraw")._eldrawBound = true;
      return;
    }
    if ($("btn-eldraw")) return;
    var bar = document.querySelector(".toolbar");
    if (!bar) return;
    var b = document.createElement("button");
    b.type = "button";
    b.id = "btn-eldraw";
    b.className = "primary";
    b.textContent = "ЕСКД eldraw (DXF)";
    bar.insertBefore(b, $("btn-gdxf") || null);
    b.onclick = download;
  }
  document.addEventListener("DOMContentLoaded", mount);
  if (document.readyState !== "loading") mount();
  setTimeout(mount, 400);
})();
