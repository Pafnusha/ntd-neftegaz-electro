(function(){
  function txt(id){var el=document.getElementById(id);return el?el.textContent.trim():'';}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  function exportWord(){
    var trs=document.querySelectorAll('#ep-tbody tr');
    var rows='', i, tr, val;
    function inp(tr,f){var el=tr.querySelector('[data-f="'+f+'"]');return el?el.value:'';}
    function calc(tr,c){var el=tr.querySelector('[data-c="'+c+'"]');return el?el.textContent:'';}
    for(i=0;i<trs.length;i++){
      tr=trs[i];
      rows+='<tr><td>'+esc(inp(tr,'name'))+'</td><td>'+esc(inp(tr,'n'))+'</td><td>'+esc(inp(tr,'pnUnit'))+'</td><td>'+esc(calc(tr,'Pn'))+'</td><td>'+esc(inp(tr,'ki'))+'</td><td>'+esc(inp(tr,'cosPhi'))+'</td><td>'+esc(calc(tr,'tg'))+'</td><td>'+esc(calc(tr,'KiPn'))+'</td><td>'+esc(calc(tr,'Qrow'))+'</td><td>'+esc(calc(tr,'nPn2'))+'</td></tr>';
    }
    var html='\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Ведомость нагрузок</title><style>body{font-family:Times New Roman,serif;font-size:12pt}h1{font-size:16pt}h2{font-size:13pt}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #000;padding:4px 6px}th{background:#d9e2f3}tr.y td{background:#fff2cc;font-weight:bold}</style></head><body>'+
      '<h1>Ведомость электрических нагрузок</h1>'+
      '<p>Расчёт по РТМ 36.18.32.4-92. Uн = '+esc(document.getElementById('un-input').value)+' кВ. Ко = '+esc(document.getElementById('ko-input').value)+'. cosφ проектировщика = '+esc(document.getElementById('cos-target').value)+'.</p>'+
      '<table><tr><th>Наименование ЭП</th><th>n</th><th>Pн ед., кВт</th><th>Pн, кВт</th><th>Ки</th><th>cosφ</th><th>tgφ</th><th>P=Ки·Pн</th><th>Q, квар</th><th>n·Pн²</th></tr>'+rows+
      '<tr class="y"><td>ИТОГО по КТП</td><td></td><td></td><td>'+esc(txt('out-Pn'))+'</td><td>'+esc(txt('out-KiAvg'))+'</td><td>'+esc(txt('out-cos1'))+'</td><td>'+esc(txt('out-tg'))+'</td><td>'+esc(txt('out-KiPn'))+'</td><td></td><td>nэ='+esc(txt('out-ne'))+'</td></tr></table>'+
      '<h2>Расчётные величины</h2>'+
      '<table>'+
      '<tr><td>Кр</td><td>'+esc(txt('out-kr'))+'</td></tr>'+
      '<tr><td>Рр итого, кВт</td><td>'+esc(txt('out-Pp'))+'</td></tr>'+
      '<tr><td>Qр итого, квар</td><td>'+esc(txt('out-Qp'))+'</td></tr>'+
      '<tr><td>Sр итого, кВ·А</td><td>'+esc(txt('out-Sp'))+'</td></tr>'+
      '<tr><td>Iр, А</td><td>'+esc(txt('out-Ip'))+'</td></tr>'+
      '<tr class="y"><td>Рр·Ко, кВт</td><td>'+esc(txt('out-PpKo'))+'</td></tr>'+
      '<tr class="y"><td>Qр·Ко, квар</td><td>'+esc(txt('out-QpKo'))+'</td></tr>'+
      '<tr class="y"><td>Qку, квар</td><td>'+esc(txt('out-Qc'))+'</td></tr>'+
      '<tr class="y"><td>Q после КУ, квар</td><td>'+esc(txt('out-Qp2'))+'</td></tr>'+
      '<tr class="y"><td>S после КУ, кВ·А</td><td>'+esc(txt('out-Sp2'))+'</td></tr>'+
      '<tr class="y"><td>I после КУ, А</td><td>'+esc(txt('out-Ip2'))+'</td></tr>'+
      '<tr class="y"><td>Трансформатор рекомендуемый, кВ·А</td><td>'+esc(txt('out-Str'))+'</td></tr>'+
      '</table>'+
      '<p>'+esc(txt('kr-note'))+' '+esc(txt('ku-note'))+'</p>'+
      '</body></html>';
    var blob=new Blob([html],{type:'application/msword'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vedomost-nagruzok.doc';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
  }
  var btn=document.getElementById('btn-word');
  if(btn) btn.onclick=function(){try{exportWord();}catch(e){alert(e.message);}};
})();
