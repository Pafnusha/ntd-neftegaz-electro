/* UI4 — отчёты и экспорт (Word .doc / Excel .xls / CSV / PNG / печать) */
Object.assign(App,{
  download(name,text,mime){ const a=new Blob(["\uFEFF"+text],{type:(mime||"text/plain")+";charset=utf-8"});
    const u=URL.createObjectURL(a); const l=document.createElement("a"); l.href=u; l.download=name; document.body.append(l); l.click();
    setTimeout(()=>{ l.remove(); URL.revokeObjectURL(u); },400); },
  downloadBlob(name,blob){ const u=URL.createObjectURL(blob); const l=document.createElement("a"); l.href=u; l.download=name; document.body.append(l); l.click(); setTimeout(()=>{l.remove();URL.revokeObjectURL(u);},400); },
  collect(){ const self=this,out=[]; this.state.nodes.forEach(n=>{ if(!n.line)return; const r=self.resMap[n.id]; if(!r||r.skipped||!r.res)return; out.push({n,line:n.line,res:r.res,err:r.error}); }); return out; },
  mtdFormInit(){ this.mtdForm=this.mtdForm||{T:5000,t:8760,kdOn:true}; return this.mtdForm; },

  bindReport(){ const self=this, host=self.$("#reportForm");
    if(host){ host.innerHTML="";
      const org=self.el("input",{type:"text",value:"Проектная организация"});
      const obj=self.el("input",{type:"text",value:self.state.name||""});
      const base=self.el("input",{type:"text",value:"3300-E-000-EL-PHI-00009-00-D ред.03U; ПУЭ изд.7 гл.1.3/3.1/7.3; ГОСТ 32144-2013; ГОСТ 31996-2012; ГОСТ 31565-2012; ГОСТ Р 50571.5.52-2011; IEC 60364-5-52 / 60502; каталоги NED-Plagum 2025; Метод. рекомендации Роскоммунэнерго 2001"});
      self.rep={org,obj,base};
      host.append(self.el("div",{class:"formgrid"},[
        self.el("label",{class:"f"},[self.el("b",{},["Организация"]),org]),
        self.el("label",{class:"f"},[self.el("b",{},["Объект"]),obj]),
        self.el("label",{class:"f"},[self.el("b",{},["Основание / НТД"]),base])]));
      const opts=self.el("div",{style:"display:flex;gap:14px;flex-wrap:wrap;margin-top:8px"},[]);
      [["optF",1,"формулы и обоснование"],["optAll",0,"таблица всех сечений"],["optNTD",1,"схема + перечень НТД"]].forEach(o=>{
        const c=self.el("input",{type:"checkbox",...(o[1]?{checked:""}:{})}); c.dataset.k=o[0];
        opts.append(self.el("label",{class:"f inline"},[c,self.el("span",{},[o[2]])])); });
      host.append(opts); }
    const on=k=>{const e=self.$("#reportForm input[data-k="+k+"]"); return e?e.checked:true;}; self.optOn=on;
    const bw=self.$("#btnDocWord"); if(bw)bw.onclick=()=>{ self.download((self.rep.obj.value||"raschet")+"-otchet.doc",self.buildDoc(true),"application/msword"); self.toast("Отчёт Word (.doc) готов","ok"); };
    const bx=self.$("#btnDocExcel"); if(bx)bx.onclick=()=>self.download("vedomost-linej.xls",self.buildXls(),"application/vnd.ms-excel");
    const bc=self.$("#btnDocCSV"); if(bc)bc.onclick=()=>self.download("lines.csv",self.buildCSV(),"text/csv");
    const bp=self.$("#btnSchemePNG"); if(bp)bp.onclick=()=>self.schemePNG();
    const bpr=self.$("#btnPrint"); if(bpr)bpr.onclick=()=>{ const w=window.open("","_blank"); w.document.write(self.buildDoc(true)); w.document.close(); setTimeout(()=>w.print(),600); }; },

  srcLabel(line){ return {"auto":"IEC (в воздухе) + ГТП ПУЭ (в земле)","IEC-LV":"проектная методика табл.1 (IEC 60364-5-52, медь)","GTP-PUYE":"ГТП ПУЭ п.1.3.10 (проводники с пластмассовой изоляцией)","SN3x":"каталог NED-Plagum SN, 3-жильные","SN1x":"каталог NED-Plagum SN, 1-жильные","IEC-HV":"проектная методика табл.2 (IEC 60502-2)","VL-AC":"ПУЭ табл.1.3.29 (неизолированные провода)","VL-SIP":"СИП-4 (ГТП)"}[line.src]||line.src; },
  docSection(x,i){ const self=this,n=x.n,line=n.line,S=self.settings,par=self.byId(n.par);
    const effP=(line.P!==""&&line.P!=null)?+line.P:((self.effLoad(n)||{}).P||0);
    let h="<h3>"+(i+1)+". "+self.esc((par?par.label:"—")+" → "+n.label)+" — "+(line.kind==="vl"?"ВЛ ":"КЛ ")+line.vclass+" кВ</h3>";
    h+="<p><b>Исходные данные:</b> P="+self.fmt(effP,1)+" кВт; cosφ="+(+line.cos||0.8)+"; Kс="+(+line.Ks||1)+"; L="+(+line.L||0)+" м; "+(line.ph==="1"?"1 фаза":"3 фазы")+"; прокладка: "+self.esc((DATA.methods[line.method]||{label:"—"}).label)+"; число кабелей/цепей "+(line.nParallel||1)+"; зазор "+(line.gap||100)+" мм; t возд. "+(line.tAir!=null?line.tAir:S.Tair)+" °С; t грунта "+(line.tSoil!=null?line.tSoil:S.Tsoil)+" °С; ρ грунта "+(line.rho||S.rho)+" К·м/Вт; "+(line.cores||4)+"-ж. "+(line.mat==="al"?"алюминий":"медь")+"; база данных: "+self.esc(self.srcLabel(line))+(line.notes?"; заметка: "+self.esc(line.notes):"")+".</p>";
    const b=x.res.best;
    if(!b){ h+="<p><b>Сечение не найдено</b>: ни один кандидат не проходит совмещённые проверки. См. замечания.</p>"; return h; }
    h+="<p><b>Принято: "+self.esc(self.markOf(line,b))+"</b> · Iдоп.факт = "+self.fmt(b.Idp,0)+" А; Iр = "+self.fmt(x.res.IrA,1)+" А"+(x.res.kAdd!==1?"; требуемый с учётом доп. множителей = "+self.fmt(x.res.Kneed,0)+" А":"")+".</p>";
    h+="<p><b>Формулы:</b><br>";
    h+="Iр = "+(line.ph==="1"?"Kс·P·10³/(Uф·cosφ)":"Kс·P·10³/(√3·U·cosφ)")+" = "+self.fmt(x.res.IrA,1)+" А<br>";
    h+="Iдоп.ф = Iкат·kθ·kсред = "+self.fmt(b.Icat,0)+" · "+self.fmt(b.kT,3)+" · "+self.fmt(b.kGrp,3)+" = "+self.fmt(b.Idp,0)+" А, где kθ = √((θраб−tср)/(θкат−tкат)) по формуле (1) IEC / проектной методики: θкат="+b.theta0+" °С, tср="+b.tFact+" °С<br>";
    h+="группировка/среда: "+self.esc(b.groupNote||"")+(b.rho!=null?"; ρ="+b.rho+" К·м/Вт — ПУЭ табл.1.3.23":"")+"; (метод. §7.7: kGA/kHA; ПУЭ 1.3.26 на число кабелей в траншее)<br>";
    h+="ΔU = "+(line.ph==="1"?"2·I·L·(r0·cosφ+x0·sinφ)/Uф":"√3·I·L·(r0·cosφ+x0·sinφ)/U")+" = "+self.fmt(b.dU.V,1)+" В = "+self.fmt(b.dU.pct,2)+" % ≤ "+(line.allowedPct!=null?line.allowedPct:"—")+" % (метод. §7.9, ГОСТ 32144)<br>";
    h+="r0(θраб) = "+self.fmt(b.r,3)+" Ом/км; x0 = "+self.fmt(b.x,3)+" Ом/км<br>";
    if(b.checks.minS)h+="мех. прочность: "+b.s+" мм² ≥ "+(line.mat==="al"?S.minS_al:S.minS_cu)+" мм² — "+(b.checks.minS.ok?"выполнено":"НАРУШЕНО")+"<br>";
    if((line.protect||line.prot)&&(line.protect||line.prot).ust&&b.checks.mtz)h+="МТЗ (ПУЭ 3.1.11): Iуст="+(line.protect||line.prot).ust+" А ≤ "+b.checks.mtz.need+"·Iдоп.ф = "+self.fmt(b.checks.mtz.need*b.Idp,0)+" А; фактическая доля уставки "+self.fmt(b.checks.mtz.val*100,0)+"% — "+(b.checks.mtz.ok?"выполнено":"НАРУШЕНО")+"<br>";
    if(b.checks.sc)h+="термостойкость при КЗ (метод. §7.10): "+self.esc(b.checks.sc.txt)+" — "+(b.checks.sc.ok?"выполнено":"нарушено")+"<br>";
    if(b.checks.start)h+="пусковой ΔU (метод. §7.9, 15%): "+self.esc(b.checks.start.txt)+" — "+(b.checks.start.ok?"выполнено":"нарушено")+"<br>";
    if(line.motor&&line.motor.branch)h+="отпаечная к ЭД: Iдоп ≥ 1,25·Iн (ПУЭ 3.1.12/7.3.97, метод. §7.2)<br>";
    h+="</p>"; return h; },

  buildDoc(full){ const self=this,S=self.settings,R=self.rep,now=new Date().toLocaleString("ru-RU");
    let h="<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'>";
    h+="<style>body{font-family:'Times New Roman',serif;font-size:12pt}h1{font-size:15pt;text-align:center}h2{font-size:13pt}h3{font-size:12pt}table{border-collapse:collapse}td,th{border:1px solid #505050;padding:2px 6px;font-size:9.5pt}p{margin:4px 0}</style></head><body>";
    h+="<h1>РАСЧЁТ ВЫБОРА СЕЧЕНИЙ КАБЕЛЬНЫХ И ВОЗДУШНЫХ ЛИНИЙ 0,4 / 6–35 кВ</h1>";
    h+="<p>"+self.esc(R.org.value||"")+" · объект: "+self.esc(R.obj.value||self.state.name||"")+" · "+now+"</p>";
    h+="<p><i>Основание: "+self.esc(R.base.value||"")+". Методика: расчётный ток; длительно допустимый ток с поправками на температуру среды, ρ грунта и группировку; допустимые потери напряжения; минимальное сечение; проверка по аппаратуре защиты (кратности ПУЭ 3.1.11); термическая стойкость по адиабатному уравнению; невозгораемость по ГОСТ 31565. Кабельная продукция — по каталогам NED-Plagum (ЭПР, 0,66–35 кВ). Режим расчёта: "+({all:"вся цепочка",hv:"только 6–35 кВ",lv:"только 0,4 кВ"}[S.calcScope]||"вся цепочка")+".</i></p>";
    h+="<p><b>Расчётные формулы (общие):</b><br>Iр = Kс·P·10³/(√3·U·cosφ) [3ф]; Iр = Kс·P·10³/(Uф·cosφ) [1ф].<br>kθ = √((θраб−tср)/(θкат−tкат)) — формула (1) проектной методики / IEC.<br>Iдоп.ф = Iкат·kθ·kсред (kсред: ПУЭ 1.3.26×1.3.23 в земле; kGA IEC / каталог NED в воздухе).<br>ΔU% = 100·√3·I·L·(r0·cosφ+x0·sinφ)/(U·1000) [3ф]; для 1ф — множитель 2 и Uф.<br>Sмин.КЗ = Iкз·√t / K (K=143 Cu XLPE/EPR; 92 Al).</p>";
    let sec=0;
    if(full){ sec++; h+="<h2>"+sec+". Расчётная (однолинейная) схема</h2>";
      try{ const u=self.schemeImgSrc(); if(u)h+="<p style='text-align:center'><img src='"+u+"' width='640'></p>"; }catch(e){ h+="<p class='muted'>(схема не встроена)</p>"; }
    }
    sec++; h+="<h2>"+sec+". Ведомость линий</h2><table><tr><th>№</th><th>Участок</th><th>U,кВ</th><th>тип</th><th>P,кВт</th><th>L,м</th><th>Iр,А</th><th>Марка и сечение кабеля</th><th>Iдоп.ф,А</th><th>ΔU, %</th><th>оценка</th></tr>";
    const rows=self.collect();
    rows.forEach((x,i)=>{ const b=x.res.best,line=x.line,par=self.byId(x.n.par)||{};
      const effP=(line.P!==""&&line.P!=null)?+line.P:((self.effLoad(x.n)||{}).P||0);
      h+="<tr><td>"+(i+1)+"</td><td>"+self.esc(par.label+" → "+x.n.label)+"</td><td>"+(line.kind==="vl"?"ВЛ ":"КЛ ")+(+line.vclass===0.4?"0,4":line.vclass)+"</td><td>"+(line.ph==="1"?"1ф":"3ф")+"</td><td>"+self.fmt(effP,0)+"</td><td>"+(line.L||"—")+"</td><td>"+self.fmt(x.res.IrA,0)+"</td><td>"+(b?self.esc(self.markOf(line,b)):"—")+"</td><td>"+(b?self.fmt(b.Idp,0):"—")+"</td><td>"+(b&&b.dU?self.fmt(b.dU.pct,2):"—")+"</td><td>"+(b?(["PDT","dU","mtz","sc","minS","start","fire"].every(k=>!b.checks[k]||b.checks[k].ok)?"годен":"с замеч."):  "не годен")+"</td></tr>"; });
    h+="</table>";
    if(self.mtdLast){ sec++; const m=self.mtdLast;
      h+="<h2>"+sec+". Потери электроэнергии (по «Методическим рекомендациям… 10(6)-0,4 кВ» Роскоммунэнерго, 2001)</h2><p>τ=(0,105+T/12500)·T = "+self.fmt(m.tau,0)+" ч при T="+self.fmt(self.mtdForm.T,0)+" ч; формулы (6,13); линии: ΔWл = 3·Iср²·RΣ·τ·10⁻³·Kд.п = "+self.fmt(m.Wline,0)+" кВт·ч; трансформаторы: ΔWтр = ΔPхх·t + ΔPкз·kз²·τ = "+self.fmt(m.Wtr,0)+" кВт·ч; итого "+self.fmt(m.Wtot,0)+" кВт·ч, что ≈ "+self.fmt(m.rel,2)+"% от отпускной энергии ΣP·t.</p>"; }
    if(full){ sec++; h+="<h2>"+sec+". Детальный расчёт и обоснование</h2>"; rows.forEach((x,i)=>{ h+=self.docSection(x,i); }); }
    if(full&&self.optOn("optAll")){ sec++; h+="<h2>"+sec+". Приложение — все сечения</h2>";
      rows.forEach(x=>{ const r=x.res; if(!r.cands.length)return;
        h+="<h3>"+self.esc(x.n.label)+" ("+x.line.vclass+" кВ) "+self.esc(self.markOf(x.line,r.best))+"</h3><table><tr><th>s, мм²</th><th>Iкат, А</th><th>kθ</th><th>kсред</th><th>Iдоп.ф, А</th><th>ΔU, %</th><th>Итог</th></tr>";
        r.cands.forEach(c=>{ h+="<tr><td>"+c.s+"</td><td>"+self.fmt(c.Icat,0)+"</td><td>"+self.fmt(c.kT,3)+"</td><td>"+self.fmt(c.kGrp,3)+"</td><td>"+self.fmt(c.Idp,0)+"</td><td>"+(c.dU?self.fmt(c.dU.pct,2):"")+"</td><td>"+(c===r.best?"★ принято":(c.pass?"проходит":"—"))+"</td></tr>"; }); h+="</table>"; }); }
    if(full&&self.optOn("optNTD")){ h+="<h2>Приложение — использованные документы</h2><ul>";
      DATA.documents.forEach(d=>{ h+="<li><b>"+self.esc(d[0])+"</b> — "+self.esc(d[1])+"</li>"; }); h+="</ul>"; }
    h+="</body></html>"; return h; },
  buildXls(){ const self=this;
    let h="<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='utf-8'></head><body><table border='1'><tr><th>Участок</th><th>U кВ</th><th>ВЛ/КЛ</th><th>ф</th><th>P кВт</th><th>cosφ</th><th>Kс</th><th>L м</th><th>способ прокладки</th><th>Iр А</th><th>сечение мм²</th><th>кабель</th><th>Iдоп.ф А</th><th>ΔU %</th><th>ΔU доп %</th><th>уставка Защ А</th><th>проверки</th></tr>";
    self.collect().forEach(x=>{ const l=x.line,b=x.res.best; const par=self.byId(x.n.par)||{};
      const eff=(l.P!==""&&l.P!=null)?+l.P:((self.effLoad(x.n)||{}).P||0);
      h+="<tr><td>"+self.esc(par.label+" → "+x.n.label)+"</td><td>"+l.vclass+"</td><td>"+(l.kind==="vl"?"ВЛ":"КЛ")+"</td><td>"+(l.ph||"3")+"</td><td>"+eff+"</td><td>"+(l.cos||0.8)+"</td><td>"+(l.Ks||1)+"</td><td>"+(l.L||"")+"</td><td>"+self.esc((DATA.methods[l.method]||{}).label||"")+"</td><td>"+self.fmt(x.res.IrA,1)+"</td><td>"+(b?b.s:"—")+"</td><td>"+(b?self.esc(self.markOf(l,b)):"—")+"</td><td>"+(b?self.fmt(b.Idp,0):"")+"</td><td>"+(b&&b.dU?self.fmt(b.dU.pct,2):"")+"</td><td>"+(l.allowedPct||"")+"</td><td>"+(((l.protect||l.prot)&& (l.protect||l.prot).ust)||"")+"</td><td>"+(b?["PDT","dU","mtz","sc","minS","start"].filter(k=>b.checks[k]).map(k=>k+(b.checks[k].ok?"+":"−")).join(" "):"")+"</td></tr>"; });
    return h+"</table></body></html>"; },
  buildCSV(){ const self=this; const q=v=>'\"'+String(v==null?"":v).replace(/"/g,'""')+"\"";
    let s="Участок;UкВ;тип;ф;P кВт;cos;Kс;L м;способ;Iр А;сечение;кабель;Iдопф А;ΔU%;ПДУ %;Iуст А;проверки\n";
    self.collect().forEach(x=>{ const l=x.line,b=x.res.best;
      const chk=b?["PDT","dU","mtz","sc","minS","start"].filter(k=>b.checks[k]).map(k=>k+":"+(b.checks[k].ok?"OK":"NO")).join(", "):"нет сечения";
      s+=[q(((self.byId(x.n.par)||{}).label||"")+" -> "+x.n.label),l.vclass,(l.kind==="vl"?"ВЛ":"КЛ"),(l.ph||"3"),((l.P!==""&&l.P!=null)?l.P:((self.effLoad(x.n)||{}).P||0)),(l.cos||""),(l.Ks||1),(l.L||0),q((DATA.methods[l.method]||{}).label||""),self.fmt(x.res.IrA,1),(b?b.s:""),q(b?self.markOf(l,b):""),(b?self.fmt(b.Idp,0):""),(b&&b.dU?self.fmt(b.dU.pct,2):""),(l.allowedPct||""),(((l.protect||l.prot)&& (l.protect||l.prot).ust)||""),q(chk)].join(";")+"\n"; });
    return s; },
  schemeImgSrc(){ const svg=self.$("#schemeCanvas svg"); if(!svg)throw new Error("no svg");
    const xml=new XMLSerializer().serializeToString(svg);
    return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(xml))); },
  schemePNG(){ const self=this; const svg=self.$("#schemeCanvas svg"); if(!svg){ self.toast("нет схемы для экспорта","err"); return; }
    const xml=new XMLSerializer().serializeToString(svg);
    const w=svg.getAttribute("width")||1200,hh=svg.getAttribute("height")||700,scale=2;
    const img=new Image();
    img.onload=()=>{ const c=document.createElement("canvas"); c.width=+w*scale; c.height=+hh*scale;
      const g=c.getContext("2d"); g.fillStyle="#ffffff"; g.fillRect(0,0,c.width,c.height);
      g.drawImage(img,0,0,c.width,c.height);
      c.toBlob(b=>{ if(b){ self.downloadBlob("shema-seti.png",b); self.toast("Схема PNG скачана","ok"); } else self.toast("не удалось сохранить PNG","err"); },"image/png"); };
    img.onerror=()=>self.toast("SVG не растеризовался (шрифты?)","err");
    img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(xml); },
  renderReportPreview(){ const host=self && this.$("#reportPreview"); if(host) host.innerHTML=this.buildDoc(false); }
});
