/* data-compat.js — нейтральные имена + документы без «Ямал»; совместимость со старым data.js */
(function(){
  var D = (typeof DATA!=="undefined")?DATA:(typeof window!=="undefined"?window.DATA:null);
  if(!D) return;
  /* rename tables if still under old keys */
  if(!D.lvIec && D.lvYamal) D.lvIec = D.lvYamal;
  if(!D.hvIecAir && D.hvYamalAir) D.hvIecAir = D.hvYamalAir;
  if(!D.projOverall && D.yamalOverall) D.projOverall = D.yamalOverall;
  if(!D.duProj && D.duYamal) D.duProj = D.duYamal;
  /* keep aliases both ways */
  D.lvYamal = D.lvIec; D.hvYamalAir = D.hvIecAir;
  D.yamalOverall = D.projOverall; D.duYamal = D.duProj;
  /* neutralize user-facing strings */
  if(D.methods){
    if(D.methods.air_ladder) D.methods.air_ladder.label="В воздухе по кабельной лестнице/лотку (норм. IEC — лестница)";
    if(D.methods.air_pipe) D.methods.air_pipe.label="В трубе/гофре (IEC B52.5-B2 для LV)";
  }
  if(D.uLimits && D.uLimits.length){
    D.uLimits = D.uLimits.map(function(u){
      var t=(u.t||"").replace(/Ямал\s*СПГ/g,"Проектная методика").replace(/Ямал/g,"Проектная методика");
      var txt=(u.txt||"");
      return {t:t, txt:txt};
    });
    D.uLimits[D.uLimits.length-1]={t:"Проектная методика §7.9 — линии между РУ и приёмниками", txt:"2–5% (см. таблицу), пуск двигателей ≤15%"};
  }
  D.documents = [
    ["3300-E-000-EL-PHI-00009-00-D ред.03U","Основные принципы выбора сечений электрических кабелей (проектная методика); таблицы IEC 60364-5-52/60502-2; §7.4–7.11"],
    ["ГОСТ 31565-2012","Кабельные изделия. Требования пожарной безопасности (нг, нг(А)-LS, HF и др.)"],
    ["ПУЭ изд.6/7","гл.1.3 п.1.3.3, 1.3.6, 1.3.7, 1.3.10, 1.3.23–1.3.26, 1.3.29, 1.3.36; п.3.1.10–3.1.12; п.7.3.97"],
    ["ГОСТ Р 50571.5.52-2011 (IEC 60364-5-52)","Выбор и монтаж электрооборудования, токовые нагрузки, коэффициенты"],
    ["ГОСТ 31996-2012","Кабели силовые с пластмассовой изоляцией на 0,66–3,6 кВ (обозначения, сечения)"],
    ["ГОСТ 22483-2021","Жилы токопроводящие (сопротивление)"],
    ["ГОСТ 32144-2013","Показатели качества электроэнергии"],
    ["ГОСТ IEC 60079-14-2013 / п.7.3 ПУЭ","Взрывоопасные зоны"],
    ["ТУ 3530-001-85082376-2016, IEC 60502-2","NED-Plagum SN 6–35 кВ"],
    ["ТУ 3530-004-85082376-2016, IEC 60502-1","NED-Plagum 0,66/1 кВ (ЭПР)"],
    ["Методические рекомендации по определению потерь электрической энергии в городских электрических сетях 10(6)–0,4 кВ (Роскоммунэнерго, ЗАО «АСУ Мособлэлектрo», утв. 23.04.2001)","Формулы (1)–(31): потери в линиях и трансформаторах, τ=ƒ(T), Кд.п при неравномерной нагрузке фаз"]
  ];
  if(typeof window!=="undefined") window.DATA=D;
})();
