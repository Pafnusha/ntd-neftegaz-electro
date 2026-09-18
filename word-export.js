(function(){
  function txt(id){var el=document.getElementById(id);return el?el.textContent.trim():'';}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  function inp(tr,f){var el=tr.querySelector('[data-f="'+f+'"]');return el?el.value:'';}
  function calc(tr,c){var el=tr.querySelector('[data-c="'+c+'"]');return el?el.textContent:'';}
  function exportWord(){
    var trs=document.querySelectorAll('#ep-tbody tr');
    var rows='',i,tr;
    for(i=0;i<trs.length;i++){
      tr=trs[i];
      rows+='<tr><td>'+esc(inp(tr,'name'))+'</td><td align="center">'+esc(inp(tr,'n'))+'</td><td align="right">'+esc(inp(tr,'pnUnit'))+'</td><td align="right">'+esc(calc(tr,'Pn'))+'</td><td align="center">'+esc(inp(tr,'ki'))+'</td><td align="center">'+esc(inp(tr,'cosPhi'))+'</td><td align="right">'+esc(calc(tr,'tg'))+'</td><td align="right">'+esc(calc(tr,'KiPn'))+'</td><td align="right">'+esc(calc(tr,'Qrow'))+'</td><td align="right">'+esc(calc(tr,'nPn2'))+'</td></tr>';
    }
    var html='\ufeff<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">'+
      '<head><meta charset="utf-8"><title>Vedomost nagruzok A3</title>'+
      '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>80</w:Zoom></w:WordDocument></xml><![endif]-->'+
      '<style>'+
      '@page Section1{size:420mm 297mm;mso-page-orientation:landscape;margin:12mm 10mm 12mm 10mm;}'+
      'div.Section1{page:Section1;}'+
      'body{font-family:Times New Roman,serif;font-size:11pt;}'+
      'h1{font-size:16pt;margin:0 0 6pt 0;}'+
      'p{margin:0 0 8pt 0;}'+
      'table{border-collapse:collapse;width:100%;font-size:9pt;}'+
      'th,td{border:1px solid #000;padding:3px 4px;vertical-align:top;}'+
      'th{background:#d9e2f3;text-align:center;}'+
      'tr.y td{background:#fff2cc;font-weight:bold;}'+
      '</style></head><body><div class="Section1">'+
      '<h1>Ведомость электрических нагрузок (формат A3, альбом)</h1>'+
      '<p>РТМ 36.18.32.4-92. Uн='+esc(document.getElementById('un-input').value)+' кВ. Ко='+esc(document.getElementById('ko-input').value)+'. cosφ₂='+esc(document.getElementById('cos-target').value)+'. Кр='+esc(txt('out-kr'))+'. nэ='+esc(txt('out-ne'))+'.</p>'+
      '<table>'+
      '<tr><th style="width:28%">Наименование ЭП</th><th>n</th><th>Pн ед., кВт</th><th>Pн, кВт</th><th>Ки</th><th>cosφ</th><th>tgφ</th><th>P=Ки·Pн, кВт</th><th>Q, квар</th><th>n·Pн²</th></tr>'+
      rows+
      '<tr class="y"><td>ИТОГО по КТП</td><td></td><td></td><td>'+esc(txt('out-Pn'))+'</td><td>'+esc(txt('out-KiAvg'))+'</td><td>'+esc(txt('out-cos1'))+'</td><td>'+esc(txt('out-tg'))+'</td><td>'+esc(txt('out-KiPn'))+'</td><td>'+esc(txt('out-Qp'))+'</td><td></td></tr>'+
      '<tr class="y"><td>Рр / Qр / Sр / Iр</td><td></td><td></td><td></td><td></td><td></td><td></td><td>'+esc(txt('out-Pp'))+' кВт</td><td>'+esc(txt('out-Qp'))+' квар</td><td>'+esc(txt('out-Sp'))+' кВ·А; I='+esc(txt('out-Ip'))+' А</td></tr>'+
      '<tr class="y"><td>Итого с Ко</td><td></td><td></td><td></td><td></td><td></td><td></td><td>'+esc(txt('out-PpKo'))+' кВт</td><td>'+esc(txt('out-QpKo'))+' квар</td><td>'+esc(txt('out-SpKo'))+' кВ·А</td></tr>'+
      '<tr class="y"><td>Qку = Рр·Ко·(tg1-tg2)</td><td></td><td></td><td></td><td></td><td>'+esc(document.getElementById('cos-target').value)+'</td><td>'+esc(txt('out-tg2'))+'</td><td></td><td>'+esc(txt('out-Qc'))+' квар</td><td></td></tr>'+
      '<tr class="y"><td>После компенсации</td><td></td><td></td><td></td><td></td><td></td><td></td><td>'+esc(txt('out-PpKo'))+' кВт</td><td>'+esc(txt('out-Qp2'))+' квар</td><td>'+esc(txt('out-Sp2'))+' кВ·А; I='+esc(txt('out-Ip2'))+' А</td></tr>'+
      '<tr class="y"><td>Трансформатор, кВ·А</td><td></td><td></td><td></td><td></td><td>'+esc(txt('out-Str'))+'</td><td></td><td></td><td></td><td></td></tr>'+
      '</table>'+
      '<p>'+esc(txt('kr-note'))+' '+esc(txt('ku-note'))+'</p>'+
      '</div></body></html>';
    var blob=new Blob([html],{type:'application/msword'});
    var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='vedomost-nagruzok-A3.doc';document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1500);
  }
  var btn=document.getElementById('btn-word');
  if(btn) btn.onclick=function(){try{exportWord();}catch(e){alert(e.message);}};
})();
