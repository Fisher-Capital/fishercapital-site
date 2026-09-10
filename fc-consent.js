/* Consent notice behaviour. Loaded on /self-employed-lp/ and /thank-you/ only.
   The bar is shown only while no choice has been stored. No pixel loads before Accept. */
(function () {
  'use strict';

  function boot() {
    var bar = document.getElementById('fc-consent');
    if (!bar) { return; }
    if (typeof window.fcConsent !== 'function' || typeof window.fcSetConsent !== 'function') { return; }

    if (window.fcConsent() === 'unset') {
      bar.hidden = false;
    } else {
      bar.hidden = true;
    }

    var buttons = bar.querySelectorAll('[data-fc-consent]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var value = e.currentTarget.getAttribute('data-fc-consent');
        try { window.fcSetConsent(value); } catch (err) { /* never throw */ }
        bar.hidden = true;
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
