/* =====================================================================
   UI2 — быстрый расчёт одной линии + интерактивный каталог NED-Plagum
   ===================================================================== */
Object.assign(App,{
  /* ---------- БЫСТРЫЙ РАСЧЁТ ---------- */
  bindQuick(){ const self=this;
    this.$("#btnQuickCalc").onclick=()=>self.calcQuick();
    this.$("#btnQuickToScheme").onclick=()=>{ const p=self.newProject(); p.name="Расчёт одной линии";
      p.nodes=[{id:"root",par:null,type:"src",label:"Источник",data:{},line:null},
        {id:"q",par:"root",type:"load",label:"Нагрузка (ввода)",data:{P:self.qLine.P||0,cos:self.qLine.cos||0.8},line:Object.assign(self.defLine(),JSON.parse(JSON.stringify(self.qLine)))}];
      self.state=p; self.selId="q"; self.renderAll(); self.$(".tab[data-tab=scheme]").click(); self.toast("Добавлено в новую схему","ok"); };
    this.$("#btnQuickPreset").onclick=()=>{ self.qLine=Object.assign(self.qLine,
      {vclass:"0.4",method:"earth_trench",src:"auto",mat:"cu",P:160,cos:0.82,L:180,allowedPct:3,duAuto:false,nParallel:1,gap:100,
       protect:{type:"fusePVC",ust:630}, sc:{Ik:14,t:0.1}, motor:null, ph:"3", cores:4, tAir:30,tSoil:15});
      self.renderQuickForm(); self.calcQuick(); }; },
  renderQuickForm(){ const host=this.$("#quickForm"); if(!host)return; const self=this, L=this.qLine;
    host.innerHTML="";
    const grid=this.el("div",{class:"formgrid"}); host.append(grid);
    const S=(label,key,opts)=>{const s=self.el("select",{onchange:ev=>{const v=ev.target.value;
        const KEEP={vclass:1,ph:1,method:1,src:1,kind:1,mat:1,grpMode:1,grpSet:1};
        L[key]=KEEP[key]?v:(v!==""&&!isNaN(+v)?+v:v); self.renderQuickForm(); self.calcQuick();}});
      opts.forEach(o=>s.append(self.el("option",{value:String(o[0]),...(String(L[key])===String(o[0])?{selected:""}:{})},[o[1]])));
      grid.append(self.el("label",{class:"f"},[self.el("b",{},[label]),s]));};
    const N=(label,key)=>{const i=self.el("input",{type:"number",step:"any",value:L[key]==null?"":L[key]});
      i.onchange=ev=>{L[key]=ev.target.value===""?"":+ev.target.value; self.validate(i,label); }; i.onblur=()=>self.calcQuick();
      grid.append(self.el("label",{class:"f"},[self.el("b",{},[label]),i]));};
    S("Класс напряжения","vclass",[["0.4","0,4 кВ"],["6","6 кВ"],["10","10 кВ"],["20","20 кВ"],["35","35 кВ"]]);
    S("Тип линии","kind",[["kl","КЛ кабельная"],["vl","ВЛ воздушная"]]);
    S("Фазность","ph",[["3","3 фазы"],["1","1 фаза+N"]]);
    S("Способ прокладки","method",Object.keys(DATA.methods).map(k=>[k,DATA.methods[k].label]));
    S("Источник данных токов","src",this.srcOptionsFor(L));
    S("Материал","mat",[["cu","медь"],["al","алюминий"]]);
    S("Число жил","cores",[[3,"3"],[4,"4"],[5,"5"],[2,"2"],[1,"1 (одножильные по фазам)"]]);
    N("P расчётная, кВт","P"); N("Kспроса","Ks"); N("cos φ","cos");
    N("I фикс (0=по P), А","Ifix"); N("Длина L, м","L");
    N("ΔU допустимое, %","allowedPct");
    N("Число кабелей в траншее / цепей","nParallel");
    N("Зазор, мм (100/200/300)","gap");
    S("Группировка в воздухе","grpMode",[["yamal","Ямал kGA"],["catalog-air","каталог NED поверхность"],["catalog-tray","каталог лоток/желоб"],["catalog-channel","каталог каналы"]]);
    S("Набор коэф-та","grpSet",[["single","1,00 (одиночно)"],["hv","0,90 HV spaced"],["hvSpaced","0,93"],["tight","0,64 LV пучок"]]);
    N("T воздуха °С","tAir"); N("T грунта °С","tSoil");
    N("θ раб. жилы °С (90/65/70/105)","thetaJob");
    S("Характеристика защиты","protType",[["","— не проверять"]].concat(DATA.protectTypes.map(t=>[t.key,t.label])));
    L.protType=L.protType||""; if(L.protType) L.prot=L.prot||{}, L.prot.type=L.protType;
    N("Уставка / Iн.вст, А","protUst");
    L.prot=L.prot||{}; L.prot.ust=L.protUst;
    S("Метод коэф-та temp","kTempMode2",[["formula","√-формула (Ямал/IEC)"],["pue","табл.1.3.3 ПУЭ (строки 50–80 °С)"]]);
    N("Iкз(3), кА (0=нет)","scIk"); L.sc=L.sc||{}; L.sc.Ik=L.scIk||null;
    N("t откл. КЗ, с","sct"); L.sc.t=L.sct!=null?L.sct:0.5;
    N("K терм (143 Cu / 92 Al)","scK"); L.sc.K=L.scK||null;
    const mrow=self.el("div",{style:"display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:6px"});
    const mchk=self.el("input",{type:"checkbox",...(L.motor&&L.motor.branch?{checked:""}:{}),onchange:ev=>{L.motor=L.motor||{};L.motor.branch=ev.target.checked; self.calcQuick();}});
    const m2=self.el("input",{type:"checkbox",...(L.withNeutral?{checked:""}:{}),onchange:ev=>{L.withNeutral=ev.target.checked; self.calcQuick();}});
    mrow.append(self.el("label",{class:"f inline"},[mchk,self.el("span",{},"отпаечная к ЭД (×1,25 ПУЭ 3.1.12)")]),
                self.el("label",{class:"f inline"},[m2,self.el("span",{},"уч. нулевого провода (1ф/4-ж)")]) );
    host.append(mrow);
    L.L=L.L; L.tAir=L.tAir===""||L.tAir==null?self.settings.Tair:L.tAir; L.tSoil=L.tSoil===""||L.tSoil==null?self.settings.Tsoil:L.tSoil; },
  srcOptionsFor(L){ const o=[["auto","авто — IEC (воздух)/ГТП ПУЭ (земля)"]];
    if(L.vclass==="0.4"){ o.push(["YAMAL-LV","Ямал табл.1 (IEC 90°С медь, воздух/труба)"],["GTP-PUYE","ГТП ПУЭ пластм. Cu/Al (воздух+земля)"]); }
    else { o.push(["SN3x","NED-Plagum SN 3×ж (каталог)"],["SN1x","NED-Plagum SN 1×ж (каталог)"],["YAMAL-HV","Ямал табл.2 IEC (3×ж воздух)"]); }
    if(L.kind==="vl"){ o.push(["VL-AC","АС (ПУЭ 1.3.29)"],["VL-SIP","СИП‑4 (ГТП)"]); }
    return o; },
  validate(inp,label){ const v=inp.value; let ok=true;
    if(inp.type==="number"){ if(v===""){ok=inp.dataset.req?false:true;} else if(isNaN(+v))ok=false; else if(+v<0)ok=false; }
    inp.classList.toggle("err",!ok); if(!ok&&label==="")inp.title="введите корректное положительное число"; },
  qLineToEng(){ const L=JSON.parse(JSON.stringify(this.qLine)); const S=this.settings;
    if(L.P===""||L.P==null)L.P=0; const vU=L.vclass==="0.4"?0.4:Number(L.vclass)||0.4;
    L.vU=vU; L.allowedPct=L.allowedPct===""?S.du04:+L.allowedPct;
    L.prot=L.prot||{}; if(L.protType&&!L.prot.type){L.prot.type=L.protType;}
    if(L.kTempMode2)L.kTempMode=L.kTempMode2;
    return L; },
  calcQuick(){ const self=this; L0();
    function L0(){}
    const bar=self.$(".progress"); if(bar){bar.classList.add("on");bar.firstElementChild.style.width="30%";}
    setTimeout(()=>{ let r=null,err=null;
      try{ r=Eng.selectLine(self.qLineToEng(),self.settings);}catch(e){err=e;}
      if(bar){bar.firstElementChild.style.width="100%";setTimeout(()=>bar.classList.remove("on"),350);}
      const host=self.$("#quickResult"); host.innerHTML="";
      if(err){ host.append(self.el("div",{class:"remark bad"},"Ошибка: "+err)); return; }
      const b=r.best;
      const k=v=>self.el("div",{class:"kpi-item"},[self.el("b",{},[v[1]]),v[0]]);
      host.append(self.el("div",{class:"kpi"},[ k(["I расчётный",self.fmt(r.IrA,1)+" А"]), k(["Треб. Iдоп",self.fmt(r.Kneed,1)+" А"]),
        k(["Рекомендуется",b?(b.s+" мм²"):"не найдено"]), k(["I доп. факт",b?self.fmt(b.Idp,0)+" А":"—"]),
        k(["ΔU расч.",b&&b.dU?self.fmt(b.dU.pct,2)+"%":"—"]), k(["Состав коэфф.",b?self.fmt(b.kT,2)+"×"+self.fmt(b.kGrp,2):"—"]) ]));
      if(!b){ host.append(self.el("div",{class:"remark bad"},"Ни одно типовое сечение не проходит все проверки — увеличьте допустимые ΔU, снизьте ток/уставки или измените способ прокладки.")); }
      host.append(self.el("div",{class:"remark "+(b?"ok":"bad"),html:b?("✅ Принято: "+self.markOf(self.qLine,b)+" <b>Iдоп.ф="+self.fmt(b.Idp,0)+" А</b> ≥ "+self.fmt(r.Kneed,0)+" А; ΔU="+self.fmt(b.dU.pct,2)+"% ≤ "+(self.qLine.allowedPct!=null?self.qLine.allowedPct:"%")+""):""}));
      const fb=self.$("#quickFormulas"); fb.innerHTML=self.formulasText(r,self.qLineToEng(),self.settings);
      self.renderQuickTable(r); self.drawCharts(r); self.save();
    },10); },
  renderQuickTable(r){ const t=this.$("#quickTable"); if(!t)return; t.innerHTML="";
    t.append(this.el("tr",{html:"<th>s, мм²</th><th>I катал., А</th><th>k_Tθ</th><th>k гр/ρ</th><th>I доп.ф, А</th><th>ДДТ</th><th>мин.сеч.</th><th>МТЗ</th><th>ΔU%</th><th>КЗ</th><th>Пуск</th><th>Итог</th>"}));
    const self=this;
    r.cands.forEach(c=>{ const tr=self.el("tr",{class:(c===r.best?"ok ":(c.pass?"":" bad"))});
      const cell=(x,ok)=>self.el("td",{class:"num",html:ok==null?x:(ok?"✓ ":"✗ ")+x});
      tr.append(self.el("td",{class:"num"},[String(c.s)]));
      tr.append(self.el("td",{class:"num"},[self.fmt(c.Icat,0)]));
      tr.append(self.el("td",{class:"num"},[self.fmt(c.kT,3)]));
      tr.append(self.el("td",{class:"num",title:c.groupNote||""},[self.fmt(c.kGrp,3)]));
      tr.append(self.el("td",{class:"num"},[self.fmt(c.Idp,0)]));
      tr.append(cell(self.fmt(c.checks.PDT.need,0),!!c.checks.PDT.ok));
      tr.append(self.el("td",{class:"num",html:c.checks.minS.ok?"✓":"✗"}));
      tr.append(c.checks.mtz?self.el("td",{class:"num",html:c.checks.mtz.ok?"✓ ≤"+Math.round((c.checks.mtz.need||0)*100)+"%":"✗ "+self.fmt(c.checks.mtz.val*100,0)+"%"}):self.el("td",{},"—"));
      tr.append(self.el("td",{class:"num",html:c.dU?self.fmt(c.dU.pct,2):"—"}));
      tr.append(c.checks.sc?self.el("td",{class:"num",html:c.checks.sc.ok?"✓":"✗"}):self.el("td",{},"—"));
      tr.append(c.checks.start?self.el("td",{class:"num",html:c.checks.start.ok?"✓":"✗"}):self.el("td",{},"—"));
      tr.append(self.el("td",{html:c===r.best?"⭐ выбран":(c.pass?"годен":"нет")+" "},[]));
      t.append(tr); }); },
  formulasText(r,L,S){ const o=[]; const eff={};
    o.push("1) РАСЧЁТНЫЙ ТОК: "+(L.ph==="1"?"Iр = Kс·P·10³/(Uф·cosφ)":"Iр = Kс·P·10³/(√3·U·cosφ)")+" = "+this.fmt(r.IrA,1)+" А  (P="+this.fmt(L.P,1)+" кВт, Kс="+this.fmt(L.Ks,2)+", cosφ="+this.fmt(L.cos,2)+", U="+(L.vU||L.vclass)+" кВ)");
    if(r.kAdd!==1)o.push("   с запасом/пересчётом: Iтреб = Iр·"+this.fmt(r.kAdd,3)+" = "+this.fmt(r.Kneed,1)+" А (двиг.1,25 / >2пров. на фазу /кзона)");
    const b=r.best;
    if(b){ o.push("2) ДОПУСТИМЫЙ ТОК: Iдопф = Iкат·√((θраб−tср)/(θкат−tкат))·kρ·kгр = "+this.fmt(b.Icat,0)+"·"+this.fmt(b.kT,3)+"·"+this.fmt(b.kGrp,3)+" = "+this.fmt(b.Idp,0)+" А ≥ "+this.fmt(r.Kneed,1)+" А — см. карточку коэффициентов");
      o.push("3) ПОПРАВКИ (для "+this.fmt(b.s,0)+" мм²): kT=√(("+ (b.theta0!=null?b.theta0:(L.thetaJob||S.thetaJob))+"−"+(b.tFact!=null?b.tFact:(L.method&&L.method.startsWith("earth")?(L.tSoil!=null?L.tSoil:S.Tsoil):(L.tAir!=null?L.tAir:S.Tair)))+")/(…база каталога…)) = "+this.fmt(b.kT,3)+"; kгрупп/ρ = "+this.fmt(b.kGrp,3)+" ("+(b.groupNote||"")+")(xρ = "+this.fmt((b.kRho||1),3)+")");
      o.push("4) ПОТЕРЯ НАПРЯЖЕНИЯ: "+(L.ph==="1"?"ΔU = 2·I·L·(r0·cosφ+x0·sinφ)/Uф":"ΔU = √3·I·L·(r0·cosφ+x0·sinφ)/U")+" = "+this.fmt(b.dU?pct(b.dU):"",0)+" → "+this.fmt(b.dU&&b.dU.pct,2)+"% ≤ "+(L.allowedPct!=null?L.allowedPct:"…")+"%");
      if(b.checks.mtz) o.push("5) МТЗ (ПУЭ 3.1.11): уставка "+(L.prot&&L.prot.ust)+" А ≤ "+b.checks.mtz.need+"·Iдопф="+this.fmt((b.checks.mtz.need||0)*b.Idp,0)+" А — "+(b.checks.mtz.ok?"пройдено":"НЕ пройдено")+"; фактич. Iуст/Iдопф = "+this.fmt((b.checks.mtz.val||0)*100,0)+"%");
      o.push("6) МЕХАНИЧЕСКАЯ ПРОЧНОСТЬ: s="+b.s+" мм² ≥ "+(L.mat==="al"?S.minS_al:S.minS_cu)+" мм² (мин. по изол. материала/ПУЭ) — "+(b.checks.minS.ok?"пройдено":"нарушено"));
      if(b.checks.sc) o.push("7) ТЕРМОСТОЙКОСТЬ: Sмины=(Ik·√t)/K="+b.checks.sc.txt.split("=")[1]+" — "+(b.checks.sc.ok?"пройдено":"нарушено"));
      if(b.checks.start) o.push("8) ПУСК: ΔUпуск="+b.checks.start.txt.split(",")[0]+" — "+(b.checks.start.ok?"пройдено":"нарушено"));}
    o.push("\nКандидаты: "+r.cands.map(c=>c.s+"мм²("+(c.pass?"✓":"✗")+(c.checks.PDT.ok?"":"!ДДТ")+(c.checks.dU.ok?"":"!ΔU")+")").join("  "));
    function pct(dU){return dU.pct;}
    return o.join("\n"); },
  drawCharts(r){ const self=this;
    function plot(host, xs, lines, ylab){ const W=420,H=210,padL=40,padB=26,padT=16;
      if(!xs.length||!lines.length){host.innerHTML="";return;}
      let ymax=0; lines.forEach(L=>L.pts.forEach(v=>{if(isFinite(v))ymax=Math.max(ymax,v);})); ymax=ymax*1.15||10;
      const X=i=>padL+(i/(Math.max(1,xs.length-1)))*(W-padL-8), Y=v=>H-padB-(v/ymax)*(H-padB-padT);
      let s2='<svg width="100%" height="'+H+'" viewBox="0 0 '+W+' '+H+'"><line x1="'+padL+'" x2="'+(W-6)+'" y1="'+(H-padB)+'" y2="'+(H-padB)+'" stroke="#567"/><line x1="'+padL+'" x2="'+padL+'" y1="'+padT+'" y2="'+(H-padB)+'" stroke="#567"/>';
      const cols=["#177a4c","#b26a00","#8a5bc9","#c62828"];
      lines.forEach((L,li)=>{ const pts=L.pts.map((v,i)=>isFinite(v)?X(i)+","+Y(v):null).filter(Boolean).join(" ");
        s2+='<polyline fill="none" stroke="'+cols[li%4]+'" stroke-width="2" '+(L.dash?'stroke-dasharray="6 3"':"")+' points="'+pts+'"/>';
        if(L.ref!=null){ const v2=Y(L.ref); s2+='<line x1="'+padL+'" x2="'+(W-6)+'" y1="'+v2+'" y2="'+v2+'" stroke="#c62828" stroke-dasharray="4 3" stroke-width="1.5"/><text x="4" y="'+(v2+3)+'" font-size="8" fill="#c62828">'+L.refName+"</text>"; }
        L.pts.forEach((v,i)=>{ if(isFinite(v))s2+='<circle cx="'+X(i)+'" cy="'+Y(v)+'" r="2.3" fill="'+cols[li%4]+'"/>';
          if(i<xs.length&&(i%2===0||xs.length<14))s2+='<text x="'+X(i)+'" y="'+(H-padB+11)+'" font-size="8.5" text-anchor="middle" fill="#456">'+xs[i]+"</text>"; }); });
      s2+='<text x="'+(padL+2)+'" y="'+(padT-2)+'" font-size="9" fill="#345">'+ylab+"</text>";
      const leg=lines.map((L,i)=>'<tspan dx="8" fill="'+cols[i%4]+'">— '+L.name+"</tspan>").join("");
      s2+='<text x="'+padL+'" y="'+(H-4)+'" font-size="9" fill="#345">сечения, мм²'+leg.replace(/tspan/g,"tspan")+"</text></svg>";
      host.innerHTML=s2; }
    const cs=r.cands.slice(0,14);
    plot(self.$("#chartI"), cs.map(c=>c.s), [
      {name:"Iдоп.ф",pts:cs.map(c=>c.Idp)},{name:"Iкат",pts:cs.map(c=>c.Icat)},{name:"I расч/треб (гориз.)",pts:cs.map(()=>r.Kneed)}],"А");
    const Lm=Math.max(50,Math.ceil((+self.qLine.L||100)*1.3)); const ux=[]; for(let i=0;i<=10;i++)ux.push(Math.round(Lm*i/10));
    const series={}; r.cands.slice(0,5).forEach(c=>{ const s2=Object.assign(JSON.parse(JSON.stringify(self.qLine)),{minS:c.s,maxS:c.s,Ifix:r.IrA}); series[c.s]=ux.map(lx=>{ const q=Object.assign({},s2,{L:lx}); try{const rr=Eng.selectLine(q,self.settings); if(rr.best&&rr.best.dU)return rr.best.dU.pct; const alt=rr.cands.find(x=>x.s===c.s); if(alt)return alt.dU.pct;}catch(e){} return NaN; }); });
    plot(self.$("#chartU"), ux, Object.keys(series).map(k=>({name:k+" мм²",pts:series[k],ref:(+self.qLine.allowedPct)||undefined,refName:"ПДУ"})),"%"); },
  /* ---------- КАТАЛОГ ---------- */
  bindCatalog(){ const self=this; this.$("#catalogSearch").oninput=()=>self.renderCatalog();
    this.filters={u:"all",mat:"all",kind:"all"};
    const bar=self.$("#catalogFilters"); bar.innerHTML="";
    const chip=(grp,val,lab)=>{ const c=self.el("button",{class:"chip"+(self.filters[grp]===val?" active":""),onclick:()=>{self.filters[grp]=val; App.$$("#catalogFilters .chip").forEach(x=>{}); bar.querySelectorAll('[data-g="'+grp+'"]').forEach(x=>x.classList.toggle("active",x===c)); self.renderCatalog();}}); c.dataset.group=grp; c.dataset.g=grp; c.append(lab); return c; };
    ["all","04","10","vl"].forEach((u,i)=>bar.append(chip("u",u,["🏷 Все","КЛ 0,4 кВ","КЛ 6–35 кВ","ВЛ"][i])) );
    bar.append(self.el("span",{class:"muted"}," · материал: "));
    ["all","cu","al"].forEach((m,i)=>bar.append(chip("mat",m,["все","медь","алюм."][i])));
    bar.append(self.el("span",{class:"muted"}," · число жил: "));
    ["all","3","1","4","5","2"].forEach((c,i)=>bar.append(chip("kind",c,["любое","3-ж." ,"1-ж.","4-ж.","5-ж.","2-ж."][i]))); },
  expandCatalog(){ const rows=[];
    Object.keys(DATA.sn3).forEach(U=>DATA.sn3[U].forEach(r=>rows.push({U,b:U.includes("6/")||U.includes("3.6")?"6/10":"",brand:"NED‑Plagum SN нг(А)-LS",family:"SN",kind:"3×",s:r.s,Iz:r.iz,Ia:r.ia,r90:r.r90,d:r.d,note:"каталог SN (медь, ЭПР)",mat:"cu"})));
    Object.keys(DATA.sn1).forEach(U=>DATA.sn1[U].forEach(r=>rows.push({U,brand:"NED‑Plagum SN нг(А)-LS",family:"SN",kind:"1×",s:r.s,Iz:Math.max(r.izP,r.izT),Ia:Math.max(r.iaP,r.iaT),r90:DATA.sn1_r90[r.s]||null,d:r.d,note:"в земле пл./треуг "+r.izP+"/"+r.izT+" · возд "+r.iaP+"/"+r.iaT,mat:"cu",izP:r.izP,izT:r.izT,iaP:r.iaP,iaT:r.iaT})));
    /* LV: Yamal (медь) */
    DATA.lvYamal.forEach(r=>rows.push({U:"0,66/1кВ",brand:"NED‑Plagum 1 кВ ЭПР (IEC/Ямал табл.1)",family:"LV",kind:"3×/4×",s:r[0],Iz:null,Ia:r[2]!=null?r[2]:r[1],Iair:r[1],Icond:r[2],r90:null,note:"лоток "+r[1]+" А, труба "+(r[2]!=null?r[2]+" А":"нет"),mat:"cu"}));
    /* LV: ГТП ПУЭ Cu 4ж ×0.92 нормированный к 90 */
    const fA=Math.sqrt((90-15)/(65-15)), fV=Math.sqrt((90-25)/(65-25));
    ["cu","al"].forEach(mat=>{ const T=mat==="cu"?DATA.lvGostPlastic.cu:DATA.lvGostPlastic.al;
      T.c3.forEach(r=>rows.push({U:"0,66/1кВ",brand:(mat==="cu"?"NED‑Plagum":"A‑NED‑Plagum")+" (ГТП ПУЭ→90°С)",family:"LVG",kind:"3×(→4×)",s:r[0],Iz:Math.round(r[2]*fA*0.92),Ia:Math.round(r[1]*fV*0.92),note:"в воздухе "+r[1]+"·"+fV.toFixed(2)+"=… ; в земле "+r[2]+"·"+fA.toFixed(2)+" → ×0,92 (4-ж.)",mat:mat,Izraw:r[2],Iaraw:r[1]})); });
    /* ВЛ */
    DATA.vlAC.forEach(r=>{ if(r.iIn)rows.push({U:"ВЛ 6–35",brand:(r.norm||"АС‑"+r.s)+" (ПУЭ 1.3.29)",family:"VL",kind:"1×",s:Math.round(r.s),Iz:null,Ia:r.iOut||r.iIn,note:"в помещений "+r.iIn+"/ вне "+(r.iOut||"—"),mat:"al"});});
    DATA.vlSIP4.forEach(r=>rows.push({U:"ВЛ 0,4",brand:"СИП‑4 (ГТП)",family:"VL",kind:"4×",s:r.s,Iz:null,Ia:r.i,note:"ориентировочно",mat:"al",r90:r.r,x0:r.x}));
    /* HV Yamal air */
    DATA.hvYamalAir.c3.forEach(r=>rows.push({U:"3,6/6…18/30",brand:"XLPE (Ямал табл.2) 3× брон. в воздухе",family:"SN",kind:"3×",s:r.s,Iz:null,Ia:r.i,note:"IEC60502-2 B6",mat:"cu"}));
    return rows; },
  renderCatalog(){ const t=this.$("#catalogTable"); if(!t)return; const q=(this.$("#catalogSearch").value||"").toLowerCase();
    const f=this.filters||{}; const self=this; const rows=this.expandCatalog().filter(x=>{
      if(f.u==="04"&&!/0,66|0\.4/.test(x.U))return false;
      if(f.u==="10"&&x.family!=="SN")return false;
      if(f.u==="vl"&&x.family!=="VL")return false;
      if(f.mat&&f.mat!=="all"&&x.mat!==f.mat)return false;
      if(f.kind&&f.kind!=="all"&&!x.kind.startsWith(f.kind))return false;
      if(q){ const s=(x.brand+" "+x.U+" "+x.kind+" "+x.s+" "+(x.norm||"")+" "+(x.note||"")).toLowerCase().replace(/\s+/g,""); if(!s.includes(q.replace(/\s+/g,"")))return false; }
      return true; });
    t.innerHTML=""; t.append(this.el("tr",{html:"<th>Класс U</th><th>Марка/каталог</th><th>Жил×</th><th>s, мм²</th><th>I в воздухе, А</th><th>I в земле, А</th><th>r, Ом/км</th><th>d, мм</th><th>Примечание</th>"}));
    rows.slice(0,450).forEach(x=>{ const tr=self.el("tr",{class:"rowclick"});
      tr.onclick=()=>{self.catalogSel=x; self.renderCatDetail(x); };
      tr.innerHTML="<td>"+x.U+"</td><td>"+self.esc2(x.brand)+"</td><td>"+x.kind+"</td><td class='num'>"+x.s+"</td><td class='num'>"+(x.Ia!=null?x.Ia:"—")+"</td><td class='num'>"+(x.Iz!=null?x.Iz:"—")+"</td><td class='num'>"+(x.r90!=null?x.r90:(x.r!=null?x.r:"—"))+"</td><td class='num'>"+(x.d!=null?x.d:"—")+"</td><td class='muted'>"+self.esc2((x.note||"").slice(0,110))+"</td>";
      t.append(tr); });
    this.$("#catalogCount").textContent="строк: "+rows.length+(rows.length>450?" (показаны первые 450)":""); },
  renderCatDetail(x){ const host=this.$("#catalogDetail"); host.innerHTML="";
    host.append(this.el("div",{class:"mono"})); host.innerHTML = 
      "<b>"+this.esc2(x.brand)+"</b><br>"+
      "Класс: "+x.U+" · жила: "+x.s+" мм² ("+x.kind+") · материал: "+(x.mat==="cu"?"медь":"алюминий")+"<br>"+
      "ДДТ (каталог/ГТП): в воздухе "+(x.Ia!=null?x.Ia+" А":"— (не задан — см. источник данных)")+" · в земле "+(x.Iz!=null?x.Iz+" А":"—")+"<br>"+
      "r(90°С) ≈ "+(x.r90!=null?x.r90+" Ом/км":"по ГОСТ 22483")+" · наружный диаметр "+(x.d!=null?x.d+" мм":"—")+"<br>"+
      "<span class='muted'>"+this.esc2(x.note||"")+"</span><br>";
    const btn=(lab,fn)=>this.el("button",{class:"btn btn-sm",onclick:fn},[lab]);
    host.append(this.el("div",{class:"btn-group"},[
      btn("→ применить в Быстром расчёте",()=>{ const L=this.qLine; L.src=this.srcMatch(x); L.mat=x.mat; L.cores=+String(x.kind)[0]||L.cores;
        if(/1×/.test(x.kind))L.cores=1; if(x.family==="VL"){L.kind="vl";L.src=x.brand.includes("СИП")?"VL-SIP":"VL-AC";}
        this.renderQuickForm(); this.calcQuick(); this.$(".tab[data-tab=quick]").click(); this.toast("Кабель применён в быстром расчёте","ok"); }),
      btn("→ применить к линии выбранного узла схемы",()=>{ const n=this.byId(this.selId); if(!n||!n.line){this.toast("сначала выберите узел со схемой","err");return;}
        n.line.src=this.srcMatch(x); n.line.mat=x.mat; n.line.cores=+String(x.kind)[0]||n.line.cores; if(x.family==="VL"){n.line.kind="vl";n.line.src=x.brand.includes("СИП")?"VL-SIP":"VL-AC";}
        this.recalc(); this.toast("Применено к линии «"+n.label+"»","ok"); }) ])); },
  srcMatch(x){ if(x.family==="SN"&&x.brand.includes("Ямал"))return "YAMAL-HV"; if(x.family==="SN"||x.family==="VL")return x.brand.includes("XLPE")?"YAMAL-HV":(x.family==="VL"?(x.brand.includes("СИП")?"VL-SIP":"VL-AC"):(/1×|3×/.test(x.kind)?"SN1x":"SN3x")); if(x.family==="LV")return x.brand.includes("IEC")?"YAMAL-LV":"GTP-PUYE"; if(x.family==="LVG")return "GTP-PUYE"; return "auto"; }
});
