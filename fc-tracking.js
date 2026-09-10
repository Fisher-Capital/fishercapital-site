/* FisherCapital tracking. Loaded in <head> of /self-employed-lp/ and /thank-you/ only.
   Never throws. Every storage access is wrapped. No pixel loads without a pixel ID
   AND an explicit consent choice of "granted". */
(function () {
  'use strict';

  // ===== FisherCapital tracking config (edit here only) =====
  var FC_TRACKING = { META_PIXEL_ID: "" };
  // ==========================================================

  window.FC_TRACKING = FC_TRACKING;

  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'fc_tok'];
  var PAID_SOURCES = ['facebook', 'instagram', 'meta', 'fb', 'ig'];
  var PAID_MEDIUMS = ['paid', 'cpc', 'paid_social', 'paidsocial'];
  var DECORATE_HOSTS = ['tally.so', 'calendly.com'];

  /* ---------- storage helpers (never throw) ---------- */
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- attribution ---------- */
  var urlParams = {};
  try {
    var qs = new URLSearchParams(window.location.search);
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      var v = qs.get(ATTR_KEYS[i]);
      if (v !== null && v !== '') { urlParams[ATTR_KEYS[i]] = v; }
    }
  } catch (e) { urlParams = {}; }

  var stored = {};
  try {
    var raw = ssGet('fc_attr');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (var j = 0; j < ATTR_KEYS.length; j++) {
          var sk = ATTR_KEYS[j];
          if (typeof parsed[sk] === 'string' && parsed[sk] !== '') { stored[sk] = parsed[sk]; }
        }
      }
    }
  } catch (e) { stored = {}; }

  var FC_ATTR = {};
  for (var k1 in stored) { if (Object.prototype.hasOwnProperty.call(stored, k1)) { FC_ATTR[k1] = stored[k1]; } }
  for (var k2 in urlParams) { if (Object.prototype.hasOwnProperty.call(urlParams, k2)) { FC_ATTR[k2] = urlParams[k2]; } } // URL wins

  try { ssSet('fc_attr', JSON.stringify(FC_ATTR)); } catch (e) { /* ignore */ }

  window.FC_ATTR = FC_ATTR;
  // Which attribution keys arrived in this page's URL rather than only from storage.
  window.FC_ATTR_FROM_URL = urlParams;

  /* ---------- paid classifier (S1) ---------- */
  function classifyPaid(attr) {
    if (!attr) { return false; }
    if (attr.fbclid) { return true; }
    var src = (attr.utm_source || '').toLowerCase();
    var med = (attr.utm_medium || '').toLowerCase();
    return PAID_SOURCES.indexOf(src) !== -1 && PAID_MEDIUMS.indexOf(med) !== -1;
  }
  var FC_IS_PAID = classifyPaid(FC_ATTR);
  window.FC_IS_PAID = FC_IS_PAID;

  /* ---------- consent ---------- */
  window.fcConsent = function () {
    var v = lsGet('fc_consent');
    if (v === 'granted' || v === 'denied') { return v; }
    return 'unset';
  };

  function hasPixelId() {
    return typeof FC_TRACKING.META_PIXEL_ID === 'string' && FC_TRACKING.META_PIXEL_ID !== '';
  }

  /* ---------- pixel loader ---------- */
  var pixelLoaded = false;
  function loadPixel() {
    if (pixelLoaded) { return false; }
    if (!hasPixelId()) { return false; }
    if (window.fcConsent() !== 'granted') { return false; }
    try {
      /* Meta base code */
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

      var id = FC_TRACKING.META_PIXEL_ID;
      window.fbq('set', 'autoConfig', false, id);        // no automatic collection
      window.fbq('init', id, {}, { agent: 'fishercapital' });
      window.fbq('track', 'PageView');
      pixelLoaded = true;
      return true;
    } catch (e) {
      return false;
    }
  }
  window.fcLoadPixel = loadPixel;

  window.fcSetConsent = function (value) {
    if (value !== 'granted' && value !== 'denied') { return window.fcConsent(); }
    lsSet('fc_consent', value);
    if (value === 'granted') { loadPixel(); }
    try {
      document.dispatchEvent(new CustomEvent('fc:consent', { detail: { value: value } }));
    } catch (e) { /* ignore */ }
    return value;
  };

  /* ---------- conversion token ---------- */
  function hex32() {
    try {
      var a = new Uint8Array(16);
      window.crypto.getRandomValues(a);
      var out = '';
      for (var i = 0; i < a.length; i++) { out += ('0' + a[i].toString(16)).slice(-2); }
      return out;
    } catch (e) {
      return null;
    }
  }
  function sessionToken() {
    var t = ssGet('fc_tok');
    if (t && /^[0-9a-f]{32}$/.test(t)) { return t; }
    var fresh = hex32();
    if (fresh) { ssSet('fc_tok', fresh); }
    return fresh;
  }
  window.fcToken = sessionToken;

  /* ---------- link decoration (S3) ---------- */
  function isLandingPage() {
    try {
      return window.location.pathname.indexOf('/self-employed-lp') === 0 ||
             window.location.pathname.indexOf('/self-employed-lp') > -1;
    } catch (e) { return false; }
  }

  function decorateLinks() {
    var onLp = isLandingPage();
    var anchors;
    try { anchors = document.querySelectorAll('a[href]'); } catch (e) { return; }

    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var u;
      try { u = new URL(a.getAttribute('href'), window.location.href); } catch (e) { continue; }
      if (DECORATE_HOSTS.indexOf(u.hostname) === -1) { continue; }

      var additions = {};
      for (var j = 0; j < ATTR_KEYS.length; j++) {
        var key = ATTR_KEYS[j];
        if (key === 'fc_tok') { continue; }
        if (FC_ATTR[key]) { additions[key] = FC_ATTR[key]; }
      }
      if (onLp) { additions.fc_source = 'self-employed-lp'; }

      var tok = null;
      if (onLp || Object.keys(additions).length > 0) {
        tok = FC_ATTR.fc_tok || sessionToken();
        if (tok) { additions.fc_tok = tok; }
      }

      // No attribution present and not on the LP: leave the href untouched.
      if (Object.keys(additions).length === 0) { continue; }

      try {
        for (var key2 in additions) {
          if (Object.prototype.hasOwnProperty.call(additions, key2)) {
            u.searchParams.set(key2, additions[key2]);   // preserves existing query and hash
          }
        }
        a.setAttribute('href', u.toString());
      } catch (e) { /* leave this link alone */ }
    }
  }
  window.fcDecorateLinks = decorateLinks;

  /* ---------- event tracking ---------- */
  window.fcTrack = function (eventName, params, conversionKey) {
    try {
      if (!eventName || !conversionKey) { return { status: 'disabled' }; }
      if (!hasPixelId()) { return { status: 'disabled' }; }
      if (window.fcConsent() !== 'granted') { return { status: 'disabled' }; }

      var markerKey = 'fc_sent_' + conversionKey;
      if (lsGet(markerKey)) { return { status: 'duplicate' }; }

      if (!pixelLoaded) { loadPixel(); }
      if (typeof window.fbq !== 'function') { return { status: 'disabled' }; }

      var eventID = String(eventName).toLowerCase() + '-' + conversionKey;
      window.fbq('track', eventName, params || {}, { eventID: eventID });
      lsSet(markerKey, String(Date.now()));
      return { status: 'sent', eventID: eventID };
    } catch (e) {
      return { status: 'disabled' };
    }
  };

  /* ---------- boot ---------- */
  if (window.fcConsent() === 'granted') { loadPixel(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', decorateLinks);
  } else {
    decorateLinks();
  }
})();
