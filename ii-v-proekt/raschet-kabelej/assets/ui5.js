/* UI5 — вкладка НТД (нормативные таблицы), инструкция, запуск тестов */
Object.assign(App,{
  bindNTD(){ const self=this; const host=self.$("#ntdSections"); if(!host)return; host.innerHTML=""; const nav=self.$("#ntdNav"); nav.innerHTML="";
    const mk=(id,title,fill)=>{ const c=self.el("div",{class:"card ntd-sec",id:"ntd-"+id}); c.dataset.key=title.toLowerCase();
      c.append(self.el("h2",{},[title])); if(fill)fill(c); host.append(c);
      nav.append(self.el("div",{class:"chip",onclick:()=>{const e=document.getElementById("ntd-"+id);if(e)e.scrollIntoView({behavior:"smooth"});}},[id.toUpperCase()])); };
    const TB=rows=>{ let h="<div class='table-wrap'><table class='tbl'>"+rows.join("")+"</table></div>"; return h; };

    mk("yamal1","Ямал СПГ · Таблица 1 — длительно допустимые токи НН, 0,66/1 кВ, медь XLPE/аналог (90 °С; t возд 30 °С; IEC 60364-5-52)",c=>{
      c.append(self.$parse(TB(["<tr><th>сечение, мм²</th><th>в воздухе — лоток лестничный/перфорир. (B52.12-E/F)</th><th>в трубе (B52.5-B2)</th></tr>"]
        .concat(DATA.lvYamal.map(r=>"<tr><td class='num'>"+r[0]+"</td><td class='num'>"+r[1]+"</td><td class='num'>"+(r[2]!=null?r[2]:"— (не нормируется &gt;300)")+"</td></tr>")))));});
    mk("yamal2","Ямал СПГ · Таблица 2 — токи ВН брон. 3,6/6–18/30 кВ (Cu XLPE, IEC 60502-2 B6/B2) в воздухе",c=>{
      const keys=[...new Set(DATA.hvYamalAir.c3.map(r=>r.s).concat(Object.keys(DATA.hvYamalAir.c1trefoil).map(Number)))].sort((a,b)=>a-b);
      const rowsY=["<tr><th>сечение</th><th>3С (B.6)</th><th>1С тр-к (B.2)</th></tr>"];
      keys.forEach(s2=>{ const c3=DATA.hvYamalAir.c3.find(r=>r.s===s2), c1=DATA.hvYamalAir.c1trefoil[s2];
        rowsY.push("<tr><td class='num'>"+s2+"</td><td class='num'>"+(c3?c3.i:"—")+"</td><td class='num'>"+(c1!=null?c1:"—")+"</td></tr>"); });
      c.append(self.$parse(TB(rowsY)));});
    mk("yamal3","Ямал · kAT — коэффициенты по температуре воздуха (формула (1): k=√((K−T)/(K−t)); K=90 XLPE/EPR · 70 PVC · 65 бумага; t=30 — в воздухе)",c=>{
      let h="<div class='table-wrap'><table class='tbl'><tr>"; Object.keys(DATA.airTempTable).forEach(t=>h+="<th>"+t+" °С</th>"); h+="</tr><tr>";
      Object.values(DATA.airTempTable).forEach(v=>h+="<td class='num'>"+v+"</td>"); h+="</tr></table></div>"; c.append(self.$parse(h));});
    mk("yamal4","Ямал §7.7 — общие коэффициенты снижения (типовые маршруты проекта)",c=>{
      let h="<table class='tbl'><tr><th>назначение</th><th>Σ k</th><th>состав</th></tr>";
      DATA.yamalOverall.forEach(r=>h+="<tr><td>"+self.esc(r.name)+"</td><td class='num'>"+r.f+"</td><td class='muted'>"+self.esc(r.d)+"</td></tr>"); c.append(self.$parse(h+"</table>"));});
    mk("yamal5","Ямал §7.9 — допустимые потери напряжения; ГОСТ 32144-2013",c=>{
      let h="<table class='tbl'><tr><th>цепь/назначение</th><th>ПДУ, %</th></tr>";
      DATA.duYamal.forEach(r=>h+="<tr><td>"+self.esc(r[0])+"</td><td class='num'>"+r[1]+"</td></tr>");
      h+="</table><ul class='muted' style='padding-left:18px'>"; DATA.uLimits.forEach(u=>h+="<li><b>"+self.esc(u.t)+"</b> — "+self.esc(u.txt)+"</li>"); h+="</ul>"; c.append(self.$parse(h));});
    mk("yamal6","Ямал §7.10 — выдерживаемые токи КЗ (проект Ямал: таблица времени/тока; адиабатное S=I·√t/K)",c=>{
      let h="<table class='tbl'><tr><th>элемент сети</th><th>Iкз / t</th></tr>";
      DATA.scWithstand.forEach(r=>h+="<tr><td>"+self.esc(r.u)+"</td><td>"+r.v+"</td></tr>"); h+="</table><p class='muted'>S(мм²) = Iкз(А)·√t(с) / K. XLPE/EPR медь: K=143, Al: 92 (250 °С). Для кабеля с бумажн. — ПУЭ-методика.</p>"; c.append(self.$parse(h));});
    mk("klist","Коэффициент K материала (адиабатное уравнение, Ямал §7.10 / IEC 60364-4-43)",c=>{
      let h="<table class='tbl'><tr><th>токопровод/изоляция (нач→кон)</th><th>K, А·√с/мм²</th></tr>";
      DATA.kAdiabatic.forEach(r=>h+="<tr><td>"+self.esc(r.m)+"</td><td class='num'>"+r.k+"</td></tr>"); c.append(self.$parse(h+"</table>"));});
    mk("pue133","ПУЭ(7) табл. 1.3.3 — поправки на температуру земли/воздуха (строки: усл. t среды+норм. t жил)",c=>{
      let h="<div class='table-wrap'><table class='tbl'><tr><th>t усл. / t жил</th>"+DATA.kTempPueCols.map(t=>"<th>"+t+" °С</th>").join("")+"</tr>";
      DATA.kTempPue.forEach(r=>{ h+="<tr><td>"+r[0]+" / "+r[1]+"</td>"+r[2].map(v=>"<td class='num'>"+(v!=null?v:"—")+"</td>").join("")+"</tr>"; });
      c.append(self.$parse(h+"</table></div>"));});
    mk("pue1323","ПУЭ(6) табл. 1.3.23 — на удельное сопротивление грунта (база 120 см·К/Вт = 1,2 К·м/Вт)",c=>{
      let h="<table class='tbl'><tr>"+DATA.kRhoPUE.map(p=>"<th>ρ "+p.rho+" смК/Вт<br>("+(p.rho/100)+" К·м/Вт)</th>").join("")+"</tr><tr>"+DATA.kRhoPUE.map(p=>"<td class='num'>"+p.k+"</td>").join("")+"</tr></table><p class='muted'>Вне таблицы — интерполяция; выше 3,0 — √-экстраполяция (в движке).</p>"; c.append(self.$parse(h));});
    mk("pue1326","ПУЭ(6) табл. 1.3.26 — на число силовых кабелей, проложенных рядом в земле (без нулевых и контрольных)",c=>{
      let h="<div class='table-wrap'><table class='tbl'><tr><th>зазор\\\\кабели</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th></tr>";
      Object.entries(DATA.kTrenchPUE).forEach(([g,v])=>{ h+="<tr><td>"+g+" мм</td>"+v.map(k=>"<td class='num'>"+k+"</td>").join("")+"</tr>"; });
      c.append(self.$parse(h+"</table></div>"));});
    mk("nedk","Каталог NED-Plagum SN (стр. 32–33) — коэффициенты для различных способов укладки в воздухе",c=>{
      const grp=(name,tbl)=>{ let h="<h3>"+name+"</h3><div class='table-wrap'><table class='tbl'><tr><th></th>"+tbl.cols.map(x=>"<th>"+x+"</th>").join("")+"</tr>";
        tbl.sets.forEach(s=>{ h+="<tr><td>"+(s.chan?("канал "+s.chan+": "):"")+s.name+"</td>"+s.v.map(v=>"<td class='num'>"+v+"</td>").join("")+"</tr>"; }); return h+"</table></div>"; };
        let h="<p class='muted'>Допустимые нагрузки каталога — для t проводника 90 °С и среды 30 °С (воздух).</p>";
        h+=grp("на ровной поверхности в воздухе",DATA.kGroupAirCatalog);
        h+=grp("в закрытых каналах (ограниченный теплоотвод)",DATA.kGroupChannelCatalog);
        h+=grp("в желобе (коробе) — прокладка с интервалом",DATA.kTrayCatalog);
        c.append(self.$parse(h));});
    mk("lvgt","ГТП по ПУЭ п.1.3.10 (пластмасса, θ жил 65 °С, возд. 25/земля 15) — токи 0,66–3 кВ; движок пересчитывает на 90 °С формулой (1)",c=>{
      const tab=(cap,mat,core)=>{ const T=mat==="cu"?DATA.lvGostPlastic.cu:DATA.lvGostPlastic.al;
        let h="<h3>"+cap+"</h3><div class='table-wrap'><table class='tbl'><tr><th>s</th><th>в воздухе</th><th>в земле</th></tr>";
        T[core].forEach(r=>h+="<tr><td class='num'>"+r[0]+"</td><td class='num'>"+r[1]+"</td><td class='num'>"+r[2]+"</td></tr>"); return h+"</table></div>"; };
      let h=tab("медь, 3-жильные","cu","c3")+tab("медь, 1-жильные","cu","c1")+tab("медь, 2-жильные","cu","c2")+tab("алюминий, 3-ж.","al","c3")+tab("алюминий, 1-ж.","al","c1");
      h+="<p class='muted'>4-ж. = 3-ж. ×0,92 (примечание ПУЭ к табл.1.3.7). Для 5-ж. — то же. То, что NED-Plagum ЭПР (допуст. 90/105 °С), при пересчёте на θраб = 90 °С даёт увеличение в √((90−15)/(65−15))≈1,22 (в земле) / √((90−25)/(65−25))≈1,27 (воздух, t=25).</p>";
      c.append(self.$parse(h));});
    mk("mtz","МТЗ и защита от перегрузки: ПУЭ 3.1.10–3.1.12, 7.3.97; Ямал §7.7/7.2",c=>{
      let h="<table class='tbl'><tr><th>аппарат защиты</th><th>кратность уставки к ДДТ кабеля (не более)</th></tr>";
      DATA.protectTypes.forEach(p=>h+="<tr><td>"+self.esc(p.label)+"</td><td>"+Math.round(p.m*100)+" % — "+self.esc(p.note||"")+"</td></tr>");
      h+="</table><ul class='muted' style='padding-left:18px'><li>3.1.11 — проценты в таблице выше; для бумажной изоляции 100 %, для регулируемого обратно-зависимого расцепителя 125 % (ток трогания).</li><li>3.1.12 / 7.3.97 — отпаечные линии к АД: Iдоп ≥ 100 % Iн (не ВЗ) / ≥ 125 % Iн (во взрывоопасных).</li><li>Ямал §7.8 — &gt;2 проводника на фазу: ДПТ ×0,85.</li></ul>";
      c.append(self.$parse(h));});
    mk("vl1329","ВЛ: ПУЭ(7) табл. 1.3.29 — неизолированные провода (θ 70 °С, t возд. 25 °С): «в помещ./вне»",c=>{
      let h="<div class='table-wrap'><table class='tbl'><tr><th>провод</th><th>в помещениях</th><th>вне помещений</th></tr>"; const seen={};
      DATA.vlAC.forEach(r=>{ const key=r.norm||("АС "+r.s); if(seen[key])return; seen[key]=1;
        h+="<tr><td>"+key+"</td><td class='num'>"+(r.iIn!=null?r.iIn:"—")+"</td><td class='num'>"+(r.iOut!=null?r.iOut:"—")+"</td></tr>"; });
      h+="</table></div><p class='muted'>Для ВЛ применяется столбец «вне помещений». x0: ВЛ 6–20 кВ ~0,4 Ом/км (Д≈1 м); СИП-4 ~0,15 Ом/км; r20(АС)=ρ/S (ρ≈28,6 Ом·мм²/км) — в движке по формуле, уточняется по проекту.</p>"; c.append(self.$parse(h));});
    mk("jed","Экономическая плотность тока (ПУЭ табл. 1.3.36) — справочно, критерий не включён в выбор",c=>{
      let h="<div class='table-wrap'><table class='tbl'><tr><th>проводники</th>"+DATA.jEcon.cols.map(x=>"<th>"+x+"</th>").join("")+"</tr>";
      DATA.jEcon.rows.forEach(r=>{ h+="<tr><td>"+r[0]+"</td>"+r.slice(1).map(v=>"<td class='num'>"+v+"</td>").join("")+"</tr>"; });
      c.append(self.$parse(h+"</table></div>"));});
    mk("docs","Перечень нормативных и справочных документов",c=>{ c.innerHTML="<ul>"+DATA.documents.map(d=>"<li><b>"+self.esc(d[0])+"</b> — "+self.esc(d[1])+"</li>").join("")+"</ul><p class='muted'>Ссылка на методику потерь: files.stroyinf.ru/Data1/45/45970/ (Метод. рекомендации по определению потерь электроэнергии в городских сетях 10(6)-0,4 кВ).</p>";});
    mk("form","Расчётные формулы движка",c=>{ c.append(self.$parse(self.formulasHelpText())); });
    self.$("#ntdSearch").oninput=e=>{ const q=e.target.value.toLowerCase(); document.querySelectorAll(".ntd-sec").forEach(s=>{ s.style.display=(!q)||((s.dataset.key||"")+s.textContent.toLowerCase()).includes(q)?"":"none"; }); }; },
  $parse(html){ const t=document.createElement("template"); t.innerHTML=html; return t.content; },
  formulasHelpText(){ return "<div class='formula-box'>"+
    "1) Iр=Kс·P·10³/(√3·U·cosφ) [3ф]; Iр=Kс·P·10³/(Uф·cosφ) [1ф] — Ямал 7.5 / основы МЭК.<br>"+
    "2) Iдоп.факт = Iкат · √((θраб−tср)/(θкат−tкат)) · kρ·kгрупп · kд.пол — формула (1) Ямал СПГ + ПУЭ табл.1.3.26 (в траншее), каталог NED (в воздухе/каналах), ПУЭ 1.3.23 (ρ базы 1,2).<br>"+
    "3) ΔU(3ф)=100·√3·I·L·(r0·cosφ+x0·sinφ)/(U·1000) %; ΔU(1ф)=100·2·I·L·(r0 cosφ+x0 sinφ)/(Uф·1000) — Ямал формула (2), IEC 60364.<br>"+
    "4) МТЗ: Iуст ≤ m·Iдоп.факт (значения m — таблица МТЗ из ПУЭ 3.1.11).<br>"+
    "5) стойкость КЗ (S≥Iкз·√tкз/K·[10³ при кА]).<br>"+
    "6) мин. сечение (по настройке ПУЭ/произв.) и проверка ΔU пуск ≤15% для ЭД.<br>"+
    "7) потери энергии по Методике Роскоммунэнерго (см. вкладку «Потери энергии» — формулы 1–31 с нумерацией).</div>"; }
});
