/* Cookieless, privacy friendly page and event counts via GoatCounter.
   No cookies, no local storage, no personal data, so no consent banner is
   needed. Replace GOATCOUNTER_CODE with the code of the GoatCounter site
   (the "clarityos" part of clarityos.goatcounter.com). While it is still the
   placeholder, nothing is loaded and track() does nothing. */
(function(){
  "use strict";
  var GOATCOUNTER_CODE = 'clarityos';
  var enabled = !/^\[.*\]$/.test(GOATCOUNTER_CODE) && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
  var queue = [];

  window.clarityTrack = function(name, title){
    if(!enabled) return;
    var ev = {path:name, title:title || name, event:true};
    if(window.goatcounter && window.goatcounter.count){ window.goatcounter.count(ev); }
    else { queue.push(ev); }
  };
  if(!enabled) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', 'https://' + GOATCOUNTER_CODE + '.goatcounter.com/count');
  s.addEventListener('load', function(){
    queue.splice(0).forEach(function(ev){ window.goatcounter.count(ev); });
  });
  document.head.appendChild(s);
})();
