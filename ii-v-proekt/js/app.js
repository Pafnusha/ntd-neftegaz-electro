/* ============================================================
   ЛОГИКА САЙТА: степпер, матрица, конфигуратор, каталог,
   экспорт в Markdown, скачивание форм, печать, scroll-spy
   ============================================================ */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nf = new Intl.NumberFormat("ru-RU");

/* ---------------- тикер + доказательства ---------------- */
function renderTicker() {
  $("#ticker").innerHTML = TICKER.map((t, i) =>
    `<button class="tk" data-i="${i}" title="${esc(t.ref)}"><b>${esc(t.n)}</b><span>${esc(t.l)}</span></button>`).join("");
  $("#ticker").addEventListener("click", (e) => {
    const b = e.target.closest(".tk"); if (!b) return;
    const t = TICKER[+b.dataset.i];
    toast(`${t.n} — ${t.l} · источник: ${t.ref}`);
  });
  $("#evidGrid").innerHTML = EVIDENCE.map((e) => `
    <article class="ev rv" data-n="${esc(e.n)}">
      <div class="ev-num">${esc(e.num)}</div>
      <div class="ev-lab">${esc(e.lab)}</div>
      <p>${esc(e.txt)}</p>
      <div class="ev-src">Источник: ${esc(e.src)}</div>
    </article>`).join("");
}

/* ---------------- степпер (7 шагов) ---------------- */
const STEP_KEY = "ii-proekt-step";
function renderStepper() {
  const nav = $("#stepNav");
  nav.innerHTML = STEPS.map((s, i) =>
    `<button class="step-tab" data-i="${i}"><span class="n">шаг ${s.n}</span><span class="t">${esc(s.t)}</span></button>`).join("");
  nav.addEventListener("click", (e) => {
    const b = e.target.closest(".step-tab"); if (b) setStep(+b.dataset.i, true);
  });
  const saved = clamp(+(localStorage.getItem(STEP_KEY) || 0), 0, STEPS.length - 1);
  setStep(saved);
}
function setStep(i, scroll) {
  i = clamp(i, 0, STEPS.length - 1);
  localStorage.setItem(STEP_KEY, i);
  $$(".step-tab").forEach((t, k) => {
    t.classList.toggle("on", k === i);
    t.classList.toggle("done", k < i);
  });
  const s = STEPS[i];
  $("#stepBody").innerHTML = `
    <div class="step-head">
      <span class="idx">${s.n}</span>
      <h3>${esc(s.t)}</h3>
      <span class="dur">срок: ${esc(s.dur)}</span>
    </div>
    <span class="owner">кто ведёт · ${s.owner.map(esc).join(" + ")}</span>
    <p class="step-lede">${esc(s.goal)}</p>
    <div class="step-cols">
      <div class="step-block">
        <h4>Что делать (по порядку)</h4>
        <ol class="ord">${s.acts.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>
      </div>
      <div class="step-block">
        <h4>Артефакты шага</h4>
        <ul>${s.art.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
      </div>
    </div>
    <div class="exit"><span>критерий выхода:</span>${s.exit.map((x) => `<span class="chip">${esc(x)}</span>`).join("")}</div>
    <div class="step-note"><b>Из материалов конференции.</b> ${esc(s.note)}</div>
    <div class="step-nav">
      ${i > 0 ? `<button class="btn btn-ghost" id="prevStep">← шаг ${STEPS[i - 1].n}</button>` : ""}
      ${i < STEPS.length - 1 ? `<button class="btn btn-solid" id="nextStep">шаг ${STEPS[i + 1].n} · ${esc(STEPS[i + 1].t)} →</button>` :
      `<button class="btn btn-solid" id="goCfg">Готово → собрать план в конфигураторе</button>`}
    </div>`;
  const p = $("#prevStep"), n = $("#nextStep"), g = $("#goCfg");
  if (p) p.onclick = () => setStep(i - 1, true);
  if (n) n.onclick = () => setStep(i + 1, true);
  if (g) g.onclick = () => location.hash = "#s-config";
  if (scroll) $("#stepBody").scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------------- матрица сценариев ---------------- */
const PICK = new Set(JSON.parse(localStorage.getItem("ii-proekt-pick") || "[]"));
const MATRIX_STATE = { proc: "все", sort: "pri", q: "" };

function procList() { return ["все", ...new Set(SCEN.map((s) => s.p))]; }
function scenarioScore(s, prof) {
  let base = s.eff * 0.6 + s.impl * 0.4;
  if (!prof.data) base -= s.data === "да" ? 2.6 : 0;
  if (!prof.lokal) base -= s.secLocal === "да" ? 3.2 : 0;
  prof.roles.forEach((r) => { const b = (ROLE_BOOST[r] || {})[s.id]; if (b) base *= b; });
  if (prof.fast && s.est === "6-12 мес") base -= 2.2;
  if (prof.nocomp && (s.id === "gen3d" || s.id === "agents" || s.id === "surrogate")) base -= 1.8;
  return base;
}
function matrixRows(prof = { roles: [], data: true, lokal: true, fast: false, nocomp: false }) {
  let rows = SCEN.filter((s) => MATRIX_STATE.proc === "все" || s.p === MATRIX_STATE.proc);
  const q = MATRIX_STATE.q.trim().toLowerCase();
  if (q) rows = rows.filter((s) => (s.n + " " + s.d + " " + s.tags.join(" ") + " " + s.src).toLowerCase().includes(q));
  rows = rows.map((s) => ({ s, v: +scenarioScore(s, prof).toFixed(2) })).sort((a, b) =>
    MATRIX_STATE.sort === "eff" ? b.s.eff - a.s.eff :
    MATRIX_STATE.sort === "impl" ? b.s.impl - a.s.impl :
    MATRIX_STATE.sort === "proc" ? a.s.p.localeCompare(b.s.p, "ru") : b.v - a.v);
  return rows;
}
function renderMatrix() {
  $("#procFilter").innerHTML = procList().map((p) =>
    `<button class="tag${p === MATRIX_STATE.proc ? " on" : ""}" data-p="${esc(p)}">${esc(p)}</button>`).join("");
  $("#procFilter").onclick = (e) => {
    const b = e.target.closest(".tag"); if (!b) return;
    MATRIX_STATE.proc = b.dataset.p; renderMatrix();
  };
  const rows = matrixRows();
  $("#matrix").innerHTML = `<div class="mat-head">
      <span>сценарий</span><span>процесс</span><span>эффект (Э)</span><span>реализуем. (Р)</span><span>срок / данные</span><span></span>
    </div>` + rows.map(({ s }) => `
    <button class="mat-row${PICK.has(s.id) ? " sel" : ""}" data-id="${s.id}" aria-pressed="${PICK.has(s.id)}">
      <span class="nm">${esc(s.n)}<span class="ds">${esc(s.d)}</span></span>
      <span class="pr">${esc(s.p)}</span>
      <span class="c-eff"><em>Э ${s.eff}</em><span class="bar y"><i style="width:${s.eff * 10}%"></i></span></span>
      <span class="c-imp"><em>Р ${s.impl}</em><span class="bar g"><i style="width:${s.impl * 10}%"></i></span></span>
      <span class="src">${esc(s.est)} · данные: ${esc(s.data)}<br>${esc(s.src)}</span>
      <span class="add">${PICK.has(s.id) ? "✓" : "+"}</span>
    </button>`).join("") +
    rows.map(({ s }) => `<div hidden id="fx-${s.id}">${s.fx.map((f) => `<div><b>${esc(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>`).join("");
  $$(".mat-row").forEach((r) => r.addEventListener("click", () => {
    const id = r.dataset.id;
    if (PICK.has(id)) { PICK.delete(id); toast("Сценарий убран из плана"); }
    else { PICK.add(id); toast("Добавлено в план: " + SCEN.find((x) => x.id === id).n); }
    localStorage.setItem("ii-proekt-pick", JSON.stringify([...PICK]));
    renderMatrix(); renderCfg(true);
  }));
}

/* ---------------- конфигуратор ---------------- */
const CFG_STATE = JSON.parse(localStorage.getItem("ii-proekt-cfg") || "null") || {
  roles: ["oa"], stage: "s2", res: ["rsap"], lim: [], team: 35, hours: 640, horiz: "h6", form: ["froad", "fart", "fmetr"],
};
function opts(f) {
  if (f.type === "num") return "";
  return f.items.map((it) => {
    const on = f.type === "one" ? CFG_STATE[f.k] === it.v : (CFG_STATE[f.k] || []).includes(it.v);
    return `<label class="opt${f.type === "one" ? " radio" : ""}${on ? " on" : ""}">
      <input type="${f.type === "one" ? "radio" : "checkbox"}" name="${f.k}" value="${it.v}" ${on ? "checked" : ""}>
      <i class="bx"></i><span>${esc(it.l)}</span></label>`;
  }).join("");
}
function renderCfgForm() {
  $("#cfgForm").innerHTML = CFG.map((f) => {
    if (f.type === "num") return `<div class="fld"><span class="fld-t">${esc(f.t)} <span>${esc(f.hint || "")}</span></span>
      <div class="row2"><input type="range" name="${f.k}" min="${f.min}" max="${f.max}" step="${f.step}" value="${CFG_STATE[f.k]}">
      <input type="number" name="${f.k}n" min="${f.min}" max="${f.max}" step="${f.step}" value="${CFG_STATE[f.k]}" style="width:100%"></div>
      <div class="hint">Текущее: <span class="val" id="v-${f.k}">${nf.format(CFG_STATE[f.k])}</span> ${f.k === "team" ? "чел." : "ч/мес"}</div></div>`;
    return `<fieldset class="fld"><legend>${esc(f.t)} <span>${esc(f.hint || "")}</span></legend><div class="opts">${opts(f)}</div></fieldset>`;
  }).join("");
  $("#cfgForm").onchange = (e) => {
    const n = e.target.name; if (!n) return;
    const f = CFG.find((x) => x.k === n || x.k + "n" === n); if (!f) return;
    if (f.type === "num") {
      const v = clamp(+e.target.value || 0, f.min, f.max); CFG_STATE[f.k] = v;
      $(`input[name="${f.k}"]`).value = v; $(`input[name="${f.k}n"]`).value = v;
      $(`#v-${f.k}`).textContent = nf.format(v);
    } else if (f.type === "one") {
      CFG_STATE[f.k] = e.target.value;
    } else {
      const arr = CFG_STATE[f.k] || []; CFG_STATE[f.k] = arr;
      const i = arr.indexOf(e.target.value);
      e.target.checked ? (i < 0 && arr.push(e.target.value)) : (i >= 0 && arr.splice(i, 1));
    }
    saveCfg(); renderCfgForm(); renderCfg(true);
  };
}
function saveCfg() { localStorage.setItem("ii-proekt-cfg", JSON.stringify(CFG_STATE)); }
function prof() {
  const P = {
    roles: CFG_STATE.roles, stage: CFG_STATE.stage, team: CFG_STATE.team, hours: CFG_STATE.hours,
    horiz: CFG_STATE.horiz, data: CFG_STATE.res.includes("rdata"), lokal: CFG_STATE.res.includes("rlocal"),
    sod: CFG_STATE.res.includes("rsod"), sap: CFG_STATE.res.includes("rsap"), people: CFG_STATE.res.includes("rpeople"),
    budg: CFG_STATE.res.includes("rbudg"), xml: CFG_STATE.res.includes("rxml"), it: CFG_STATE.res.includes("rbuh"),
    fast: CFG_STATE.lim.includes("lfast"), sek: CFG_STATE.lim.includes("lsec"),
    nodata: CFG_STATE.lim.includes("lnodata"), nocomp: CFG_STATE.lim.includes("lbudg"),
    distrust: CFG_STATE.lim.includes("ltrust"), noresp: CFG_STATE.lim.includes("lnomer"),
    caps: (CFG.find((f) => f.k === "horiz").items.find((i) => i.v === CFG_STATE.horiz).cap),
  };
  if (P.sek) P.lokal = true;
  if (P.nodata) P.data = false;
  return P;
}
function buildPlan() {
  const P = prof();
  const want = new Set([...P.roles, ...CFG_STATE.form.map((x) => x)]);
  let picks = [...PICK].map((id) => SCEN.find((s) => s.id === id)).filter(Boolean);
  let manual = picks.length > 0;
  if (!manual) picks = matrixRows(P).map((r) => r.s).filter((s) => P.caps.includes(s.est)).slice(0, 6);
  else picks = picks.filter((s) => P.caps.includes(s.est));
  const steps = [...new Set([...(STEP_BY_STAGE[P.stage] || []), ...(P.people ? [] : ["teach"]), ...(P.data ? [] : ["data"]), ...(P.lokal ? ["infra"] : [])])]
    .map((id) => STEPS.find((s) => s.id === id)).filter(Boolean).sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b));
  const firstSteps = steps.slice(0, 3);
  const share = picks.reduce((s, x) => s + (TIME_EFFECT[x.id] || .08), 0);
  const freed = Math.round(P.hours * Math.min(share * .72, .52));
  const money = Math.round(freed * 2243);
  const riskList = [];
  if (!P.data) riskList.push("Нет подготовленных данных → начать с шага 02, не покупать модели под несуществующий датасет.");
  if (!P.people && !P.roles.includes("rukov")) riskList.push("Нет ответственных за автоматизацию в отделах → шаг 04 обязателен до пилотов.");
  if (P.distrust) riskList.push("Нет доверия инженеров → начать с безрисковых кейсов (поиск, тексты, сверка), а не с расчётов в РД.");
  if (manual && picks.length < 3) riskList.push(`Выбранных сценариев мало/не соответствует горизонту (${P.caps.join(", ")}) — вернитесь в матрицу.`);
  if (P.nocomp && !P.lokal) riskList.push("Нет вычислительных мощностей → только API-сценарии без проектных данных либо лёгкие RAG по инструкциям.");
  const needInfra = [];
  if (!P.lokal) needInfra.push("локальная LLM + RAG в закрытом контуре");
  if (!P.sod) needInfra.push("среда общих данных (CADLib / Pilot-ICE / Appius-PLM)");
  if (!P.xml) needInfra.push("XML-шаблон задания на проектирование (приказ № 10/128)");
  if (!P.data) needInfra.push("НСИ и регламент атрибутирования ЦИМ");
  if (!P.people) needInfra.push("приказ об ответственных за автоматизацию");
  return { P, picks, steps, firstSteps, freed, money, riskList, needInfra, manual };
}
function planHTML(pl) {
  const { P, picks, firstSteps, freed, money, riskList, needInfra } = pl;
  const roleNames = P.roles.map((v) => CFG[0].items.find((i) => i.v === v).l).join(", ") || "—";
  const art = cfgList();
  const limTxt = [CFG_STATE.lim.length ? CFG_STATE.lim.map((v) => CFG.find((f) => f.k === "lim").items.find((i) => i.v === v).l).join("; ") : "нет"].join();
  return `<div class="paper">
  <div class="p-tag">план внедрения ии · сформирован конфигуратором</div>
  <h3>${esc(roleNames)}</h3>
  <div class="p-grid">
    <div><b>Зрелость</b><span>${esc(CFG.find((f) => f.k === "stage").items.find((i) => i.v === P.stage).l)}</span></div>
    <div><b>Горизонт</b><span>${esc(CFG.find((f) => f.k === "horiz").items.find((i) => i.v === P.horiz).l)}</span></div>
    <div><b>Подразделение</b><span>${nf.format(P.team)} чел. · ${nf.format(P.hours)} ч/мес рутины</span></div>
    <div><b>Данные / контур</b><span>${P.data ? "данные готовы" : "данных нет"} · ${P.lokal ? "закрытый контур" : "внешний API"}</span></div>
  </div>

  <h4>Первые шаги (в этом порядке)</h4>
  <ol>${firstSteps.map((s) => `<li><b>шаг ${s.n} · ${esc(s.t)}</b> — ${esc(s.goal)}</li>`).join("")}</ol>

  <h4>Приоритетные ИИ-сценарии${pl.manual ? " (выбраны вручную)" : " (по баллам матрицы)"}</h4>
  <div class="kv">${picks.map((s) => `<span>${esc(s.n)} · ${esc(s.p)}</span><b>Э ${s.eff} / Р ${s.impl} · ${esc(s.est)}</b>`).join("")}</div>
  ${picks.length ? `<ul style="margin-top:8px">${picks.map((s) => `<li>${esc(s.d)} <i style="opacity:.65">— ${esc(s.src)}</i></li>`).join("")}</ul>` : "<p>Нет сценариев в выбранном горизонте — расширьте горизонт или снимите ограничения.</p>"}

  ${art("fart") ? `<h4>Артефакты, которые вы произведёте</h4><ul>${artifacts(pl).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}

  ${art("fmetr") ? `<h4>Метрики эффекта</h4>
  <div class="kv"><span>Высвобождается времени (оценка)</span><b>${nf.format(freed)} ч/мес</b>
  <span>В деньгах при 2 243 ₽/ч</span><b>≈ ${nf.format(money)} ₽/мес</b>
  <span>Годовой ориентир</span><b>≈ ${nf.format(money * 12)} ₽</b>
  <span>Что ещё считается</span><b>ручные касания · корректные блокировки · план=факт</b></div>
  <div class="warn">Оценка — арифметика от введённых вами часов и долей, подтверждённых в докладах; она не заменяет базовый замер «до» (форма Ф-2, Ф-5).</div>` : ""}

  ${art("fsec") ? `<h4>Требования ИБ и допущения</h4><ul>
    <li>Режим: ${P.lokal ? "только закрытый контур, локальные модели + RAG по своим данным" : "внешние API — без проектной документации и исходных данных"}</li>
    <li>Данные, используемые моделью: ${P.data ? "из СОД/ЦИМ с НСИ и версионированием" : "толькооткрытые / внутренние инструкции"}</li>
    <li>Объекты КИИ: доверенные ПАК (ПП РФ № 1912), отечественные ПАК до 2030 г., SIL-3/УПБ-3 в разделах АСУ ТП</li>
    <li>Журналирование обращений, фиксация версии модели и промпта, запрет автовыдачи в производство</li>
    <li>Машиночитаемость: задания на проектирование в XML (приказ Минстроя № 10/128, приёмка с 26.01.2026)</li></ul>` : ""}

  ${art("frisk") && riskList.length ? `<h4>Риски вашего сценария</h4><ul>${riskList.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}

  ${needInfra.length && art("froad") ? `<h4>Что закрыть до масштабирования</h4><ul>${needInfra.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}

  ${art("froad") ? `<h4>Квартальная разбивка</h4><ul>
    <li><b>Q1</b> — ${firstSteps.map((s) => s.n).join(", ")}: аудит, базовые замеры, ${P.lokal ? "контур" : "регламент доступа"}, обучение</li>
    <li><b>Q2</b> — ${picks.slice(0, 2).map((s) => esc(s.n)).join(" · ") || "пилоты"}; данные и НСИ; первая проверка ЦИМ</li>
    <li><b>Q3</b> — расчётные и генеративные сценарии при наличии данных (${P.data ? "готовы" : "упор в подготовку"})</li>
    <li><b>Q4</b> — реестр сценариев, 4 метрики в дашборде, тиражирование по отделам</li></ul>` : ""}

  <h4>Ограничения, которые вы указали</h4>
  <div class="warn">${esc(limTxt)}</div>
  <div class="sign"><span>основание: 83 материала VIII конференции · Гипровостокнефть · 08.2026</span><span>ИИ·ПРОЕКТ ред. 1.0</span></div>
  </div>`;
}
const FORM_LABEL = { "ТИМ/3D": "регламент проверки ЦИМ", "данные": "регламент НСИ", "расчёты": "методика приёмки ИИ-расчёта", "код": "регламент разработки" };
const cfgList = () => (k) => CFG_STATE.form.includes(k);
function artifacts(pl) {
  const P = pl.P, base = ["Ф-1 Паспорт ИИ-сценария", "Ф-2 Карточка пилота: 15–27 дней",
    "Ф-3 Чек-лист готовности данных", "Ф-4 Матрица допустимых операций",
    "Ф-5 Измерение эффекта (4 метрики)", "Ф-6 Дорожная карта по кварталам"];
  const extra = [...pl.picks.map((s) => s.tags).flat().map((t) => FORM_LABEL[t]),
    ...(P.xml ? [] : ["XML-шаблон задания на проектирование (приказ № 10/128)"]),
    ...(P.data ? [] : ["Регламент НСИ и справочник марок"]),
    ...(P.sod ? [] : ["Регламент среды общих данных (версии, полнота, коллизии)"]),
    ...(P.people ? [] : ["Приказ об ответственных за автоматизацию в подразделениях"])];
  return [...new Set([...base, ...extra.filter(Boolean)])].filter((x, i) => i < 12);
}
function renderCfg(silent) {
  const pl = buildPlan();
  $("#cfgOut").innerHTML = pl.picks.length || cfgAll() ? planHTML(pl) : `<div class="cfg-empty">Выберите профиль и нажмите «Собрать план»</div>`;
  if (!silent) toast("План собран");
}
function cfgAll() { return CFG_STATE.roles.length > 0; }

/* ---------------- каталог материалов ---------------- */
const CAT_TAGS = ["все", ...new Set(CAT.flatMap((c) => c.tg))];
let catTag = "все", catQ = "";
function renderCatalog() {
  const box = $("#catalog");
  box.insertAdjacentHTML("beforebegin", `<div class="cat-filter" id="catFilter"></div>`);
  $("#catFilter").innerHTML = CAT_TAGS.map((t) => `<button class="tag${t === catTag ? " on" : ""}" data-t="${esc(t)}">${esc(t)}</button>`).join("") +
    `<label class="mc-search" style="margin-left:auto">Поиск <input id="catSearch" type="search" value="${esc(catQ)}" placeholder="кейс, организация, цифра"></label>`;
  $("#catFilter").onclick = (e) => { const b = e.target.closest(".tag"); if (b) { catTag = b.dataset.t; renderCatalog(); } };
  $("#catSearch").oninput = (e) => { catQ = e.target.value; const p = e.target.selectionStart; renderCatalog(); };
  const items = CAT.filter((c) => (catTag === "все" || c.tg.includes(catTag)) &&
    (!catQ || (c.t + c.who + c.f + c.fx.join(" ") + c.use).toLowerCase().includes(catQ.toLowerCase())));
  $("#catalog").append("");
  const host = $("#catalog");
  host.querySelectorAll(".cards").forEach((x) => x.remove());
  const wrap = document.createElement("div"); wrap.className = "cards";
  wrap.innerHTML = items.map((c) => `
    <article class="card rv">
      <div class="who">${esc(c.who)} · ${esc(c.d)}</div>
      <h3>${esc(c.t)}</h3>
      <p>${esc(c.f)}</p>
      <div class="facts">${c.fx.map((f) => `<div><b>${esc(f[0])}</b><span>${esc(f[1])}</span></div>`).join("")}</div>
      <p style="margin-top:12px;font-size:.86em"><b>Зачем в инструкции:</b> ${esc(c.use)}</p>
      <div class="tags">${c.tg.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    </article>`).join("") || `<p class="cfg-empty">Ничего не найдено — сбросьте фильтр.</p>`;
  host.append(wrap);
  reveal(wrap);
}

/* ---------------- риски, формы ---------------- */
function renderRisks() {
  $("#risks").innerHTML = RISKS.map((r, i) => `
    <div class="risk rv"><h4>риск 0${i + 1}</h4><h3>${esc(r.h)}</h3><p>${esc(r.p)}</p>
      <p style="color:#e9ddc9"><b>Как снять:</b> ${esc(r.f)}</p>
      <div class="fix">подтверждено: ${esc(r.src)}</div></div>`).join("");
}
function renderForms() {
  $("#forms").innerHTML = FORMS.map((f, i) => `
    <div class="form-card rv"><header><span class="code">${esc(f.code)}</span><b>${esc(f.t)}</b></header>
      <pre class="doc">${esc(f.doc)}</pre>
      <footer><span class="for">${esc(f.for)}</span>
        <button class="btn btn-ghost" data-dl="${i}">Скачать .txt</button>
        <button class="btn btn-ghost" data-copy="${i}">Копировать</button></footer></div>`).join("");
  $("#forms").onclick = (e) => {
    const d = e.target.closest("[data-dl]"), c = e.target.closest("[data-copy]");
    if (d) {
      const f = FORMS[+d.dataset.dl], b = new Blob([f.code + " " + f.t + "\n\n" + f.doc], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = f.code + "_" + f.t.replace(/[^\w\dА-Яа-я -]/g, "") + ".txt"; a.click();
      URL.revokeObjectURL(a.href); toast("Скачано: " + f.code);
    }
    if (c) copy(FORMS[+c.dataset.copy].doc, "Форма скопирована");
  };
}

/* ---------------- экспорт плана ---------------- */
function planMarkdown() {
  const pl = buildPlan(), P = pl.P;
  const L = (t) => `- ${t}`;
  return `# План внедрения ИИ · ${P.roles.map((v) => CFG[0].items.find((i) => i.v === v).l).join(", ")}
> Сформирован сайтом «ИИ в проект» (ред. 1.0) на материалах VIII конференции «Комплексный инжиниринг в нефтегазодобыче», АО «Гипровостокнефть», 19–20 августа 2026 г.

| параметр | значение |
|---|---|
| Зрелость | ${CFG.find((f) => f.k === "stage").items.find((i) => i.v === P.stage).l} |
| Горизонт | ${CFG.find((f) => f.k === "horiz").items.find((i) => i.v === P.horiz).l} |
| Подразделение | ${P.team} чел., ${P.hours} ч/мес повторяемых операций |
| Данные | ${P.data ? "подготовлены" : "нет подготовленных данных"} |
| Контур | ${P.lokal ? "закрытый (локальные модели + RAG)" : "внешний API"} |

## 1. Первые шаги
${pl.firstSteps.map((s) => L(`**шаг ${s.n} — ${s.t}** (${s.dur}): ${s.goal}`)).join("\n")}

## 2. Приоритетные ИИ-сценарии
| сценарий | процесс | Э | Р | срок | источник |
|---|---|---|---|---|---|
${pl.picks.map((s) => `| ${s.n} | ${s.p} | ${s.eff} | ${s.impl} | ${s.est} | ${s.src} |`).join("\n")}

${pl.picks.map((s) => `### ${s.n}\n${s.d}\n${s.fx.map((f) => L(`${f[0]}: ${f[1]}`)).join("\n")}\n`).join("\n")}
## 3. Артефакты
${["Ф-1 Паспорт ИИ-сценария", "Ф-2 Карточка пилота (15–27 дней)", "Ф-3 Чек-лист готовности данных", "Ф-4 Матрица допустимых операций", "Ф-5 Измерение эффекта (4 метрики)", "Ф-6 Дорожная карта"].map(L).join("\n")}

## 4. Метрики
- высвобождается времени (оценка): **${nf.format(pl.freed)} ч/мес**
- в деньгах при 2 243 ₽/ч: **≈ ${nf.format(pl.money)} ₽/мес**, ≈ ${nf.format(pl.money * 12)} ₽/год
- плюс: ручные касания на цикл / корректные блокировки / совпадение плана с фактом
- обязательное условие: базовый замер «до» стартом пилота (Ф-2, Ф-5)

## 5. Требования ИБ и допущения
${[`режим: ${P.lokal ? "только закрытый контур, свои данные" : "внешние API без проектной документации"}`,
   "журналирование обращений; фиксация версии модели и промпта",
   "объекты КИИ: доверенные ПАК (ПП РФ № 1912), отечественные ПАК до 2030 г., SIL-3/УПБ-3 в АСУ ТП",
   "запрет автоматической выдачи в производство без проверки человеком",
   "задания на проектирование в XML: приказ Минстроя № 10/128, приёмка с 26.01.2026"].map(L).join("\n")}

## 6. Что закрыть до масштабирования
${pl.needInfra.map(L).join("\n") || "- всё необходимое уже есть"}

## 7. Риски вашего сценария
${pl.riskList.map(L).join("\n") || "- типовых блокировок не выявлено"}

## 8. Дорожная карта
- **Q1** — ${pl.firstSteps.map((s) => s.n).join(", ")}: аудит, базовые замеры, ${P.lokal ? "локальный контур" : "регламент доступа"}, обучение
- **Q2** — ${(pl.picks.slice(0, 2).map((s) => s.n).join(" · ")) || "пилоты"}; данные и НСИ; первая автоматическая проверка ЦИМ
- **Q3** — расчётные и генеративные сценарии ${P.data ? "на подготовленных данных" : "после подготовки данных"}
- **Q4** — реестр сценариев, 4 метрики в дашборде, тиражирование

---
*Источники — из текстов докладов конференции; прогнозные оценки помечены как заявленные докладчиками.*
`;
}

/* ---------------- утилиты ---------------- */
let tt;
function toast(msg) {
  let el = $(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.append(el); }
  el.textContent = msg; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 3600);
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg || "Скопировано"); }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = text; document.body.append(ta); ta.select();
    document.execCommand("copy"); ta.remove(); toast(msg || "Скопировано");
  }
}
function reveal(root = document) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
  $$(".rv", root).forEach((n) => io.observe(n));
}
function spy() {
  const links = $$(".topnav a");
  const map = links.map((a) => ({ a, s: $(a.getAttribute("href")) })).filter((x) => x.s);
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const l = map.find((m) => m.s === e.target); if (!l) return;
    if (e.isIntersecting) { links.forEach((k) => k.classList.remove("on")); l.a.classList.add("on"); }
  }), { rootMargin: "-45% 0px -50% 0px" });
  map.forEach((m) => io.observe(m.s));
}

/* ---------------- init ---------------- */
function init() {
  renderTicker(); renderStepper(); renderMatrix(); renderCfgForm(); renderCfg(true);
  renderCatalog(); renderRisks(); renderForms(); reveal(); spy();
  $("#cfgBuild").onclick = () => { renderCfg(); };
  $("#cfgReset").onclick = () => {
    localStorage.removeItem("ii-proekt-cfg"); localStorage.removeItem("ii-proekt-pick"); PICK.clear();
    Object.assign(CFG_STATE, { roles: ["oa"], stage: "s2", res: ["rsap"], lim: [], team: 35, hours: 640, horiz: "h6", form: ["froad", "fart", "fmetr"] });
    renderCfgForm(); renderCfg(); toast("Сброслено");
  };
  $("#cfgCopy").onclick = () => copy(planMarkdown(), "Markdown плана скопирован");
  $("#cfgPrint").onclick = () => { window.print(); };
  $("#printBtn").onclick = () => window.print();
  $("#matSearch").oninput = (e) => { MATRIX_STATE.q = e.target.value; renderMatrix(); };
  $("#matSort").onchange = (e) => { MATRIX_STATE.sort = e.target.value; renderMatrix(); };
  $("#menuBtn").onclick = () => $("#topnav").classList.toggle("open");
  $$("#topnav a").forEach((a) => a.addEventListener("click", () => $("#topnav").classList.remove("open")));
  const dl = document.createElement("button");
  dl.className = "btn btn-ghost"; dl.textContent = "Скачать план (.md)";
  dl.onclick = () => {
    const b = new Blob([planMarkdown()], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "План_внедрения_ИИ.md"; a.click();
    URL.revokeObjectURL(a.href); toast("Файл сохранён");
  };
  $(".cfg-actions").append(dl);
}
document.addEventListener("DOMContentLoaded", init);
