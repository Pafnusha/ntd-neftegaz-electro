/* phase2-ext.js — load from base64 parts */
(function(){
  var N=8, parts=[], i, x, base, src, s;
  try { base = (document.currentScript && document.currentScript.src || "").replace(/[^\/]+$/, ""); }
  catch(e){ base = "assets/"; }
  for(i=0;i<N;i++){
    x=new XMLHttpRequest();
    x.open("GET", base+"_p2_p"+i+".b64", false);
    x.send(null);
    if(x.status && x.status!==200) throw new Error("phase2 part "+i+" HTTP "+x.status);
    parts.push(String(x.responseText||"").replace(/\s+/g,""));
  }
  try { src = decodeURIComponent(escape(atob(parts.join("")))); }
  catch(e){ src = atob(parts.join("")); }
  s=document.createElement("script");
  s.text=src;
  document.head.appendChild(s);
})();
