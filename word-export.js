(function(){
  function num(x,d){x=Number(x);if(!isFinite(x))return '\u2014';return x.toFixed(d).replace(/\.?0+$/,'');}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  function exportWord(){
    if(typeof window.RTMcompute!=='function'){alert('Сначала дождитесь загрузки расчёта');return;}
    var t=window.RTMcompute();
    var i,rr,sp,rows='';
    for(i=0;i<t.rows.length;i++){
      rr=t.rows[i];
      sp=Math.sqrt(rr.KiPn*rr.KiPn+rr.Qrow*rr.Qrow);
      rows+='<tr>'+
        '<td>'+esc(rr.name)+'</td>'+
        '<td>'+num(rr.n,0)+'</td>'+
        '<td>'+num(rr.pnUnit,2)+'</td>'+
        '<td>'+num(rr.Pn,2)+'</td>'+
        '<td>'+num(rr.ki,2)+'</td>'+
        '<td>'+num(rr.cosPhi,2)+'</td>'+
        '<td>'+num(rr.tg,3)+'</td>'+
        '<td>'+num(rr.KiPn,2)+'</td>'+
        '<td>'+num(rr.Qrow,2)+'</td>'+
        '<td>'+num(rr.nPn2,0)+'</td>'+
        '<td>'+num(rr.KiPn,2)+'</td>'+
        '<td>'+num(rr.Qrow,2)+'</td>'+
        '<td>'+num(sp,2)+'</td></tr>';
    }
    var html='\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">'+
      '<head><meta charset="utf-8"><title>Ведомость нагрузок</title>'+
      '<style>body{font-family:Times New Roman,serif;font-size:11pt}h1{font-size:16pt}h2{font-size:13pt}'+
      'table{border-collapse:collapse;width:100%;font-size:9pt}th,td{border:1px solid #000;padding:3px 5px;vertical-align:top}'+
      'th{background:#d9e2f3}tr.y td{background:#fff2cc;font-weight:bold}p.n{font-size:10pt;color:#333}</style></head><body>'+
      '<h1>Ведомость электрических нагрузок</h1>'+
      '<p>Расчёт по РТМ 36.18.32.4-92. Uн = '+num(t.Un,2)+' кВ. Ко = '+num(t.ko,2)+'. cosφ₂ = '+num(t.cos2,2)+'. Кр = '+num(t.kr,3)+'.</p>'+
      '<table><tr>'+
      '<th>Наименование ЭП</th><th>n</th><th>Pн ед., кВт</th><th>Pн, кВт</th><th>Ки</th><th>cosφ</th><th>tgφ</th>'+
      '<th>P=Ки·Pн, кВт</th><th>Q, квар</th><th>n·Pн²</th><th>Pр, кВт</th><th>Qр, квар</th><th>Sр, кВ·А</th></tr>'+
      rows+
      '<tr class="y"><td>ИТОГО по КТП</td><td></td><td></td><td>'+num(t.Pn,2)+'</td><td>'+num(t.KiAvg,3)+'</td><td>'+num(t.cos1,3)+'</td><td>'+num(t.tgAvg,3)+'</td><td>'+num(t.KiPn,2)+'</td><td>'+num(t.Qsum,2)+'</td><td>'+num(t.sumNPn2,0)+'</td><td>'+num(t.Pp,2)+'</td><td>'+num(t.Qp,2)+'</td><td>'+num(t.Sp,2)+'</td></tr>'+
      '<tr class="y"><td>Итого с Ко = '+num(t.ko,2)+'</td><td></td><td></td><td>'+num(t.Pn,2)+'</td><td></td><td></td><td></td><td></td><td></td><td></td><td>'+num(t.PpKo,2)+'</td><td>'+num(t.QpKo,2)+'</td><td>'+num(t.SpKo,2)+'</td></tr>'+
      '<tr class="y"><td>Qку = Pр·Ко·(tg1−tg2)</td><td></td><td></td><td></td><td></td><td>'+num(t.cos2,2)+'</td><td>'+num(t.tg2,3)+'</td><td></td><td></td><td></td><td></td><td>'+num(t.Qc,2)+'</td><td></td></tr>'+
      '<tr class="y"><td>Параметры после компенсации</td><td></td><td></td><td></td><td></td><td>'+num(t.cos2,2)+'</td><td>'+num(t.tg2,3)+'</td><td></td><td></td><td></td><td>'+num(t.PpKo,2)+'</td><td>'+num(t.Qp2,2)+'</td><td>'+num(t.Sp2,2)+'</td></tr>'+
      '<tr class="y"><td>Ориентировочная мощность трансформатора, кВ·А</td><td></td><td></td><td></td><td></td><td>'+num(t.Str,0)+'</td><td></td><td></td><td></td><td></td><td></td><td></td><td>'+num(t.Ip2,1)+'</td></tr>'+
      '</table>'+
      '<h2>Пояснение</h2>'+
      '<p class="n">nэ = '+num(t.ne,2)+'. При nэ ≤ 10 реактивная нагрузка принята с коэффициентом 1,1. Qку = Рр·Ко · (tgφ₁ − tgφ₂), tgφ₂ = tan(arccos(cosφ проектировщика)). Iр после КУ = '+num(t.Ip2,1)+' А.</p>'+
      '</body></html>';
    var blob=new Blob([html],{type:'application/msword'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='vedomost-nagruzok.doc';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
  }
  var btn=document.getElementById('btn-word');
  if(btn) btn.onclick=function(){try{exportWord();}catch(e){alert(e.message);}};
})();
