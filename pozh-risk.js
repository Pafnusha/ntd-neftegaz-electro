/* pozh-risk.js — «Расчёт пожарных рисков» для ПС 35/10, КТП 10(6)/0,4 и электропомещений.
   Методическая основа (инженерное упрощение): СП 486.13130.2009 (действующая редакция) и приказы МЧС
   России № 404 от 10.07.2009 / № 533 от 26.06.2024 — цепочка «частота источника × вероятность
   воспламенения × (1−эффективность АУПТ) × вероятность невозможности самостоятельного выхода».
   Категории: приложения № 2 и № 3 к ФЗ-123 (порядок — СП 12.13130.2009); обязательность АУП —
   СП 486.1311500.2020 (табл. 1–4); первичные средства — ППР РФ № 1479, ГОСТ Р 51057.
   Критерии приемлемости: количественный R ≤ 1×10⁻⁴ 1/год; индивидуальный q ≤ 1×10⁻⁶ 1/год. */
"use strict";
(function () {

/* ===== SECTION:data ===== */
var $=function(id){return document.getElementById(id);};
function esc(x){return String(x==null?"":x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");}
function fx(x){ if(!isFinite(x)) return "—"; if(x===0) return "0";
  var SUP="⁰¹²³⁴⁵⁶⁷⁸⁹";
  if(Math.abs(x)<1e-3||Math.abs(x)>=1e4){
    var sp=x.toExponential(1).split("e"), d=sp[1], sg="";
    if(d.charAt(0)==="-"){ sg="⁻"; d=d.slice(1); } else if(d.charAt(0)==="+"){ d=d.slice(1); }
    return sp[0]+"·10"+sg+d.replace(/[0-9]/g,function(ch){return SUP[+ch];});
  }
  return (Math.round(x*1000)/1000).toLocaleString("ru-RU"); }
/* Типовые источники зажигания электрооборудования:
   q — средн. частота отказа с воспламенением, 1/год·ед (обобщение эксплуатации, прил. СП 486 доп.);
   p — вероятность воспламенения окружения при отказе (по катег. зоны); вид АУПТ снижает через прил. В */
var SRC=[
 {k:"tr_oil", n:"Трансформатор/реактор масляный (с маслоприёмником)", q:4.1e-4, per:"шт"},
 {k:"tr_dry", n:"Трансформатор сухой (литая изоляция), ТСЗ", q:2.5e-5, per:"шт"},
 {k:"cb_oil", n:"Выключатель масляный, ячейка 6–35 кВ", q:2.0e-4, per:"яч"},
 {k:"cb_sf6", n:"Выключатель элегазовый/вакуумный (пожароопасность мала)", q:4.0e-5, per:"яч"},
 {k:"cruel", n:"КРУЭ 35–110 кВ (безмасляное)", q:3.1e-5, per:"прис"},
 {k:"panel04", n:"Панель ЩН/РУ 0,4 кВ (вводная и линейная)", q:2.4e-4, per:"пан"},
 {k:"cable", n:"Кабельный пучок в кабельном сооружении (на 1 км трассы)", q:1.8e-3, per:"км"},
 {k:"motor", n:"Электродвигатель/насос с маслосистемой", q:3.2e-4, per:"шт"},
 {k:"batt", n:"АКБ свинцово-кислотная стационарная (пожар; H2-взрыв — отдельный анализ)", q:5.0e-5, per:"батар"},
 {k:"ups", n:"Шкаф ИБП/выпрямитель 0,4 кВ (без встроенных АКБ)", q:2.0e-4, per:"шт"},
 {k:"light", n:"Сеть освещения и штепсельные нагрузки (10 точек)", q:1.2e-4, per:"гр.10"}
];
function srcBy(k){return SRC.filter(function(x){return x.k===k;})[0];}
/* Эффективность АУПТ β — типовые инженерные оценки результативности сработавших установок
   (0,6…0,9 по статистике), уточняются расчётом по действующей методике; одна АУПТ на объект: */
var APZ=[
 {k:"none", n:"нет АУПТ", b:0.00},
 {k:"auk", n:"АУП порошковое (в т.ч. модульное)", b:0.78},
 {k:"aug", n:"АУП газовое (объёмное)", b:0.72},
 {k:"aiv", n:"АУВ спринклер/дробеструйное", b:0.90},
 {k:"atr", n:"АУВ тонкораспылённое (ТРВ)", b:0.85},
 {k:"aua", n:"АУА аэрозольное", b:0.60}
];
/* Зоны: area m², vol m³, presence (часть года в зоне чел.), tEv мин (эвакуация), tNP критич. оstri; */
/* kat — категория помещения (авто по ПУЭ при наличии маслянных объемов), */
var TPL={
 ess530:{obj:"ПС 35/10 кВ ESS-530 · пример адаптации типового расчёта (ИТТ 25.011.1-ЭС1-ИТТ3 / 3200-G-042-EL-SPE-00002)", zones:[
   {n:"Модуль силовых трансформаторов 35/10 (ТСГЛ сухие)", area:45, vol:210, pres:0.02, tEv:3, tNP:10, oilL:0, srcs:[["tr_dry",2],["cb_sf6",6]]},
   {n:"Модуль КРУЭ-35", area:30, vol:140, pres:0.01, tEv:2.5, tNP:12, oilL:0, srcs:[["cruel",6]]},
   {n:"Модуль КРУ-10 (фидеры Т, резисторы ЗЗ)", area:40, vol:180, pres:0.02, tEv:3, tNP:10, oilL:0, srcs:[["cb_sf6",10],["panel04",4]]},
   {n:"КТПСН 10/0,42 · 2×ТСЗ 630 кВА", area:36, vol:160, pres:0.05, tEv:3, tNP:10, oilL:0, srcs:[["tr_dry",2],["panel04",10]]},
   {n:"ЩП/ИВВ: выпрямители, ИБП 10 и 20 кВА", area:60, vol:260, pres:0.10, tEv:3, tNP:12, oilL:0, srcs:[["ups",2],["panel04",12],["light",6],["batt",2]]},
   {n:"Кабельные помещения (лотки, проходки)", area:90, vol:300, pres:0.008, tEv:4, tNP:8, oilL:0, srcs:[["cable",0.5]]}
 ], apz:"none"},
 ps3510:{obj:"ПС 35/10 кВ · комплект №1", zones:[
   {n:"ОРУ-35 (открытая установка)", outdoor:true, area:2400, vol:0, pres:0.15, tEv:2.0, tNP:15, oilL:18000, srcs:[["cb_oil",8],["cruel",4],["tr_oil",2],["cable",0.6]]},
   {n:"Машинный зал Т-35/10 (масл.)", area:420, vol:1900, pres:0.35, tEv:4.0, tNP:12, oilL:9000, srcs:[["tr_oil",2],["cb_oil",6],["cable",0.4]]},
   {n:"ЗРУ-10 кВ (камеры КСО/КРУ)", area:160, vol:720, pres:0.20, tEv:3.5, tNP:9,  oilL:400,  srcs:[["cb_oil",12],["panel04",10],["cable",0.8]]},
   {n:"ЩП/связь, ИБП", area:60, vol:180, pres:0.30, tEv:3.0, tNP:8,  oilL:0,    srcs:[["ups",2],["panel04",4],["light",3]]},
   {n:"Аккумуляторная", area:36, vol:110, pres:0.05, tEv:2.5, tNP:6,  oilL:0,    srcs:[["batt",2]]}
 ], apz:"none"},
 "ktp-oil":{obj:"КТП 10(6)/0,4 кВ с масляными Т", zones:[
   {n:"Отсек трансформаторов (масло)", area:48, vol:190, pres:0.10, tEv:2.0, tNP:6, oilL:600, srcs:[["tr_oil",2],["cb_oil",2]]},
   {n:"РУ-0,4 (ЩН)", area:30, vol:105, pres:0.10, tEv:2.0, tNP:7, oilL:0, srcs:[["panel04",8],["cable",0.2],["light",1]]}
 ], apz:"auk"},
 "ktp-dry":{obj:"КТП 10(6)/0,4 кВ, сухие ТСЗ", zones:[
   {n:"Отсек ТСЗ 10/0,4", area:40, vol:160, pres:0.10, tEv:2.0, tNP:8, oilL:0, srcs:[["tr_dry",2],["cb_sf6",2]]},
   {n:"ЩРН-0,4", area:24, vol:96, pres:0.08, tEv:2.0, tNP:9, oilL:0, srcs:[["panel04",6],["light",1]]}
 ], apz:"none"},
 "ru":{obj:"РУ 0,4/6-10 кВ производственного корпуса", zones:[
   {n:"Зал РУ-10 кВ", area:200, vol:900, pres:0.25, tEv:3.5, tNP:10, oilL:1200, srcs:[["cb_oil",10],["tr_oil",1],["cable",1]]},
   {n:"ЩУ/релейная", area:50, vol:170, pres:0.50, tEv:3.0, tNP:10, oilL:0, srcs:[["panel04",8],["ups",2],["light",4]]},
   {n:"Кабельное сооружение (этаж)", area:300, vol:1100, pres:0.05, tEv:4.0, tNP:12, oilL:0, srcs:[["cable",3]]},
   {n:"Вентиляция/масл. хозяйство", area:80, vol:320, pres:0.10, tEv:3.0, tNP:8, oilL:2500, srcs:[["motor",2]]}
 ], apz:"aiv"},
 "akkb":{obj:"Аккумуляторная (зарядная) помещение", zones:[
   {n:"Зал батарей", area:80, vol:340, pres:0.10, tEv:4.0, tNP:6, oilL:0, srcs:[["batt",8],["ups",1]]}
 ], apz:"aug"},
 "empty":{obj:"Объект (задано)", zones:[
   {n:"Зона 1", area:100, vol:400, pres:0.2, tEv:3, tNP:10, oilL:0, srcs:[]}
 ], apz:"none"}
};


/* ===== SECTION:calc ===== */
var state = { tpl:"ps3510", zones:[], apz:"none", npeople:2, rcrit:1e-4, qcrit:1e-6,
              meas:{as:true, dr:false, ev:false, o2d:false, cng:false, smk:false, unat:false, apk:false} };
/* Ориентировочная (СПРАВОЧНАЯ) классификация зон электроустановок по масконасыщенности.
   Нормативная — только расчётом: прил. № 3 к ФЗ-123 (пожарная) и прил. № 2 к ФЗ-123
   (взрывоопасность, в т.ч. водород при заряде АКБ), порядок — СП 12.13130.2009. */
function battN(z){ return (z.srcs||[]).filter(function(sr){return sr[0]==="batt";}).reduce(function(a,sr){return a+(Number(sr[1])||1);},0); }
function katT(z){
  var oil=Number(z.oilL)||0;
  if (z.outdoor) return {t:"нар. уст.", why:"открытое распределительное устройство — категории помещений не применяются; требования — по перечню СП 486.1311500.2020 для наружных установок"};
  if (oil>=800) return {t:"Т2…Т1 (справ.)", why:"большой объём масла (трансформаторное масло — ГЖ с температурой вспышки ~135 °С): категория устанавливается расчётом пожарной нагрузки по прил. № 3 к ФЗ-123 (порядок — СП 12.13130.2009)"};
  if (oil>=40)  return {t:"Т2 (справ.)", why:"маслонаполненное оборудование; категория — расчётом пожарной нагрузки по прил. № 3 к ФЗ-123"};
  if (battN(z)>0) return {t:"В1…В4 / Т3 (расчёт)", why:"заряд АКБ свыше 2,3 В на элемент — взрывоопасность по выделяемому H2 (по ПУЭ гл.4.4 — прежний класс В-Iа); категория В1–В4 — расчётом парообразования по прил. № 2 к ФЗ-123; пожарная — по прил. № 3 (обычно Т3)"};
  if (oil>0)     return {t:"Т2", why:"маслонаполненное оборудование"};
  return {t:"Т3/Т4 или Д (расчёт)", why:"сухое эл. оборудование без масла: категория расчётом пожарной нагрузки (прил. № 3 к ФЗ-123) либо Д при низкой сгораемой нагрузке"};
}
/* Вероятность воспламенения при отказе источника — типовые значения из практик расчёта
   (ГОСТ Р 59788; СП 486 прил. Б метод.basis), для категорий по ПУЭ: */
function zonePign(z){
  var hadOil=(Number(z.oilL)||0)>0;
  var oil=(state.meas.o2d? 0 : hadOil?(z.outdoor?0:(Number(z.oilL)||0)):0);
  var p = oil>=800?0.5 : oil>=40?0.40 : (battN(z)>0)?0.30 : 0.25;
  if (z.outdoor) p=0.15;
  if (state.meas.cng) p*=0.8;   /* кабели нг(А)-..., герметичные проходки и разделки (СП 76.13130.2016, ПУЭ) */
  return Math.min(0.9,p);
}
function effKey(k){ if (state.meas.o2d){ if(k==="tr_oil")return "tr_dry"; if(k==="cb_oil")return "cb_sf6"; } return k; }
function apzObj(){ return APZ.filter(function(x){return x.k===state.apz;})[0]||APZ[0]; }
/* Вероятность невозможности самостоятельного выхода людей P_н.э (прил. Г СП 486,
   аппроксимация по соотношению t_эв / t_н.п; поправки на АПС/авар. освещение/автоворота): */
function pNeup(z){
  var tEv=Number(z.tEv)||3, tNP=Number(z.tNP)||8;
  if (state.meas.as) tEv*=0.9;      /* АПС: раньше оповещение — короче реакция */
  if (state.meas.ev) tEv*=0.85;     /* аварийное освещение и указатели эвакуации */
  if (state.meas.dr) tEv*=0.85;     /* дистанционное открывание замков/автоворот */
  if (state.meas.smk) tNP+=2;         /* дымоудаление/подпор — дольше достижение НП (СП 7.13130.2013*) */
  var ratio=tEv/Math.max(0.1,tNP), g;
  if (ratio<=0.5) g=0.05; else if (ratio<1) g=0.05+(ratio-0.5)*0.5; else if (ratio<1.5) g=0.3+(ratio-1)*1.2; else g=0.90;
  return g; /* АУПТ — только множителем (1−β) в формуле риска: без двойного учёта */
}
function compute(){
  var R=0, rows=[], grand=0;
  state.zones.forEach(function(z){
    var qsum=0;
    (z.srcs||[]).forEach(function(sr){ var d=srcBy(effKey(sr[0])); if(d) qsum+=d.q*Math.max(0,Number(sr[1])||0); });
    var p1=zonePign(z), b=apzObj().b, pe=pNeup(z);
    var pf=Math.min(1,(Number(z.pres)||0)*(state.meas.unat?0.2:1)); /* P(люди в зоне в момент развития пожара) */
    var supp=1-b; if (state.meas.apk && (Number(z.pres)||1)<=0.12) supp=Math.min(supp,0.22); /* локальное модульное АУП в шкафах */
    (z.srcs||[]).forEach(function(sr){
      var d=srcBy(effKey(sr[0])); if(!d) return;
      var Ri=d.q*Math.max(0,Number(sr[1])||0)*p1*supp*pe; /* количественный R — риск для человека, находящегося в зоне; присутствие входит только в индивидуальный риск */
      rows.push({zone:z.n, src:d.n, per:d.per, cnt:Number(sr[1])||0, q:d.q, Ri:Ri, pign:p1, b:b, pe:pe, pf:pf, supp:supp});
      R+=Ri; grand+=d.q*Math.max(0,Number(sr[1])||0);
    });
    z._qsum=qsum; z._pe=pe; z._pign=p1;
  });
  var presMax=0.01, qind=0;
  state.zones.forEach(function(z){
    var Rz=0; rows.forEach(function(x){ if(x.zone===z.n) Rz+=x.Ri; });
    z._Rz=Rz; presMax=Math.max(presMax, (Number(z.pres)||0.01)*(state.meas.unat?0.2:1));
    qind=Math.max(qind, Rz*(Number(z.pres)||0)*(state.meas.unat?0.2:1)); /* индив. риск = R зоны × доля времени пребывания */
  });
  var out={R:R, qind:qind, rows:rows, totalQ:grand, presMax:presMax,
           Rcrit:Number(state.rcrit)||1e-4, qcrit:Number(state.qcrit)||1e-6};
  out.okR=out.R<=out.Rcrit; out.okQ=out.qind<=out.qcrit;
  return out;
}
/* Первичные средства — СП 9.13130.2009; требования АУПТ — приложение к ст.99 ФЗ-123, приказ МЧС №404 */
function techMeasures(){
  var oil=state.zones.reduce(function(a,z){return a+(Number(z.oilL)||0);},0);
  var oilRoom=state.zones.filter(function(z){return !z.outdoor;}).reduce(function(a,z){return a+(Number(z.oilL)||0);},0);
  var res=[];
  res.push({h:"Переносные огнетушители", t:"обеспечение — по ППР РФ № 1479; для электроустановок — порошковые/углекислотные не ниже класса Е по ГОСТ Р 51057 (не менее 2 ед. на помещение/отсек, у выходов). СП 9.13130.2009 с 01.03.2025 не действует — применяется как справочный"});
  res.push({h:"Автоматическое пожаротушение", t: oilRoom>=800
    ? "закрытые маслопомещения объекта (~"+Math.round(oilRoom)+" л масла): оснащение АУПТ — по перечню СП 486.1311500.2020 (табл. 1–4, по исполнению и мощности); при нахождении людей — только установки, обеспечивающие эвакуацию (СП 485.13130.2020)"
    : (oilRoom>=40 ? "помещения с масланасыщенным оборудованием — проверяется по перечню СП 486.1311500.2020 (табл. 1–4); при наличии людей — требования СП 485.13130.2020"
    : "по перечню СП 486.1311500.2020 АУПТ не требуется; АУП/АПС — по перечню и ст. 61/83 ФЗ-123; для шкафов ИБП рекомендуется модульное АУП")});
  res.push({h:"Автоматическая пожарная сигнализация", t:"обязательна для объектов перечня (СП 486.1311500.2020) и по ст. 61/83 ФЗ-123; проектирование — СП 484.13130.2020"});
  if (oilRoom>=1000) res.push({h:"Маслоотводы и сбора масла", t:"маслоприёмники/маслосборники, отвод за пределы зданий — ПУЭ разд. 4.2 (нормируемые массы масла п. 4.2.116–4.2.119; выходы камер п. 4.2.220); противопожарные разрывы — СП 2.13130.2020; эксплуатация — ПТЭЭП (приказ Минэнерго № 811), ППР РФ № 1479"});
  res.push({h:"Огнестойкие проходки и разделки", t:"кабели в групповых проходках — не сгораемые материалы, огневые преграды (СП 76.13130.2016)"});
  return res;
}
function fireClass(){
  var cats=state.zones.filter(function(z){return !z.outdoor;}).map(function(z){return katT(z).t;}).join(" ");
  if (/Т1|Т2/.test(cats)) return "Здания с помещениями Т1/Т2 (после нормативного категорирования): степень огнестойкости не ниже II, класс С0 — табл. 21 ФЗ-123 и СП 2.13130.2020, уточняется по площади/этажности";
  if (/В1/.test(cats)) return "Наличие взрывопожароопасных помещений (кат. В): не ниже II, С0 (СП 2.13130.2020)";
  return "Степень огнестойкости и класс конструктивной пожарной опасности — по табл. 21/22 ФЗ-123 и СП 2.13130.2020 после расчёта категорий";
}
function f0i(v){ return Math.round(v).toLocaleString("ru-RU"); }


/* ===== SECTION:build ===== */
var OIL={ tm:{400:350,630:500,1000:950,1600:1300,2500:1800}, tdn:{1000:1000,2500:2200,4000:3800,6300:5500,10000:8500,16000:12000,25000:17000} }; /* л — типовые значения по паспортам серийных ТМ/ТДН; уточнять по паспорту */
function oilEst(kind,kVA){ var t=OIL[kind]||OIL.tm; var keys=Object.keys(t).map(Number).sort(function(a,b){return a-b;});
  for (var i=0;i<keys.length;i++) if (kVA<=keys[i]) return Math.round(t[keys[i]]*(kVA/keys[i])); return Math.round(t[keys[keys.length-1]]*(kVA/keys[keys.length-1])); }
function buildFromForm(){
  var n=Math.max(1,Number($("g_n").value)||1), kva=Number($("g_kva").value)||1000, kind=$("g_type").value;
  var krun=Math.max(0,Number($("g_krun").value)||0), kru=$("g_krut").value;
  var cab=Number($("g_cab").value)||0, bt=Math.max(0,Number($("g_batt").value)||0), pres=Number($("g_pres").value)||0.15;
  var per = kind==="tdn"?Math.max(30,12+kva/500):Math.max(18,8+kva/70), vtr=Math.round(per*4.6);
  var trKey = kind==="tsz"?"tr_dry":"tr_oil", oilEach = kind==="tsz"?0:oilEst(kind,kva);
  var zones=[{n:"Трансформаторный модуль ("+(kind==="tdn"?"ТДН 35/10":kind==="tm"?"ТМ 10/0,4":"ТСЗ сухие")+")", area:per*n, vol:vtr*n, pres:pres, tEv:3, tNP:10, oilL:oilEach*n, srcs:[[trKey,n]]}];
  if (krun>0) zones.push({n:"Модуль КРУ 6–35 кВ", area:2+krun*2.2, vol:(2+krun*2.2)*3.6, pres:pres*0.6, tEv:3, tNP:10,
    oilL: kru==="cb_oil"? krun*30 : 0, srcs:[[kru,krun],["panel04",Math.max(2,Math.round(krun*0.5))]]});
  if (cab>0) zones.push({n:"Кабельное сооружение", area:Math.max(12,cab*180), vol:Math.max(40,cab*180*3), pres:0.02, tEv:4, tNP:8, oilL:0, srcs:[["cable",cab]]});
  if (bt>0) zones.push({n:"Батарейная (оперативный ток)", area:12+bt*2, vol:(12+bt*2)*3.5, pres:0.05, tEv:2.5, tNP:6, oilL:0, srcs:[["batt",bt]]});
  zones.push({n:"ЩП / вторичные системы", area:36, vol:150, pres:pres*0.8, tEv:3, tNP:10, oilL:0, srcs:[["ups",Math.min(4,n)],["panel04",12],["light",6]]});
  state.zones=zones; state.tpl="custom";
  var oilTot=zones.reduce(function(a,z){return a+z.oilL;},0);
  $("build-out").textContent="Собрано зон: "+zones.length+"; масло в здании: "+Math.round(oilTot)+" л. "+
    (oilTot===0 ? "Сухое исполнение: позиция перечня по маслонаполненным силовым трансформаторам не применяется (СП 486.1311500.2020 — сверить свою номенклатуру по табл. 1–4)."
                : "Обязательность АУП проверить по перечню СП 486.1311500.2020 (табл. 1–4) и фактическому объёму масла по паспортам оборудования.");

  $("objname").value=(kind==="tsz"?"ПС/КТП, сухое исполнение":"ПС/КТП "+kva+" кВА ×"+n)+" — расчёт пользователя";
  renderAll();
}
/* ===== SECTION:ui ===== */
function loadTpl(key){
  var t=TPL[key]||TPL.empty;
  state.tpl=key; $("objname").value=t.obj; state.apz=t.apz||"none";
  state.zones=JSON.parse(JSON.stringify(t.zones));
  renderAll();
}
function renderAll(){ renderZones(); renderSrc(); renderMeasures(); recalc(); }
function num(v){ return "<input type='number' step='any' value='"+(v==null?"":v)+"'>"; }
function renderZones(){
  var t=$("zones-table");
  var h="<tr><th>№</th><th>Зона</th><th>Площадь, м²</th><th>Объём, м³</th><th>Масло, л</th><th>Прис. людей (0..1)</th><th>t эв., мин</th><th>t НП, мин</th><th>Кат.</th><th></th></tr>";
  state.zones.forEach(function(z,i){
    h+="<tr><td>"+(i+1)+"</td><td><input type='text' data-zz='"+i+"' data-f='n' value='"+esc(z.n)+"' style='width:190px'></td>"+
       "<td><input type='number' data-zz='"+i+"' data-f='area' value='"+z.area+"'></td>"+
       "<td><input type='number' data-zz='"+i+"' data-f='vol' value='"+z.vol+"'></td>"+
       "<td><input type='number' data-zz='"+i+"' data-f='oilL' value='"+(z.oilL||0)+"'></td>"+
       "<td><input type='number' step='0.05' min='0' max='1' data-zz='"+i+"' data-f='pres' value='"+z.pres+"'></td>"+
       "<td><input type='number' step='0.5' data-zz='"+i+"' data-f='tEv' value='"+z.tEv+"'></td>"+
       "<td><input type='number' step='0.5' data-zz='"+i+"' data-f='tNP' value='"+z.tNP+"'></td>"+
       "<td class='num'>"+katT(z).t+"</td>"+
       "<td><button data-zdel='"+i+"'>✕</button></td></tr>";
  });
  t.innerHTML=h;
  var chips=state.zones.map(function(z,i){ return "<div class='chip'><b>"+esc(z.n)+" — "+katT(z).t+"</b><span class='note'>"+katT(z).why+"</span></div>"; }).join("");
  chips+="<div class='chip'><b>Класс пожара зоны / здания</b><span class='note'>"+fireClass()+"</span></div>";
  $("cat-out").innerHTML=chips;
  $("zones-table").oninput=function(e){
    var el=e.target, i=el.dataset.zz, f=el.dataset.f; if(i==null||!f) return;
    var z=state.zones[+i]; z[f]= (f==="n")?el.value:Number(el.value);
    renderZones(); renderSrc(); recalc();
  };
  $("zones-table").onclick=function(e){
    var b=e.target.closest ? e.target.closest("[data-zdel]") : null; if(!b) return;
    state.zones.splice(+b.dataset.zdel,1); renderAll();
  };
}
function renderSrc(){
  var t=$("src-table");
  var h="<tr><th>Зона</th><th>Источник (тип отказа)</th><th>q, 1/год·ед</th><th>Кол-во</th><th>Σq, 1/год</th><th>Сведения</th><th></th></tr>";
  state.zones.forEach(function(z,zi){
    (z.srcs||[]).forEach(function(sr,si){
      var d=srcBy(sr[0]); if(!d){ return; }
      h+="<tr><td>"+esc(z.n)+"</td><td><select data-si='"+zi+":"+si+"'>"+SRC.map(function(o){return "<option value='"+o.k+"'"+(o.k===sr[0]?" selected":"")+">"+o.n+"</option>";}).join("")+"</select></td>"+
         "<td class='num'>"+fx(d.q)+"</td>"+
         "<td><input type='number' step='any' min='0' data-cnt='"+zi+":"+si+"' value='"+sr[1]+"' style='width:70px'></td>"+
         "<td class='num'>"+fx(d.q*(Number(sr[1])||0))+"</td><td class='note'>ед. изм.: "+d.per+"; зона кат. "+katT(z).t+"</td>"+
         "<td><button data-sdel='"+zi+":"+si+"'>✕</button></td></tr>";
    });
  });
  t.innerHTML=h;
  t.onclick=function(e){
    var b=e.target.closest?e.target.closest("[data-sdel]"):null; if(!b)return;
    var a=b.dataset.sdel.split(":"); state.zones[+a[0]].srcs.splice(+a[1],1); renderSrc(); renderZones(); recalc();
  };
  t.onchange=function(e){
    var el=e.target;
    if(el.tagName==="SELECT"&&el.dataset.si!=null){ var a=el.dataset.si.split(":"); state.zones[+a[0]].srcs[+a[1]][0]=el.value; renderSrc(); recalc(); return; }
    if(el.dataset.cnt!=null){ var c=el.dataset.cnt.split(":"); state.zones[+c[0]].srcs[+c[1]][1]=Number(el.value)||0; renderSrc(); recalc(); }
  };
}
var ADV=[
 {k:"o2d", n:"Сухое исполнение вместо маслонаполненного (ТСЗ/ТСГЛ) — как в ИТТ-примере; либо вынос масляного оборудования из здания",
  ntd:"СП 486.1311500.2020 табл. 1–4: обязанность АУП распространяется на маслонаполненное оборудование указанного типа/мощности; сухие трансформаторы в позицию перечня не входят (обязательность подтвердить по конкретной позиции таблицы)",
  eff:"q: tr_oil→tr_dry (2,5·10⁻⁵), cb_oil→cb_sf6 (4·10⁻⁵); P восплам. зоны →0,25"},
 {k:"apk", n:"Локальное модульное АУП внутри шкафов и ниш (пуск при отсутствии людей)",
  ntd:"СП 485.13130.2020 (требования к АУП); локальное АУП оборудования — допустимая практика; полную АУПТ помещений по перечню не требует, если помещение не входит в перечень СП 486.1311500.2020",
  eff:"для зон с pres≤0,12: множитель подавления не хуже 0,22"},
 {k:"cng", n:"Кабели нг(А)-LS/-FRLS, огнестойкие проходки и разделки, раздельная укладка силовых и контрольных кабелей",
  ntd:"ПУЭ п. 2.1 (требования к распространению горения), СП 76.13130.2016 (пределы огнестойкости проходок); ст. 134, 153 ФЗ-123",
  eff:"P восплам. зоны ×0,8"},
 {k:"smk", n:"Противопожарная вентиляция: дымоудаление и подпор (клапаны с электроприводом от АПС)",
  ntd:"СП 7.13130.2013*; ст. 133 ФЗ-123", eff:"t НП +2 мин (позднее наступление критических ОФ)"},
 {k:"unat", n:"Работа без постоянного присутствия людей: диспетчеризация, телеуправление, телесигнализация; обходы по регламенту",
  ntd:"ПТЭЭП (приказ Минэнерго № 811), ППР РФ № 1479 (эксплуатационный контроль); индивидуальный риск учитывает долю времени пребывания",
  eff:"доля пребывания в зонах ×0,2 (дляIndividualного риска)"}
];
function renderAdv(){
  var box=$("adv-box"); if(!box) return;
  var me=state.meas;
  box.innerHTML=ADV.map(function(a){
    return "<label class='chip' style='max-width:460px'><b><input type='checkbox' data-adv='"+a.k+"'"+(me[a.k]?" checked":"")+"> "+a.n+"</b><span class='note'>В модели: "+a.eff+"</span><div class='note'>НТД: "+a.ntd+"</div></label>";
  }).join("")+
  "<div class='chip' style='max-width:460px'><b>Второй выход / дистанционное открывание</b><span class='note'>для РУ без маслонаполненных аппаратов ПУЭ гл. 4.2 допускает one выход при соблюдении условий (в ИТТ-примере: «в отсутствии маслонаполненных аппаратов второй выход необязателен»); фиксируется планом эвакуации. Мероприятие «дист. открывание» включается блоком «Мероприятия, влияющие на расчёт».</span></div>";
  Array.prototype.forEach.call(box.querySelectorAll("[data-adv]"), function(el){ el.onchange=function(){ state.meas[this.dataset.adv]=!!this.checked; recalc(); }; });
}
function advSummary(r){
  var el=$("adv-out"); if(!el) return;
  var on=ADV.filter(function(a){return state.meas[a.k];});
  var txt=on.map(function(a){ return "<li><b>"+a.n+"</b> — "+a.eff+"; <i>"+a.ntd+"</i></li>"; }).join("");
  var res=r&&r.okR? "<b>количественный риск R="+fx(r.R)+" ≤ "+fx(r.Rcrit)+" 1/год</b>":"<b>РИСК ПРЕВЫШЕН (R="+fx(r?r.R:NaN)+")</b>";
  var resq=r&&r.okQ? "; <b>q="+fx(r.qind)+" ≤ "+fx(r.qcrit)+"</b>": "; <b>индивидуальный q превышен ("+fx(r?r.qind:NaN)+" > "+fx(r?r.qcrit:NaN)+")</b>";
  el.innerHTML="<p><b>Сводка обоснований включено "+on.length+" из "+ADV.length+". "+res+resq+".</p>"+
   (txt? "<ul class='notes'>"+txt+"</ul><p class='note'>Формулировка для ПЗ/ответа эксперту: «Автоматическое пожаротушение не предусмотрено, поскольку оборудование, подпадающее под перечень СП 486.1311500.2020 (табл. 1–4), на объекте отсутствует (сухое исполнение / вне перечня); расчётное подтверждение приемлемости — оценка пожарного риска по СП 486.13130.2009 и приказам МЧС № 404/№ 533 со значениями выше; объект оснащён АПС, СОУЭ, первичными средствами (ОУ/ОП) в объёме ППР РФ № 1479». Раздел попадает в отчёт (п. 4.1).</p>"
       : "<p class='note'>Отметьте рычаги выше — обоснование появятся в отчёте (раздел 4.1) и в пояснениях.</p>");
}
function renderMeasures(){
  var h="";
  h+="<label class='chip'>АУПТ: <select id='m-apz'>"+APZ.map(function(a){return "<option value='"+a.k+"'"+(a.k===state.apz?" selected":"")+">"+a.n+" (β="+a.b+")</option>";}).join("")+"</select></label>";
  [["as","АПС с оповещением"],["ev","Аварийное освещение / план эвакуации"],["dr","Дист. открывание замков и автоворот"]].forEach(function(o){
    h+="<label class='chip'><input type='checkbox' id='m-"+o[0]+"'"+(state.meas[o[0]]?" checked":"")+"> "+o[1]+"</label>";
  });
  $("measures").innerHTML=h;
  $("m-apz").onchange=function(){ state.apz=this.value; recalc(); };
  ["as","ev","dr"].forEach(function(k){ $("m-"+k).onchange=function(){ state.meas[k]=this.checked; recalc(); }; });
}
function recalc(){
  renderAdv();
  state.npeople=Number($("npeople").value)||0;
  state.rcrit=Number($("rcrit").value)||1e-4;
  state.qcrit=Number($("qcrit").value)||1e-6;
  var r=compute(); state.last=r;
  var h="<tr><th>Зона</th><th>Источник</th><th>Кол-во</th><th>q, 1/год</th><th>P(воспл)</th><th>1−β(АУПТ)</th><th>P(невых)</th><th>Подавление (1−β;локал)</th><th>P(люди)→q</th><th>R_i, 1/год</th></tr>";
  r.rows.forEach(function(x){
    h+="<tr><td>"+esc(x.zone)+"</td><td>"+esc(x.src)+"</td><td class='num'>"+x.cnt+"</td><td class='num'>"+fx(x.q)+"</td><td class='num'>"+fx(x.pign)+"</td><td class='num'>"+fx(1-x.b)+"</td><td class='num'>"+fx(x.pe)+"</td><td class='num'>"+fx(x.supp!=null?x.supp:1-x.b)+"</td><td class='num'>"+fx(x.pf)+"</td><td class='num "+(r.okR?"ok":"bad")+"'>"+fx(x.Ri)+"</td></tr>";
  });
  $("risk-table").innerHTML=h+"<tr><th colspan='8'>ИТОГО количественный пожарный риск R (объект)</th><th class='num "+(r.okR?"ok":"bad")+"'>"+fx(r.R)+"</th></tr>";
  var v=(r.okR&&r.okQ)?"ok":(!r.okR&&!r.okQ)?"bad":"mid";
  var verdict=v==="ok"? "<div class='verdict ok'>✓ Риск приемлем: R="+fx(r.R)+" ≤ "+fx(r.Rcrit)+" 1/год; индивидуальный q="+fx(r.qind)+" ≤ "+fx(r.qcrit)+" 1/год. Дополнительных мер по СП 486 не требуется.</div>"
    : "<div class='verdict "+(v==="bad"?"bad":"mid")+"'>✗ Расчётный риск превышает приемлемый: R="+fx(r.R)+" (критерий "+fx(r.Rcrit)+"), q="+fx(r.qind)+" (критерий "+fx(r.qcrit)+"). Требуется снижение риска — смотреть вклад в таблице и включать мероприятия (АУПТ, АПС, автооткрывание, сокращение пребывания людей).</div>";
  verdict+="<div class='note'>Частота источников объекта Σq = "+fx(r.totalQ)+" 1/год. Доля времени пребывания в наиболее населённой зоне — "+fx(r.presMax)+". Пожарная опасность зоны характеризуется P(воспл) по категории ПУЭ.</div>";
  var zn="";
  state.zones.forEach(function(z){ zn+="<div class='chip'><b>"+esc(z.n)+"</b><span class='note'>Σq="+fx(z._qsum)+"; Pвосг="+fx(z._pign)+"; Pневых="+fx(z._pe)+"; Pлюди="+fx(Math.min(1,(Number(z.pres)||0)*(state.meas.unat?0.2:1)))+"; R_зоны="+fx(z._Rz||(z._qsum*z._pign*(1-apzObj().b)*z._pe*(Math.min(1,(Number(z.pres)||0)*(state.meas.unat?0.2:1)))))+"</span></div>"; });
  $("zone-risk-table").innerHTML="<tr><th>Позиции по зонам</th></tr><tr><td><div class='chips'>"+zn+"</div></td></tr>"+
    "<tr><td><b>Первичные и автоматические средства по НТД:</b><ul class='notes'>"+techMeasures().map(function(m){return "<li><b>"+m.h+":</b> "+m.t+"</li>";}).join("")+"</ul></td></tr>";
  $("risk-out").innerHTML=verdict; advSummary(state.last);
  $("ntd-list").innerHTML=["СП 486.13130.2009 (действующая редакция) — расчётные величины пожарного риска","Приказы МЧС России: № 404 от 10.07.2009; № 533 от 26.06.2024 (с 01.01.2025) — производственные объекты","ФЗ-123: прил. № 2 и № 3 к ст. 27 — категории; ст. 61, 83 — АУП/АПС; табл. 21 — огнестойкость","СП 486.1311500.2020 — перечень объектов, подлежащих защите АУП/СПС (табл. 1–4); СП 484/485.13130.2020","ПУЭ 7 (гл. 4.4; п. 4.2.116–4.2.119, 4.2.220); СП 12.13130.2009; СП 2.13130.2020; СП 76.13130.2016","ППР РФ № 1479; ПТЭЭП (приказ Минэнерго № 811); ГОСТ Р 51057. СП 9.13130.2009 с 01.03.2025 — справочно"].map(function(x){return "<li>"+x+"</li>";}).join("");
}


/* ===== SECTION:export ===== */
function download(name, mime, text){
  var blob=new Blob([text],{type:mime+";charset=utf-8"}); var url=URL.createObjectURL(blob);
  var a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},6000);
}
function reportHtml(){
  var r=state.last||compute();
  var rowsh=r.rows.map(function(x){return "<tr><td>"+esc(x.zone)+"</td><td>"+esc(x.src)+"</td><td style='text-align:right'>"+x.cnt+"</td><td style='text-align:right'>"+fx(x.q)+"</td><td style='text-align:right'>"+fx(x.pign)+"</td><td style='text-align:right'>"+fx(1-x.b)+"</td><td style='text-align:right'>"+fx(x.pe)+"</td><td style='text-align:right'>"+fx(x.Ri)+"</td></tr>";}).join("");
  var cats=state.zones.map(function(z){return "<tr><td>"+esc(z.n)+"</td><td>"+katT(z).t+"</td><td>"+katT(z).why+"</td><td style='text-align:right'>"+(z.oilL||0)+"</td><td style='text-align:right'>"+z.area+" м²</td></tr>";}).join("");
  return "<html><head><meta charset='utf-8'><style>body{font:11pt 'Times New Roman',serif;color:#000}h1{font-size:14pt;text-align:center}h2{font-size:12pt}table{border-collapse:collapse;width:100%;font-size:9pt}td,th{border:1px solid #444;padding:3px 5px}th{background:#eee}.sum{font-weight:700}.meta td{border:none}@page{size:A4;margin:14mm}</style></head><body>"+
  "<h1>РАСЧЁТ ПОЖАРНЫХ РИСКОВ<br><span style='font-size:11pt'>"+esc($("objname").value||"объект")+"</span></h1>"+
  "<table class='meta'><tr><td>Шаблон/состав:</td><td>"+state.zones.map(function(z){return z.n;}).join("; ")+"</td></tr>"+
  "<tr><td>АУПТ:</td><td>"+apzObj().n+"</td><td>Мероприятия:</td><td>"+(state.meas.as?"АПС; ":"")+(state.meas.ev?"авар. освещение; ":"")+(state.meas.dr?"дист. открывание; ":"")+"</td></tr>"+
  "<tr><td>Дата:</td><td>"+new Date().toLocaleDateString("ru-RU")+"</td></tr></table>"+
  "<h2>1. Категории помещений: справочная классификация (нормативная — приложения № 2/№ 3 к ФЗ-123, СП 12.13130.2009)</h2><table><tr><th>Зона</th><th>Категория</th><th>Обоснование</th><th>Масло, л</th><th>Площадь</th></tr>"+cats+"</table>"+
  "<p>"+fireClass()+".</p>"+
  "<h2>2. Источники воздействия и расчёт риска (СП 486.13130.2009; приказы МЧС № 404 / № 533)</th><table><tr><th>Зона</th><th>Источник</th><th>Кол-во</th><th>q, 1/год</th><th>P восплам.</th><th>1−β (АУПТ)</th><th>P невозм. выхода</th><th>R_i, 1/год</th></tr>"+rowsh+
  "<tr class='sum'><td colspan='7'>Количественный пожарный риск объекта R</td><td>"+fx(r.R)+"</td></tr>"+
  "<tr class='sum'><td colspan='7'>Индивидуальный пожарный риск q (макс. пребывания "+fx(r.presMax)+")</td><td>"+fx(r.qind)+"</td></tr></table>"+
  "<h2>3. Условие приемлемости</h2><p>Приемлемый риск R<sub>доп</sub> = "+fx(r.Rcrit)+" 1/год; q<sub>доп</sub> = "+fx(r.qcrit)+" 1/год. Результат: "+(r.okR&&r.okQ?"<b>риск приемлем</b>":"<b>риск превышает приемлемый — требуются дополнительные мероприятия</b>")+".</p>"+
  "<h2>4.1. Обоснование объёма мер противопожарной защиты (включённые рычаги)</h2>"+ADV.filter(function(a){return state.meas[a.k];}).map(function(a){return "<p><b>"+a.n+"</b>. "+a.eff+". <i>"+a.ntd+"</i></p>";}).join("")+(state.meas.o2d?"<p>Маслонаполненное оборудование в здании отсутствует — обязательность АУП по позиции перечня СП 486.1311500.2020 (табл. 1–4) не наступает; номенклатуру подтвердить по фактическому оборудованию.</p>":"")+"<h2>4.2. Обязательные по перечню средства</h2>"+techMeasures().map(function(m){return "<p><b>"+m.h+".</b> "+m.t+"</p>";}).join("")+
  "<h2>5. Использованные НТД</h2><ol><li>СП 486.13130.2009 (действующая редакция)</li><li>Приказ МЧС России от 10.07.2009 № 404; с 01.01.2025 — приказ от 26.06.2024 № 533 (расчётные величины пожарного риска на производственных объектах)</li><li>ФЗ № 123-ФЗ (прил. № 2 и № 3 к ст. 27; ст. 61, 83; табл. 21), СП 12.13130.2009, СП 2.13130.2020</li><li>СП 486.1311500.2020 — перечень объектов, подлежащих АУП/СПС (табл. 1–4); СП 484.13130.2020; СП 485.13130.2020</li><li>ПУЭ 7-е изд. (гл. 4.4; п. 4.2.116–4.2.119, 4.2.220)</li><li>ППР РФ № 1479; ПТЭЭП (приказ Минэнерго № 811); ГОСТ Р 51057; СП 76.13130.2016; СП 9.13130.2009 — с 01.03.2025 справочно</li></ol>"+
  "<p style='font-size:8.5pt'>Инженерная оценка по упрощённой схеме; методическая основа — СП 486.13130.2009 и приказы МЧС России № 404 / № 533. Типовые частоты отказов и вероятности подлежат уточнению по фактическим данным эксплуатации объекта. Категории зон — справочные, нормативные устанавливаются расчётом по прил. № 2/№ 3 к ФЗ-123. P невозможности выхода — ступенчатая аппроксимация, персонал/посетители не дифференцированы. Для деклараций пожарного риска (ст. 90–92 ФЗ-123) — полная методика с верификацией.</p>"+
  "<table class='meta' style='margin-top:14mm'><tr><td style='width:45%'>Расчёт выполнил</td><td>____________ / ____________ /</td><td>«___» ________ 20___ г.</td></tr></table></body></html>";
}
function openReport(){ var w=window.open("","_blank","width=1000,height=800"); if(!w){alert("Разрешите всплывающие окна");return;} w.document.write(reportHtml()); w.document.close(); setTimeout(function(){try{w.print();}catch(e){}},400); }
function boot(){
  $("tpl").value=state.tpl; loadTpl("ps3510");
  $("tpl").onchange=function(){ loadTpl(this.value); };
  $("b-calc").onclick=recalc;
  $("b-build").onclick=buildFromForm;
  $("b-zadd").onclick=function(){ state.zones.push({n:"Новая зона",area:100,vol:400,oilL:0,pres:0.1,tEv:3,tNP:10,srcs:[]}); renderAll(); };
  $("b-zdel").onclick=function(){ if(state.zones.length>1){state.zones.pop(); renderAll();} };
  $("b-sadd").onclick=function(){ if(!state.zones.length){return;} state.zones[state.zones.length-1].srcs.push(["panel04",2]); renderSrc(); renderZones(); recalc(); };
  $("b-report").onclick=openReport;
  $("b-doc").onclick=function(){ download("raschet-pozharnyh-riskov.doc","application/msword","\ufeff"+reportHtml()); };
  $("b-save").onclick=function(){ download("pozh-risk.json","application/json",JSON.stringify({tpl:state.tpl,obj:$("objname").value,zones:state.zones,apz:state.apz,meas:state.meas,npeople:$("npeople").value,rcrit:$("rcrit").value,qcrit:$("qcrit").value},null,1)); };
  $("b-load").onclick=function(){$("f-json").click();};
  $("f-json").onchange=function(){ var f=this.files&&this.files[0]; this.value=""; if(!f)return; var rd=new FileReader(); rd.onload=function(){ try{ var d=JSON.parse(rd.result); if(d.zones){state.zones=d.zones; state.apz=d.apz||"none"; state.meas=d.meas||state.meas; if(d.obj)$("objname").value=d.obj;} renderAll(); }catch(e){alert(e.message);} }; rd.readAsText(f); };
  ["npeople","rcrit","qcrit","objname"].forEach(function(id){ $(id).addEventListener("input",recalc); });
}
boot();
window.__PPR={state:state,compute:compute,loadTpl:loadTpl};

})();
