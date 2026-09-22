(function(){
  function $(id){return document.getElementById(id);}
  function uid(){return 'e'+Math.random().toString(36).slice(2,8);}
  function nn(v){v=parseFloat(v);return isFinite(v)?v:0;}
  function fmt(x,d){if(!isFinite(x))return '—';return Number(x).toLocaleString('ru-RU',{maximumFractionDigits:d});}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  var state={els:[]};
  function demo(){
    $('sys-name').value='ПС 35 кВ, шины ВН'; $('uc').value='37'; $('ik-max').value='12.61';
    state.els=[
      {id:uid(),kind:'cab',name:'КЛ 35 кВ к ESS-530, 3×150',U:35,L:1.4,r0:0.159,x0:0.11},
      {id:uid(),kind:'bus',name:'ЗРУ ESS-530 35 кВ',U:35},
      {id:uid(),kind:'tr',name:'042-TR530-BC1 ТСД-20000/35/10,5',S:20,uk:7,Uh:35,Ul:10.5,Utap:31.5}
    ];
    draw(); paint();
  }
  function add(kind){
    if(kind==='cab') state.els.push({id:uid(),kind:'cab',name:'КЛ 35 кВ',U:35,L:1,r0:0.159,x0:0.11});
    if(kind==='bus') state.els.push({id:uid(),kind:'bus',name:'РУ / ЗРУ',U:10.5});
    if(kind==='tr') state.els.push({id:uid(),kind:'tr',name:'Т КТП 35/10',S:16,uk:8,Uh:35,Ul:10.5,Utap:31.5});
    draw(); paint();
  }
  function draw(){
    var box=$('blocks'); box.innerHTML='';
    state.els.forEach(function(e,i){
      var d=document.createElement('div');
      d.className='blk '+(e.kind==='cab'?'cab':e.kind==='tr'?'tr':'bus');
      var title=e.kind==='cab'?'Кабель':e.kind==='tr'?'Трансформатор':'Шины';
      var h='<h3>'+(i+1)+'. '+title+'</h3>';
      h+='<label class="field">Имя<input data-i="'+i+'" data-f="name" value="'+esc(e.name)+'"></label>';
      if(e.kind==='cab'){
        h+='<label class="field">U, кВ<input type="number" step="0.1" data-i="'+i+'" data-f="U" value="'+e.U+'"></label>';
        h+='<label class="field">L, км<input type="number" step="0.001" data-i="'+i+'" data-f="L" value="'+e.L+'"></label>';
        h+='<label class="field">r0, Ом/км<input type="number" step="0.001" data-i="'+i+'" data-f="r0" value="'+e.r0+'"></label>';
        h+='<label class="field">x0, Ом/км<input type="number" step="0.001" data-i="'+i+'" data-f="x0" value="'+e.x0+'"></label>';
      }
      if(e.kind==='bus') h+='<label class="field">U шин, кВ<input type="number" step="0.1" data-i="'+i+'" data-f="U" value="'+e.U+'"></label>';
      if(e.kind==='tr'){
        h+='<label class="field">Sном, МВ·А<input type="number" step="0.1" data-i="'+i+'" data-f="S" value="'+e.S+'"></label>';
        h+='<label class="field">uk, %<input type="number" step="0.1" data-i="'+i+'" data-f="uk" value="'+e.uk+'"></label>';
        h+='<label class="field">Uвн, кВ<input type="number" step="0.1" data-i="'+i+'" data-f="Uh" value="'+e.Uh+'"></label>';
        h+='<label class="field">Uнн, кВ<input type="number" step="0.1" data-i="'+i+'" data-f="Ul" value="'+e.Ul+'"></label>';
        h+='<label class="field">U ПБВ макс, кВ<input type="number" step="0.1" data-i="'+i+'" data-f="Utap" value="'+e.Utap+'"></label>';
      }
      h+='<button type="button" data-del="'+e.id+'">Удалить</button>';
      d.innerHTML=h; box.appendChild(d);
    });
  }
  function zsys(Uc,Ik){return Ik>0?{r:0,x:Uc/(Math.sqrt(3)*Ik),U:Uc}:{r:0,x:0,U:Uc};}
  function refZ(z,fromU,toU){if(!(fromU>0)||!(toU>0)||fromU===toU) return {r:z.r,x:z.x}; var k=(toU/fromU)*(toU/fromU); return {r:z.r*k,x:z.x*k};}
  function compute(){
    var Uc=nn($('uc').value)||37, Ikmax=nn($('ik-max').value);
    var name=$('sys-name').value||'Система';
    var zsMax=zsys(Uc,Ikmax);
    var nodes=[{id:'K1',title:'К1 · '+name,U:Uc,kind:'sys'}];
    var chain=[{kind:'sys',name:name,U:Uc,r:0,x:zsMax.x,note:'xc = Uc / (\u221a3·Ikз)'}];
    var Uprev=Uc;
    state.els.forEach(function(e,i){
      if(e.kind==='cab'){
        chain.push({kind:'cab',name:e.name,U:nn(e.U)||Uprev,r:nn(e.r0)*nn(e.L),x:nn(e.x0)*nn(e.L),note:'r=r0·L; x=x0·L'});
        Uprev=nn(e.U)||Uprev; nodes.push({id:'K'+(i+2),title:'К'+(i+2)+' · '+e.name,U:Uprev,kind:'cab'});
      } else if(e.kind==='bus'){
        chain.push({kind:'bus',name:e.name,U:nn(e.U)||Uprev,r:0,x:0,note:'Z≈0'});
        Uprev=nn(e.U)||Uprev; nodes.push({id:'K'+(i+2),title:'К'+(i+2)+' · '+e.name,U:Uprev,kind:'bus'});
      } else if(e.kind==='tr'){
        var Ut=nn(e.Utap)||nn(e.Uh)||35, S=nn(e.S)||1, uk=nn(e.uk);
        var xtr=uk/100*Ut*Ut/S;
        chain.push({kind:'tr',name:e.name,U:nn(e.Ul)||10.5,Utap:Ut,r:0,x:xtr,note:'xтр=(uk/100)·Uтап²/S'});
        Uprev=nn(e.Ul)||10.5; nodes.push({id:'K'+(i+2),title:'К'+(i+2)+' · НН '+e.name,U:Uprev,kind:'tr'});
      }
    });
    function faultAt(idx){
      var Un=nodes[idx].U, re=0, xe=0, parts=[];
      for(var i=0;i<=idx;i++){
        var el=chain[i]; var from=el.kind==='tr'?el.Utap:el.U;
        var zr=refZ({r:el.r,x:el.x},from,Un); re+=zr.r; xe+=zr.x;
        parts.push({name:el.name,rnat:el.r,xnat:el.x,Unat:from,r:zr.r,x:zr.x,note:el.note});
      }
      var z=Math.sqrt(re*re+xe*xe); var I3=z>0?(Un/(Math.sqrt(3)*z)):0;
      return {re:re,xe:xe,z:z,I3:I3,I2:I3*Math.sqrt(3)/2,parts:parts,U:Un};
    }
    return {Uc:Uc,Ikmax:Ikmax,zsMax:zsMax,nodes:nodes,rows:nodes.map(function(nd,i){return {node:nd,f:faultAt(i)};})};
  }
  function schemeSvg(t){
    var n=t.nodes.length,w=Math.max(760,n*170),s='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="170" viewBox="0 0 '+w+' 170">';
    s+='<rect width="'+w+'" height="170" fill="#f8fbff"/>'; var x0=70,dx=(w-80)/Math.max(1,n-1);
    t.nodes.forEach(function(nd,i){
      var x=x0+i*dx;
      if(i<n-1) s+='<line x1="'+(x+42)+'" y1="60" x2="'+(x+dx-42)+'" y2="60" stroke="#1b6ef3" stroke-width="3"/>';
      var col=nd.kind==='sys'?'#1b6ef3':nd.kind==='tr'?'#c05600':nd.kind==='cab'?'#2e7d32':'#5e35b1';
      s+='<rect x="'+(x-42)+'" y="34" width="84" height="52" rx="8" fill="'+col+'"/>';
      s+='<text x="'+x+'" y="55" text-anchor="middle" fill="#fff" font-size="11">'+esc(nd.id)+'</text>';
      s+='<text x="'+x+'" y="70" text-anchor="middle" fill="#fff" font-size="10">'+fmt(nd.U,1)+' кВ</text>';
      s+='<text x="'+x+'" y="108" text-anchor="middle" font-size="11">I(3)='+fmt(t.rows[i].f.I3,2)+' кА</text>';
      s+='<text x="'+x+'" y="124" text-anchor="middle" font-size="10">I(2)='+fmt(t.rows[i].f.I2,2)+' кА</text>';
    }); return s+'</svg>';
  }
  function paint(){
    var t=compute(); $('scheme').innerHTML=schemeSvg(t);
    var h='<table><tr><th>Точка</th><th>U, кВ</th><th>rэ, Ом</th><th>xэ, Ом</th><th>zэ, Ом</th><th>Iкз(3), кА</th><th>Iкз(2), кА</th></tr>';
    t.rows.forEach(function(r){h+='<tr><td>'+esc(r.node.title)+'</td><td>'+fmt(r.f.U,2)+'</td><td>'+fmt(r.f.re,4)+'</td><td>'+fmt(r.f.xe,4)+'</td><td>'+fmt(r.f.z,4)+'</td><td><b>'+fmt(r.f.I3,3)+'</b></td><td>'+fmt(r.f.I2,3)+'</td></tr>';});
    $('res').innerHTML=h+'</table>';
  }
  function exportWord(){
    var t=compute(); var rows='',det='';
    t.rows.forEach(function(r){
      rows+='<tr><td>'+esc(r.node.title)+'</td><td>'+fmt(r.f.U,2)+'</td><td>'+fmt(r.f.re,4)+'</td><td>'+fmt(r.f.xe,4)+'</td><td>'+fmt(r.f.z,4)+'</td><td>'+fmt(r.f.I3,3)+'</td><td>'+fmt(r.f.I2,3)+'</td></tr>';
      det+='<h3>'+esc(r.node.title)+'</h3><table><tr><th>Элемент</th><th>U нат., кВ</th><th>r нат., Ом</th><th>x нат., Ом</th><th>r к точке</th><th>x к точке</th><th>Формула</th></tr>';
      r.f.parts.forEach(function(p){det+='<tr><td>'+esc(p.name)+'</td><td>'+fmt(p.Unat,2)+'</td><td>'+fmt(p.rnat,4)+'</td><td>'+fmt(p.xnat,4)+'</td><td>'+fmt(p.r,4)+'</td><td>'+fmt(p.x,4)+'</td><td>'+esc(p.note)+'</td></tr>';});
      det+='<tr class="y"><td>Эквивалент</td><td>'+fmt(r.f.U,2)+'</td><td></td><td></td><td>'+fmt(r.f.re,4)+'</td><td>'+fmt(r.f.xe,4)+'</td><td>I(3)=U/(√3·zэ)='+fmt(r.f.I3,3)+' кА</td></tr></table>';
    });
    var html='\ufeff<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page Section1{size:297mm 210mm;mso-page-orientation:landscape;margin:12mm;}div.Section1{page:Section1;}body{font-family:Times New Roman,serif;font-size:12pt}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #000;padding:3px 5px}th{background:#d9e2f3}tr.y td{background:#fff2cc;font-weight:bold}</style></head><body><div class="Section1">'+
      '<h1>Расчёт токов короткого замыкания на шинах СН</h1>'+
      '<h2>Схема замещения</h2>'+schemeSvg(t)+
      '<h2>Сводная таблица</h2><table><tr><th>Точка КЗ</th><th>U, кВ</th><th>rэ, Ом</th><th>xэ, Ом</th><th>zэ, Ом</th><th>Iкз(3), кА</th><th>Iкз(2), кА</th></tr>'+rows+'</table>'+
      '<h2>Формулы и подстановка</h2>'+
      '<p>xс = Uс / (√3 · Iкз макс) = '+fmt(t.Uc,2)+' / (√3 · '+fmt(t.Ikmax,3)+') = '+fmt(t.zsMax.x,4)+' Ом.</p>'+
      '<p>Кабель: r = r0·L; x = x0·L (длина в км).</p>'+
      '<p>Трансформатор, макс. режим (нижнее ПБВ): xтр = (uк/100) · Uтап² / Sном.</p>'+
      '<p>Приведение: Z2 = Z1·(U2/U1)². Ток: I(3) = U / (√3·zэ). I(2) = (√3/2)·I(3).</p>'+
      '<h2>Поэлементная проверка</h2>'+det+
      '</div></body></html>';
    var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'application/msword'})); a.download='raschet-tokov-KZ-SN-A4.doc'; document.body.appendChild(a); a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},1200);
  }
  $('blocks').addEventListener('input',function(e){var el=e.target.closest('[data-f]'); if(!el) return; var i=+el.getAttribute('data-i'), f=el.getAttribute('data-f'); if(!state.els[i]) return; state.els[i][f]=f==='name'?el.value:nn(el.value); paint();});
  $('blocks').addEventListener('click',function(e){var b=e.target.closest('[data-del]'); if(!b) return; state.els=state.els.filter(function(x){return x.id!==b.getAttribute('data-del');}); draw(); paint();});
  $('add-cab').onclick=function(){add('cab');};
  $('add-bus').onclick=function(){add('bus');};
  $('add-tr').onclick=function(){add('tr');};
  $('btn-demo').onclick=demo;
  $('btn-word').onclick=function(){try{exportWord();}catch(err){alert(err.message);}};
  ['sys-name','uc','ik-max','ik-min'].forEach(function(id){var el=$(id); if(el) el.addEventListener('input',paint);});
  demo();
})();

/* высота шапки на телефоне больше, чем на ПК — липкая строка строка считается по живой шапке */
(function () {
  function setHeadOffset() {
    var h = document.querySelector('header');
    if (h) document.documentElement.style.setProperty('--thead-top', Math.round(h.offsetHeight) + 'px');
  }
  setHeadOffset();
  addEventListener('resize', setHeadOffset);
})();
