/* Consent notice behaviour. Loaded on /self-employed-lp/ and /thank-you/ only.
   The bar is shown only while no choice has been stored. No pixel loads before Accept.

   On storage failure (S1): fcSetConsent always records the choice in memory, so
   the choice IS effective for this page view and the bar is hidden either way.
   What a failed write costs is persistence, not effect, so nothing here claims
   the answer was remembered. The failure is recorded on <html> for the test
   harness and for anyone debugging a locked-down browser, and the bar will
   simply be shown again on the next page view. */
(function () {
  'use strict';

  function boot() {
    var bar = document.getElementById('fc-consent');
    if (!bar) { return; }
    if (typeof window.fcConsent !== 'function' || typeof window.fcSetConsent !== 'function') { return; }

    bar.hidden = window.fcConsent() !== 'unset';

    var buttons = bar.querySelectorAll('[data-fc-consent]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var value = e.currentTarget.getAttribute('data-fc-consent');
        var persisted = false;
        try { persisted = window.fcSetConsent(value) === true; } catch (err) { persisted = false; }

        var effective = false;
        try { effective = window.fcConsent() === value; } catch (err) { effective = false; }

        // Hide once the choice is effective for this page view. A choice that
        // did not persist is still honoured here; it is simply not remembered.
        if (effective || persisted) { bar.hidden = true; }

        if (!persisted) {
          try { document.documentElement.setAttribute('data-fc-consent-persisted', 'false'); } catch (err) { /* ignore */ }
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
