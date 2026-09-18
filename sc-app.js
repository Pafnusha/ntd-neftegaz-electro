(function(){
  function $(id){return document.getElementById(id);}
  function uid(){return 'e'+Math.random().toString(36).slice(2,8);}
  function nn(v){v=parseFloat(v);return isFinite(v)?v:0;}
  function fmt(x,d){if(!isFinite(x))return '-';return Number(x).toLocaleString('ru-RU',{maximumFractionDigits:d});}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  var state={els:[]};
  function demo(){
    $('sys-name').value='PS 35 kV VN'; $('uc').value='37'; $('ik-max').value='12.61'; $('ik-min').value='';
    $('sys-name').value='\u041f\u0421 35 \u043a\u0412, \u0448\u0438\u043d\u044b \u0412\u041d';
    state.els=[
      {id:uid(),kind:'cab',name:'\u041a\u041b 35 \u043a\u0412 \u043a ESS-530, 3\u00d7150',U:35,L:1.4,r0:0.159,x0:0.11},
      {id:uid(),kind:'bus',name:'\u0417\u0420\u0423 ESS-530 35 \u043a\u0412',U:35},
      {id:uid(),kind:'tr',name:'042-TR530-BC1 \u0422\u0421\u0414-20000/35/10,5',S:20,uk:7,Uh:35,Ul:10.5,Utap:31.5}
    ];
    draw(); paint();
  }
  function add(kind){
    if(kind==='cab') state.els.push({id:uid(),kind:'cab',name:'\u041a\u041b 35 \u043a\u0412',U:35,L:1,r0:0.159,x0:0.11});
    if(kind==='bus') state.els.push({id:uid(),kind:'bus',name:'\u0420\u0423 / \u0417\u0420\u0423',U:10.5});
    if(kind==='tr') state.els.push({id:uid(),kind:'tr',name:'\u0422 \u041a\u0422\u041f 35/10',S:16,uk:8,Uh:35,Ul:10.5,Utap:31.5});
    draw(); paint();
  }
  function draw(){
    var box=$('blocks'); box.innerHTML='';
    state.els.forEach(function(e,i){
      var d=document.createElement('div');
      d.className='blk '+(e.kind==='cab'?'cab':e.kind==='tr'?'tr':'bus');
      var h='<h3>'+(i+1)+'. '+(e.kind==='cab'?'\u041a\u0430\u0431\u0435\u043b\u044c':e.kind==='tr'?'\u0422\u0440\u0430\u043d\u0441\u0444\u043e\u0440\u043c\u0430\u0442\u043e\u0440':'\u0428\u0438\u043d\u044b')+'</h3>';
      h+='<label class="field">\u0418\u043c\u044f<input data-i="'+i+'" data-f="name" value="'+esc(e.name)+'"></label>';
      if(e.kind==='cab'){
        h+='<label class="field">U, \u043a\u0412<input type="number" step="0.1" data-i="'+i+'" data-f="U" value="'+e.U+'"></label>';
        h+='<label class="field">L, \u043a\u043c<input type="number" step="0.001" data-i="'+i+'" data-f="L" value="'+e.L+'"></label>';
        h+='<label class="field">r0<input type="number" step="0.001" data-i="'+i+'" data-f="r0" value="'+e.r0+'"></label>';
        h+='<label class="field">x0<input type="number" step="0.001" data-i="'+i+'" data-f="x0" value="'+e.x0+'"></label>';
      }
      if(e.kind==='bus') h+='<label class="field">U \u0448\u0438\u043d, \u043a\u0412<input type="number" step="0.1" data-i="'+i+'" data-f="U" value="'+e.U+'"></label>';
      if(e.kind==='tr'){
        h+='<label class="field">S, \u041c\u0412\u00b7\u0410<input type="number" step="0.1" data-i="'+i+'" data-f="S" value="'+e.S+'"></label>';
        h+='<label class="field">uk, %<input type="number" step="0.1" data-i="'+i+'" data-f="uk" value="'+e.uk+'"></label>';
        h+='<label class="field">U\u0432\u043d<input type="number" step="0.1" data-i="'+i+'" data-f="Uh" value="'+e.Uh+'"></label>';
        h+='<label class="field">U\u043d\u043d<input type="number" step="0.1" data-i="'+i+'" data-f="Ul" value="'+e.Ul+'"></label>';
        h+='<label class="field">U \u041f\u0411\u0412 \u043c\u0430\u043aс<input type="number" step="0.1" data-i="'+i+'" data-f="Utap" value="'+e.Utap+'"></label>';
      }
      h+='<button type="button" data-del="'+e.id+'">\u0423\u0434\u0430\u043b\u0438\u0442\u044c</button>';
      d.innerHTML=h; box.appendChild(d);
    });
  }
  function zsys(Uc,Ik){return Ik>0?{r:0,x:Uc/(Math.sqrt(3)*Ik),U:Uc}:{r:0,x:0,U:Uc};}
  function refZ(z,fromU,toU){if(!(fromU>0)||!(toU>0)||fromU===toU) return {r:z.r,x:z.x}; var k=(toU/fromU)*(toU/fromU); return {r:z.r*k,x:z.x*k};}
  function compute(){
    var Uc=nn($('uc').value)||37, Ikmax=nn($('ik-max').value);
    var name=$('sys-name').value||'\u0421\u0438\u0441\u0442\u0435\u043c\u0430';
    var zsMax=zsys(Uc,Ikmax);
    var nodes=[{id:'K1',title:'K1 \u00b7 '+name,U:Uc,kind:'sys'}];
    var chain=[{kind:'sys',name:name,U:Uc,r:0,x:zsMax.x,note:'xc=Uc/(sqrt(3)*Ik)'}];
    var Uprev=Uc;
    state.els.forEach(function(e,i){
      if(e.kind==='cab'){
        chain.push({kind:'cab',name:e.name,U:nn(e.U)||Uprev,r:nn(e.r0)*nn(e.L),x:nn(e.x0)*nn(e.L),note:'r=r0*L; x=x0*L'});
        Uprev=nn(e.U)||Uprev; nodes.push({id:'K'+(i+2),title:'K'+(i+2)+' \u00b7 '+e.name,U:Uprev,kind:'cab'});
      } else if(e.kind==='bus'){
        chain.push({kind:'bus',name:e.name,U:nn(e.U)||Uprev,r:0,x:0,note:'Z=0'});
        Uprev=nn(e.U)||Uprev; nodes.push({id:'K'+(i+2),title:'K'+(i+2)+' \u00b7 '+e.name,U:Uprev,kind:'bus'});
      } else if(e.kind==='tr'){
        var Ut=nn(e.Utap)||nn(e.Uh)||35, S=nn(e.S)||1, uk=nn(e.uk);
        var xtr=uk/100*Ut*Ut/S;
        chain.push({kind:'tr',name:e.name,U:nn(e.Ul)||10.5,Uh:nn(e.Uh),Ul:nn(e.Ul),Utap:Ut,S:S,uk:uk,r:0,x:xtr,note:'xtr=uk/100*Utap^2/S'});
        Uprev=nn(e.Ul)||10.5; nodes.push({id:'K'+(i+2),title:'K'+(i+2)+' \u00b7 HH '+e.name,U:Uprev,kind:'tr'});
      }
    });
    function faultAt(idx){
      var Un=nodes[idx].U, re=0, xe=0, parts=[];
      for(var i=0;i<=idx;i++){
        var el=chain[i];
        var from=el.kind==='tr'?el.Utap:el.U;
        var zr=refZ({r:el.r,x:el.x},from,Un);
        re+=zr.r; xe+=zr.x;
        parts.push({name:el.name,kind:el.kind,rnat:el.r,xnat:el.x,Unat:from,r:zr.r,x:zr.x,note:el.note});
      }
      var z=Math.sqrt(re*re+xe*xe);
      var I3=z>0?(Un/(Math.sqrt(3)*z)):0;
      return {re:re,xe:xe,z:z,I3:I3,I2:I3*Math.sqrt(3)/2,parts:parts,U:Un};
    }
    var rows=nodes.map(function(nd,i){return {node:nd,f:faultAt(i)};});
    return {Uc:Uc,Ikmax:Ikmax,zsMax:zsMax,name:name,chain:chain,nodes:nodes,rows:rows};
  }
  function schemeSvg(t){
    var n=t.nodes.length,w=Math.max(760,n*170);
    var s='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="170" viewBox="0 0 '+w+' 170">';
    s+='<rect width="'+w+'" height="170" fill="#f8fbff"/>';
    var x0=70,dx=(w-80)/Math.max(1,n-1);
    t.nodes.forEach(function(nd,i){
      var x=x0+i*dx;
      if(i<n-1) s+='<line x1="'+(x+42)+'" y1="60" x2="'+(x+dx-42)+'" y2="60" stroke="#1b6ef3" stroke-width="3"/>';
      var col=nd.kind==='sys'?'#1b6ef3':nd.kind==='tr'?'#c05600':nd.kind==='cab'?'#2e7d32':'#5e35b1';
      s+='<rect x="'+(x-42)+'" y="34" width="84" height="52" rx="8" fill="'+col+'"/>';
      s+='<text x="'+x+'" y="55" text-anchor="middle" fill="#fff" font-size="11">'+esc(nd.id)+'</text>';
      s+='<text x="'+x+'" y="70" text-anchor="middle" fill="#fff" font-size="10">'+fmt(nd.U,1)+' kV</text>';
      s+='<text x="'+x+'" y="108" text-anchor="middle" font-size="11">I(3)='+fmt(t.rows[i].f.I3,2)+' kA</text>';
      s+='<text x="'+x+'" y="124" text-anchor="middle" font-size="10">I(2)='+fmt(t.rows[i].f.I2,2)+' kA</text>';
    });
    return s+'</svg>';
  }
  function paint(){
    var t=compute(); window._sc=t; $('scheme').innerHTML=schemeSvg(t);
    var h='<table><tr><th>Tochka</th><th>U, kV</th><th>re, Ohm</th><th>xe, Ohm</th><th>ze, Ohm</th><th>Ik3, kA</th><th>Ik2, kA</th></tr>';
    h='<table><tr><th>\u0422\u043e\u0447\u043a\u0430</th><th>U, \u043a\u0412</th><th>r\u044d, \u041e\u043c</th><th>x\u044d, \u041e\u043c</th><th>z\u044d, \u041e\u043c</th><th>I\u043a\u0437(3), \u043a\u0410</th><th>I\u043a\u0437(2), \u043a\u0410</th></tr>';
    t.rows.forEach(function(r){h+='<tr><td>'+esc(r.node.title)+'</td><td>'+fmt(r.f.U,2)+'</td><td>'+fmt(r.f.re,4)+'</td><td>'+fmt(r.f.xe,4)+'</td><td>'+fmt(r.f.z,4)+'</td><td><b>'+fmt(r.f.I3,3)+'</b></td><td>'+fmt(r.f.I2,3)+'</td></tr>';});
    $('res').innerHTML=h+'</table>';
  }
  function exportWord(){
    var t=compute(); var rows='', det='';
    t.rows.forEach(function(r){
      rows+='<tr><td>'+esc(r.node.title)+'</td><td>'+fmt(r.f.U,2)+'</td><td>'+fmt(r.f.re,4)+'</td><td>'+fmt(r.f.xe,4)+'</td><td>'+fmt(r.f.z,4)+'</td><td>'+fmt(r.f.I3,3)+'</td><td>'+fmt(r.f.I2,3)+'</td></tr>';
      det+='<h3>'+esc(r.node.title)+'</h3><table><tr><th>\u042d\u043b\u0435\u043c\u0435\u043d\u0442</th><th>U nat</th><th>r nat</th><th>x nat</th><th>r k U</th><th>x k U</th><th>\u0424\u043e\u0440\u043c\u0443\u043b\u0430</th></tr>';
      r.f.parts.forEach(function(p){det+='<tr><td>'+esc(p.name)+'</td><td>'+fmt(p.Unat,2)+'</td><td>'+fmt(p.rnat,4)+'</td><td>'+fmt(p.xnat,4)+'</td><td>'+fmt(p.r,4)+'</td><td>'+fmt(p.x,4)+'</td><td>'+esc(p.note)+'</td></tr>';});
      det+='<tr class="y"><td>\u042d\u043a\u0432\u0438\u0432\u0430\u043b\u0435\u043d\u0442</td><td>'+fmt(r.f.U,2)+'</td><td></td><td></td><td>'+fmt(r.f.re,4)+'</td><td>'+fmt(r.f.xe,4)+'</td><td>I(3)=U/(sqrt(3)*z) = '+fmt(r.f.I3,3)+' kA</td></tr></table>';
    });
    var html='\ufeff<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>@page Section1{size:297mm 210mm;mso-page-orientation:landscape;margin:12mm;}div.Section1{page:Section1;}body{font-family:Times New Roman,serif;font-size:12pt}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #000;padding:3px 5px}th{background:#d9e2f3}tr.y td{background:#fff2cc;font-weight:bold}</style></head><body><div class="Section1">'+
      '<h1>\u0420\u0430\u0441\u0447\u0451\u0442 \u0442\u043e\u043a\u043e\u0432 \u041a\u0417 \u043d\u0430 \u0448\u0438\u043d\u0430\u0445 \u0421\u041d</h1>'+
      '<h2>\u0421\u0445\u0435\u043c\u0430 \u0437\u0430\u043c\u0435\u0449\u0435\u043d\u0438\u044f</h2>'+schemeSvg(t)+
      '<h2>\u0421\u0432\u043e\u0434\u043d\u0430\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0430</h2><table><tr><th>\u0422\u043e\u0447\u043a\u0430</th><th>U, \u043a\u0412</th><th>r\u044d</th><th>x\u044d</th><th>z\u044d</th><th>I(3), \u043a\u0410</th><th>I(2), \u043a\u0410</th></tr>'+rows+'</table>'+
      '<h2>\u0424\u043e\u0440\u043c\u0443\u043b\u044b</h2>'+
      '<p>xс = Uс / (\u221a3 \u00b7 Iкз макс) = '+fmt(t.Uc,2)+' / (\u221a3 \u00b7 '+fmt(t.Ikmax,3)+') = '+fmt(t.zsMax.x,4)+' \u041eм.</p>'+
      '<p>\u041aабель: r = r0\u00b7L; x = x0\u00b7L (L в км).</p>'+
      '<p>\u0422рансформатор (нижнее ПБВ): xтр = (uk/100)\u00b7Uтап²/Sном.</p>'+
      '<p>Z2 = Z1\u00b7(U2/U1)². I(3) = U / (\u221a3\u00b7zэ). I(2) = (\u221a3/2)\u00b7I(3).</p>'+
      '<h2>\u041fоэлементная проверка</h2>'+det+
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
  ['sys-name','uc','ik-max','ik-min'].forEach(function(id){$(id).addEventListener('input',paint);});
  demo();
})();
