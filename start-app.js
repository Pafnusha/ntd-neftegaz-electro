(function(){
  function $(id){return document.getElementById(id);}
  function uid(){return 'b'+Math.random().toString(36).slice(2,8);}
  function num(el){var v=parseFloat(el&&el.value);return isFinite(v)?v:0;}
  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function sinFromCos(c){c=clamp(c,-0.999999,0.999999);return Math.sqrt(Math.max(0,1-c*c));}
  function fmt(x,d){if(!isFinite(x))return '-';return Number(x).toLocaleString('ru-RU',{maximumFractionDigits:d});}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<');}
  var state={branches:[]};
  function demo(){
    state.branches=[
      {id:uid(),name:'КЛ ПС — РП 3×120',L:0.72,r0:0.15,x0:0.081,P:5090.45,cos:0.95,rbr:0,xbr:0},
      {id:uid(),name:'КЛ РП — ЭД 3×70',L:0.16,r0:0.26,x0:0.086,P:0,cos:0.8,rbr:0.06,xbr:0.018}
    ];
    $('src-type').value='ps35';
    $('unt').value='10.5'; $('ps-p').value='14006.37'; $('ps-cos').value='0.9';
    $('snt').value='16000'; $('pk').value='90'; $('uk').value='8';
    $('un-sys').value='35'; $('ikz').value='4.124';
    $('rkv').value='0.035'; $('xkv').value='0.012';
    $('mot-p').value='1000'; $('mot-eta').value='0.952'; $('mot-cos').value='0.8'; $('mot-k').value='6';
    toggleSrc(); renderBranches(); paint();
  }
  function toggleSrc(){
    var ps=$('src-type').value==='ps35';
    $('ps35-block').style.display=ps?'grid':'none';
    $('grid10-block').style.display=ps?'none':'grid';
  }
  function sourceRX(){
    var Unt=num($('unt'))||10.5;
    if($('src-type').value==='ps35'){
      var Snt=num($('snt'))||1, Pk=num($('pk')), uk=num($('uk'));
      var Un=num($('un-sys'))||35, Ikz=num($('ikz'))||0.001;
      var rt=Pk*Unt*Unt/(Snt*Snt)*1e6;
      var zt=uk*Unt*Unt/Snt*1e4;
      var xt=Math.sqrt(Math.max(0,zt*zt-rt*rt));
      var xc=Un/(Math.sqrt(3)*Ikz)*Math.pow(Unt/Un,2)*1e3;
      var rkv=num($('rkv')), xkv=num($('xkv'));
      return {kind:'ps35',Unt:Unt,rt:rt,zt:zt,xt:xt,xc:xc,rkv:rkv,xkv:xkv,R:rt+rkv,X:xt+xkv+xc,Snt:Snt,Pk:Pk,uk:uk,Un:Un,Ikz:Ikz};
    }
    var Ikz10=num($('ikz10'))||0.001;
    var xc=Unt/(Math.sqrt(3)*Ikz10)*1e3;
    var rkv=num($('rkv10')), xkv=num($('xkv10'));
    return {kind:'grid10',Unt:Unt,rt:0,zt:0,xt:0,xc:xc,rkv:rkv,xkv:xkv,R:rkv,X:xkv+xc,Ikz:Ikz10};
  }
  function compute(){
    var src=sourceRX(); var Unt=src.Unt;
    var P0=num($('ps-p')), c0=num($('ps-cos'))||0.9, s0=sinFromCos(c0);
    var I0=Unt>0?P0/(Math.sqrt(3)*Unt*c0):0;
    var lim=num($('du-lim'))||10;
    var mot={P:num($('mot-p')),eta:num($('mot-eta'))||1,cos:num($('mot-cos'))||0.8,k:num($('mot-k'))||1};
    mot.sin=sinFromCos(mot.cos);
    var br=state.branches.map(function(b){
      return {name:b.name,L:Number(b.L)||0,r0:Number(b.r0)||0,x0:Number(b.x0)||0,P:Number(b.P)||0,cos:Number(b.cos)||0.9,rbr:(Number(b.rbr)||0)*1e-3,xbr:(Number(b.xbr)||0)*1e-3};
    });
    br.forEach(function(b){b.R=b.r0*b.L+b.rbr; b.X=b.x0*b.L+b.xbr; b.sin=sinFromCos(b.cos);});
    function dropSrc(I){return I*Math.sqrt(3)*(src.R*c0+src.X*s0)*1e-3;}
    function dropBr(b,I,cos,sin){return I*Math.sqrt(3)*(b.R*cos+b.X*sin);}
    var dU0src=dropSrc(I0); var U=Unt-dU0src*1e-3;
    var nodes0=[{name:'Шины источника',I:I0,dU:dU0src,U:U}];
    br.forEach(function(b,i){
      var Ib=b.P>0&&U>0?b.P/(Math.sqrt(3)*U*b.cos):0;
      var dU=(i===br.length-1&&b.P===0)?0:dropBr(b,Ib,b.cos,b.sin);
      U=U-dU*1e-3; b.I0=Ib; b.dU0=dU; b.U0=U;
      nodes0.push({name:b.name,I:Ib,dU:dU,U:U});
    });
    var Ubus=br.length?br[br.length-1].U0:nodes0[0].U; if(!(Ubus>0)) Ubus=Unt;
    var In=mot.P/(Math.sqrt(3)*Ubus*mot.cos*mot.eta); var Ip=In*mot.k;
    var IstartSrc=I0+Ip; var dU1src=dropSrc(IstartSrc); U=Unt-dU1src*1e-3;
    var nodes1=[{name:'Шины источника',I:IstartSrc,dU:dU1src,U:U}];
    br.forEach(function(b,i){
      var Ib=(b.P>0&&U>0?b.P/(Math.sqrt(3)*Math.max(U,0.1)*b.cos):0)+Ip;
      var last=i===br.length-1;
      var dU=dropBr(b,Ib,last?mot.cos:b.cos,last?mot.sin:b.sin);
      U=U-dU*1e-3; b.I1=Ib; b.dU1=dU; b.U1=U;
      nodes1.push({name:b.name,I:Ib,dU:dU,U:U});
    });
    var sumV0=dU0src+br.reduce(function(s,b){return s+b.dU0;},0);
    var sumV1=dU1src+br.reduce(function(s,b){return s+b.dU1;},0);
    function pct(v){return v/(Unt*10);}
    return {src:src,P0:P0,c0:c0,s0:s0,I0:I0,mot:mot,In:In,Ip:Ip,br:br,nodes0:nodes0,nodes1:nodes1,dU0src:dU0src,dU1src:dU1src,Um0:Ubus,Um1:U,sumV0:sumV0,sumV1:sumV1,pct0:pct(sumV0),pct1src:pct(dU1src),pct1:pct(sumV1),lim:lim,ok0:pct(sumV0)<=lim+1e-6,okSrc:pct(dU1src)<=lim+1e-6,okM:pct(sumV1)<=lim+1e-6};
  }
  function renderBranches(){
    var tb=$('br-body'); tb.innerHTML='';
    state.branches.forEach(function(b){
      var tr=document.createElement('tr');
      tr.innerHTML='<td><input data-f="name" value="'+esc(b.name)+'"></td><td><input type="number" step="0.01" data-f="L" value="'+b.L+'"></td><td><input type="number" step="0.001" data-f="r0" value="'+b.r0+'"></td><td><input type="number" step="0.001" data-f="x0" value="'+b.x0+'"></td><td><input type="number" step="0.01" data-f="P" value="'+b.P+'"></td><td><input type="number" step="0.01" data-f="cos" value="'+b.cos+'"></td><td><input type="number" step="0.001" data-f="rbr" value="'+b.rbr+'"></td><td><input type="number" step="0.001" data-f="xbr" value="'+b.xbr+'"></td><td><button type="button" data-del="'+b.id+'">x</button></td>';
      tb.appendChild(tr);
    });
  }
  function schemeSvg(t){
    var parts=['Источник']; t.br.forEach(function(b){parts.push(b.name);}); parts.push('ЭД '+t.mot.P+' кВт');
    var w=Math.max(720,parts.length*170), x0=70, dx=(w-80)/(parts.length-1);
    var s='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="150" viewBox="0 0 '+w+' 150">';
    s+='<rect width="'+w+'" height="150" fill="#f8fbff"/>';
    parts.forEach(function(name,i){
      var x=x0+i*dx;
      if(i<parts.length-1) s+='<line x1="'+(x+40)+'" y1="58" x2="'+(x+dx-40)+'" y2="58" stroke="#1b6ef3" stroke-width="3"/>';
      var fill=i===0?'#1b6ef3':(i===parts.length-1?'#c62828':'#2e7d32');
      s+='<rect x="'+(x-40)+'" y="32" width="80" height="52" rx="8" fill="'+fill+'"/>';
      s+='<text x="'+x+'" y="62" text-anchor="middle" fill="#fff" font-size="11">'+esc(String(name).slice(0,14))+'</text>';
    });
    t.nodes1.forEach(function(n,i){var x=x0+i*dx; s+='<text x="'+x+'" y="108" text-anchor="middle" font-size="11">'+(isFinite(n.U)?n.U.toFixed(3)+' кВ':'')+'</text>';});
    s+='</svg>'; return s;
  }
  function paint(){
    var t=compute();
    $('scheme').innerHTML=schemeSvg(t);
    $('o-u0').textContent=fmt(t.nodes0[0].U,3)+' кВ';
    $('o-um0').textContent=fmt(t.Um0,3)+' кВ';
    $('o-i').textContent=fmt(t.In,1)+' / '+fmt(t.Ip,1)+' А';
    $('o-du-s').innerHTML='<span class="'+(t.okSrc?'ok':'bad')+'">'+fmt(t.pct1src,2)+' %</span>';
    $('o-du-m').innerHTML='<span class="'+(t.okM?'ok':'bad')+'">'+fmt(t.pct1,2)+' %</span>';
    $('o-um').textContent=fmt(t.Um1,3)+' кВ';
    $('o-gost').innerHTML=t.okM?'<span class="ok">норма</span>':'<span class="bad">превышение</span>';
    var html='<table><tr><th>Узел</th><th>I без, А</th><th>ΔU без, В / %</th><th>U без, кВ</th><th>I пуск, А</th><th>ΔU пуск, В / %</th><th>U пуск, кВ</th></tr>';
    t.nodes0.forEach(function(n,i){var n1=t.nodes1[i]; html+='<tr><td>'+esc(n.name)+'</td><td>'+fmt(n.I,1)+'</td><td>'+fmt(n.dU,1)+' / '+fmt(n.dU/(t.src.Unt*10),2)+'</td><td>'+fmt(n.U,3)+'</td><td>'+fmt(n1.I,1)+'</td><td>'+fmt(n1.dU,1)+' / '+fmt(n1.dU/(t.src.Unt*10),2)+'</td><td>'+fmt(n1.U,3)+'</td></tr>';});
    $('node-out').innerHTML=html+'</table>';
    $('verdict').textContent=t.okM?('ΔU на клеммах '+fmt(t.pct1,2)+' % ≤ '+t.lim+' % — ГОСТ 32144.'):('ΔU на клеммах '+fmt(t.pct1,2)+' % > '+t.lim+' % — не соответствует ГОСТ 32144.');
  }
  function exportWord(){}
  $('src-type').onchange=function(){toggleSrc();paint();};
  ['unt','ps-p','ps-cos','du-lim','snt','pk','uk','un-sys','ikz','rkv','xkv','ikz10','rkv10','xkv10','mot-p','mot-eta','mot-cos','mot-k'].forEach(function(id){var el=$(id); if(el) el.addEventListener('input',paint);});
  $('br-body').addEventListener('input',function(e){var inp=e.target.closest('input[data-f]'); if(!inp) return; var tr=inp.closest('tr'), idx=[].indexOf.call(tr.parentNode.children,tr); if(idx<0) return; var f=inp.dataset.f; state.branches[idx][f]=f==='name'?inp.value:Number(inp.value); paint();});
  $('br-body').addEventListener('click',function(e){var btn=e.target.closest('[data-del]'); if(!btn) return; state.branches=state.branches.filter(function(b){return b.id!==btn.getAttribute('data-del');}); renderBranches(); paint();});
  $('btn-add').onclick=function(){state.branches.push({id:uid(),name:'КЛ РУ — РУ',L:0.5,r0:0.15,x0:0.081,P:0,cos:0.9,rbr:0,xbr:0}); renderBranches(); paint();};
  $('btn-demo').onclick=demo;
  window._startCompute=compute;
  demo();
})();
