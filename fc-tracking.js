/* FisherCapital tracking. Loaded in <head> of /self-employed-lp/ and /thank-you/ only.
   Never throws. Every storage access is wrapped and falls back to memory.

   ON THE COMPLETION TOKEN (review 2, B1)
   --------------------------------------
   fc_tok is minted in the browser and travels in a visible URL. It is therefore
   NOT proof that a Tally form was completed, and it must never be treated as
   proof. A static site cannot mint a server-signed, single-use token.

   What this file does instead is defence in depth:
     1. strict shape check, /^[0-9a-f]{32}$/, on every token it accepts;
     2. the thank-you page additionally requires the URL token to match the
        token this browser minted in sessionStorage, or a referrer on tally.so;
     3. the browser Lead event is treated as a DEDUP SHADOW only.

   The authoritative Phase 2 web lead is a server-side Meta Conversions API
   event, sent by Make from the Tally webhook, with
   event_id = "lead-" + fc_tok. Meta deduplicates the browser event against
   the CAPI event by that shared event_id. If the two disagree, the CAPI
   event is the record. Wiring that webhook is a Lane C task on Ray's list;
   until it exists, treat browser Lead counts as indicative, not as truth. */
(function () {
  'use strict';

  // ===== FisherCapital tracking config (edit here only) =====
  var FC_TRACKING = { META_PIXEL_ID: "" };
  // ==========================================================

  window.FC_TRACKING = FC_TRACKING;

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var BUNDLE_KEYS = UTM_KEYS.concat(['fbclid']);
  var PAID_SOURCES = ['facebook', 'instagram', 'meta', 'fb', 'ig'];
  var PAID_MEDIUMS = ['paid', 'cpc', 'paid_social', 'paidsocial'];
  var DECORATE_HOSTS = ['tally.so', 'calendly.com'];
  var LP_PATH = '/self-employed-lp';

  /* ---------- storage with in-memory fallback (S1) ----------
     The memory copy is always written, so a page view with blocked or full
     storage still behaves consistently within itself: one token for every
     link, one consent answer, one dedup marker. Setters report whether the
     value actually persisted beyond this page view. */
  var memSession = {};
  var memLocal = {};

  function ssGet(k) {
    try { var v = window.sessionStorage.getItem(k); if (v !== null) { return v; } } catch (e) { /* fall through */ }
    return Object.prototype.hasOwnProperty.call(memSession, k) ? memSession[k] : null;
  }
  function ssSet(k, v) {
    memSession[k] = v;
    try { window.sessionStorage.setItem(k, v); return true; } catch (e) { return false; }
  }
  function lsGet(k) {
    try { var v = window.localStorage.getItem(k); if (v !== null) { return v; } } catch (e) { /* fall through */ }
    return Object.prototype.hasOwnProperty.call(memLocal, k) ? memLocal[k] : null;
  }
  function lsSet(k, v) {
    memLocal[k] = v;
    try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; }
  }

  /* ---------- token ---------- */
  function isValidTok(t) { return typeof t === 'string' && /^[0-9a-f]{32}$/.test(t); }
  window.fcIsValidToken = isValidTok;

  /* ---------- attribution (S2: last touch) ----------
     The current URL wins. If the URL carries ANY utm_* or fbclid, the stored
     bundle is replaced entirely, so a newsletter click cannot inherit the
     fbclid of an earlier paid visit. If the URL carries none of them, the
     stored bundle is used unchanged. Presence counts, not value, so a bare
     "?fbclid=" still marks the visit as paid. */
  var qs = null;
  try { qs = new URLSearchParams(window.location.search); } catch (e) { qs = null; }

  var urlBundle = {};
  var urlHasBundle = false;
  if (qs) {
    for (var i = 0; i < BUNDLE_KEYS.length; i++) {
      var bk = BUNDLE_KEYS[i];
      if (qs.has(bk)) {
        urlHasBundle = true;
        urlBundle[bk] = qs.get(bk) || '';
      }
    }
  }

  var bundle = {};
  if (urlHasBundle) {
    bundle = urlBundle;
    try { ssSet('fc_attr', JSON.stringify(bundle)); } catch (e) { /* ignore */ }
  } else {
    try {
      var raw = ssGet('fc_attr');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (var j = 0; j < BUNDLE_KEYS.length; j++) {
            var sk = BUNDLE_KEYS[j];
            if (typeof parsed[sk] === 'string') { bundle[sk] = parsed[sk]; }
          }
        }
      }
    } catch (e) { bundle = {}; }
  }

  var FC_ATTR = {};
  for (var k1 in bundle) { if (Object.prototype.hasOwnProperty.call(bundle, k1)) { FC_ATTR[k1] = bundle[k1]; } }

  var urlTok = qs ? qs.get('fc_tok') : null;
  var urlTokValid = isValidTok(urlTok);
  if (urlTokValid) { FC_ATTR.fc_tok = urlTok; }

  window.FC_ATTR = FC_ATTR;
  window.FC_ATTR_FROM_URL = urlHasBundle ? urlBundle : {};
  window.FC_URL_TOKEN = urlTokValid ? urlTok : null;
  // Snapshot of the token this browser had BEFORE any decoration could mint
  // one, so the thank-you page's match test is independent of script order.
  window.FC_TOK_AT_LOAD = (function () { var t = ssGet('fc_tok'); return isValidTok(t) ? t : null; })();

  /* ---------- paid classifier (S1 of review 1, semantics per S2 of review 2) ---------- */
  function classifyPaid(attr) {
    if (!attr) { return false; }
    if (Object.prototype.hasOwnProperty.call(attr, 'fbclid')) { return true; }
    var src = (attr.utm_source || '').toLowerCase();
    var med = (attr.utm_medium || '').toLowerCase();
    return PAID_SOURCES.indexOf(src) !== -1 && PAID_MEDIUMS.indexOf(med) !== -1;
  }
  window.FC_IS_PAID = classifyPaid(bundle);

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

  /* ---------- pending queue (B2) ----------
     A first-time visitor reaches the thank-you page with consent unset. The
     Lead call cannot fire yet, so it is parked here and replayed once, if and
     when the visitor presses Accept. Decline discards the queue. */
  window.FC_PENDING = [];
  var flushed = false;

  function queuePending(eventName, params, conversionKey) {
    for (var i = 0; i < window.FC_PENDING.length; i++) {
      var p = window.FC_PENDING[i];
      if (p.eventName === eventName && p.conversionKey === conversionKey) { return false; }
    }
    window.FC_PENDING.push({ eventName: eventName, params: params, conversionKey: conversionKey });
    return true;
  }

  function flushPending() {
    if (flushed) { return []; }
    flushed = true;
    var queued = window.FC_PENDING.splice(0, window.FC_PENDING.length);
    var out = [];
    for (var i = 0; i < queued.length; i++) {
      out.push(window.fcTrack(queued[i].eventName, queued[i].params, queued[i].conversionKey));
    }
    return out;
  }
  window.fcFlushPending = flushPending;

  window.fcSetConsent = function (value) {
    if (value !== 'granted' && value !== 'denied') { return false; }
    var persisted = lsSet('fc_consent', value);
    var results = [];
    if (value === 'granted') {
      loadPixel();
      results = flushPending();
    } else {
      window.FC_PENDING.splice(0, window.FC_PENDING.length);
      flushed = true;
    }
    try {
      document.dispatchEvent(new CustomEvent('fc:consent', {
        detail: { value: value, persisted: persisted, flushed: results }
      }));
    } catch (e) { /* ignore */ }
    return persisted;
  };

  /* ---------- session token ---------- */
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
  function storedToken() {
    var t = ssGet('fc_tok');
    return isValidTok(t) ? t : null;
  }
  function sessionToken() {
    var t = storedToken();
    if (t) { return t; }
    var fresh = hex32();
    if (fresh) { ssSet('fc_tok', fresh); }   // memory copy always set, so one token per page view
    return fresh;
  }
  window.fcStoredToken = storedToken;   // never mints
  window.fcToken = sessionToken;        // mints if absent

  /* ---------- link decoration (S3) ---------- */
  function isLandingPage() {
    try {
      return window.location.pathname.replace(/\/+$/, '') === LP_PATH;
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
      for (var j = 0; j < BUNDLE_KEYS.length; j++) {
        var key = BUNDLE_KEYS[j];
        if (FC_ATTR[key]) { additions[key] = FC_ATTR[key]; }
      }
      if (onLp) { additions.fc_source = 'self-employed-lp'; }

      if (onLp || Object.keys(additions).length > 0) {
        var tok = FC_ATTR.fc_tok || sessionToken();
        if (isValidTok(tok)) { additions.fc_tok = tok; }
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

  /* ---------- event tracking ----------
     States (review 1 B12, review 2 B3):
       disabled   no pixel ID configured, or invalid arguments. Nothing stored.
       no-consent consent is unset or denied. If unset, the call is queued and
                  replayed once on Accept. Nothing stored, nothing sent.
       duplicate  this conversion key already fired on this browser.
       sent       handed to fbq with a deduplicating eventID. */
  window.fcTrack = function (eventName, params, conversionKey) {
    try {
      if (typeof eventName !== 'string' || eventName === '' ||
          typeof conversionKey !== 'string' || conversionKey === '') {
        return { status: 'disabled', reason: 'invalid-args' };
      }
      if (!hasPixelId()) { return { status: 'disabled', reason: 'no-pixel-id' }; }

      var consent = window.fcConsent();
      if (consent !== 'granted') {
        var queued = false;
        if (consent === 'unset') { queued = queuePending(eventName, params, conversionKey); }
        return { status: 'no-consent', consent: consent, queued: queued };
      }

      var markerKey = 'fc_sent_' + conversionKey;
      if (lsGet(markerKey)) { return { status: 'duplicate' }; }

      if (!pixelLoaded) { loadPixel(); }
      if (typeof window.fbq !== 'function') { return { status: 'disabled', reason: 'pixel-unavailable' }; }

      var eventID = eventName.toLowerCase() + '-' + conversionKey;
      window.fbq('track', eventName, params || {}, { eventID: eventID });
      var persisted = lsSet(markerKey, String(Date.now()));
      return { status: 'sent', eventID: eventID, persisted: persisted };
    } catch (e) {
      return { status: 'disabled', reason: 'exception' };
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
