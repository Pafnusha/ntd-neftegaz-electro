(async function(){
  var b64=await (await fetch('loads-app.gz.b64')).text();
  var bin=Uint8Array.from(atob(b64), function(c){return c.charCodeAt(0);});
  var ds=new DecompressionStream('gzip');
  var stream=new Response(bin).body.pipeThrough(ds);
  var text=await new Response(stream).text();
  var s=document.createElement('script'); s.text=text; document.head.appendChild(s);
})();
