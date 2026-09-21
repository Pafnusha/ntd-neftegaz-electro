/* tests-phase2 — проверки автоподбора по всем критериям */
(function(){
  function ok(name, cond, detail){ return {name:name, ok:!!cond, detail:detail||""}; }
  window.PHASE2_TESTS = function(){
    const out=[];
    const S={thetaJob:90,Tair:30,Tsoil:15,du04:5,du10:10,TmaxHours:4000,minS_cu:1.5,minS_al:2.5,kAdditional:1};
    /* 1) assumptions present */
    out.push(ok("assumptions block", !!(DATA.assumptions&&DATA.assumptions.doesNot&&DATA.assumptions.doesNot.length>=3)));
    /* 2) SIP-3 series */
    out.push(ok("СИП-3 в базе", (DATA.vlSIP3||[]).length>=6, "n="+((DATA.vlSIP3||[]).length)));
    /* 3) NED 4/5 */
    out.push(ok("NED 4/5-жильные", (DATA.lvNed45&&DATA.lvNed45.brands||[]).length>=8));
    /* 4) jэк helper */
    const j=Eng.jEconOf&&Eng.jEconOf("cu",4000,"pvc");
    out.push(ok("jэк helper", j&&j.j>0, JSON.stringify(j)));
    /* 5) GTP rescale */
    const g=Eng.gtpRescale65to90&&Eng.gtpRescale65to90(100,25,true);
    out.push(ok("ГТП 65→90", g&&g.k>1 && g.I>100, "k="+((g&&g.k)||"?")));
    /* 6) selectLine with loop */
    if(typeof Eng.selectLine==="function"){
      const line={kind:"kl",vclass:"0.4",method:"air_pipe",src:"IEC-LV",mat:"cu",ph:"1",cores:2,
        P:10,cos:0.9,L:50,allowedPct:5,duAuto:false,protect:{type:"cbNonAdj",ust:25},
        sc:{Ik:5,t:0.2,Ik1:0.8,Zloop:0.3,Itrip:25}, nParallel:2};
      const r=Eng.selectLine(line,S);
      out.push(ok("автоподбор LV возвращает cands", r&&r.cands&&r.cands.length>0, "n="+((r&&r.cands)||[]).length));
      const b=r&&r.best;
      out.push(ok("проверки PDT/dU/minS", !!(b&&b.checks&&b.checks.PDT&&b.checks.dU&&b.checks.minS)));
      out.push(ok("проверка loop в checks", !!(b&&b.checks&&b.checks.loop)));
      out.push(ok("проверка jэк справочно", !!(b&&b.checks&&b.checks.jEcon&&b.checks.jEcon.advisory)));
      /* VL SIP-3 */
      const vl={kind:"vl",vclass:"10",method:"air_open",src:"VL-SIP3",mat:"al",ph:"3",cores:1,
        P:500,cos:0.85,L:2000,allowedPct:10,duAuto:false,sc:{Ik:10,t:0.5}};
      const rv=Eng.selectLine(vl,S);
      out.push(ok("автоподбор ВЛ СИП-3", rv&&rv.cands&&rv.cands.length>0, "best="+((rv&&rv.best&&rv.best.s)||"—")));
    } else out.push(ok("Eng.selectLine", false));
    return out;
  };
  /* hook into existing runTests if present */
  const _rt = window.runTests;
  window.runTests = function(){
    let res = typeof _rt==="function"?_rt():[];
    if(!Array.isArray(res)) res=[];
    try{ res = res.concat(window.PHASE2_TESTS()); }catch(e){ res.push({name:"PHASE2_TESTS",ok:false,detail:String(e)}); }
    return res;
  };
})();
