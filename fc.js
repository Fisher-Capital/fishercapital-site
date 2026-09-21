/* FisherCapital — shared behaviour: mobile menu, situation picker,
   payment calculator, FAQ accordion. Each block no-ops if its
   markup is absent, so every page can load the same file. */
(function () {
  'use strict';

  /* ── mobile menu ─────────────────────────────────────────── */
  var burger = document.getElementById('hamburger');
  var menu = document.getElementById('mobileMenu');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ── hero situation picker ───────────────────────────────── */
  var line = document.getElementById('picker-line');
  var pcta = document.getElementById('picker-cta');
  var SITUATIONS = {
    unsure: {
      t: "Not sure which fits? That's fine.",
      s: 'Start the intake; that is what the review is for. It takes about 3 minutes. No SIN or documents are needed for this first step.',
      cta: 'Tell me your situation →', href: 'https://tally.so/r/KYGDrk'
    },
    declined: {
      t: 'Bank declined',
      s: 'A lender decline is a reason to understand what happened, what information is missing, and whether another path should be reviewed.',
      cta: 'Start with a bank decline →', href: '/bank-declined/'
    },
    self: {
      t: 'Self-employed or irregular income',
      s: "Self-employed qualifying works differently than the bank's standard process. There are lending channels built around that reality.",
      cta: 'Start as self-employed →', href: '/self-employed/'
    },
    renewal: {
      t: 'Renewal or refinance',
      s: "A renewal is an opportunity to compare the existing offer, other available options and any costs of switching. Starting early gives time to review the details.",
      cta: 'Start with a renewal →', href: '/renewal/'
    },
    debt: {
      t: 'Debt consolidation',
      s: 'Where there is home equity and higher-interest debt, restructuring may change the monthly payment; whether it is lower, and what it costs overall, depends on the lender, the terms and the full application.',
      cta: 'Start with debt consolidation →', href: '/debt-consolidation/'
    },
    buying: {
      t: 'Buying a home',
      s: 'A purchase where the income or credit picture is not standard is still a file that needs the right lender fit. A review looks at what you have, what would need to be gathered, and which lenders may consider it.',
      cta: 'Start with a purchase →', href: '/buying-a-home/'
    }
  };
  if (line && pcta) {
    document.querySelectorAll('.pk').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.pk').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        var d = SITUATIONS[b.dataset.k];
        if (!d) return;
        line.textContent = '';
        var st = document.createElement('strong');
        st.textContent = d.t;
        line.appendChild(st);
        line.appendChild(document.createTextNode(d.s));
        pcta.textContent = d.cta;
        pcta.setAttribute('href', d.href);
      });
    });
  }

  /* ── payment calculator ──────────────────────────────────────
     Plain arithmetic on figures the visitor enters, using the
     semi-annual compounding that applies to most Canadian
     fixed-rate mortgages. Not a quote, rate or qualification. */
  var amt = document.getElementById('c-amt');
  if (amt) {
    var rate = document.getElementById('c-rate');
    var amort = document.getElementById('c-amort');
    var term = document.getElementById('c-term');
    var freq = 'monthly';
    var cad = function (n) { return '$' + Math.round(n).toLocaleString('en-CA'); };

    var calc = function () {
      var P = +amt.value, r = +rate.value / 100, A = +amort.value, T = +term.value;
      document.getElementById('o-amt').textContent = cad(P);
      document.getElementById('o-rate').textContent = (+rate.value).toFixed(2) + '%';
      document.getElementById('o-amort').textContent = A + ' years';
      document.getElementById('o-term').textContent = T + (T === 1 ? ' year' : ' years');

      var perYear = freq === 'monthly' ? 12 : 26;
      var i = Math.pow(1 + r / 2, 2 / perYear) - 1;
      var pay;
      if (freq === 'accel') {
        var im = Math.pow(1 + r / 2, 2 / 12) - 1;
        pay = (im === 0 ? P / (A * 12) : P * im / (1 - Math.pow(1 + im, -A * 12))) / 2;
      } else {
        pay = i === 0 ? P / (A * perYear) : P * i / (1 - Math.pow(1 + i, -A * perYear));
      }

      var bal = P, interest = 0, count = 0, scheduledCount = T * perYear;
      for (var k = 0; k < scheduledCount && bal > 0.0000001; k++) {
        var it = bal * i;
        var actualPayment = Math.min(pay, bal + it);
        interest += it;
        bal = Math.max(0, bal + it - actualPayment);
        count++;
      }
      if (bal < 0.0000001) bal = 0;
      var principal = P - bal;

      document.getElementById('r-pay').textContent = cad(pay);
      document.getElementById('r-freq').textContent = freq === 'monthly' ? 'per month' : 'every two weeks';
      document.getElementById('r-count').textContent = count;
      document.getElementById('r-prin').textContent = cad(principal);
      document.getElementById('r-int').textContent = cad(interest);
      document.getElementById('r-bal').textContent = cad(bal);
      document.getElementById('r-split').style.width =
        (principal / (principal + interest) * 100).toFixed(1) + '%';
    };

    [amt, rate, amort, term].forEach(function (el) { el.addEventListener('input', calc); });
    document.querySelectorAll('.seg button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.seg button').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        freq = b.dataset.f;
        calc();
      });
    });
    calc();
  }

  /* ── FAQ accordion ───────────────────────────────────────── */
  document.querySelectorAll('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var open = q.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-q').forEach(function (o) {
        o.setAttribute('aria-expanded', 'false');
        o.nextElementSibling.classList.remove('open');
      });
      if (!open) {
        q.setAttribute('aria-expanded', 'true');
        q.nextElementSibling.classList.add('open');
      }
    });
  });
})();
