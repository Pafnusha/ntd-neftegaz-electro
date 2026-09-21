/* =====================================================================
   UI CORE — состояние, home, схема, форма линии, ведомость, замечания, SVG
   Вспомогательные вкладки: ui2.js (быстрый расчёт+каталог),
   ui3.js (ΔU и потери Методики), ui4.js (отчёт, НТД, инструкция, тесты)
   ===================================================================== */
const App = {
  state:null, selId:null, resMap:{}, settings:null, qLine:null, catalogSel:null,
  LS_PROJ:"cbel.projects", LS_CUR:"cbel.current", LS_SET:"cbel.settings",

  /* ================= helpers ================= */
  $(s,el){ return (el||document).querySelector(s); },
  $$(s,el){ return Array.from((el||document).querySelectorAll(s)); },
  el(tag,attrs,kids){ const e=document.createElement(tag);
    for(const k in attrs||{}){ const v=attrs[k];
      if(k==="class")e.className=v; else if(k==="html")e.innerHTML=v;
      else if(k.startsWith("on")&&typeof v==="function")e.addEventListener(k.slice(2),v);
      else if(v!==null&&v!==undefined&&v!==false)e.setAttribute(k,v); }
    if(kids!=null&&!Array.isArray(kids))kids=[kids];
    (kids||[]).forEach(k=>{ if(k!=null)e.append(typeof k==="string"||typeof k==="number"?document.createTextNode(String(k)):k); }); return e; },
  toast(msg,cls){ const t=this.el("div",{class:"toast "+(cls||"")},[msg]); this.$("#toasts").append(t); setTimeout(()=>t.remove(),4500); },
  fmt(x,d){ if(x==null||isNaN(x))return "—"; const p=d==null?1:d; return (+x).toLocaleString("ru-RU",{minimumFractionDigits:0,maximumFractionDigits:p}); },
  uid(){ return "n"+Math.random().toString(36).slice(2,8); },
  tag(t){ return ["src","tr","zru","load"][t]?{src:"🌀",tr:"◎",zru:"▧",load:"⚙"}[t]:"▫"; },

  /* ================= дефолты ================= */
  defSettings(){ return {
    standard:"yamal", thetaJob:90, kTempMode:"formula",
    Tair:30, Tsoil:15, rho:1.2, groupMode:"yamal",
    kHazard:1.0, kAdditional:1.0, minS_cu:1.5, minS_al:2.5,
    du04:5, du10:10, mtzType:"cbNonAdj",
    TmaxHours:5000, tCalcHours:8760, theme:"light" };},
  defLine(over){ const l={ kind:"kl", vclass:"0.4", method:"earth_trench", src:"auto", mat:"cu", ph:"3",
      cores:4, P:"", Ks:1, cos:0.8, L:100, allowedPct:5, duAuto:true,
      nParallel:1, gap:100, groupMode:null, grpSet:"single", arrangement:"trefoil",
      tAir:null, tSoil:null, protect:{type:null,ust:null}, sc:{Ik:null,t:0.5},
      motor:null, withNeutral:false, thetaJob:null, kTempMode:null, nPerPhase:null, notes:"" };
    return Object.assign(l,over||{}); },
  newProject(){ return { name:"Новый проект", created:Date.now(), nodes:[
    {id:"root",par:null,type:"src",label:"ГСП / ЦП 10 кВ", data:{Isc:20,tb:0.1},line:null},
    {id:"n1",par:"root",type:"tr",label:"ТР‑1 · 1000 кВА", data:{S:1000,uk:5.5,Pk:12,Pxx:1.8},line:this.defLine({vclass:"10",method:"air_ladder",grpSet:"hv",cores:3,src:"SN3x",protect:{type:"cbNonAdj",ust:300},sc:{Ik:25,t:0.5},L:80})},
    {id:"n2",par:"n1",type:"zru",label:"ЗРУ‑0,4 «Насосная»", data:{},line:this.defLine({vclass:"0.4",method:"air_pipe",cores:4,src:"YAMAL-LV",L:25,allowedPct:2,duAuto:false,protect:{type:null,ust:null}})},
    {id:"n3",par:"n2",type:"load",label:"Насосы 3×55 кВт (К1)", data:{P:160,cos:0.82,ph:"3"},line:this.defLine({vclass:"0.4",method:"earth_trench",mat:"cu",cores:4,src:"auto",L:180,allowedPct:3,duAuto:false,nParallel:1,gap:100,protect:{type:"cbNonAdj",ust:500},sc:{Ik:14,t:0.1}})}
  ]};},
  templates(){ const self=this; const mk=(name,fn)=>{const p=fn();p.name=name;p.created=Date.now();return p;};
    return [
      mk("Узел 10 кВ (промплощадка, стиль Ямал СПГ)",function(){ const P=self.newProject();
        P.nodes=P.nodes.concat([
          {id:"m1",par:"root",type:"load",label:"Двигатель 630 кВт/10 кВ",data:{P:630,cos:0.85,ph:"3",motor:true},line:self.defLine({vclass:"10",method:"air_ladder",src:"SN3x",grpSet:"hv",L:120,allowedPct:2,duAuto:false,protect:{type:"cbAdjTrip",ust:46},sc:{Ik:25,t:0.2}})},
          {id:"b1",par:"n1",type:"zru",label:"ЩСУ‑0,4 (модуль)",data:{},line:self.defLine({vclass:"0.4",method:"air_pipe",src:"YAMAL-LV",L:20})},
          {id:"l1",par:"b1",type:"load",label:"Насос 45 кВт (зоны В-I)",data:{P:45,cos:0.84,ph:"3",motor:true},line:self.defLine({vclass:"0.4",method:"air_ladder",nParallel:9,grpMode:"yamal",grpSet:"tight",allowedPct:5,duAuto:false,protect:{type:"fusePVC",ust:160},motor:{branch:true}})}
        ]);return P;}),
      mk("Городская сеть 10/0,4 (потери по Методике)",function(){ const P=self.newProject();
        P.nodes=[
          {id:"root",par:null,type:"src",label:"ЦП 10 кВ",data:{Isc:12.5},line:null},
          {id:"f1",par:"root",type:"tr",label:"ТР‑1 · ТП№1",data:{S:630,uk:5.5,Pk:7.6,Pxx:1.2},line:self.defLine({vclass:"10",method:"earth_trench",src:"SN3x",L:600,nParallel:2,gap:200,allowedPct:7,cos:0.9})},
          {id:"c1",par:"f1",type:"load",label:"Нагрузка ТП№1",data:{P:180,cos:0.92,ph:"3",Ia:260,Ib:250,Ic:235},line:self.defLine({vclass:"0.4",method:"air_pipe",src:"GTP-PUYE",L:120,allowedPct:5,cos:0.92})},
          {id:"f2",par:"root",type:"tr",label:"ТР‑2 · ТП№2",data:{S:400,uk:5.5,Pk:5.5,Pxx:0.9},line:self.defLine({vclass:"10",method:"earth_trench",src:"GTP-PUYE",L:900,allowedPct:7,cos:0.9})},
          {id:"c2",par:"f2",type:"load",label:"Нагрузка ТП№2",data:{P:110,cos:0.9,ph:"3"},line:self.defLine({vclass:"0.4",method:"earth_trench",src:"GTP-PUYE",L:250,allowedPct:5,duAuto:false,cos:0.9})}
        ];return P;}),
      mk("ВЛ‑10 + СИП‑4 (воздушные линии)",function(){ const P=self.newProject();
        P.nodes=[
          {id:"root",par:null,type:"src",label:"РП 10 кВ",data:{Isc:10},line:null},
          {id:"v1",par:"root",type:"zru",label:"ОПУ‑10 (порт. ВЛ)",data:{},line:self.defLine({vclass:"10",kind:"vl",src:"VL-AC",method:"air_open",cores:3,L:2300,allowedPct:10,cos:0.85,duAuto:false})},
          {id:"t1",par:"v1",type:"tr",label:"ТР КТП 10/0,4 · 250 кВА",data:{S:250,uk:5.5,Pk:4,Pxx:0.7},line:self.defLine({vclass:"10",kind:"vl",src:"VL-AC",method:"air_open",cores:3,L:500,duAuto:false})},
          {id:"u1",par:"t1",type:"load",label:"Потребители (СИП‑4)",data:{P:120,cos:0.88,ph:"3"},line:self.defLine({vclass:"0.4",kind:"vl",src:"VL-SIP",method:"air_open",cores:4,L:400,allowedPct:5,duAuto:false})}
        ];return P;})
    ];},

  /* ---------- быстрая выгрузка Word ---------- */
  bindWordButtons(){ const self=this; const f=id=>{const b=self.$("#"+id); if(b)b.onclick=()=>self.quickWord();}; f("btnWordHome"); f("btnWordScheme"); },
  quickWord(){ try{
      if(!this.rep){ this.rep={org:{value:"Расчётная организация"},obj:{value:this.state.name||"Проект"},base:{value:"Ямал СПГ 3300-E-000-EL-PHI-00009-00-D; ПУЭ; ГОСТ 31996/32144; каталоги NED-Plagum"}}; }
      if(!this.optOn) this.optOn=()=>true;
      const html=this.buildDoc(true);
      this.download((this.rep.obj.value||"raschet").replace(/[\\/:*?"<>|]+/g,"_")+"-otchet.doc",html,"application/msword");
      this.toast("Word-отчёт выгружен","ok");
    }catch(e){ this.toast("Не удалось сформировать отчёт: "+e.message,"err"); } },
  /* ================= persistence ================= */
  save(){ try{ localStorage.setItem(this.LS_CUR,JSON.stringify(this.state));
      const all=JSON.parse(localStorage.getItem(this.LS_PROJ)||"{}"); all[this.state.name]=this.state;
      localStorage.setItem(this.LS_PROJ,JSON.stringify(all));
      localStorage.setItem(this.LS_SET,JSON.stringify(this.settings));
      this.$("#autosaveState").textContent="💾 "+new Date().toLocaleTimeString("ru-RU"); }catch(e){} },
  store(){ try{ return JSON.parse(localStorage.getItem(this.LS_PROJ)||"{}"); }catch(e){ return {}; } },

  /* ================= init ================= */
  init(){
    this.settings=Object.assign(this.defSettings(),(()=>{try{return JSON.parse(localStorage.getItem(this.LS_SET)||"{}");}catch(e){return {};}})());
    try{ const s=JSON.parse(localStorage.getItem(this.LS_CUR)); if(s&&s.nodes&&s.nodes.length)this.state=s; }catch(e){}
    if(!this.state)this.state=this.newProject();
    this.$$(".tab").forEach(b=>b.addEventListener("click",()=>{ const t=b.dataset.tab.trim();
      this.$$(".tab").forEach(x=>x.classList.toggle("active",x===b));
      this.$$(".page").forEach(p=>p.classList.remove("active"));
      const pg=this.$("#page-"+t); if(pg)pg.classList.add("active"); this.onTab(t); }));
    this.$$("[data-goto]").forEach(b=>b.addEventListener("click",()=>{ this.$$(".tab").forEach(x=>{ if(x.dataset.tab.trim()===b.dataset.goto)x.click(); }); }));
    this.$("#btnTheme").onclick=()=>{ document.body.classList.toggle("dark"); this.settings.theme=document.body.classList.contains("dark")?"dark":"light"; this.save(); };
    if(this.settings.theme==="dark")document.body.classList.add("dark");
    this.renderTemplates(); this.renderProjectList(); this.renderSettings();
    this.bindHome(); this.bindScheme(); this.bindWordButtons();
    this.qLine=this.defLine({vclass:"0.4",method:"earth_trench",P:160,cos:0.8,L:180,src:"auto",
      allowedPct:3, duAuto:false, nParallel:1,gap:100, protect:{type:"cbNonAdj",ust:500}, sc:{Ik:22,t:0.5}});
    this.bindQuick(); this.renderQuickForm();
    this.bindCatalog(); this.renderCatalog();
    this.bindUDrop(); this.renderUDropForm();
    this.bindMTD(); this.renderMTDForm();
    this.bindNTD(); this.bindHelp(); this.bindReport(); this.bindTests();
    this.recalc(true);
  },
  onTab(t){ if(t==="report")this.renderReportPreview(); if(t==="udrop"){this.renderUdrop();this.renderUdropScheme();} if(t==="lossesTab")this.renderMTDForm(); },
  renderAll(){ this.recalc(); },

  /* ================= HOME ================= */
  bindHome(){ const imp=this.$("#fileImportProject");
    this.$("#btnImportProject").onclick=()=>imp.click();
    imp.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const rd=new FileReader();
      rd.onload=()=>{ try{ this.state=JSON.parse(rd.result); if(!this.state.nodes)this.state=this.newProject();
        this.selId=null; this.save(); this.renderAll(); this.$(".tab[data-tab=scheme]").click(); this.toast("Проект загружен","ok"); }
        catch(x){ this.toast("Ошибка чтения файла: "+x,"err"); } };
      rd.readAsText(f); }; },
  renderTemplates(){ const box=this.$("#templateList"); if(!box)return; box.innerHTML="";
    this.templates().forEach(t=>box.append(this.el("div",{style:"margin:5px 0"},[this.el("button",{class:"btn btn-sm",onclick:()=>{ this.state=t; this.selId=null; this.renderAll(); this.$(".tab[data-tab=scheme]").click(); this.save(); }},["📋 "+t.name])]))); },
  renderProjectList(){ const box=this.$("#projectList"); if(!box)return; box.innerHTML=""; const all=this.store();
    const names=Object.keys(all).sort(); if(!names.length){ box.append(this.el("span",{class:"muted"},"нет сохранённых проектов")); return; }
    names.forEach(n=>box.append(this.el("div",{style:"display:flex;gap:6px;align-items:center;padding:3px 0;border-bottom:1px dashed var(--line)"},[
      this.el("span",{style:"flex:1"},[n+" · "+(all[n].nodes||[]).length+" эл."]),
      this.el("button",{class:"btn btn-sm",onclick:()=>{this.state=all[n];this.selId=null;this.renderAll();this.$(".tab[data-tab=scheme]").click();}},"Открыть"),
      this.el("button",{class:"btn btn-sm btn-ghost",title:"скачать",onclick:()=>this.download(n.replace(/\W+/g,"_")+".json",JSON.stringify(all[n],null,1),"application/json")},"⬇"),
      this.el("button",{class:"btn btn-sm btn-ghost",onclick:()=>{const a=this.store();delete a[n];localStorage.setItem(this.LS_PROJ,JSON.stringify(a));this.renderProjectList();}},"✕")
    ]))); },
  renderSettings(){ const s=this.settings,box=this.$("#settingsForm"); if(!box)return; box.innerHTML="";
    const fld=(lab,key,type,opts,min,max)=>{ let inp;
      const set=(v)=>{ this.settings[key]=isNaN(+v)||String(v).match(/[^\d.\-]/)?v:+v; this.save(); this.recalc(); };
      if(type==="select") inp=this.el("select",{onchange:e=>set(e.target.value)},opts.map(o=>this.el("option",{value:o[0],...(String(this.settings[key])===o[0]?{selected:""}:{})},[o[1]])));
      else inp=this.el("input",{type:"number",min:min,max:max,step:"any",value:this.settings[key],onchange:e=>set(e.target.value)});
      return this.el("label",{class:"f"},[this.el("b",{},[lab]),inp]); };
    box.append(this.el("div",{class:"formgrid"},[
      fld("Метод коэфф-тов (ДДТ)","standard","select",[["yamal","Ямал/IEC (√-формула, базы 30/20°C)"],["pue","ПУЭ (табл. 1.3.3)"]]),
      fld("θ допустимая жилы, °С","thetaJob","number",null,40,130),
      fld("T воздуха, °С","Tair","number",null,-50,60),
      fld("T грунта, °С","Tsoil","number",null,-10,40),
      fld("ρ грунта, К·м/Вт","rho","number",null,0.4,4),
      fld("kHA доп. (опасная зона и пр.)","kHazard","number",null,0.5,1.2),
      fld("Доп. коэф-т пользователя","kAdditional","number",null,0.5,2),
      fld("Мин. сечение Cu, мм²","minS_cu","number",null,0.5,16),
      fld("Мин. сечение Al, мм²","minS_al","number",null,1,16),
      fld("ПДУ 0,4 кВ, %","du04","number",null,0.5,20),
      fld("ПДУ 6–35 кВ, %","du10","number",null,0.5,20),
      fld("T часов макс. нагрузки, ч","TmaxHours","number",null,100,8760),
      fld("t расчётного периода, ч","tCalcHours","number",null,100,8760)
    ])); },

  /* ================= SCHEME ================= */
  bindScheme(){ const self=this;
    const mk=(type,lbl,vclass)=>()=>{ const par=self.selId?self.selId:(self.state.nodes.find(n=>!n.par)||{}).id;
      const nid=self.uid(); const nv=vclass||(self.isTr(self.byId(par))||self.byId(par).type==="load"?"0.4":"10");
      const node={id:nid,par,type,data:type==="tr"?{S:630,uk:5.5,Pk:8,Pxx:1.1}:type==="load"?{P:100,cos:0.8,ph:"3"}:{},
        line:self.defLine({vclass:nv,duAuto:nv==="10"?!self.settings:false,allowedPct:nv==="10"?self.settings.du10:self.settings.du04})};
      if(type==="src")node.line=null;
      self.state.nodes.push(node); self.selId=nid; self.save(); self.recalc(); };
    this.$("#btnAddGSP").onclick=mk("src","ГСП / ЦП","10");
    this.$("#btnAddTRS").onclick=mk("tr","ТР (ТП 10/0,4)","10");
    this.$("#btnAddZRU").onclick=mk("zru","ЗРУ/ЩР","0.4");
    this.$("#btnAddLoad").onclick=mk("load","Потребитель","0.4");
    this.$("#btnRecalc").onclick=()=>{ self.recalc(); this.toast("Пересчёт выполнен","ok"); }; },
  isTr(n){ return n&&n.type==="tr"; },
  byId(id){ return this.state.nodes.find(n=>n.id===id); },
  children(id){ return this.state.nodes.filter(n=>n.par===id); },
  lineOf(n){ return n&&n.line; },
  voltU(line){ return line.vclass==="0.4"?0.4:Number(line.vclass)||0.4; },
  subtreeLoad(id){ const self=this; let P=0,Q=0;
    (function walk(x){ const n=self.byId(x);
      if(n&&n.type==="load"){ const p=+n.data.P||0; const c=Math.min(1,Math.max(0.2,+n.data.cos||0.8));
        P+=p; Q+=p*Math.tan(Math.acos(c)); }
      self.children(x).forEach(k=>walk(k.id)); })(id);
    return {P,Q}; },
  effLoad(n){ const line=this.lineOf(n); if(!line)return null;
    const own=n.type==="load"?{P:+n.data.P||0,Q:(+n.data.P||0)*Math.tan(Math.acos(Math.min(1,+n.data.cos||0.8)))}:this.subtreeLoad(n.id);
    const manual=line.P!==""&&line.P!=null; let P=manual?+line.P:own.P, Q=manual?(+line.Q!=null?+line.Q:P*Math.tan(Math.acos(+line.cos||0.8))):own.Q;
    const cos=manual?(+line.cos||0.8):(n.type==="load"&&n.data.cos!=null?+n.data.cos:(own.P?own.P/Math.max(1e-6,Math.sqrt(own.P*own.P+own.Q*own.Q)):0.8));
    const S=Math.sqrt(P*P+Q*Q);
    const U=this.voltU(line), ph=line.ph||"3";
    let I=Eng.current(P,cos||0.8,U,ph,line.Ks||1);
    if(n.type==="tr"&&line.useTrNom) { I=line.vclass==="0.4"?0:I; I=Eng.current(n.data.S*0.95,cos||0.9,U,ph,1); P=n.data.S*0.95*(cos||0.9); }
    if(line.Ifix) I=+line.Ifix;
    return {P,Q,S,cos:cos||0.8,U,I,manual}; },
  lineCalc(n){ const line=this.lineOf(n); if(!line)return null; const e=this.effLoad(n)||{P:0,cos:.8,U:line.vclass==="0.4"?0.4:10,I:0};
    const L=Object.assign({},line,{P:e.P,cos:e.cos,vU:e.U,L:+line.L||0,sc:line.sc||{Ik:null,t:.5},Ifix:line.Ifix?+line.Ifix:null});
    if(!L.tAir&&L.tAir!==0)L.tAir=this.settings.Tair; if(!L.tSoil&&L.tSoil!==0)L.tSoil=this.settings.Tsoil;
    if(L.duAuto){ L.allowedPct=L.vclass==="0.4"?this.settings.du04:this.settings.du10; }
    return {line:L,res:Eng.selectLine(L,this.settings)}; },
  reccalc(){ /* noop alias */ },
  recalc(silent){ const self=this; this.resMap={}; this.state.nodes.forEach(n=>{ if(n.line){ try{ self.resMap[n.id]=self.lineCalc(n); }catch(e){ self.resMap[n.id]={error:e.message}; } } });
    this.renderTree(); this.renderSummary(); this.renderScheme(); this.renderRemarks(); this.renderLineForm();
    this.renderUdropScheme&&this.renderUdropScheme(); if(!silent)this.save(); },

  renderTree(){ const self=this,box=this.$("#nodeTree"); if(!box)return; box.innerHTML="";
    (function row(n,d){ if(!n)return; const r=self.resMap[n.id]; let badge="";
      if(n.line){ if(r&&r.error)badge=`<span class="tag bad">✕</span>`;
        else if(r&&r.res&&!r.res.best)badge=`<span class="tag bad">✕ нет сечения</span>`;
        else if(r&&r.res&&r.res.best)badge=`<span class="tag ok">✓ ${r.res.best.s} мм²</span>`; }
      const sub=self.subtreeLoad(n.id);
      box.append(self.el("div",{class:"tree-line"+(self.selId===n.id?" sel":"")+(d===1?" child":d>1?" child2":""),onclick:()=>{self.selId=n.id;self.renderTree();self.renderLineForm();}},[
        self.el("span",{class:"grow",html:"<b>"+self.tag(n.type)+" "+self.esc2(n.label)+"</b> <span class='muted'>"+(n.line?(n.line.kind==="vl"?"ВЛ ":"КЛ ")+n.line.vclass+" кВ":"источник")+"</span>"}),
        self.el("span",{class:"muted",html:`ΣP≈${self.fmt(sub.P,0)} кВт`}),
        self.el("span",{html:badge}),
        n.par?self.el("button",{class:"btn btn-sm",onclick:e=>{e.stopPropagation();
          const del=id=>{const kids=self.children(id);self.state.nodes=self.state.nodes.filter(x=>x.id!==id);kids.forEach(k=>del(k.id));};
          del(n.id); self.selId=null; self.save(); self.recalc(); }},"✕"):null
      ]));
      self.children(n.id).forEach(c=>row(c,d+1)); })(self.state.nodes.find(n=>!n.par),0); },

  renderSummary(){ const t=this.$("#lineSummaryTable"); if(!t)return;
    t.innerHTML=""; t.append(this.el("tr",{html:"<th>Участок (от → до)</th><th>Линия</th><th>Ф</th><th>P расч.</th><th>Iр, А</th><th>Кабель (марка, сечение)</th><th>Iдоп.ф</th><th>ΔU, %</th><th>Итог</th>"}));
    const self=this;
    this.state.nodes.forEach(n=>{ const r=this.resMap[n.id]; if(!n.line||!r)return; const par=this.byId(n.par); const row=this.el("tr",{class:"rowclick"});
      row.onclick=()=>{self.selId=n.id;self.renderTree();self.renderLineForm();self.$(".tab[data-tab=scheme]").forEach&&0;};
      const b=r.res&&r.res.best; const st=b?(b.checks.dU&&!b.checks.dU.ok?"⚠ ΔU":(["mtz","sc","start"].some(k=>b.checks[k]&&!b.checks[k].ok)?"⚠":"✓")):(r.res?"✕":"?");
      row.innerHTML=`<td><b>${par?par.label:"—"}</b> → ${n.label}</td><td>${n.line.kind==="vl"?"ВЛ":"КЛ"} ${n.line.vclass} кВ</td><td>${n.line.ph==="1"?"1ф":"3ф"}</td><td class="num">${self.fmt(r.res? (r.res.IrA? (r.line.P!=null&&r.line.P!==""?+r.line.P:(self.effLoad(n).P)):0):0,0)} кВт</td><td class="num">${self.fmt(r.res&&r.res.IrA,0)}</td><td>${b?self.markOf(n.line,b):"—"}</td><td class="num">${b?self.fmt(b.Idp,0)+" А":"—"}</td><td class="num">${b&&b.dU?self.fmt(b.dU.pct,2):"—"}</td><td>${st}</td>`;
      t.append(row); }); },
  markOf(line,b){ const nm=this.srcName(line); return `${nm} ${line.cores}×${b.s}${line.mat==="al"?" (Al)":""}`; },
  srcName(line){ const m={SN3x:line.mat==="al"?"А-NED-Plagum":"NED-Plagum SN 3×",SN1xf:"NED-Plagum SN 1× плоск.",SN1x:"NED-Plagum SN 1× тр.",
    "YAMAL-LV":"NED-Plagum 0,66/1 (IEC/Ямал)","YAMAL-HV":"NED XLPE (Ямал)",
    "GTP-PUYE":line.mat==="al"?"А-NED-Plagum (ГТП ПУЭ)":"NED-Plagum (ГТП ПУЭ)","VL-AC":"АС (ВЛ, ПУЭ 1.3.29)","VL-SIP":"СИП‑4"};
    return (m[line.src]||"кабель"); },

  renderRemarks(){ const box=this.$("#remarksBox"); if(!box)return; let html="";
    this.state.nodes.forEach(n=>{ const r=this.resMap[n.id]; if(!n.line||!r){return;}
      if(r.error){ html+=`<div class="remark bad">✕ ${n.label}: ${this.esc(r.error)}</div>`; return; }
      const res=r.res;
      if(!res.best){ html+=`<div class="remark bad">✕ <b>${n.label}</b>: ни одно сечение не удовлетворяет критериям (см. ведомость). Проверьте Iр, уставки защит и допустимые ΔU.</div>`; return; }
      const c=res.best.checks; const nm=this.markOf(n.line,res.best);
      let warn=""; 
      if(c.mtz&&!c.mtz.ok)warn+=`· МТЗ: ${this.esc((c.mtz&&c.mtz.txt)||"—")} `;
      if(c.dU&&!c.dU.ok)warn+=`· ΔU=${this.fmt(res.best.dU.pct,2)}% > ${n.line.allowedPct}% `;
      if(c.sc&&!c.sc.ok)warn+=`· ${this.esc(c.sc.txt)} `;
      if(c.start&&!c.start.ok)warn+=`· ${this.esc(c.start.txt)} `;
      if(c.minS&&!c.minS.ok)warn+=`· ${this.esc(c.minS.txt)} `;
      if(warn) html+=`<div class="remark warn">⚠ <b>${n.label}</b> (${nm}): ${warn}</div>`; 
      else html+=`<div class="remark ok">✓ <b>${n.label}</b> — ${nm}: ДДТ ${this.fmt(res.best.Idp,0)} А ≥ ${this.fmt(res.Kneed,0)} А; ΔU ${this.fmt(res.best.dU.pct,2)}%${res.best.checks.mtz?"; Iуст/Iдопф="+this.fmt(res.best.checks.mtz.val*100,0)+"%":""}</div>`;
    });
    box.innerHTML=html||'<div class="remark ok">Нет расчётных линий.</div>'; },
  esc(x){ return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); },

  /* ---------- SVG схема (autolayout) + PNG ---------- */
  renderScheme(){ const host=this.$("#schemeCanvas"); if(!host)return; host.innerHTML="";
    const self=this; const nodes=this.state.nodes; if(!nodes.length){host.innerHTML='<span class="muted">нет объектов</span>';return;}
    const pos={}; let row=0;
    (function place(id,dep){ const n=self.byId(id); const kids=self.children(id);
      if(!kids.length){ pos[id]={x:dep*250+16,y:row*126+18}; row++; return; }
      kids.forEach(k=>place(k.id,dep+1));
      const ys2=kids.map(k=>pos[k.id].y); pos[id]={x:dep*250+16,y:(ys2[0]+ys2[ys2.length-1])/2}; })(nodes.find(n=>!n.par||n.par===null).id,0);
    const W=Math.max.apply(null,Object.values(pos).map(p=>p.x))+280, H=row*126+70;
    let s=`<svg id="schemeSVG" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI,Arial" font-size="11"><style>text{fill:#0c2233}.lbl{font-weight:600}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`;
    nodes.forEach(n=>{ if(!n.par)return; const a=self.byId(n.par); const b=self.byId(n.id); if(!pos[a.id]||!pos[b.id])return;
      const r=self.resMap[b.id]; const line=b.line; const ok=r&&r.res&&r.res.best; const bad=r&&!ok;
      const x1=pos[a.id].x+104,y1=pos[a.id].y+30, x2=pos[b.id].x+104,y2=pos[b.id].y+30;
      const col=bad?"#b41f1f":(ok?"#0c6e8f":"#888");
      s+=`<path d="M${x1},${y1} L${x1},${y2-42} L${x2},${y2-42}" fill="none" stroke="${col}" stroke-width="1.6"/>`;
      s+=`<line x1="${x2}" y1="${y2-42}" x2="${x2}" y2="${y2-26}" stroke="${col}" stroke-width="1.6" ${line&&line.kind==="vl"?'stroke-dasharray="6 3"':""}/>`;
      if(line){ const t1=`${line.kind==="vl"?"ВЛ":"КЛ"}-${line.vclass}кВ`; const t2=ok?`${self.esc2(self.markOf(line,r.res.best))} · ${line.L} м · ΔU${self.fmt(r.res.best.dU.pct,1)}%`:(r&&r.res&&!r.res.best?"не выбрано":"");
        s+=`<text x="${x1+8}" y="${(y1+y2)/2-2}" fill="${col}" font-weight="700">${t1}</text>`;
        s+=`<text x="${x1+8}" y="${(y1+y2)/2+12}" fill="${col}">${self.esc2(t2)}</text>`; } });
    nodes.forEach(n=>{ const p=pos[n.id]; const fill={src:"#e7f3f8",tr:"#fff4dc",zru:"#eef7ee",load:"#f3eafe"}[n.type]||"#fff";
      s+=`<g><rect x="${p.x}" y="${p.y}" width="208" height="56" rx="8" fill="${fill}" stroke="#456" stroke-width="1.1"/>`;
      s+=`<text class="lbl" x="${p.x+9}" y="${p.y+17}">${self.esc2(n.label)}</text>`;
      s+=`<text x="${p.x+9}" y="${p.y+31}" font-size="10" fill="#345">${{src:"источник",tr:"трансформатор",zru:"распр. устройство",load:"потребитель"}[n.type]}</text>`;
      const extra=n.type==="load"?`P=${self.fmt(n.data.P,0)} кВт cosφ ${n.data.cos}`:n.type==="tr"?`S=${n.data.S} кВА uк=${n.data.uk}%`:"";
      s+=`<text x="${p.x+9}" y="${p.y+46}" font-size="10" fill="#345">${self.esc2(extra)}</text>`;
      if(n.type==="tr"){ s+=`<circle cx="${p.x+196}" cy="${p.y+12}" r="7" fill="none" stroke="#456"/><circle cx="${p.x+196}" cy="${p.y+22}" r="7" fill="none" stroke="#456"/>`; }
      s+=`</g>`; });
    s+="</svg>"; host.innerHTML=s; },
  esc2(x){ return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); },

  /* ---------- форма линии ---------- */
  renderLineForm(){ const host=this.$("#lineForm"); if(!host)return; host.innerHTML="";
    const self=this, n=this.byId(this.selId);
    if(!n){ host.append(this.el("span",{class:"muted"},"Выберите элемент схемы (клик по дереву).")); return; }
    const hdr=this.el("div",{style:"display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px"},[
      this.el("b",{},["Элемент: "+n.label]),
      this.el("button",{class:"btn btn-sm",onclick:()=>{const v=prompt("Новое имя:",n.label); if(v){n.label=v; self.recalc();}}},"✎ переименовать"),
      n.par? this.el("button",{class:"btn btn-sm btn-danger",onclick:()=>{const del=id=>{const k=self.children(id);self.state.nodes=self.state.nodes.filter(x=>x.id!==id);k.forEach(x=>del(x.id));};del(n.id);self.selId=null;self.save();self.recalc();}},"✕ удалить"):null]);
    host.append(hdr);
    if(!n.line){ host.append(this.el("div",{class:"remark info"},"Источник/шина — линия не рассчитывается (выбор элемента ниже по иерархии).")); return; }
    const L=n.line;
    host.append(this.el("h3",{},["Параметры линии ("+(L.kind==="vl"?"ВЛ":"КЛ")+" "+L.vclass+" кВ)"]));
    const grid=host.append2?null:this.el("div",{class:"formgrid"}); host.append(grid);
    const F=(input,label)=>{grid.append(this.el("label",{class:"f"},[this.el("b",{},[label]),input]));};
    const KEEP={vclass:1,ph:1,method:1,src:1,kind:1,mat:1,grpMode:1,grpSet:1,arrangement:1};
    const S=(label,key,opts)=>{const s=this.el("select",{onchange:ev=>{const v=ev.target.value;L[key]=KEEP[key]?v:(v!==""&&!isNaN(+v)?+v:v); self.recalc();}});
      opts.forEach(o=>s.append(this.el("option",{value:String(o[0]),...(String(L[key])===String(o[0])?{selected:""}:{})},[o[1]]))); F(s,label);};
    const N=(label,key,extra)=>{const inp=this.el("input",{type:"number",step:"any",value:(L[key]===""||L[key]==null)?"":L[key],...(extra||{})});
      inp.onchange=ev=>{L[key]=ev.target.value===""?"":+ev.target.value; self.recalc();}; F(inp,label);};
    S("Класс напряжения","vclass",[["0.4","0,4 кВ"],["6","6 кВ"],["10","10 кВ"],["20","20 кВ"],["35","35 кВ"]]);
    S("Тип линии","kind",[["kl","КЛ — кабельная"],["vl","ВЛ — воздушная"]]);
    S("Фазность","ph",[["3","3 фазы"],["1","1 фаза + N"]]);
    S("Способ прокладки","method",Object.keys(DATA.methods).map(k=>[k,DATA.methods[k].label]));
    S("Источник данных токов","src",this.srcOptions(L));
    S("Материал жил","mat",[["cu","медь"],["al","алюминий"]]);
    S("Число жил","cores",[[1,"1-жильный"],[2,"2-жильный"],[3,"3-жильный"],[4,"4-жильный"],[5,"5-жильный"]]);
    N("Мощность расч. P, кВт (пусто — авто по схеме)","P");
    N("Коэффициент спроса/одновременности Kс","Ks");
    N("cos φ","cos");
    N("I расч. фиксировать, А","Ifix");
    N("Длина L, м","L");
    N("ΔU допустимое, %","allowedPct");
    N("Число кабелей в траншее","nParallel");
    N("Зазор между кабелями, мм","gap");
    S("Группировка в воздухе","grpMode",[["yamal","Ямал kGA"],["catalog-air","каталог NED — по поверхности"],["catalog-tray","каталог NED — лоток/желоб"],["catalog-channel","каталог NED — каналы"]]);
    S("Температура воздуха, °С","tAir");
    S("Температура грунта, °С","tSoil");
    N("Проводников на фазу (число)","nPerPhase");
    const dA=this.el("input",{type:"checkbox",...(L.duAuto?{checked:""}:{})}); dA.onchange=ev=>{L.duAuto=ev.target.checked; self.recalc();};
    grid.append(this.el("label",{class:"f inline"},[dA,this.el("span",{},"ΔU из общ. настроек (5%/10%)")]));

    host.append(this.el("h3",{},["Максимальная токовая защита (ПУЭ п.3.1.10–3.1.12, 7.3.97)"]));
    const g2=this.el("div",{class:"formgrid"}); host.append(g2);
    const S2=(label,key,opts)=>{const s=this.el("select",{onchange:ev=>{L.prot[key]=ev.target.value===""?null:ev.target.value; self.recalc();}});
      [[null,"— не проверять"]].concat(opts).forEach(o=>s.append(this.el("option",{value:o[0]==null?"":String(o[0]),...(String(L.prot[key])===String(o[0])?{selected:""}:{})},[o[1]]))); g2.append(this.el("label",{class:"f"},[this.el("b",{},[label]),s]));};
    S2("Тип/характеристика защиты","type",DATA.protectTypes.map(t=>[t.key,t.label]));
    const pt=DATA.protectTypes.find(t=>t.key===L.prot.type)||{m:self.settings.mtzM!=null?self.settings.mtzM:0.8};
    g2.append(this.el("div",{class:"hint",style:"grid-column:1/-1"},[ "Кратность уставки к длительно допустимому току кабеля по ПУЭ 3.1.11: уставка ≤ "+Math.round(pt.m*100)+"% · Iдоп.ф — из расчёта"]));
    const uInp=this.el("input",{type:"number",step:"any",value:L.prot.ust==null?"":L.prot.ust}); uInp.onchange=ev=>{L.prot.ust=ev.target.value===""?null:+ev.target.value; self.recalc();};
    g2.append(this.el("label",{class:"f"},[this.el("b",{},["Уставка / Iн.вст, А"]),uInp]));

    host.append(this.el("h3",{},["Ток КЗ — термическая стойкость (Ямал §7.10)"]));
    const g3=this.el("div",{class:"formgrid"}); host.append(g3);
    L.sc=L.sc||{};
    const S3=(label,key,arr)=>{const inp=this.el("input",{type:"number",step:"any",value:arr[key]==null?"":arr[key]});
      inp.onchange=ev=>{arr[key]=ev.target.value===""?null:+ev.target.value; self.recalc();}; g3.append(this.el("label",{class:"f"},[this.el("b",{},[label]),inp]));};
    S3("Iкз(3) макс., кА","Ik",L.sc); S3("Время отключения t, с","t",L.sc);
    S3("K материала (143 Cu XLPE/EPR, 92 Al, 115 Cu-PVC)","K",L.sc);

    host.append(this.el("h3",{},["Двигатель / пусковые условия"]));
    const g4=this.el("div",{class:"formgrid"}); host.append(g4);
    const mb=this.el("input",{type:"checkbox",...(L.motor&&L.motor.branch?{checked:""}:{})}); mb.onchange=ev=>{L.motor=L.motor||{};L.motor.branch=ev.target.checked; self.recalc();};
    g4.append(this.el("label",{class:"f inline"},[mb,this.el("span",{},"отпаечная линия к ЭД → Iдоп ≥ 1,25·Iн (ПУЭ 3.1.12/7.3.97)")]));
    L.motor=L.motor||{};
    const S4=(label,key)=>{const inp=this.el("input",{type:"number",step:"any",value:(L.motor[key]==null?"":L.motor[key])});
      inp.onchange=ev=>{L.motor[key]=ev.target.value===""?null:+ev.target.value; self.recalc();}; g4.append(this.el("label",{class:"f"},[this.el("b",{},[label]),inp]));};
    S4("Iн.дв, А","In"); S4("Iпуск, А","Ip"); S4("cos φ пуска","cosP"); S4("ΔU доп. пуск, %","lim");
    const notes=this.el("input",{type:"text",value:L.notes||"",placeholder:"Заметка (войдёт в отчёт)"}); notes.onchange=ev=>{L.notes=ev.target.value; self.save();};
    host.append(this.el("div",{style:"margin-top:8px"},[notes]));

    const rc=self.resMap[n.id];
    if(rc&&rc.res){ const r=rc.res, b=r.best;
      host.append(this.el("div",{class:"kpi"},[
        this.el("div",{class:"kpi-item"},[this.el("b",{},[self.fmt(r.IrA,0)+" А"]),"I расч."]),
        this.el("div",{class:"kpi-item"},[this.el("b",{},[b?b.s+" мм²":"—"]),b?self.markOf(L,b):"нет сечения"]),
        this.el("div",{class:"kpi-item"},[this.el("b",{},[b?self.fmt(b.Idp,0)+" А":"—"]),"I доп. факт"]),
        this.el("div",{class:"kpi-item"},[this.el("b",{},[b&&b.dU?self.fmt(b.dU.pct,2)+"%":"—"]),"ΔU"])]));
      if(!b){ let msg="Кандидатов нет: "; host.append(this.el("div",{class:"remark bad"})); }
    }
    host.append(self.formulaBlock?self.formulaBlock(rc):document.createTextNode("")); },
  formulaBlock(rc){ const w=this.el("div",{class:"formula-box"}); w.style.display="none"; w.setAttribute("id","fblock"); return w; },
  srcOptions(L){ const opts=[["auto","авто — ГТП ПУЭ для всех, IEC/Ямал для воздуха (медь/алюм.)"]];
    if(L.vclass==="0.4"||!L.vclass){ opts.push(["YAMAL-LV","Ямал СПГ, табл.1 (IEC 60364-5-52, Cu, в воздухе/трубе)"],["GTP-PUYE","ГТП ПУЭ 0,66–1 кВ (пластм. изоляция, Cu/Al, воздух+земля)"]); }
    else { opts.push(["SN3x","Каталог NED‑Plagum SN 3‑жильные"],["SN1x","Каталог NED‑Plagum SN 1‑жильные"],["YAMAL-HV","Ямал СПГ, табл.2 (IEC 60502‑2, брон. 3×, воздух)"]); }
    if(L.kind==="vl"){ opts.push(["VL-AC","ВЛ неизолир. АС (ПУЭ табл.1.3.29)"],["VL-SIP","СИП‑4 (ВЛ 0,4 кВ)"]); }
    return opts; }
};
typeof window!=="undefined" && (window.App = App);
