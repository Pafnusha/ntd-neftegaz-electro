/**
 * Browser loader note: include scripts in order listed in loads.html.
 * Node: require('./model') etc.
 * Exposes window.LoadsCore after all modules load.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.LoadsCore = window.LoadsCore || {};
  window.LoadsCore.VERSION = '1.0.0-mvp';
  window.LoadsCore.ready = true;
})();
