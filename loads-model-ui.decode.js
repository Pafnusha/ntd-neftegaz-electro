(function(){
  function load(urls, cb){
    var i=0, parts=[];
    function next(){
      if(i>=urls.length){ cb(parts.join("")); return; }
      fetch(urls[i++]).then(function(r){ return r.text(); }).then(function(t){ parts.push(t); next(); });
    }
    next();
  }
  load(['loads-model-ui.b64.0', 'loads-model-ui.b64.1'], function(b64){
    var s=document.createElement("script"); s.text=atob(b64); document.head.appendChild(s);
  });
})();
