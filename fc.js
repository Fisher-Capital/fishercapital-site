/* The Mortgage Room shared behaviour: mobile menu, situation picker,
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
      t: 'You don’t need all the answers yet.',
      s: 'We’ll start with what you want to do, what’s getting in the way, and your timing. There’s room to work through the questions together.',
      focus: ['Your goal', 'Your questions', 'Your timing'],
      cta: 'Let’s talk about your situation →', href: '/intake/'
    },
    declined: {
      t: 'Let’s understand the reason.',
      s: 'We’ll look at what the lender told you, what information it used, and what may need to change before considering another path.',
      focus: ['The reason given', 'Your file', 'Possible next steps'],
      cta: 'Explore the bank-declined briefing →', href: '/bank-declined/'
    },
    self: {
      t: 'Your income has a story.',
      s: 'We’ll look at how you earn, how your income is documented, and what needs more context. Lender requirements vary.',
      focus: ['Income structure', 'Business history', 'Supporting records'],
      cta: 'Explore the self-employed briefing →', href: '/self-employed/'
    },
    renewal: {
      t: 'Put your renewal offer on the table.',
      s: 'We’ll look at your timing, your current offer, and the costs and trade-offs of any alternatives before you decide.',
      focus: ['Renewal date', 'Current offer', 'Switching costs'],
      cta: 'Explore the renewal briefing →', href: '/renewal/'
    },
    debt: {
      t: 'Look at the whole cost picture.',
      s: 'We’ll review the balances, home equity and borrowing costs. A lower monthly payment can still mean paying more overall.',
      focus: ['Debt balances', 'Home equity', 'Total cost'],
      cta: 'Explore the debt-consolidation briefing →', href: '/debt-consolidation/'
    },
    buying: {
      t: 'Let’s plan your next move.',
      s: 'We’ll talk through your budget, down payment, income and timing, so you know what information a mortgage review needs.',
      focus: ['Purchase plans', 'Down payment', 'Your timing'],
      cta: 'Explore the home-buying briefing →', href: '/buying-a-home/'
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
        var focus = document.getElementById('brief-focus');
        if (focus) {
          focus.textContent = '';
          d.focus.forEach(function (topic) {
            var item = document.createElement('li');
            item.textContent = topic;
            focus.appendChild(item);
          });
        }
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
