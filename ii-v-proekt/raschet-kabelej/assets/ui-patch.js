/* ui-patch.js — режим all/hv/lv, нг, автоподписи IEC, нейтрализация «Ямал» в UI */
(function(){
  if(typeof App==="undefined") return;
  var A=App;

  function repl(s){
    return String(s==null?"":s)
      .replace(/Ямал\s*СПГ/g,"проектная методика")
      .replace(/Ямал\/IEC/g,"IEC/ПУЭ")
      .replace(/√-формула \(Ямал\/IEC\)/g,"√-формула (IEC)")
      .replace(/Ямал kGA/g,"kGA (проектн.)")
      .replace(/Ямал табл\./g,"IEC табл.")
      .replace(/\(Ямал табл\./g,"(IEC табл.")
      .replace(/IEC\/Ямал/g,"IEC")
      .replace(/Ямал §/g,"метод. §")
      .replace(/стиль Ямал СПГ/g,"промплощадка")
      .replace(/норм\. Ямал/g,"норм. проектн.")
      .replace(/\(Ямал B52/g,"(IEC B52")
      .replace(/Ямал/g,"IEC");
  }
  function scrubDom(root){
    if(!root) return;
    try{
      var w=document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n; while((n=w.nextNode())){
        var t=n.nodeValue, r=repl(t);
        if(r!==t) n.nodeValue=r;
      }
    }catch(e){}
  }

  var _init=A.init;
  if(_init){ A.init=function(){
    var r=_init.apply(this,arguments);
    this.settings=this.settings||{};
    if(this.settings.calcScope==null) this.settings.calcScope="all";
    if(this.settings.requireFire==null) this.settings.requireFire=false;
    if(!this.settings.fireClass) this.settings.fireClass="ng";
    if(this.settings.standard==="yamal") this.settings.standard="iec";
    if(this.settings.groupMode==="yamal") this.settings.groupMode="iec";
    var self=this;
    var sc=this.$ && this.$("#selCalcScope");
    if(sc){ sc.value=this.settings.calcScope||"all";
      sc.onchange=function(){ self.settings.calcScope=sc.value; if(self.save)self.save(); if(self.recalc)self.recalc();
        if(self.toast)self.toast("Режим: "+sc.options[sc.selectedIndex].text,"ok"); }; }
    var be=this.$ && this.$("#btnExportProject");
    if(be && !be._patched){ be._patched=1; be.onclick=function(){
      try{
        var blob=new Blob([JSON.stringify({name:self.state&&self.state.name,nodes:self.state&&self.state.nodes,settings:self.settings},null,2)],{type:"application/json"});
        var u=URL.createObjectURL(blob); var a=document.createElement("a"); a.href=u;
        a.download=(self.state&&self.state.name||"project")+".json"; a.click();
        setTimeout(function(){URL.revokeObjectURL(u);},400);
        if(self.toast)self.toast("Проект экспортирован","ok");
      }catch(e){ if(self.toast)self.toast("Ошибка экспорта: "+e,"err"); }
    };}
    ["#btnWordHome","#btnWordScheme"].forEach(function(sel){
      var b=self.$&&self.$(sel); if(b&&!b._patched){ b._patched=1; b.onclick=function(){
        try{ if(self.bindReport)self.bindReport(); }catch(e){}
        if(self.buildDoc&&self.download){
          self.download((self.state&&self.state.name||"raschet")+"-otchet.doc", self.buildDoc(true), "application/msword");
          if(self.toast)self.toast("Отчёт Word готов","ok");
        } else if(self.$("#btnDocWord")) self.$("#btnDocWord").click();
      };}
    });
    scrubDom(document.body);
    return r;
  };}

  A.lineInScope=function(line){
    var sc=(this.settings&&this.settings.calcScope)||"all";
    if(sc==="all"||!line) return true;
    var vc=String(line.vclass||"0.4");
    var isHV=vc!=="0.4"&&vc!=="0.66"&&Number(vc)>=6;
    if(sc==="hv") return !!isHV;
    if(sc==="lv") return !isHV;
    return true;
  };

  var _recalc=A.recalc;
  if(_recalc){ A.recalc=function(){
    var self=this;
    if(!this.resMap) this.resMap={};
    if(this.state&&this.state.nodes){
      this.state.nodes.forEach(function(n){
        if(!n.line) return;
        if(self.lineInScope&&!self.lineInScope(n.line)) self.resMap[n.id]={skipped:true,res:null};
      });
    }
    var r=_recalc.apply(this,arguments);
    scrubDom(this.$&&this.$("#lineForm"));
    scrubDom(this.$&&this.$("#remarksBox"));
    scrubDom(this.$&&this.$("#lineSummaryTable"));
    return r;
  };}

  A.srcOptionsFor=function(L){
    var o=[["auto","авто — ВН: NED SN; НН воздух: IEC; НН земля: ГТП ПУЭ"]];
    if(L.vclass==="0.4"){
      o.push(["IEC-LV","IEC 60364-5-52 табл.1 (Cu 90°С, воздух/труба)"],["GTP-PUYE","ГТП ПУЭ пластм. Cu/Al (воздух+земля)"]);
    } else {
      o.push(["SN3x","NED-Plagum SN 3×ж (каталог)"],["SN1x","NED-Plagum SN 1×ж (каталог)"],["IEC-HV","IEC 60502-2 табл.2 (3×ж воздух)"]);
    }
    if(L.kind==="vl") o.push(["VL-AC","АС (ПУЭ 1.3.29)"],["VL-SIP","СИП‑4 (ГТП)"]);
    return o;
  };
  A.srcOptions=A.srcOptionsFor;

  A.srcName=function(line){
    var m={
      "IEC-LV":"NED-Plagum 0,66/1 (IEC 60364-5-52)","IEC-HV":"NED XLPE (IEC 60502-2)",
      "YAMAL-LV":"NED-Plagum 0,66/1 (IEC)","YAMAL-HV":"NED XLPE (IEC)",
      "GTP-PUYE":(line.mat==="al"?"А-NED-Plagum (ГТП ПУЭ)":"NED-Plagum (ГТП ПУЭ)"),
      "VL-AC":"АС (ВЛ, ПУЭ 1.3.29)","VL-SIP":"СИП‑4","auto":"авто (NED/IEC/ПУЭ)",
      "SN3x":line.mat==="al"?"А-NED-Plagum SN":"NED-Plagum SN 3×",
      "SN1xf":"NED-Plagum SN 1× плоск.","SN1x":"NED-Plagum SN 1× тр."
    };
    return m[line.src]||line.src;
  };

  var _mark=A.markOf;
  if(_mark){ A.markOf=function(line,b){
    var base=_mark.apply(this,arguments);
    if(line&&line.brand) base=line.brand+(b?" "+b.s+" мм²":"");
    if(line&&line.manualS!=null&&line.manualS!=="") base=(base||"")+" [ручн.]";
    return repl(base);
  };}

  var _rs=A.renderSettings;
  if(_rs){ A.renderSettings=function(){
    var r=_rs.apply(this,arguments);
    var self=this; var host=this.$&&this.$("#settingsForm");
    if(host && !host.querySelector("[data-patch-scope]")){
      var wrap=document.createElement("div"); wrap.className="formgrid"; wrap.setAttribute("data-patch-scope","1");
      wrap.innerHTML=
        '<label class="f"><b>Режим расчёта схемы</b><select id="patchCalcScope">'+
        '<option value="all">вся цепочка 10(6–35) → 0,4 кВ</option>'+
        '<option value="hv">только 6–35 кВ</option>'+
        '<option value="lv">только 0,4 кВ</option></select></label>'+
        '<label class="f inline"><input type="checkbox" id="patchRequireFire"> Требовать невозгораемость (нг / ГОСТ 31565)</label>'+
        '<label class="f"><b>Класс нг</b><select id="patchFireClass">'+
        '<option value="ng">нг (любой)</option><option value="ls">нг(А)-LS</option><option value="hf">нг(А)-HF</option></select></label>';
      host.appendChild(wrap);
      var sc=host.querySelector("#patchCalcScope");
      if(sc){ sc.value=self.settings.calcScope||"all"; sc.onchange=function(){ self.settings.calcScope=sc.value; if(self.save)self.save(); }; }
      var fr=host.querySelector("#patchRequireFire");
      if(fr){ fr.checked=!!self.settings.requireFire; fr.onchange=function(){ self.settings.requireFire=fr.checked; if(self.save)self.save(); }; }
      var fc=host.querySelector("#patchFireClass");
      if(fc){ fc.value=self.settings.fireClass||"ng"; fc.onchange=function(){ self.settings.fireClass=fc.value; if(self.save)self.save(); }; }
    }
    scrubDom(host);
    return r;
  };}

  var _exp=A.expandCatalog;
  if(_exp){ A.expandCatalog=function(){
    var rows=_exp.apply(this,arguments)||[];
    return rows.map(function(x){
      if(x.brand) x.brand=repl(x.brand);
      if(x.note) x.note=repl(x.note);
      return x;
    });
  };}

  A.srcMatch=function(x){
    if(x.family==="SN") return /1×/.test(x.kind||"")?"SN1x":"SN3x";
    if(x.family==="VL") return (x.brand||"").indexOf("СИП")>=0?"VL-SIP":"VL-AC";
    if(x.family==="LV") return /IEC|60364/.test(x.brand||"")?"IEC-LV":"GTP-PUYE";
    if(x.family==="LVG") return "GTP-PUYE";
    return "auto";
  };

  var _tmpl=A.templates;
  if(_tmpl){ A.templates=function(){
    return _tmpl.apply(this,arguments).map(function(p){ p.name=repl(p.name); return p; });
  };}

  var _qw=A.quickWord;
  if(_qw){ A.quickWord=function(){
    if(!this.rep) this.rep={};
    if(!this.rep.base) this.rep.base={value:"3300-E-000-EL-PHI-00009-00-D; ПУЭ; ГОСТ; IEC; NED-Plagum"};
    else if(this.rep.base && this.rep.base.value) this.rep.base.value=repl(this.rep.base.value);
    return _qw.apply(this,arguments);
  };}

  ["renderLineForm","renderQuickForm","renderCatalog","renderTemplates","renderNTD","renderHelp"].forEach(function(fn){
    var orig=A[fn];
    if(typeof orig!=="function") return;
    A[fn]=function(){
      var r=orig.apply(this,arguments);
      scrubDom(document.getElementById("main")||document.body);
      return r;
    };
  });

  if(typeof console!=="undefined") console.info("[ui-patch] active: calcScope / нг / no-Yamal UI");
})();
