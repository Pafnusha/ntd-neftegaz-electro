(async function(){
  var p0=(await (await fetch('loads-draw.gz.b64.0')).text()).trim();
  var p1=(await (await fetch('loads-draw.gz.b64.1')).text()).trim();
  var b64=p0+p1;
  while (b64.length % 4) b64 += '=';
  var bin=Uint8Array.from(atob(b64), function(c){return c.charCodeAt(0);});
  var ds=new DecompressionStream('gzip');
  var stream=new Response(bin).body.pipeThrough(ds);
  var text=await new Response(stream).text();
  var s=document.createElement('script'); s.text=text; document.head.appendChild(s);
})();
