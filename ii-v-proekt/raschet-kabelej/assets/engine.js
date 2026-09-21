/* =====================================================================
   ENGINE — расчётное ядро (без DOM).  Все формулы — в комментариях
   с указанием источника (проектная методика 3300-E / ПУЭ / IEC / Методичка Роскоммунэнерго).
   ===================================================================== */
(function(root){
const D = (typeof DATA==="undefined" && typeof require!=="undefined") ? require("./data.js") : root.DATA;

const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const rr = (x,d)=>{const p=Math.pow(10||1,d||1);return Math.round(x*p)/p;};
const f1=x=>Math.round(x*10)/10, f2=x=>Math.round(x*100)/100, f3=x=>Math.round(x*1000)/1000, f0=x=>Math.round(x);

/* ---------- r, x проводников ---------- */
/* r(T)=r20·(1+α(T−20)), α=0,00404 1/°С (медь/алюминий, ГОСТ/IEC) */
function rAt(s, mat, theta){
  const t = mat==="al"?D.r20al:D.r20cu;
  const ks=Object.keys(t).map(Number).sort((a,b)=>a-b);
  let lo=ks[0]; for(const k of ks){ if(Math.abs(k-s)<Math.abs(lo-s)) lo=k; }
  return t[lo]*(1+0.00404*(theta-20));
}
function xLv(s){ let best=D.x0lv[0]; for(const p of D.x0lv){ if(s>=p[0]-1e-9) best=p; } return best[1]; }

/* ---------- поправочные коэффициенты ---------- */
/* Температура: проектная методика формула (1) k=√((K−T)/(K−t)); K — допуст. θ жилы */
function kTemp(theta, tFactor, tBase, mode){
  if(mode==="pue"){ const row=pueTempRow(theta,tBase); if(row) return pueInterp(row.v,tFactor); }
  if(theta-tFactor<=0) return 0.30;
  return Math.sqrt((theta-tFactor)/(theta-tBase));
}
function pueTempRow(theta,tBase){
  let rows=D.kTempPue;
  if(tBase!=null){ rows=rows.filter(r=>r[0]===tBase); if(!rows.length) rows=D.kTempPue; }
  let bt=rows.map(r=>Math.abs(r[1]-theta));
  return {v: rows[bt.indexOf(Math.min.apply(null,bt))][2]};
}
function pueInterp(vec,tF){
  const cols=D.kTempPueCols;
  if(tF<=cols[0]) return vec[0];
  for(let i=1;i<cols.length;i++){ if(tF<=cols[i]){ const v1=vec[i-1],v2=vec[i];
      if(v1==null||v2==null) return v1||v2||1;
      const f=(tF-cols[i-1])/(cols[i]-cols[i-1]); return v1+(v2-v1)*f; } }
  return vec[vec.length-1];
}
/* Грунт ρ (К·м/Вт): ПУЭ табл.1.3.23, база 1,2; вне диапазона — √-экстраполяция */
function kRho(rhoK){
  const a=D.kRhoPUE.map(p=>({r:p.rho/100,k:p.k}));
  if(rhoK<=a[0].r) return a[0].k;
  for(let i=1;i<a.length;i++) if(rhoK<=a[i].r){ const f=(rhoK-a[i-1].r)/(a[i].r-a[i-1].r); return a[i-1].k+(a[i].k-a[i-1].k)*f; }
  const last=a[a.length-1]; return Math.max(0.5,last.k*Math.sqrt(last.r/rhoK));
}
/* Число кабелей в траншее: ПУЭ изд.6 табл.1.3.26 (зазор 100/200/300 мм) */
function kTrench(n,gap){
  const keys=Object.keys(D.kTrenchPUE).map(Number);
  const gapK=keys.reduce((a,b)=>Math.abs(b-gap)<Math.abs(a-gap)?b:a,keys[0]);
  const vec=D.kTrenchPUE[gapK];
  const base=vec[clamp(Math.round(n),1,6)-1];
  return n>6? base*Math.max(0.7,1-0.045*(n-6)) : base;
}
/* Группировка в воздухе: каталог NED/проектная методика */
function kAirGroup(mode,N,setIdx){
  if(mode==="iec"||mode==="yamal"){ const m={single:1.00,tight:0.64,hv:0.90,hvSpaced:0.93}; return m[setIdx]!=null?m[setIdx]:1; }
  const tbl = mode==="channel"?D.kGroupChannelCatalog : mode==="tray"?D.kTrayCatalog : D.kGroupAirCatalog;
  const set = tbl.sets[setIdx||0]||tbl.sets[0];
  const idx = N<=1?0:N===2?1:N===3?2:N===4?3:N<=6?4:5;
  return set.v[idx];
}
/* Группировка LV-лоток по проектной методики (B52.20/21): по числу цепей */
function kAirIecLadder(nCircuits){
  if(nCircuits<=3) return {s:0.80,d:"≈0,80"};
  return {s:0.64,d:">9 многож. / >3 однож. (метод. §7.7)"};
}

/* ---------- расчётный ток ---------- */
/* 3ф: I = Kс·P·10³/(√3·U·cosφ) ; 1ф: I = Kс·P·10³/(Uф·cosφ), Uф=U/√3 */
function current(P_kw, cosphi, U_kv, ph, Ks){
  const U=U_kv*1000, f=(Ks==null?1:Ks);
  const If3 = f*P_kw*1000/(Math.sqrt(3)*U*cosphi);
  return ph==="1" ? f*P_kw*1000/((U/Math.sqrt(3))*cosphi) : If3;
}
function S_from(P,Q){ return {S:Math.sqrt(P*P+Q*Q), cosphi: Q!==0? P/Math.sqrt(P*P+Q*Q):1}; }

/* ---------- падение напряжения ---------- */
/* метод. §7.9 (IEC 60364): ΔU = √3·I·L·(r·cosφ+x·sinφ)/1000 [В] (3ф);
   ΔU% = 100·ΔU/Uн ; 1ф (2/3-пров.): ΔU=2·I·L·(...)/1000 относительно Uф */
function voltDrop(I, L_m, r_km, x_km, cosphi, U_kv, ph, withNeutral){
  const U=U_kv*1000, sinphi=withNeutral?Math.max(cosphi,(1-cosphi)) : Math.sqrt(Math.max(0,1-cosphi*cosphi));
  const k = ph==="1"?2:Math.sqrt(3);
  const dU = k*I*L_m/1000*(r_km*cosphi+x_km*sinphi);   /* В */
  const dUn = ph==="1"? U/Math.sqrt(3): U;
  const pct = 100*dU/dUn;
  return {V:dU,pct:pct,sinphi:sinphi};
}

/* ---------- термическая стойкость (метод. §7.10) ---------- */
/* A ≥ I·√t / K ;  I — ток КЗ А, t — с, K=143 (Cu XLPE/EPR) */
function sMinSC(Ik_kA, t_s, K){ return t_s<=0?0:Ik_kA*1000*Math.sqrt(t_s)/K; }

/* ---------- список сечений-кандидатов (каталог/ГТП) ---------- */
function sourceSeries(key, line){
  /* Возвращает [{s, I, theta, tBase, note, r90? , kind}] для режима прокладки */
  const ph=line.ph||"3", cores=line.cores||(ph==="1"?2:3);
  const meth=line.method||"earth_trench", grp=Object.assign({label:meth},D.methods[meth]||{});
  let src = line.src|| key || "auto";
  if(src==="YAMAL-LV") src="IEC-LV";
  if(src==="YAMAL-HV") src="IEC-HV";
  /* auto: ВН → каталог SN; НН в воздухе → IEC-LV; НН в земле → ГТП ПУЭ */
  if(src==="auto"||src==null||src===""){
    const vc=String(line.vclass||"0.4");
    const isHV = vc!=="0.4" && vc!=="0.66" && Number(vc)>=6;
    if(isHV) src = (line.cores===1||(line.src&&String(line.src).includes("1x")))?"SN1x":"SN3x";
    else if(line.method&&line.method.startsWith("air")&&(line.mat||"cu")==="cu") src="IEC-LV";
    else src="GTP-PUYE";
  }
  /* --- NED SN 6–35 кВ --- */
  if(src.startsWith("SN")){
    const U=line.vclass==="6"?"3.6/6":line.vclass==="20"?"12/20":line.vclass==="35"?"20.3/35":"6/10";
    const is1 = src.includes("1x");
    const list = is1? D.sn1[U] : D.sn3[U];
    return list.map(r=>{
      let I, note;
      if(is1){ const arr=is1; const flat=src.includes("flat");
        I = meth==="earth_trench"? (flat? r.izP : r.izT) : (flat? r.iaP : r.iaT);
        note="Каталог NED-Plagum SN "+U+(is1?" 1x":" 3x")+(meth==="earth_trench"?(flat?" в земле плоскость":" в земле треугольник"):(flat?" в воздухе плоскость":" в воздухе треугольник"));
      } else { I = meth==="earth_trench"? r.iz : r.ia; note="Каталог NED-Plagum SN "+U+" 3x,"+(meth==="earth_trench"?" в земле":" в воздухе"); }
      const r90 = is1? D.sn1_r90[r.s] : r.r90;
      return {s:r.s,I:I,theta:90,tBase:meth==="earth_trench"?15:30,note:note,r90:r90,diam:r.d};
    });
  }
  /* --- IEC LV (в воздухе по табл.1) --- */
  if(src==="IEC-LV"){
    const conduit = line.method==="air_pipe";
    return D.lvIec.map(r=>({s:r[0],I:conduit?r[2]:r[1],theta:90,tBase:30,
      note:"проектная методика, табл.1 (IEC 60364-5-52) "+(conduit?"в трубе B2":"лоток E/F")+", медь 3/4-ж. XLPE-типа 90°С"}));
  }
  if(src==="IEC-HV"){
    return D.hvIecAir.c3.map(r=>({s:r.s,I:r.i,theta:90,tBase:30,note:"проектная методика, табл.2 (IEC 60502-2), 3x брон. в воздухе"}));
  }
  /* --- ПУЭ ГТП пластмасса 0,66-1кВ (в т.ч. в земле) --- */
  if(src==="GTP-PUYE"){
    const mat=line.mat||"cu";
    const T=(mat==="al"?D.lvGostPlastic.al:D.lvGostPlastic.cu);
    const arr = cores===1? T.c1 : cores===2? T.c2 : T.c3;
    const kn = cores===1?0: (cores===2? (T===D.lvGostPlastic.cu?0:0):0);
    const mul = cores>=4? T.k4 : (mat==="al"&&false?0:1);
    const ground = meth==="earth_trench"|| meth==="earth_pipe";
    return arr.map(r=>({s:r[0],I:(ground?r[2]:r[1])*mul,theta:65,
       tBase:ground?15:25,
       note:"ПУЭ ГТП кабели с пластмасс. изоляцией до 3 кВ, "+(mat==="al"?"алюм.":"медн.")+" "+cores+"-ж., "+(ground?"в земле":"в воздухе (25°С)")+(mul!==1?" ×0,92 (пересчёт с 3-ж.)":"")}));
  }
  /* --- ВЛ --- */
  if(src==="VL-AC"){
    return D.vlAC.filter(r=>r.iOut||r.iIn).map(r=>({s:r.s,I:(line.vlAirTemp||25)>=40?r.iIn:r.iOut||r.iIn,theta:70,tBase:25,note:"ВЛ: ПУЭ изд.7 табл.1.3.29 (АС), θжил 70°С"}));
  }
  if(src==="VL-SIP"){
    return D.vlSIP4.map(r=>({s:r.s,I:r.i,theta:70,tBase:25,note:"СИП-4 (ГТП, ориентировочно)",r90:r.r,x0:r.x}));
  }
  /* --- пользовательский набор --- */
  if(Array.isArray(src)) return src;
  return D.lvGostPlastic.cu.c3.map(r=>({s:r[0],I:r[2],theta:65,tBase:15,note:"fallback"}));
}

/* ---------- выбор сечения (основной алгоритм) ---------- */
/* line: {mat,vclass:'0.4'|'6'|'10'|'35',method,nParallelN,gap,src,cores,ph,
      P,cos,Ks,Iload?, L, Tair,Tsoil,rho, kHа?, multiN?, motor{In,...}|null,
      protect:{type,ust,IkSens?}, sc:{Ik,t,K}|settings.smin, allowedPct, θjob, ...}
   opts: {catalog, settings}                                                    */
function selectLine(line, set){
  const S = set||{};
  const thetaJob = line.thetaJob!=null?line.thetaJob:(S.thetaJob!=null?S.thetaJob:90);
  const isVL = line.kind==="vl";
  const matEff = line.mat || (isVL? "al":"cu");
  const sr = sourceSeries(line.src,line);
  const ph=line.ph||"3";
  const Uvol = line.vU!=null? line.vU : (line.vclass==="0.4"?0.4: line.vclass==="0.66"?0.66: (line.vclass?Number(line.vclass):0.4));
  const IrA = line.Ifix!=null? line.Ifix : current(line.P||0, line.cos||0.8, Uvol, ph, KsOf(line));
  const Kadd = motorK(line,S) * multiK(line,S) * (line.kHazard?S.kHazard||1:1) * (S.kAdditional!=null?S.kAdditional:1);
  const Kneed = IrA*Kadd;               /* требуемый ДДТ с учётом кратностей, А */
  const cands = [];
  let best=null;
  for(const r0 of sr){
    const r = Object.assign({}, r0);
    /* если задан min/max сечения — фильтр */
    if(r.I==null||isNaN(r.I)) continue;
    if(line.minS && r.s<line.minS) continue;
    if(line.maxS && r.s>line.maxS) continue;
    /* нормировка каталожного тока на θJob (формула (1)) + среды: */
    const ground = line.method&&line.method.startsWith("earth");
    const tFact = ground? (line.Tsoil!=null?line.Tsoil:(S.Tsoil!=null?S.Tsoil:15)) : (line.Tair!=null?line.Tair:(S.Tair!=null?S.Tair:30));
    let kg=1, kgh=null;
    if(ground){
      kg = kTrench(line.nParallel||1, line.gap||100) * kRho(line.rho!=null?line.rho:(S.rho!=null?S.rho:1.2));
      if(line.grpCatalog) kg*=1;
      kgh="ПУЭ 1.3.26 ×1.3.23";
    } else {
      const m=line.groupMode|| (line.grpMode||"iec");
      kg = kAirGroup(m, line.nParallel||1, line.grpSet!=null?line.grpSet:"single");
      kgh=({single:"kGA (IEC) 1,00",tight:"kGA (IEC) 0,64",hv:"kGA (IEC) 0,90",hvSpaced:"kGA (IEC) 0,93"})[line.grpSet]||"по каталогу/IEC";
    }
    /* составной темп-коэффициент от базы каталога (θcat,tBase) к рабочей (θJob,tFact),
       по формуле (1) проектная методика k=√((K−T)/(K−t)) (или по табл.1.3.3 ПУЭ в режиме pue) */
    let kTotal;
    if((line.kTempMode||S.kTempMode)==="pue" && thetaJob===r.theta){ kTotal=kTemp(thetaJob,tFact,r.tBase,"pue"); }
    else { kTotal = (thetaJob-tFact>0 && r.theta-r.tBase>0)? Math.sqrt((thetaJob-tFact)/(r.theta-r.tBase)) : 0.30; }
    const Idp = r.I * kTotal;           /* ДДТ с учётом температуры */
    const rhoVal = ground? (line.rho!=null?line.rho:1.2) : null;
    /* kHA (опасная зона) и Кр=125% и >2пров. уже вынесены в Kneed; учтём и здесь доп-коэфф. группировки+ρ: */
    const IdpFact = Idp*kg;             /* фактический ДДТ */
    const cand = {s:r.s,Icat:r.I,kT:kTotal,kGrp:kg,groupNote:kgh,Idp:IdpFact,Ibase:r.I,r90:r.r90,note:r.note,
                  theta0:r.theta,tFact,rho:rhoVal,checks:{},pass:true,ok:null};
    cand.checks.PDT = {need:Kneed, val:IdpFact, ok:IdpFact>=Kneed?1:0,
       txt:`Iдоп.ф=${f1(IdpFact)} А (=${f1(r.I)}·${f2(kTotal)}·${f2(kg)}) ≥ ${f1(Kneed)} А`};
    cand.pass = cand.pass && !!cand.checks.PDT.ok;
    /* механика */
    const minS = matEff==="al"? (S.minS_al!=null?S.minS_al:2.5) : (S.minS_cu!=null?S.minS_cu:1.5);
    cand.checks.minS={ok:r.s>=minS?1:0,txt:`s=${r.s} мм² ≥ мин. ${minS} мм² (меx. прочность)`};
    cand.pass=cand.pass&&!!cand.checks.minS.ok;
    /* МТЗ (ПУЭ 3.1.11): уставка ≤ m·Iдоп.ф */
    if(line.protect&&line.protect.ust){
      const pt=(D.protectTypes||[]).find(p=>p.key===(line.protect.type|| (S.protectType))); const m=pt?pt.m:(S.mtzM!=null?S.mtzM:0.8);
      const ratio=line.protect.ust/IdpFact;
      cand.checks.mtz={ok:IdpFact? (ratio<=m?1:0):0, val:ratio, need:m,
        txt:`Iуст.з=${f0(line.protect.ust)} А ≤ ${m}·Iдоп.ф=${f1(m*IdpFact)} А`};
      cand.pass=cand.pass&&!!cand.checks.mtz.ok;
    }
    /* ΔU: только для рабочих сечений считаем */
    const rOhmKm = r.r90!=null? r.r90 * (1+0.00404*(thetaJob-90)) : rAt(r.s, matEff, thetaJob);
    const x = r.x0!=null? r.x0 : (ground||!ground? xFor(line,r):0);
    const du = voltDrop(IrA, line.L||0, rOhmKm, x*1, (line.duMode==="start"&&line.cosStart)?line.cosStart:(line.cos||0.8), Uvol, ph, line.withNeutral);
    cand.dU=du; cand.r=rOhmKm; cand.x=x;
    const lim = line.allowedPct!=null? line.allowedPct : (S.duDefault!=null?S.duDefault:5);
    cand.checks.dU={ok: (line.L? du.pct<=lim+1e-9 : 1), val:du.pct, note:`ΔU=${f1(du.pct)}% ≤ ${lim}%`};
    cand.pass=cand.pass&&!!cand.checks.dU.ok;
    /* КЗ термостойкость */
    if(line.sc&&line.sc.Ik){
      const K=line.sc.K||(line.mat==="al"?92:143);
      const smin=sMinSC(line.sc.Ik,line.sc.t||0.5,K);
      cand.checks.sc={ok:r.s>=smin?1:0,txt:`S≥Ik·√t/K=${f1(smin)} мм² (K=${K})`};
      cand.pass=cand.pass&&!!cand.checks.sc.ok;
    }
    /* старт двигателя */
    if(line.motor&&line.motor.Ip){
      const cosP=line.motor.cosP||0.5;
      const duS=voltDrop(line.motor.Ip, line.L||0, rOhmKm, x, cosP, Uvol, ph, false);
      const limS=line.motor.lim||15;
      cand.checks.start={ok:duS.pct<=limS?1:0,txt:`пуск: ΔU=${f1(duS.pct)}% ≤ ${limS}% (метод. §7.9 / IEC)`};
      cand.pass=cand.pass&&!!cand.checks.start.ok;
    }
    /* невозгораемость / исполнение нг (ГОСТ 31565) */
    if(line.requireFire || S.requireFire){
      const brand = line.brand || line.brandOverride || "";
      const fireOk = isFireSafeBrand(brand, line.fireClass||S.fireClass||"ng");
      cand.checks.fire={ok:fireOk?1:0, txt: fireOk
        ? (`исполнение «${brand||"нг"}» соответствует требованию невозгораемости (ГОСТ 31565)`)
        : (`требуется марка нг / нг(А)-LS / HF (ГОСТ 31565); задано: «${brand||"—"}»`)};
      cand.pass=cand.pass&&!!cand.checks.fire.ok;
    }
    if(!best && cand.pass) best=cand;
    cands.push(cand);
  }
  /* ручной override сечения: принудительно принимаем выбранное s, проверки сохраняются */
  if(line.manualS!=null && line.manualS!=="" && !isNaN(+line.manualS)){
    const ms=+line.manualS;
    let forced=cands.find(c=>c.s===ms);
    if(!forced && cands.length){
      forced=Object.assign({}, cands[cands.length-1], {s:ms, pass:false, checks:Object.assign({}, (cands[cands.length-1].checks||{}), {
        manual:{ok:0,txt:`сечение ${ms} мм² вне ряда источника — проверьте вручную`}
      })});
      cands.push(forced);
    }
    if(forced){ forced.manual=true; best=forced; }
  }
  return {cands, best, IrA, Kneed, kAdd:Kadd, thetaJob};
}
function isFireSafeBrand(brand, need){
  const b=String(brand||"").toLowerCase().replace(/ё/g,"е");
  if(!need || need==="none" || need==="off") return true;
  if(!b) return false; /* требование есть, марка не задана */
  const ng = /нг/.test(b) || /\bfr\b/.test(b) || /frls|frhf|hf\b|lszh|лszh/.test(b);
  if(need==="ng" || need==="any") return ng;
  if(need==="ls") return ng && (/ls|нг\(а\)-ls|нг\(а\)ls|frls/.test(b));
  if(need==="hf") return ng && (/hf|frhf|lszh/.test(b));
  return ng;
}
function xFor(line,r){ /* реактивное сопротивление для линии */
  if(line.kind==="vl") return r.x0 || (line.vclass==="0.4"?0.35:0.40);
  const is1=line.src&&line.src.includes?line.src.includes("1x"):false;
  if(is1) return (line.arrangement==="flat")? D.x0sn1.flat : D.x0sn1.trefoil;
  if(line.src&&line.src.startsWith("SN")) return D.x0sn3;
  return xLv(r.s);
}
function KsOf(line){ return line.Ks!=null?line.Ks:1; }
function motorK(line,S){ return (line.motor&&line.motor.branch)?1.25:1; } /* ПУЭ 3.1.12/7.3.97, метод. §7.2 */
function multiK(line,S){ /* метод. §7.8: >2 проводника на фазу → ДДТ×0,85, т.е. требуемый ток /0,85 */
  return (line.nPerPhase&&line.nPerPhase>2)?1/0.85:1; }

/* ---------- потери электроэнергии по Методике (Роскоммунэнерго 2001) ---------- */
/* τ=(0,105+T/12500)·T (формула 13); ΔWл=3·Iср²·RΣ·τ·10⁻³ кВт·ч;
   Kд.п=1+R0/Rф·Kn²  (26..28);  ΔWтр=ΔPхх·t+ΔPкз·kз²·τ (11);  Iср=W·10³/(Uср·...) (6) */
function tauHours(T){ return (0.105+T/12500)*T; }
function lossesLine(Icp_Rms, R_om, tHours, tau){
  return 3*Icp_Rms*Icp_Rms*R_om*tau*1e-3;               /* формула (2)/(4) Методики */
}
function lossesTransformer(dPxx_kW,dPk_kW,kz,tHours,tau){
  return dPxx_kW*tHours + dPk_kW*kz*kz*tau;             /* формула (11) */
}
function kDop(Ia,Ib,Ic,R0,Rf){
  /* формулы (27)(28) Методики — в инженерной векторной форме:
     I0 = |Ia + a·Ib + a²·Ic|/3, a=e^{j120°};  Iср=(Ia+Ib+Ic)/3;  Kn=I0/Iср;
     Kд.п = 1 + (R0/Rф)·(I0/Iср)²  — доп. потери от неравномерной загрузки фаз (гл.8.2 ПУЭ). */
  const Icp=(Ia+Ib+Ic)/3; if(!Icp||(Rf||0)<=0) return {Kn:0,Kdp:1,txt:"нет данных"};
  const re=Ia+(-0.5)*Ib+(-0.5)*Ic, im=(Math.sqrt(3)/2)*(Ib-Ic);
  const I0=Math.sqrt(re*re+im*im)/3;
  const Kn=I0/Icp, Kdp=1+(R0/Rf)*Kn*Kn;
  return {Kn:Kn,Kdp:Kdp,I0,txt:"Iср="+f1(Icp)+"; I0("+Math.round(re*10)/10+"," +Math.round(im*10)/10+")="+f1(I0)+"; Kn="+f2(Kn)+"; R0/Rф="+f2((R0||0)/(Rf||1))+" → Kд.п="+f2(Kdp)+""};
}
/* ---------- цепочка ΔU по схеме ---------- */
/* Суммарные ΔU от источника до узла: ΔU_j% суммируются арифм. по участкам (тип. допущение) */
function chainDrops(pathLines){ /* pathLines: [{pct,V}] */
  return pathLines.reduce((a,l)=>({pct:a.pct+l.pct,V:a.V+l.V}),{pct:0,V:0});
}

const Eng = {rAt,xLv,kTemp,kRho,kTrench,kAirGroup,kAirIecLadder,current,S_from,voltDrop,
  sMinSC,sourceSeries,selectLine,tauHours,lossesLine,lossesTransformer,kDop,chainDrops,
  motorK,multiK,xFor,KsOf,isFireSafeBrand,f1,f2,f3,f0};
root.Eng = Eng;
})(typeof window!=="undefined"?window:globalThis);
