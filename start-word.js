(function(){
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  function fmt(x,d){if(!isFinite(x))return '\u2014';return Number(x).toLocaleString('ru-RU',{maximumFractionDigits:d});}
  function substSvg(t){
    var n=t.br.length,w=Math.max(980,260+n*220),y=95;
    var s='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="210" viewBox="0 0 '+w+' 210">';
    s+='<rect width="'+w+'" height="210" fill="#ffffff"/>';
    s+='<text x="16" y="22" font-size="14" font-family="Times New Roman">Схема замещения цепи пуска (приведено к 10 кВ)</text>';
    s+='<line x1="24" y1="'+y+'" x2="'+(w-24)+'" y2="'+y+'" stroke="#222" stroke-width="1.6"/>';
    var x=50;
    s+='<circle cx="'+x+'" cy="'+y+'" r="11" fill="#fff" stroke="#1b6ef3" stroke-width="2"/>';
    s+='<text x="'+x+'" y="'+(y-20)+'" text-anchor="middle" font-size="12">E</text>';
    s+='<text x="'+x+'" y="'+(y+30)+'" text-anchor="middle" font-size="11">система</text>';
    function box(xx,lab,val){return '<rect x="'+(xx-50)+'" y="'+(y-16)+'" width="100" height="32" fill="#e8f0fe" stroke="#1b6ef3"/><text x="'+xx+'" y="'+(y+5)+'" text-anchor="middle" font-size="11">'+esc(lab)+'</text><text x="'+xx+'" y="'+(y+38)+'" text-anchor="middle" font-size="10">'+esc(val)+'</text>';}
    x+=90; s+=box(x,'xc',fmt(t.src.xc,1)+' мОм');
    if(t.src.kind==='ps35'){x+=130; s+=box(x,'rt + j xt',fmt(t.src.rt,1)+' + j'+fmt(t.src.xt,1));}
    x+=130; s+=box(x,'выкл. ввода',fmt(t.src.rkv,3)+' + j'+fmt(t.src.xkv,3));
    x+=115; s+='<text x="'+x+'" y="'+(y-24)+'" text-anchor="middle" font-size="11">шины ист.</text>';
    t.br.forEach(function(b,i){x+=130; s+=box(x,'КЛ '+(i+1),fmt(b.R,3)+' + j'+fmt(b.X,3)+' Ом'); x+=105; s+='<text x="'+x+'" y="'+(y-24)+'" text-anchor="middle" font-size="10">'+esc((b.name||'').slice(0,20))+'</text>';});
    x+=90; s+='<rect x="'+(x-30)+'" y="'+(y-24)+'" width="60" height="48" fill="#fdecea" stroke="#c62828"/><text x="'+x+'" y="'+(y+4)+'" text-anchor="middle" font-size="12">ЭД</text><text x="'+x+'" y="'+(y+40)+'" text-anchor="middle" font-size="10">'+fmt(t.mot.P,0)+' кВт</text>';
    s+='</svg>'; return s;
  }
  function exportWord(){
    if(typeof window._startCompute!=='function'){alert('Обновите страницу (Ctrl+F5)');return;}
    var t=window._startCompute();
    var rows='';
    t.nodes0.forEach(function(n,i){var n1=t.nodes1[i]; rows+='<tr><td>'+esc(n.name)+'</td><td>'+fmt(n.I,1)+'</td><td>'+fmt(n.dU,1)+'</td><td>'+fmt(n.dU/(t.src.Unt*10),2)+'</td><td>'+fmt(n.U,3)+'</td><td>'+fmt(n1.I,1)+'</td><td>'+fmt(n1.dU,1)+'</td><td>'+fmt(n1.dU/(t.src.Unt*10),2)+'</td><td>'+fmt(n1.U,3)+'</td></tr>';});
    var vyvod=t.okM
      ? ('Суммарные потери напряжения на клеммах двигателя при пуске составляют '+fmt(t.pct1,2)+' % и не превышают допуск '+t.lim+' %. Требования ГОСТ 32144-2013 выполняются.')
      : ('Суммарные потери напряжения на клеммах двигателя при пуске составляют '+fmt(t.pct1,2)+' % и превышают допуск '+t.lim+' %. Требования ГОСТ 32144-2013 не выполняются.');
    var html='\ufeff<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Расчёт пуска ВН ЭД</title>'+
      '<style>@page Section1{size:420mm 297mm;mso-page-orientation:landscape;margin:12mm;}div.Section1{page:Section1;}'+
      'body{font-family:Times New Roman,serif;font-size:12pt}h1{font-size:18pt}h2{font-size:14pt}'+
      'table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #000;padding:4px 6px}'+
      'th{background:#d9e2f3}tr.y td{background:#fff2cc;font-weight:bold}p.f{font-size:11pt}</style></head><body><div class="Section1">'+
      '<h1>Расчёт потерь напряжения при пуске высоковольтного электродвигателя</h1>'+
      '<p>Норма — ГОСТ 32144-2013. Допуск ΔU задаёт проектировщик (сейчас '+t.lim+' %).</p>'+
      '<h2>1. Инструкция</h2>'+
      '<p>1) Источник: ПС 35/10 или сеть/ЗРУ 10 кВ.<br>2) Нагрузка источника без пускаемого ЭД.<br>3) Ветки 10 кВ по схеме: ПС → ЗРУ → РУ → кабель к ЭД.<br>4) На фидере ЭД принять P = 0.<br>5) Задать Pн, кпд, cosφн, кратность пуска.<br>6) Сравнить ΔU с допуском.</p>'+
      '<h2>2. Схема замещения</h2>'+substSvg(t)+
      '<p>Сопротивления системы и трансформатора — в мОм, приведены к Uн = '+fmt(t.src.Unt,2)+' кВ. Сопротивления КЛ — в омах.</p>'+
      '<h2>3. Расчётные формулы</h2>'+
      '<p class="f"><b>Трансформатор ПС 35/10</b><br>rт = Pк · Uнт² / Sнт² · 10⁶, мОм<br>zт = uк · Uнт² / Sнт · 10⁴, мОм<br>xт = √(zт² − rт²), мОм</p>'+
      '<p class="f"><b>Система 35 кВ (приведение к 10 кВ)</b><br>xс = Uн / (√3 · Iкз) · (Uнт / Uн)² · 10³, мОм</p>'+
      '<p class="f"><b>Сеть / ЗРУ 10 кВ</b><br>xс = Uнт / (√3 · Iкз10) · 10³, мОм</p>'+
      '<p class="f"><b>Токи</b><br>Iр = P / (√3 · U · cosφ)<br>Iн.дв = Pн / (√3 · Uшин · cosφн · ηн)<br>Iп = Iн.дв · nпуск<br>Iузла при пуске = Iнагр. узла + Iп</p>'+
      '<p class="f"><b>Потеря напряжения</b><br>источник (R, X в мОм): ΔU = I · √3 · [(rт+rв)cosφ + (xт+xв+xс)sinφ] · 10⁻³, В<br>кабель (R, X в Ом): ΔU = I · √3 · (R·cosφ + X·sinφ), В<br>ΔU% = ΔU / (Uнт · 10³) · 100<br>Uслед = Uпред − ΔU · 10⁻³, кВ</p>'+
      '<p class="f">Подстановка: rт = '+fmt(t.src.rt,3)+' мОм; zт = '+fmt(t.src.zt,3)+' мОм; xт = '+fmt(t.src.xt,3)+' мОм; xс = '+fmt(t.src.xc,3)+' мОм; Rист = '+fmt(t.src.R,3)+' мОм; Xист = '+fmt(t.src.X,3)+' мОм.</p>'+
      '<h2>4. Исходные данные</h2>'+
      '<table><tr><td>Тип источника</td><td>'+(t.src.kind==='ps35'?'ПС 35/10 кВ':'Сеть / ЗРУ 10 кВ')+'</td><td>Uн 10 кВ</td><td>'+fmt(t.src.Unt,2)+' кВ</td></tr>'+
      '<tr><td>P нагрузки источника</td><td>'+fmt(t.P0,2)+' кВт</td><td>cosφ / sinφ</td><td>'+fmt(t.c0,3)+' / '+fmt(t.s0,3)+'</td></tr>'+
      '<tr><td>Pн двигателя</td><td>'+fmt(t.mot.P,1)+' кВт</td><td>ηн / cosφн / nпуск</td><td>'+fmt(t.mot.eta,3)+' / '+fmt(t.mot.cos,3)+' / '+fmt(t.mot.k,2)+'</td></tr>'+
      '<tr class="y"><td>Iн двигателя</td><td>'+fmt(t.In,2)+' А</td><td>Iп двигателя</td><td>'+fmt(t.Ip,2)+' А</td></tr></table>'+
      '<h2>5. Результаты по узлам</h2>'+
      '<table><tr><th>Узел</th><th>I без пуска, А</th><th>ΔU без, В</th><th>ΔU без, %</th><th>U без, кВ</th><th>I с пуском, А</th><th>ΔU с пуском, В</th><th>ΔU с пуском, %</th><th>U с пуском, кВ</th></tr>'+rows+
      '<tr class="y"><td>Сумма до клемм ЭД</td><td></td><td>'+fmt(t.sumV0,1)+'</td><td>'+fmt(t.pct0,2)+'</td><td>'+fmt(t.Um0,3)+'</td><td></td><td>'+fmt(t.sumV1,1)+'</td><td>'+fmt(t.pct1,2)+'</td><td>'+fmt(t.Um1,3)+'</td></tr></table>'+
      '<h2>6. Выводы</h2>'+
      '<p>'+vyvod+'</p>'+
      '<p>Напряжение на шинах источника без пуска: '+fmt(t.nodes0[0].U,3)+' кВ (ΔU = '+fmt(t.dU0src/(t.src.Unt*10),2)+' %).</p>'+
      '<p>Напряжение на шинах источника при пуске: '+fmt(t.nodes1[0].U,3)+' кВ (ΔU = '+fmt(t.pct1src,2)+' %).</p>'+
      '<p>Напряжение на клеммах двигателя при пуске: '+fmt(t.Um1,3)+' кВ.</p>'+
      '</div></body></html>';
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'application/msword'})); a.download='raschet-puska-VN-ED-A3.doc'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
  }
  var btn=document.getElementById('btn-word');
  if(btn) btn.onclick=function(){try{exportWord();}catch(e){alert(e.message);}};
})();
