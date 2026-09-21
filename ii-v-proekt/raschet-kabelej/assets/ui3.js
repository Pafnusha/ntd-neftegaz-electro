/* =====================================================================
   UI3 — калькулятор потерь напряжения (участки) + потери электроэнергии
   по «Методическим рекомендциям … 10(6)-0,4 кВ» (Роскоммунэнерго, 2001)
   ===================================================================== */
Object.assign(App,{
  /* ================= ΔU ================= */
  ud:{vclass:"0.4",ph:"3",cos:0.8,theta:50,segs:[{s:70,L:120,P:100,cos:0.8}]},
  bindUDrop(){ const self=this;
    this.$("#btnUDropAddSeg").onclick=()=>{ self.ud.segs.push({s:25,L:50,P:40,cos:0.8}); self.renderUDrop(); };
    this.$("#btnUDropCalc").onclick=()=>{ self.renderUDrop(); self.calcUDrop(); }; },
  renderUDropForm(){ const host=this.$("#udropForm"); if(!host)return; host.innerHTML=""; const self=this,u=this.ud;
    const g=self.el("div",{class:"formgrid"}); host.append(g);
    const S=(lab,key,opts)=>{const s=self.el("select",{onchange:e=>{u[key]=isNaN(e.target.value)?e.target.value:+e.target.value; self.renderUDrop(); self.calcUDrop();}});
      opts.forEach(o=>s.append(self.el("option",{value:String(o[0]),...(String(u[key])===String(o[0])?{selected:""}:{})},[o[1]])));g.append(self.el("label",{class:"f"},[self.el("b",{},[lab]),s]));};
    const N=(lab,key)=>{const i=self.el("input",{type:"number",step:"any",value:u[key]});i.onchange=e=>{u[key]=+e.target.value;self.renderUDrop&&0;self.calcUDrop();};g.append(self.el("label",{class:"f"},[self.el("b",{},[lab]),i]));};
    S("Класс напряжения","vclass",[["0.4","0,4 кВ"],["6","6 кВ"],["10","10 кВ"],["20","20 кВ"],["35","35 кВ"]]);
    S("Фазность сети","ph",[["3","3-фазная"],["1","1-фазная"]]);
    S("cos φ (если у участка не задан свой)","cos",[[0.7,"0,7"],[0.75,"0,75"],[0.8,"0,8"],[0.85,"0,85"],[0.9,"0,9"],[0.95,"0,95"],[1,"1,0"]]);
    N("θ расчётная жилы, °С (для r)","theta");
  },
  bindUDrop(){ const self=this; this.renderUDropForm();
    this.$("#btnUDropAddSeg").onclick=()=>{ self.ud.segs.push({s:25,L:50,P:40,cos:0.8}); self.renderUDrop(); };
    this.$("#btnUDropCalc").onclick=()=>{ self.renderUDrop(); self.calcUDrop(); }; },
  segRows(){ const self=this,u=this.ud;
    const U=u.vclass==="0.4"?0.4:Number(u.vclass);
    const totalP=u.segs.reduce((a,x)=>a+ (+x.P||0),0);
    let cum=0, txt=[];
    u.segs.forEach((sg,i)=>{ /* ток i-го участка = сумма нагрузок от i до конца */
      let P=0,Q=0; for(let k=i;k<u.segs.length;k++){ const c=+u.segs[k].cos||u.cos||0.8; P+=+u.segs[k].P||0; Q+= (+u.segs[k].P||0)*Math.tan(Math.acos(Math.min(1,Math.max(c,0.2)))); }
      const S=Math.sqrt(P*P+Q*Q), cos=S?P/S:(u.cos||0.8);
      const r=Eng.rAt(+sg.s||1,"cu",u.theta||50)*(u.vclass==="0.4"?1:1)*1, x=(u.vclass==="0.4"?0.08:0.35);
      const I=Eng.current(P,cos,U,u.ph,1);
      const one=Eng.voltDrop(I,+sg.L||0,r,x,cos,U,u.ph,false);
      cum+=one.pct; txt.push({i,s:sg.s,P,Q,I,cos,r,x,V:one.V,pct:one.pct,cum}); });
    return txt; },
  renderUDrop(){ const t=this.$("#udropTable"); if(!t)return; t.innerHTML=""; const self=this;
    t.append(this.el("tr",{html:"<th>уч.</th><th>сечение, мм²</th><th>L, м</th><th>P участка, кВт</th><th>cosφ</th><th>ток</th><th>ΔU%, уч.</th><th>ΣΔU%</th><th></th>"}));
    this.ud.segs.forEach((sg,i)=>{ const row=this.el("tr");
      const inp=(key,w)=>{const n=self.el("input",{type:"number",step:"any",value:sg[key],style:"width:"+(w||62)+"px"});n.onchange=e=>{sg[key]=+e.target.value||0;self.calcUDrop();return false;};return n;};
      row.append(this.el("td",{},"#"+(i+1)),this.el("td",{},[inp("s")]),this.el("td",{},[inp("L",70)]),this.el("td",{},[inp("P")]),this.el("td",{},[inp("cos",54)]),
        this.el("td",{class:"num",html:"—"}),this.el("td",{class:"num",html:"—"}),this.el("td",{class:"num",html:"—"}),
        this.el("td",{},[self.el("button",{class:"btn btn-sm",onclick:()=>{self.ud.segs.splice(i,1);self.renderUDrop();self.calcUDrop();}},"✕")]) );
      t.append(row); });
    this.calcUDrop(); },
  calcUDrop(){ const self=this,r=!!0; const rs=this.segRows(); const out=this.$("#udropResult"); if(!out)return;
    out.innerHTML=""; if(!this.ud.segs.length){out.append(this.el("span",{class:"muted"},"нет участков"));return;}
    const tot=rs[rs.length-1].cum; const U=self.ud.vclass==="0.4"?0.4:Number(self.ud.vclass);
    const lim=self.ud.vclass==="0.4"?self.settings.du04:self.settings.du10;
    const kpi=(c,v,u2)=>self.el("div",{class:"kpi-item"},[self.el("b",{},[v+u2]),""]); 
    out.append(self.el("div",{class:"kpi"},[kpi("",tot.toFixed(2),"% — суммарная потеря от источника до конца линии"),kpi("",U.toFixed(1)," кВ — Uном"),kpi("",(100-tot).toFixed(1),"% — U у приёмника (относ.)"),kpi(lim,"","")].filter((...a)=>a)));
    out.innerHTML="<h3>Потери по участкам</h3>"+rs.map((x,i)=>"<div class='remark "+(x.cum<=lim?"ok":"bad")+"'>Участок "+(i+1)+" ("+x.s+" мм², "+x.P+" кВт): I="+self.fmt(x.I,1)+" А · r="+x.r.toFixed(3)+" · x="+x.x.toFixed(2)+" Ом/км · ΔU="+self.fmt(x.pct,2)+"% · нарастающим ИТОГО "+self.fmt(x.cum,2)+"%</div>").join("")
      + "<div class='remark "+(tot<=lim?"ok":"bad")+"' style='font-weight:700'>ΣΔU = "+self.fmt(tot,2)+"% " + (tot<=lim?"≤" :">") + " ПДУ "+lim+"% "+(tot<=lim?"— допустимо":"— ПРЕВЫШЕНИЕ (увеличьте сечения/длину сократите/R…)")+"</div>"
      + "<div class='muted'>Формула 3ф: ΔU% = 100·√3·I·L·(r·cosφ+x·sinφ)/(U·1000); для 1ф — без √3 (2·I·L·(...)/Uф). r при θ="+this.ud.theta+" °С (пересчёт r=r20·(1+0,004·(θ−20))).</div>"; },
  renderUdropScheme(){ const t=this.$("#udropSchemeTable"); if(!t)return; t.innerHTML="";
    t.append(this.el("tr",{html:"<th>Путь источник → потребитель</th><th>Сечения/длины</th><th>ΣΔU, %</th><th>U у приёмника, %</th>"}));
    const self=this;
    (function walk(id,cum,desc){ const n=self.byId(id);
      if(n.type==="load"||n.children==null){ }
      const kids=self.children(id);
      if(!kids.length){ const last=desc.length; t.append(self.el("tr",{html:"<td>"+self.esc2(n.label)+"</td><td>"+desc.map(d=>self.esc2(d)).join(" → ")+"</td><td class='num'>"+(cum.length?self.fmt(cum.reduce((a,x)=>a+x.pct,0),2):"—")+"</td><td class='num'>"+(cum.length?self.fmt(100-cum.reduce((a,x)=>a+x.pct,0),1):"—")+"</td>"})); }
      kids.forEach(k=>{ const r=self.resMap[k.id]; let entry=null;
        if(r&&r.res&&r.res.best&&k.line){ const b=r.res.best; entry=k.line.vclass+"кВ "+b.s+"мм²/"+k.line.L+"м"; 
          walk(k.id,cum.concat([{pct:b.dU?b.dU.pct:0}]),desc.concat([entry])); return; }
        walk(k.id,cum,desc); }); })(self.state.nodes.find(n=>!n.par).id,[],[]); },

  /* ================= ПОТЕРИ ЭНЕРГИИ (Методика) ================= */
  bindMTD(){ const self=this;
    this.$("#btnMtdCalc").onclick=()=>self.mtdCalc();
    this.$("#btnMtdExample").onclick=()=>{ self.state=self.templates()[1]; self.mtdForm=Object.assign(self.mtdForm,{wp:null}); self.recalc(); self.mtdCalc(); self.toast("Загружен образец «Городская сеть»","ok"); };
    this.$("#mtdMethod").textContent=
"Методические рекомендации по определению потерь электроэнергии в городских электрических сетях напряжением 10(6)–0,4 кВ (Роскоммунэнерго / ЗАО «АСУ Мособлэлектро», утв. 23.04.2001).\n"+
"Применяемые формулы (в нумерации Методики):\n"+
"  (6)   Iср = W·10³ / (√3·Uср·t·cosφср) А — средний ток линии за период по электроэнергии W (кВт·ч); при отсутствии W — Iср≈Kгр·Iмакс.\n"+
"  (13)  τ = (0,105 + T/12500)·T  (ч) — время максимальных потерь по часам использования максимума T (приближённая формула Методики / РД 34.09.101-94);\n"+
"  (2,5) RΣ = Σ r0i·li (с учётом коэффициента эквивалентности Kэ для разветвлённых линий, п.16.5, рис.1 — по умолчанию 1).\n"+
"  (1)   ΔWл = ΔW′A + ΔW″A, где потери от передачи активной и реактивной мощностей: в данном модуле считается напрямую по среднему току: ΔWл = 3·Iср²·R∑·τ·10⁻³ кВт·ч (экв. формулам (2)–(4)).\n"+
"  (26)  Kд.п = 1 + (R0/Rф)·Kn² — добавочные потери из–за неравномерной загрузки фаз; Kn=(√(Ia²+Ib²+Ic²)/(√3·Iср)) (27–28);  Iср=(Ia+Ib+Ic)/3; однофазные сети без замеров: Kд.п=1.\n"+
"  (10)  Iм = P/(√3·U·cosφ) — средний максимальный рабочий ток ТР;  kз = Iм/Iн.т (12).\n"+
"  (11)  ΔWтр = ΔPхх·t + ΔPкз·kз²·τ кВт·ч.\n"+
"  (14)  T = W/(Pм·cosφ…) фактически T=W/(U·Pmax·…) — программа берёт T из настроек (часы использования максимума), а t — расчётные часы работы.\n"+
"Примечание: формулы (6,11,13…) приведены в согласованном с Методикой инженерном виде; при использовании сертифицированных расчётных программ (АНСИ и др.) результаты не нормируются к этому модулю."; },
  renderMTDForm(){ const host=this.$("#mtdForm"); if(!host)return; this.mtdForm=this.mtdForm||{T:this.settings.TmaxHours,t:this.settings.tCalcHours,kdOn:true}; const self=this,f=this.mtdForm; const g=self.el("div",{class:"formgrid"}); host.append(g);
    const N=(lab,key)=>{const i=self.el("input",{type:"number",step:"any",value:f[key]});i.onchange=e=>{f[key]=+e.target.value;self.mtdCalc();};g.append(self.el("label",{class:"f"},[self.el("b",{},[lab]),i]));};
    N("T — часов использования максимума (для τ)","T"); N("t — расчётный период работы сети, ч","t");
    g.append(self.el("label",{class:"f inline"},[self.el("b",{},"Учитывать Kд.п (неравномерность фаз)"),self.el("input",{type:"checkbox",...(f.kdOn?{checked:""}:{}),onchange:e=>{f.kdOn=e.target.checked;self.mtdCalc();}})])); },
  mtdCalc(){ const self=this; const f=Object.assign({T:5000,t:8760},this.mtdForm||{}); const host=this.$("#mtdTable"); if(!host)return; host.innerHTML="";
    this.$("#mtdSummary")&&0; const out=this.$("#mtdSummary");
    const tau=Eng.tauHours(f.T);
    host.append(this.el("tr",{html:"<th>Элемент</th><th>тип</th><th>P расч., кВт</th><th>Iср/Iм, А</th><th>R∑ / ΔPхх·ΔPкз</th><th>Kд.п/kз</th><th>ΔW за t, кВт·ч</th>"}));
    let Wtot=0,Wline=0,Wtr=0; const esc=this.esc2.bind(this);
    this.state.nodes.forEach(n=>{ const r=self.resMap[n.id]; if(!n.line||!r||!r.res||!r.res.best)return; const b=r.res.best; const I=r.res.IrA||0;
      const Lkm=(+n.line.L||0)/1000; const mat=n.line.mat;
      const R=(b.r!=null?b.r:Eng.rAt(b.s,mat==="al"?"al":"cu",self.settings.thetaJob||90))*Lkm;
      const Icp=I; let kd=1,kdt="";
      if(n.type==="load"&&f.kdOn&&n.data&&n.data.Ia){ const kd2=Eng.kDop(+n.data.Ia||0,+n.data.Ib||0,+n.data.Ic||0, (n.data.R0over!=null?+n.data.R0over:1)*R, R); kd=kd2.Kdp; kdt="Kн="+self.fmt(kd2.Kn,2); }
      const dW=3*Icp*Icp*R*tau*1e-3*kd*(n.line.ph==="1"?2/3:1);
      Wline+=dW; Wtot+=dW;
      host.append(self.el("tr",{html:"<td>"+esc(n.label)+"</td><td>"+(n.line.kind==="vl"?"ВЛ":"КЛ")+" "+n.line.vclass+" кВ</td><td class='num'>"+self.fmt(r.line.P||0,0)+"</td><td class='num'>"+self.fmt(Icp,0)+"</td><td class='num'>"+self.fmt(R,3)+" Ом</td><td class='num'>"+self.fmt(kd,2)+" "+esc(kdt)+"</td><td class='num'>"+self.fmt(dW,0)+"</td>"}));
      if(n.type==="tr"&&n.data&&n.data.S){ const Inom=(n.data.S)/(Math.sqrt(3)*(self.voltU(n.line)||10)); const Im=I||0; const kz=Inom?Im/Inom:0;
        const dWt=(n.data.Pxx||0)*f.t+(n.data.Pk||0)*kz*kz*tau; Wtr+=dWt; Wtot+=dWt;
        host.append(self.el("tr",{html:"<td>"+esc(n.label)+"</td><td>трансформатор "+(n.data.S||"")+" кВА</td><td class='num'>"+self.fmt(r.line.P||0,0)+"</td><td class='num'>"+self.fmt(Im,0)+" (Iм)</td><td class='num'>ΔPхх="+(n.data.Pxx||"—")+" / ΔPкз="+(n.data.Pk||"—")+" кВт</td><td class='num'>kз="+self.fmt(kz,2)+"</td><td class='num'>"+self.fmt(dWt,0)+"</td>"})); } });
    const Pmax=self.state.nodes.filter(n=>n.type==="load").reduce((a,n)=>a+ (+n.data.P||0)*  (n.line&&n.line.Ks||1),0);
    const Wgen=Pmax? Pmax*f.t :0; const rel=Wgen?100*Wtot/Wgen:0;
    out.innerHTML= out? "<div class='kpi'><div class='kpi-item'><b>"+self.fmt(tau,0)+" ч</b>τ (время макс. потерь)</div><div class='kpi-item'><b>"+self.fmt(Wline,0)+" кВт·ч</b>потери в линиях ΔWл (3·Iср²·R·τ·Kд.п)</div><div class='kpi-item'><b>"+self.fmt(Wtr,0)+" кВт·ч</b>потери в трансформаторах ΔWтр (ΔPхх·t+ΔPкз·kз²·τ)</div><div class='kpi-item'><b>"+self.fmt(Wtot,0)+" кВт·ч ≈ "+self.fmt(rel,2)+"%</b>итого относительно W=ΣP·t (формулы 1–18 Методики)</div></div>" : "";
    this.mtdLast={tau,Wline,Wtr,Wtot,rel}; },

  loadExampleMTD(){},
});
