/**
 * Manual override field: { value, source, mode: 'auto'|'manual' }
 * Never overwrite manual on recalculate unless user resets.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else {
    root.LoadsCore = root.LoadsCore || {};
    Object.assign(root.LoadsCore, factory());
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function field(value, source, mode) {
    return {
      value: value,
      source: source || 'default',
      mode: mode === 'manual' ? 'manual' : 'auto'
    };
  }

  function getVal(f, fallback) {
    if (f == null) return fallback;
    if (typeof f === 'object' && 'value' in f) return f.value;
    return f;
  }

  function isManual(f) {
    return f && typeof f === 'object' && f.mode === 'manual';
  }

  /** Set auto value only if not manual. Returns the field object. */
  function setAuto(f, value, source) {
    if (isManual(f)) return f;
    return field(value, source || 'auto', 'auto');
  }

  /** Force manual override. */
  function setManual(f, value, source) {
    return field(value, source || 'user', 'manual');
  }

  /** Revert to auto (lose manual). */
  function resetToAuto(value, source) {
    return field(value, source || 'auto', 'auto');
  }

  return { field: field, getVal: getVal, isManual: isManual, setAuto: setAuto, setManual: setManual, resetToAuto: resetToAuto };
});
