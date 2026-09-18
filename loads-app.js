(function () {
  var TR = [25,40,63,100,160,250,400,630,1000,1600,2500,4000,6300,10000];
  var KI1 = [0.1,0.15,0.2,0.3,0.4,0.5,0.6,0.7,0.8];
  var NE1 = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,30,35,40,45,50,60,70,80,90,100];
  var T1 = [
    [8,5.33,4,2.67,2,1.6,1.33,1.14,1],[6.22,4.33,3.39,2.45,1.98,1.6,1.33,1.14,1],
    [4.05,2.89,2.31,1.74,1.45,1.34,1.22,1.14,1],[3.24,2.35,1.91,1.47,1.25,1.21,1.12,1.06,1],
    [2.84,2.09,1.72,1.35,1.16,1.16,1.08,1.03,1],[2.64,1.96,1.62,1.28,1.11,1.13,1.06,1.01,1],
    [2.49,1.86,1.54,1.23,1.12,1.1,1.04,1,1],[2.37,1.78,1.48,1.19,1.1,1.08,1.02,1,1],
    [2.27,1.71,1.43,1.16,1.09,1.07,1.01,1,1],[2.18,1.65,1.39,1.13,1.07,1.05,1,1,1],
    [2.11,1.61,1.35,1.1,1.06,1.04,1,1,1],[2.04,1.56,1.32,1.08,1.05,1.03,1,1,1],
    [1.99,1.52,1.29,1.06,1.04,1.01,1,1,1],[1.94,1.49,1.27,1.05,1.02,1,1,1,1],
    [1.89,1.46,1.25,1.03,1,1,1,1,1],[1.85,1.43,1.23,1.02,1,1,1,1,1],
    [1.81,1.41,1.21,1,1,1,1,1,1],[1.78,1.39,1.19,1,1,1,1,1,1],
    [1.75,1.36,1.17,1,1,1,1,1,1],[1.72,1.35,1.16,1,1,1,1,1,1],
    [1.69,1.33,1.15,1,1,1,1,1,1],[1.67,1.31,1.13,1,1,1,1,1,1],
    [1.64,1.3,1.12,1,1,1,1,1,1],[1.62,1.28,1.11,1,1,1,1,1,1],
    [1.6,1.27,1.1,1,1,1,1,1,1],[1.51,1.21,1.05,1,1,1,1,1,1],
    [1.44,1.16,1,1,1,1,1,1,1],[1.4,1.13,1,1,1,1,1,1,1],
    [1.35,1.1,1,1,1,1,1,1,1],[1.3,1.07,1,1,1,1,1,1,1],
    [1.25,1.03,1,1,1,1,1,1,1],[1.2,1,1,1,1,1,1,1,1],
    [1.16,1,1,1,1,1,1,1,1],[1.13,1,1,1,1,1,1,1,1],[1.1,1,1,1,1,1,1,1,1]
  ];
  var KI2 = [0.1,0.15,0.2,0.3,0.4,0.5,0.6,0.7];
  var R2 = [{lo:1,hi:1},{lo:2,hi:2},{lo:3,hi:3},{lo:4,hi:4},{lo:5,hi:5},{lo:6,hi:8},{lo:9,hi:10},{lo:11,hi:25},{lo:26,hi:50},{lo:51,hi:1e9}];
  var T2 = [
    [8,5.33,4,2.67,2,1.6,1.33,1.14],[5.01,3.44,2.69,1.9,1.52,1.24,1.11,1],
    [2.94,2.17,1.8,1.42,1.23,1.14,1.08,1],[2.28,1.73,1.46,1.19,1.06,1.04,1,0.97],
    [1.31,1.12,1.02,1,0.98,0.96,0.94,0.93],[1.2,1,0.96,0.95,0.94,0.93,0.92,0.91],
    [1.1,0.97,0.91,0.9,0.9,0.9,0.9,0.9],[0.8,0.8,0.8,0.85,0.85,0.85,0.9,0.9],
    [0.75,0.75,0.75,0.75,0.75,0.8,0.85,0.85],[0.65,0.65,0.65,0.7,0.7,0.75,0.8,0.8]
  ];
  var DEMO = [
    {name:'Сети внутриплощадочные. Электрообогрев трубопроводных коллекторов',n:1,pnUnit:340,ki:0.75,cosPhi:0.98,ks:0.75},
    {name:'Электрообогрев',n:1,pnUnit:200,ki:0.75,cosPhi:0.98,ks:0.75},
    {name:'Собственные нужды азотной станции',n:1,pnUnit:40,ki:0.8,cosPhi:0.85,ks:0.8},
    {name:'Азотная станция. Насосы (2 раб. + 1 рез.)',n:2,pnUnit:216,ki:0.8,cosPhi:0.8,ks:0.8},
    {name:'УПТ. Насосы 2046-P-301A,B,C (2 раб. + 1 рез.)',n:2,pnUnit:132,ki:1,cosPhi:0.8,ks:1},
    {name:'Технологические нагрузки УПТ',n:1,pnUnit:180,ki:0.7,cosPhi:0.75,ks:0.7}
  ];
  var state = {mode:'rtm', krTable:'table1', un:0.4, krOverride:false, krManual:1, groupKs:0.5, ko:0.9, cosTarget:0.95, rows:[]};
  function uid(){ return 'r'+Math.random().toString(36).slice(2,10); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b,x)); }
  function tgFromCos(c){ c=Number(c); if (!isFinite(c) || Math.abs(c)>=1) return 0; return Math.tan(Math.acos(clamp(c,-0.999999,0.999999))); }
  function bracket(arr,x){ if (x<=arr[0]) return [0,0]; var n=arr.length; if (x>=arr[n-1]) return [n-1,n-1]; var i=0; while (i<n-1 && arr[i+1]<x) i++; return [i,i+1]; }
  function lerp(a,b,t){ return a+(b-a)*t; }
  function lookupKr1(ne,ki){
    if (!(ne>0) || !(ki>=0)) return 1; if (ki>=0.8) return 1;
    var ii=bracket(NE1,ne), jj=bracket(KI1,ki);
    var tNe = NE1[ii[1]]===NE1[ii[0]] ? 0 : (ne-NE1[ii[0]])/(NE1[ii[1]]-NE1[ii[0]]);
    var tKi = KI1[jj[1]]===KI1[jj[0]] ? 0 : (ki-KI1[jj[0]])/(KI1[jj[1]]-KI1[jj[0]]);
    var v0 = lerp(T1[ii[0]][jj[0]], T1[ii[1]][jj[0]], tNe);
    var v1 = lerp(T1[ii[0]][jj[1]], T1[ii[1]][jj[1]], tNe);
    return lerp(v0,v1,tKi);
  }
  function lookupKr2(ne,ki){
    if (!(ne>0) || !(ki>=0)) return 1;
    var n=Math.max(1,ne), rowIdx=R2.length-1, i;
    for (i=0;i<R2.length;i++) if (n>=R2[i].lo && n<=R2[i].hi){ rowIdx=i; break; }
    var row=T2[rowIdx];
    if (ki>=0.7) return row[row.length-1];
    if (ki<=KI2[0]) return row[0];
    var jj=bracket(KI2,ki);
    var t = KI2[jj[1]]===KI2[jj[0]] ? 0 : (ki-KI2[jj[0]])/(KI2[jj[1]]-KI2[jj[0]]);
    return lerp(row[jj[0]], row[jj[1]], t);
  }
  function lookupKr(mode,ne,ki){ return mode==='table2' ? lookupKr2(ne,ki) : lookupKr1(ne,ki); }
  function pickTr(s){ if (!(s>0)) return 0; var i; for (i=0;i<TR.length;i++) if (TR[i]>=s-1e-9) return TR[i]; return Math.ceil(s); }
  function $(id){ return document.getElementById(id); }
  function fmt(x,d){ if (!isFinite(x)) return '\u2014'; return Number(x).toLocaleString('ru-RU',{maximumFractionDigits:d,minimumFractionDigits:0}); }
  function esc(s){ return String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/"/g,'"'); }
  function xmlEsc(s){ return String(s==null?'':s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>'); }
  function compute(){
    var rows = state.rows.map(function(r){
      var n=Number(r.n)||0, pu=Number(r.pnUnit)||0, ki=Number(r.ki)||0, c=Number(r.cosPhi)||0, ks=Number(r.ks)||0;
      var Pn=n*pu, KiPn=ki*Pn, tg=tgFromCos(c);
      return {name:r.name,n:n,pnUnit:pu,ki:ki,cosPhi:c,ks:ks,Pn:Pn,KiPn:KiPn,tg:tg,Qrow:KiPn*tg,nPn2:n*pu*pu};
    });
    var Pn=0,KiPn=0,Qsum=0,sumNPn2=0,i;
    for (i=0;i<rows.length;i++){ Pn+=rows[i].Pn; KiPn+=rows[i].KiPn; Qsum+=rows[i].Qrow; sumNPn2+=rows[i].nPn2; }
    var KiAvg = Pn>0 ? KiPn/Pn : 0;
    var ne = (sumNPn2>0 && Pn>0) ? (Pn*Pn)/sumNPn2 : 0; if (ne<1 && Pn>0) ne=1;
    var tw=0; for (i=0;i<rows.length;i++) tw+=rows[i].KiPn*rows[i].tg;
    var tgAvg = KiPn>0 ? tw/KiPn : 0;
    var kr = state.krOverride ? (Number(state.krManual)||1) : lookupKr(state.krTable, ne, KiAvg);
    var Pp,Qp;
    if (state.mode==='demand'){ Pp=(Number(state.groupKs)||0)*Pn; Qp=Pp*tgAvg; }
    else { Pp=kr*KiPn; Qp = ne<=10 ? 1.1*KiPn*tgAvg : KiPn*tgAvg; }
    var Sp=Math.sqrt(Pp*Pp+Qp*Qp);
    var Un=Number(state.un)||0.4;
    var Ip=Un>0 ? Sp/(Math.sqrt(3)*Un) : 0;
    var cos1=Sp>0 ? Pp/Sp : 0;
    var ko=isFinite(Number(state.ko)) ? Number(state.ko) : 1;
    var PpKo=Pp*ko, QpKo=Qp*ko, SpKo=Math.sqrt(PpKo*PpKo+QpKo*QpKo);
    var cos2=Number(state.cosTarget)||0.95, tg2=tgFromCos(cos2);
    var tg1=PpKo>0 ? QpKo/PpKo : tgAvg;
    var Qc=Math.max(0, PpKo*(tg1-tg2));
    var Qp2=QpKo-Qc, Sp2=Math.sqrt(PpKo*PpKo+Qp2*Qp2);
    var Ip2=Un>0 ? Sp2/(Math.sqrt(3)*Un) : 0;
    return {rows:rows,Pn:Pn,KiPn:KiPn,Qsum:Qsum,sumNPn2:sumNPn2,KiAvg:KiAvg,ne:ne,tgAvg:tgAvg,kr:kr,Pp:Pp,Qp:Qp,Sp:Sp,Ip:Ip,Un:Un,cos1:cos1,ko:ko,PpKo:PpKo,QpKo:QpKo,SpKo:SpKo,cos2:cos2,tg1:tg1,tg2:tg2,Qc:Qc,Qp2:Qp2,Sp2:Sp2,Ip2:Ip2,Str:pickTr(Sp2)};
  }
  function renderRows(){
    var tb=$('ep-tbody'); tb.innerHTML='';
    var demand=state.mode==='demand';
    state.rows.forEach(function(r,idx){
      var tr=document.createElement('tr'); tr.dataset.id=r.id;
      tr.innerHTML='<td>'+(idx+1)+'</td><td><input type="text" data-f="name" value="'+esc(r.name)+'"></td><td><input type="number" data-f="n" min="0" step="1" value="'+r.n+'"></td><td><input type="number" data-f="pnUnit" min="0" step="0.01" value="'+r.pnUnit+'"></td><td class="col-calc" data-c="Pn">-</td><td><input type="number" data-f="ki" min="0" max="1" step="0.01" value="'+r.ki+'"'+(demand?' disabled':'')+'></td><td><input type="number" data-f="cosPhi" min="0" max="1" step="0.01" value="'+r.cosPhi+'"></td><td class="col-calc" data-c="tg">-</td><td class="col-calc" data-c="KiPn">-</td><td class="col-calc" data-c="Qrow">-</td><td class="col-calc" data-c="nPn2">-</td><td><input type="number" data-f="ks" min="0" max="1" step="0.01" value="'+r.ks+'"'+(demand?'':' disabled')+'></td><td><button type="button" class="btn-icon" data-act="dup">+</button> <button type="button" class="btn-icon danger" data-act="del">x</button></td>';
      tb.appendChild(tr);
    });
    paint();
  }
  function setTxt(id,v,d){ var el=$(id); if(el) el.textContent=fmt(v,d); }
  function paint(){
    var t=compute(); var trs=$('ep-tbody').querySelectorAll('tr');
    t.rows.forEach(function(r,i){ var tr=trs[i]; if(!tr) return;
      tr.querySelector('[data-c="Pn"]').textContent=fmt(r.Pn,2);
      tr.querySelector('[data-c="KiPn"]').textContent=fmt(r.KiPn,2);
      tr.querySelector('[data-c="tg"]').textContent=fmt(r.tg,3);
      tr.querySelector('[data-c="Qrow"]').textContent=fmt(r.Qrow,2);
      tr.querySelector('[data-c="nPn2"]').textContent=fmt(r.nPn2,0);
    });
    setTxt('out-Pn',t.Pn,2); setTxt('out-KiPn',t.KiPn,2); setTxt('out-KiAvg',t.KiAvg,3);
    setTxt('out-cos1',t.cos1,3); setTxt('out-tg',t.tgAvg,3); setTxt('out-ne',t.ne,2); setTxt('out-kr',t.kr,3);
    setTxt('out-Pp',t.Pp,2); setTxt('out-Qp',t.Qp,2); setTxt('out-Sp',t.Sp,2); setTxt('out-Ip',t.Ip,1);
    setTxt('out-PpKo',t.PpKo,2); setTxt('out-QpKo',t.QpKo,2); setTxt('out-SpKo',t.SpKo,2);
    setTxt('out-tg2',t.tg2,3); setTxt('out-Qc',t.Qc,2); setTxt('out-Qp2',t.Qp2,2);
    setTxt('out-Sp2',t.Sp2,2); setTxt('out-Ip2',t.Ip2,1); setTxt('out-Str',t.Str,0);
    $('kr-note').textContent = state.mode==='demand' ? 'Режим спроса: Рр = Кс * ΣPн.' : (state.krOverride ? 'Кр ручной.' : ('Итого: nэ='+fmt(t.ne,2)+', Ки='+fmt(t.KiAvg,3)+', Кр='+fmt(t.kr,3)+'.'));
    $('ku-note').textContent = 'cos1='+fmt(t.cos1,3)+' tg1='+fmt(t.tg1,3)+' -> cos2='+fmt(t.cos2,3)+' tg2='+fmt(t.tg2,3)+'. Qku='+fmt(t.Qc,1)+' kvar. S='+fmt(t.Sp2,1)+' kVA, TM '+fmt(t.Str,0)+' kVA.';
  }
  function demoRows(){ return DEMO.map(function(r){ var o={}; for (var k in r) o[k]=r[k]; o.id=uid(); return o; }); }
  function download(name, mime, text){ var blob=new Blob([text],{type:mime}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function numCell(f, v){ return '<Cell ss:Formula="'+xmlEsc(f)+'"><Data ss:Type="Number">'+(isFinite(v)?v:0)+'</Data></Cell>'; }
  function nCell(v){ return '<Cell><Data ss:Type="Number">'+(isFinite(v)?v:0)+'</Data></Cell>'; }
  function sCell(v){ return '<Cell><Data ss:Type="String">'+xmlEsc(v)+'</Data></Cell>'; }
  function exportExcel(){
    var t=compute(); var n=Math.max(state.rows.length,1); var last=n+1, tot=last+1; var rowsXml='', i, r;
    for (i=0;i<n;i++){
      r=state.rows[i]||{name:'',n:0,pnUnit:0,ki:0,cosPhi:0.8,ks:0.5};
      var rr=t.rows[i]||{Pn:0,KiPn:0,tg:0,Qrow:0,nPn2:0}; var ri=i+2;
      rowsXml += '<Row>'+sCell(r.name)+nCell(Number(r.n)||0)+nCell(Number(r.pnUnit)||0)+nCell(Number(r.ki)||0)+nCell(Number(r.cosPhi)||0)+
        numCell('=B'+ri+'*C'+ri, rr.Pn)+numCell('=D'+ri+'*F'+ri, rr.KiPn)+
        numCell('=IF(OR(E'+ri+'>=1,E'+ri+'<=-1),0,TAN(ACOS(MAX(-1,MIN(1,E'+ri+')))))', rr.tg)+
        numCell('=G'+ri+'*H'+ri, rr.Qrow)+numCell('=B'+ri+'*C'+ri+'*C'+ri, rr.nPn2)+nCell(Number(r.ks)||0)+'</Row>';
    }
    var xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n'+ 
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+
      '<Styles><Style ss:ID="h"><Font ss:Bold="1"/><Interior ss:Color="#E8EEF7" ss:Pattern="Solid"/></Style><Style ss:ID="y"><Font ss:Bold="1"/><Interior ss:Color="#FFF2B3" ss:Pattern="Solid"/></Style></Styles>'+
      '<Worksheet ss:Name="Src"><Table>'+
      '<Row ss:StyleID="h">'+sCell('Name')+sCell('n')+sCell('Pn1')+sCell('Ki')+sCell('cos')+sCell('Pn')+sCell('KiPn')+sCell('tg')+sCell('Q')+sCell('nPn2')+sCell('Ks')+'</Row>'+
      rowsXml+
      '<Row ss:StyleID="y">'+sCell('ИТОГО')+sCell('')+sCell('')+sCell('')+sCell('')+
      numCell('=SUM(F2:F'+last+')',t.Pn)+numCell('=SUM(G2:G'+last+')',t.KiPn)+sCell('')+
      numCell('=SUM(I2:I'+last+')',t.Qsum)+numCell('=SUM(J2:J'+last+')',t.sumNPn2)+sCell('')+'</Row></Table></Worksheet>'+
      '<Worksheet ss:Name="Totals"><Table>'+
      '<Row ss:StyleID="h">'+sCell('Параметр')+sCell('Значение')+sCell('Примечание')+'</Row>'+
      '<Row>'+sCell('Режим')+sCell(state.mode)+sCell('')+'</Row>'+
      '<Row>'+sCell('Un kV')+nCell(t.Un)+sCell('')+'</Row>'+
      '<Row ss:StyleID="y">'+sCell('Рр ИТОГО')+nCell(t.Pp)+sCell('Kr*sum(KiPn)')+'</Row>'+
      '<Row ss:StyleID="y">'+sCell('Рр ИТОГО kvar')+nCell(t.Qp)+sCell('')+'</Row>'+
      '<Row ss:StyleID="y">'+sCell('Sp')+numCell('=SQRT(B4*B4+B5*B5)',t.Sp)+sCell('')+'</Row>'+
      '<Row>'+sCell('Ko')+nCell(t.ko)+sCell('')+'</Row>'+
      '<Row>'+sCell('Pp*Ko')+numCell('=B4*B7',t.PpKo)+sCell('')+'</Row>'+
      '<Row>'+sCell('Qp*Ko')+numCell('=B5*B7',t.QpKo)+sCell('')+'</Row>'+
      '<Row>'+sCell('cos2')+nCell(t.cos2)+sCell('')+'</Row>'+
      '<Row>'+sCell('tg2')+nCell(t.tg2)+sCell('')+'</Row>'+
      '<Row>'+sCell('tg1')+numCell('=IF(B8>0,B9/B8,0)',t.tg1)+sCell('')+'</Row>'+
      '<Row ss:StyleID="y">'+sCell('Qku')+numCell('=MAX(0,B8*(B12-B11))',t.Qc)+sCell('P*Ko*(tg1-tg2)')+'</Row>'+
      '<Row>'+sCell('Q after')+numCell('=B9-B13',t.Qp2)+sCell('')+'</Row>'+
      '<Row ss:StyleID="y">'+sCell('S after')+numCell('=SQRT(B8*B8+B14*B14)',t.Sp2)+sCell('')+'</Row>'+
      '<Row ss:StyleID="y">'+sCell('Str')+nCell(t.Str)+sCell('TM')+'</Row></Table></Worksheet></Workbook>';
    download('nagruzki-ktp.xls','application/vnd.ms-excel',xml);
  }
  function bind(){
    $('mode-select').onchange=function(){ state.mode=this.value; renderRows(); };
    $('kr-table-select').onchange=function(){ state.krTable=this.value; paint(); };
    $('un-input').oninput=function(){ state.un=Number(this.value)||0.4; paint(); };
    $('group-ks').oninput=function(){ state.groupKs=Number(this.value)||0; paint(); };
    $('ko-input').oninput=function(){ state.ko=Number(this.value); if(!isFinite(state.ko)) state.ko=1; paint(); };
    $('cos-target').oninput=function(){ state.cosTarget=Number(this.value)||0.95; paint(); };
    $('kr-override').onchange=function(){ state.krOverride=this.checked; $('kr-manual').disabled=!this.checked; paint(); };
    $('kr-manual').oninput=function(){ state.krManual=Number(this.value)||1; paint(); };
    $('ep-tbody').addEventListener('input', function(e){
      var inp=e.target.closest('input[data-f]'); if(!inp) return;
      var tr=inp.closest('tr'), row=null, i;
      for (i=0;i<state.rows.length;i++) if (state.rows[i].id===tr.dataset.id) row=state.rows[i];
      if(!row) return; var f=inp.dataset.f; if (f==='name') row.name=inp.value; else row[f]=inp.value===''?0:Number(inp.value); paint();
    });
    $('ep-tbody').addEventListener('click', function(e){
      var btn=e.target.closest('[data-act]'); if(!btn) return;
      var id=btn.closest('tr').dataset.id, idx=-1, i;
      for (i=0;i<state.rows.length;i++) if(state.rows[i].id===id) idx=i; if (idx<0) return;
      if (btn.dataset.act==='del'){
        if (state.rows.length<=1) state.rows[0]={id:uid(),name:'',n:1,pnUnit:0,ki:0.2,cosPhi:0.8,ks:0.5};
        else state.rows.splice(idx,1); renderRows();
      } else if (btn.dataset.act==='dup'){
        var src=state.rows[idx], copy={}; for (var k in src) copy[k]=src[k]; copy.id=uid();
        state.rows.splice(idx+1,0,copy); renderRows();
      }
    });
    $('btn-add').onclick=function(){ state.rows.push({id:uid(),name:'',n:1,pnUnit:0,ki:0.2,cosPhi:0.8,ks:0.5}); renderRows(); };
    $('btn-reset').onclick=function(){ state.rows=demoRows(); state.mode='rtm'; state.ko=0.9; state.cosTarget=0.95; state.krOverride=false; $('mode-select').value='rtm'; $('ko-input').value='0.9'; $('cos-target').value='0.95'; $('kr-override').checked=false; $('kr-manual').disabled=true; renderRows(); };
    $('btn-save-json').onclick=function(){ download('rtm-loads.json','application/json', JSON.stringify({version:2,mode:state.mode,krTable:state.krTable,un:state.un,krOverride:state.krOverride,krManual:state.krManual,groupKs:state.groupKs,ko:state.ko,cosTarget:state.cosTarget,rows:state.rows.map(function(r){return {name:r.name,n:r.n,pnUnit:r.pnUnit,ki:r.ki,cosPhi:r.cosPhi,ks:r.ks};})},null,2)); };
    $('btn-load-json').onclick=function(){ $('file-json').click(); };
    $('file-json').onchange=function(){
      var f=this.files && this.files[0]; this.value=''; if(!f) return;
      var reader=new FileReader();
      reader.onload=function(){ try{
        var data=JSON.parse(reader.result);
        if (Array.isArray(data.rows)) state.rows=data.rows.map(function(r){ return {id:uid(),name:r.name||'',n:Number(r.n)||0,pnUnit:Number(r.pnUnit)||0,ki:Number(r.ki)||0,cosPhi:Number(r.cosPhi)||0.8,ks:Number(r.ks)||0.5}; });
        if (data.mode) state.mode=data.mode; if (data.ko!=null) state.ko=Number(data.ko); if (data.cosTarget!=null) state.cosTarget=Number(data.cosTarget); if (data.un!=null) state.un=Number(data.un)||0.4;
        $('mode-select').value=state.mode; $('ko-input').value=state.ko; $('cos-target').value=state.cosTarget; $('un-input').value=state.un; renderRows();
      } catch(err){ alert('JSON: '+err.message); } };
      reader.readAsText(f);
    };
    $('btn-excel').onclick=function(){ try { exportExcel(); } catch(err){ alert('Excel: '+err.message); } };
  }
  state.rows = demoRows();
  bind();
  renderRows();
})();
