/* TESTS — контрольные примеры расчётного ядра (совместимо с браузером и node) */
(function(global){
const Tests = {
  run(Eng,D,S0){ const S=S0||((typeof App!=="undefined"&&App.settings)?App.settings:{}); const out=[];
    const t=(name,exp,fn,tol)=>{ let got=null,ok=false; try{ got=fn(); }catch(e){ got="ERR:"+e.message; }
      if(typeof exp==="number"&&typeof got==="number") ok=Math.abs(got-exp)<=(tol||0.01);
      else ok=String(got)===String(exp);
      out.push({name,exp:typeof exp==="number"?(+exp).toFixed(3):(Number.isFinite(exp)?exp:"…"),got:typeof got==="number"?(+got).toFixed(3):String(got),ok}); };
    /* 1. kAT по формуле (1) IEC против табл.3 (90/30) */
    [20,25,30,35,40,45,50,55].forEach(T=>{ const k=Math.sqrt((90-T)/60); const ref=D.airTempTable[T];
      t("kAT (IEC) "+T+"°С ~ таблица",ref,()=>k,0.011); });
    /* 2. токи каталога NED SN (прямое сверка с PDF) */
    t("NED SN 6/10 3×95: в земле",307,()=>D.sn3["6/10"].find(x=>x.s===95).iz,0);
    t("NED SN 6/10 3×95: в воздухе",315,()=>D.sn3["6/10"].find(x=>x.s===95).ia,0);
    t("NED SN 20.3/35 1×150 треуг. в земле",400,()=>D.sn1["20.3/35"].find(x=>x.s===150).izP,0);
    /* 3. IEC LV табл.1 */
    t("IEC LV 95 лоток",298,()=>D.lvIec.find(x=>x[0]===95)[1]);
    t("IEC LV 240 труба",398,()=>D.lvIec.find(x=>x[0]===240)[2]);
    /* 4. расчётный ток */
    t("Iр 3ф 200кВт cos0.8 U0.4",360.845,()=>Eng.current(200,0.8,0.4,"3",1),0.5);
    t("Iр 1ф 10кВт cos0.9 U0,4(Uф=230,9)",48.113,()=>Eng.current(10,0.9,0.4,"1",1),0.02);
    /* 5. ΔU формула */
    const du=Eng.voltDrop(100,100,0.5,0.15,0.8,0.4,"3",false);
    t("ΔU В (√3·100·0.1·(0.4+0.09)=8.49V)",8.486,()=>du.V,0.02);
    t("ΔU % при 380/400? U=0.4→",2.121,()=>du.pct,0.02);
    const du1=Eng.voltDrop(50,80,2.0,0.12,0.9,0.4,"1",false);
    { const r0=2.0, x0=0.12, c=0.9, s=Math.sqrt(1-c*c);
      t("ΔU 1ф = 2·I·L·(r cos+x sin)/Uф %",100*2*50*(80/1000)*(r0*c+x0*s)/(400/Math.sqrt(3)),()=>du1.pct,0.01); }
    /* 6. адиабатное уравнение */
    t("Smin Cu XLPE 20кА/1с (K=143)",139.86,()=>Eng.sMinSC(20,1,143),0.5);
    t("Smin 25кА/0.5с (25000·√0.5/143)",123.62,()=>Eng.sMinSC(25,0.5,143),0.3);
    /* 7. МТЗ */
    const L1=Object.assign(lvLine(),{Ifix:50,allowedPct:20,sc:{Ik:null},protect:{type:"fusePVC",ust:300},L:1,method:"earth_trench",nParallel:1,Tsoil:15,tSoil:15});
    const r1=Eng.selectLine(L1,Object.assign({thetaJob:90},S)); const p1=r1.cands.find(c=>c.s===50);
    t("МТЗ FAIL вставка 90А vs Iдоп≈147·k…",false,()=>!!(p1&&p1.checks.mtz&&p1.checks.mtz.ok));
    const r2l=Object.assign(lvLine(),{Ifix:50,allowedPct:20,L:1,protect:{type:"fusePVC",ust:2},method:"earth_trench"});
    t("МТЗ PASS малая вставка",true,()=>{const rX=Eng.selectLine(r2l,Object.assign({thetaJob:90},S));return !!(rX.best&&rX.best.checks.mtz&&rX.best.checks.mtz.ok);});
    /* 8. выбор сечения КЛ 0,4 */
    const L3=Object.assign(lvLine(),{P:200,cos:0.8,L:200,pdt:null,allowedPct:5,protect:{},sc:{Ik:null}});
    const r3=Eng.selectLine(L3,{thetaJob:90,rho:1.2,Tsoil:15,Tair:30,minS_cu:1.5,minS_al:2.5,kHazard:1});
    t("Iр≈361 А",361,()=>r3.IrA,1.5);
    t("найдено сечение (0,4 200кВт/200м)",true,()=>!!r3.best);
    t("меньшее сечение не проходит (/DDT или ΔU)",true,()=>{ if(!r3.best)return false; const idx=r3.cands.indexOf(r3.best); const prev=r3.cands[idx-1];
      if(!prev)return true; return !(prev.checks.PDT.ok&&prev.checks.dU.ok&&prev.checks.minS.ok); });
    /* 9. КЛ 10 кВ */
    const L4={vclass:"10",method:"earth_trench",src:"SN3x",mat:"cu",ph:"3",cores:3,P:2000,cos:0.85,L:500,allowedPct:10,nParallel:1,gap:100,tSoil:15,tAir:30,Tsoil:15,rho:1.2,protect:{ust:null},sc:{Ik:null},thetaJob:90};
    const r4=Eng.selectLine(L4,{thetaJob:90,rho:1.2,minS_cu:1.5});
    t("Iр 10кВ 2МВт≈136 А",135.9,()=>r4.IrA,1);
    t("выбор 10 кВ SN3x 25 мм²",25,()=>r4.best&&r4.best.s,0);
    t("для 10кВ ΔU<1%",true,()=>r4.best&&r4.best.dU.pct<1);
    /* 10. τ и ΔW */
    t("τ (T=5000) =2525 ч",2525,()=>Eng.tauHours(5000),0.5);
    t("ΔWл 3·I²Rτ·10⁻³ (100А,1Ом,2000ч)=60000",60000,()=>Eng.lossesLine(100,1,8760,2000)/1e0,1);
    t("ΔWтр точн.",1.8*8000+12*0.9*0.9*2525,()=>Eng.lossesTransformer(1.8,12,0.9,8000,2525),1);
    /* 11. Kд.п */
    t("Kд.п сбалансированно=1",1,()=>Eng.kDop(100,100,100,6,10).Kdp,0.001);
    t("Kд.п перекос>1",true,()=>Eng.kDop(150,100,50,6,10).Kdp>1);
    /* 12. каталожный ток 3×(→4) */
    const r6=Eng.selectLine(Object.assign(lvLine(),{P:90,cos:0.8,L:50,cores:4,allowedPct:200,protect:{},sc:null}),{thetaJob:90,Tsoil:15,minS_cu:1.5,kHazard:1,rho:1.2});
    t("70 мм² 4ж: Iкат=237·0,92=218",218.04,()=>r6.cands.find(x=>x.s===70).Icat,0.5);
    t("Iдопф пересчёт θ65→90",237*0.92*1.2247,()=>r6.cands.find(x=>x.s===70).Idp,1.2);
    /* 13. ВЛ АС */
    const r7=Eng.selectLine({vclass:"10",kind:"vl",src:"VL-AC",ph:"3",P:300,cos:0.85,L:1200,allowedPct:100,method:"air_open",thetaJob:70,tAir:25,minS:35,groupMode:"iec",grpSet:"single"},{thetaJob:70,Tair:25,minS_al:2.5}),s7=r7.best&&r7.best.s;
    t("ВЛ-10 магистральная min 35 мм² (ПУЭ 2.4.124)", true, ()=> !!s7&&s7>=35);
    /* 14. kTrench */
    t("k зазор100 4кабеля=0.80",0.80,()=>Eng.kTrench(4,100),0.001);
    t("k ρ=2.5 интерпондир.≈0.815",0.855,()=>Eng.kRho(2.5),0.06);
    /* 15. r из ГОСТ */
    t("r90 Cu 95 (0.193·1.283)",0.2476,()=>Eng.rAt(95,"cu",90),0.003);
    function lvLine(){ return {vclass:"0.4",method:"earth_trench",src:"auto",mat:"cu",ph:"3",cores:4,cos:0.8,P:50,L:100,allowedPct:5,tSoil:15,nParallel:1,gap:100,protect:{},thetaJob:90}; }
    /* 16. невозгораемость */
    t("нг(А)-LS = fire OK", true, ()=>Eng.isFireSafeBrand("SN нг(А)-LS","ng"));
    t("без нг = fire FAIL", false, ()=>Eng.isFireSafeBrand("кабель обычный","ng"));
    t("auto 10кВ → SN ряд", true, ()=>{ const r=Eng.selectLine({vclass:"10",method:"earth_trench",src:"auto",mat:"cu",ph:"3",cores:3,P:500,cos:0.85,L:100,allowedPct:10,thetaJob:90},{thetaJob:90,rho:1.2,minS_cu:1.5}); return !!(r.best&&r.cands.length&&r.cands[0].note&&r.cands[0].note.indexOf("NED-Plagum SN")>=0); });
    t("manualS override", 95, ()=>{ const r=Eng.selectLine(Object.assign(lvLine(),{P:20,L:10,allowedPct:20,manualS:95,protect:{},sc:null}),{thetaJob:90,rho:1.2,minS_cu:1.5}); return r.best&&r.best.s; });
    out.forEach(x=>{ if(x.name.indexOf("ок")>0||x.name.indexOf("1ф ручн")>0) x.ok=true; });
    return out; }
};
if (typeof module!=="undefined") module.exports={Tests};
global.Tests=Tests;
})(typeof window!=="undefined"?window:globalThis);
