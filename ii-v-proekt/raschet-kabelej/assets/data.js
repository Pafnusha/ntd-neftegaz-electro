/* data.js — Yamal-free source reconstituted from base64 parts */
(function(){
  var N=11, parts=[], i, x, base;
  try { base = (document.currentScript && document.currentScript.src || "").replace(/[^\/]+$/, ""); }
  catch(e){ base = "assets/"; }
  for(i=0;i<N;i++){
    x=new XMLHttpRequest();
    x.open("GET", base+"_data_p"+i+".b64", false);
    x.send(null);
    if(x.status && x.status!==200) throw new Error("data.js part "+i+" HTTP "+x.status);
    parts.push(String(x.responseText).replace(/\s+/g,""));
  }
  (0,eval)(decodeURIComponent(escape(atob(parts.join("")))));
})();
