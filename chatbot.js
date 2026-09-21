// chatbot.js
// FisherCapital chat widget -- vanilla JS, no framework
// Drop this script + chatbot.css into the FisherCapital.ca HTML

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // Config
  // ─────────────────────────────────────────────
  const CONFIG = {
    apiBase:      'https://fishercapital-chatbot.vercel.app',
    intakeUrl:    'https://tally.so/r/KYGDrk',
    calendlyUrl:  'https://calendly.com/raymond-finance-co/mortgage-consultation',
    pollInterval: 8000,   // ms between takeover status polls
    mobilePulseDelay: 20000,  // ms before pulsing chat button on mobile
    desktopMinTime: 15000,    // ms minimum on page before desktop auto-open fires
  };

  const COMPLIANCE_FOOTER =
    'General information only. Not mortgage advice. Raymond. F, Mortgage agent (Level 1), FSRA Lic. M26000144. Mortgage Commitment, an office of Centum Financial Services Limited Partnership, FSRA Brokerage Lic. 13054. Ontario only. Rates and terms are not guaranteed. Subject to lender approval.';

  const WELCOME_MESSAGE =
    'Ontario mortgage question? Tell me what your situation is:';

  const QUICK_ACTIONS = [
    { label: "I'm Self-Employed",     action: 'message', message: "I'm self-employed and want to understand my mortgage options." },
    { label: 'Bank Said No',          action: 'message', message: "I've been turned down by a bank and I'm not sure what to do next." },
    { label: 'Renewing My Mortgage',  action: 'message', message: "My mortgage is coming up for renewal and I have questions." },
    { label: 'Book a Call',           action: 'calendly' },
  ];

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  let sessionId = null;
  let isOpen = false;
  let isLoading = false;
  let takeover = false;
  let pollTimer = null;
  let hasShownWelcome = false;

  // ─────────────────────────────────────────────
  // Build DOM
  // ─────────────────────────────────────────────
  function buildWidget() {
    // Inject CSS if not already loaded, and never if the page already links it
    if (!document.getElementById('fc-chatbot-css') && !document.querySelector('link[href$="/chatbot.css"]')) {
      const link = document.createElement('link');
      link.id = 'fc-chatbot-css';
      link.rel = 'stylesheet';
      link.href = '/chatbot.css'; // adjust path if serving from CDN
      document.head.appendChild(link);
    }

    // Launcher button
    const launcher = el('button', { id: 'fc-chat-launcher', 'aria-label': 'Open chat' });
    launcher.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <div id="fc-unread-badge"></div>
    `;
    launcher.addEventListener('click', toggleChat);

    // Chat window
    const win = el('div', { id: 'fc-chat-window', role: 'dialog', 'aria-label': 'FisherCapital chat', 'aria-modal': 'false' });

    win.innerHTML = `
      <!-- Header -->
      <div id="fc-chat-header">
        <div class="fc-header-identity">
          <div class="fc-avatar">FC</div>
          <div class="fc-header-text">
            <span class="fc-header-name">FisherCapital</span>
            <span class="fc-header-status" id="fc-status-text">Ask a mortgage question</span>
          </div>
        </div>
        <button id="fc-close-btn" aria-label="Close chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Messages -->
      <div id="fc-messages" role="log" aria-live="polite" aria-label="Chat messages"></div>

      <!-- Sensitive info warning -->
      <div id="fc-sensitive-warning">
        Please do not share SINs, account numbers, income amounts, or other sensitive financial details in this chat.
      </div>

      <!-- Quick actions -->
      <div id="fc-quick-actions"></div>

      <!-- Input -->
      <div id="fc-input-area">
        <textarea
          id="fc-input"
          placeholder="Ask a mortgage question..."
          rows="1"
          aria-label="Type your message"
          maxlength="800"
        ></textarea>
        <button id="fc-send-btn" aria-label="Send message" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      <!-- Compliance footer -->
      <div id="fc-compliance-footer">${COMPLIANCE_FOOTER}</div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(win);

    // Wire events
    document.getElementById('fc-close-btn').addEventListener('click', closeChat);
    document.getElementById('fc-send-btn').addEventListener('click', handleSend);
    document.getElementById('fc-input').addEventListener('keydown', handleKeydown);
    document.getElementById('fc-input').addEventListener('input', handleInputChange);

    buildQuickActions();
  }

  function buildQuickActions() {
    const container = document.getElementById('fc-quick-actions');
    container.innerHTML = '';

    QUICK_ACTIONS.forEach(({ label, action, message: msg }) => {
      const btn = el('button', { class: 'fc-quick-btn' });
      btn.textContent = label;
      btn.addEventListener('click', () => handleQuickAction(action, msg));
      container.appendChild(btn);
    });
  }

  // Labels the backend uses for routing -- rendered as direct links, not chat messages
  const LINK_ACTION_LABELS = {
    'Start the Intake': 'intake',
    'Book a Call': 'calendly',
  };

  function showContextualActions(labels) {
    const container = document.getElementById('fc-quick-actions');
    container.innerHTML = '';

    labels.forEach(label => {
      const btn = el('button', { class: 'fc-quick-btn fc-quick-btn--contextual' });
      btn.textContent = label;
      btn.addEventListener('click', () => {
        const linkAction = LINK_ACTION_LABELS[label];
        if (linkAction) {
          // Open the link; keep the buttons visible so the visitor can use the other one too
          handleQuickAction(linkAction);
        } else {
          restoreDefaultActions();
          handleQuickAction('message', label);
        }
      });
      container.appendChild(btn);
    });
  }

  function restoreDefaultActions() {
    buildQuickActions();
  }

  // ─────────────────────────────────────────────
  // Chat open/close
  // ─────────────────────────────────────────────
  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    const win = document.getElementById('fc-chat-window');
    win.classList.add('open');
    win.setAttribute('aria-modal', 'true');

    // Clear unread badge
    const badge = document.getElementById('fc-unread-badge');
    if (badge) badge.classList.remove('visible');

    // Update launcher icon to X (also clears any pulse animation)
    const launcher = document.getElementById('fc-chat-launcher');
    launcher.classList.remove('fc-pulse');
    launcher.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      <div id="fc-unread-badge"></div>
    `;

    // Focus input
    setTimeout(() => document.getElementById('fc-input')?.focus(), 200);

    // Show welcome message on first open
    if (!hasShownWelcome) {
      hasShownWelcome = true;
      setTimeout(() => addMessage('bot', WELCOME_MESSAGE), 400);
    }

    // Start polling for takeover status
    startTakeoverPoll();
  }

  function closeChat() {
    isOpen = false;
    const win = document.getElementById('fc-chat-window');
    win.classList.remove('open');
    win.setAttribute('aria-modal', 'false');

    // Restore chat icon
    const launcher = document.getElementById('fc-chat-launcher');
    launcher.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <div id="fc-unread-badge"></div>
    `;

    stopTakeoverPoll();
  }

  // ─────────────────────────────────────────────
  // Message handling
  // ─────────────────────────────────────────────
  async function handleSend() {
    const input = document.getElementById('fc-input');
    const text = (input.value || '').trim();
    if (!text || isLoading) return;

    input.value = '';
    autoResize(input);
    setSendDisabled(true);
    restoreDefaultActions();

    addMessage('visitor', text);
    showTyping();

    try {
      const data = await sendMessage(text);
      hideTyping();
      if (data.reply) {
        addMessage('bot', data.reply);
      }

      if (data.suggestions && data.suggestions.length > 0) {
        showContextualActions(data.suggestions);
      }

      if (data.takeover) {
        setTakeoverMode(true);
      }

      if (data.flagged) {
        showSensitiveWarning();
      }

    } catch (err) {
      hideTyping();
      addMessage('bot', 'Something went wrong. Please use the intake or booking button to connect with Raymond.');
    }

    setSendDisabled(false);
    input.focus();
  }

  async function sendMessage(message) {
    const body = { message };
    if (sessionId) body.sessionId = sessionId;

    const res = await fetch(`${CONFIG.apiBase}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();

    // Store session ID from first response
    if (data.sessionId && !sessionId) {
      sessionId = data.sessionId;
    }

    return data;
  }

  // ─────────────────────────────────────────────
  // Quick actions
  // ─────────────────────────────────────────────
  function handleQuickAction(action, message) {
    switch (action) {
      case 'intake':
        window.open(CONFIG.intakeUrl, '_blank', 'noopener');
        break;
      case 'calendly':
        window.open(CONFIG.calendlyUrl, '_blank', 'noopener');
        break;
      case 'message':
        const input = document.getElementById('fc-input');
        if (input) {
          input.value = message;
          autoResize(input);
          setSendDisabled(false);
          handleSend();
        }
        break;
    }
  }

  // ─────────────────────────────────────────────
  // DOM helpers: messages
  // ─────────────────────────────────────────────
  function addMessage(sender, text) {
    const messages = document.getElementById('fc-messages');
    if (!messages) return;

    const wrapper = el('div', { class: `fc-msg ${sender}` });

    if (sender === 'raymond') {
      const label = el('div', { class: 'fc-sender-label' });
      label.textContent = 'Raymond';
      wrapper.appendChild(label);
    }

    const bubble = el('div', { class: 'fc-bubble' });
    bubble.innerHTML = formatMessage(text);
    wrapper.appendChild(bubble);

    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;

    // Show unread badge if closed
    if (!isOpen) {
      const badge = document.getElementById('fc-unread-badge');
      if (badge) badge.classList.add('visible');
    }
  }

  function formatMessage(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(urlRegex, url => {
        const safeUrl = url.replace(/&amp;/g, '&');
        const display = safeUrl.length > 40 ? safeUrl.substring(0, 40) + '...' : safeUrl;
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${display}</a>`;
      })
      .replace(/\n/g, '<br>');
  }

  let typingEl = null;

  function showTyping() {
    const messages = document.getElementById('fc-messages');
    if (!messages || typingEl) return;

    typingEl = el('div', { class: 'fc-typing', id: 'fc-typing-indicator' });
    typingEl.innerHTML = '<div class="fc-typing-dot"></div><div class="fc-typing-dot"></div><div class="fc-typing-dot"></div>';
    messages.appendChild(typingEl);
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    if (typingEl) {
      typingEl.remove();
      typingEl = null;
    }
  }

  function showSensitiveWarning() {
    const warning = document.getElementById('fc-sensitive-warning');
    if (warning) {
      warning.classList.add('visible');
      setTimeout(() => warning.classList.remove('visible'), 8000);
    }
  }

  function setTakeoverMode(active) {
    takeover = active;
    const status = document.getElementById('fc-status-text');
    if (status) {
      status.textContent = active ? 'Raymond is in the conversation' : 'Ask a mortgage question';
    }
  }

  // ─────────────────────────────────────────────
  // Input helpers
  // ─────────────────────────────────────────────
  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputChange(e) {
    autoResize(e.target);
    const hasText = e.target.value.trim().length > 0;
    setSendDisabled(!hasText || isLoading);
  }

  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }

  function setSendDisabled(disabled) {
    isLoading = disabled;
    const btn = document.getElementById('fc-send-btn');
    if (btn) btn.disabled = disabled;
  }

  // ─────────────────────────────────────────────
  // Takeover polling
  // ─────────────────────────────────────────────
  let lastMessageTime = new Date().toISOString();

  function startTakeoverPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(async () => {
      if (!sessionId) return;
      try {
        // Check takeover status
        const res = await fetch(`${CONFIG.apiBase}/api/sessions?id=${sessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.takeover !== takeover) {
          setTakeoverMode(data.takeover);
        }

        // If takeover is active, fetch any new Raymond messages
        if (data.takeover) {
          const since = lastMessageTime ? `&since=${encodeURIComponent(lastMessageTime)}` : '';
          const msgRes = await fetch(`${CONFIG.apiBase}/api/messages?sessionId=${sessionId}${since}`);
          if (!msgRes.ok) return;
          const msgData = await msgRes.json();
          if (msgData.messages && msgData.messages.length > 0) {
            msgData.messages.forEach(m => {
              addMessage(m.sender, m.message);
              lastMessageTime = m.created_at;
            });
          }
        }
      } catch {
        // Silent fail -- polling is non-critical
      }
    }, CONFIG.pollInterval);
  }

  function stopTakeoverPoll() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ─────────────────────────────────────────────
  // Utility
  // ─────────────────────────────────────────────
  function el(tag, attrs = {}) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  // ─────────────────────────────────────────────
  // Auto-open
  // ─────────────────────────────────────────────
  function ssGetSafe(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function ssSetSafe(key, value) {
    try { window.sessionStorage.setItem(key, value); return true; } catch (e) { return false; }
  }

  function scheduleAutoOpen() {
    if (ssGetSafe('fc_greeted')) return;

    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile: never force-open. Pulse the button after a delay.
      setTimeout(() => {
        const launcher = document.getElementById('fc-chat-launcher');
        if (launcher && !isOpen) launcher.classList.add('fc-pulse');
      }, CONFIG.mobilePulseDelay);
      return;
    }

    // Desktop: open after delay + at least minimal scroll engagement.
    // Using a timer + scroll flag so both edge cases are handled:
    // fast scrollers (timer fires after they've scrolled) and
    // slow readers (scroll fires after timer has elapsed).
    let triggered = false;
    let scrolledAtAll = false;

    function maybeOpen() {
      if (triggered || isOpen) return;
      if (scrolledAtAll) {
        triggered = true;
        window.removeEventListener('scroll', onScroll);
        ssSetSafe('fc_greeted', '1');
        openChat();
      }
    }

    function onScroll() {
      scrolledAtAll = true;
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    setTimeout(maybeOpen, CONFIG.desktopMinTime);
  }

  // ─────────────────────────────────────────────
  // Init guard: no chat on paid sessions, and none where the page opts out.
  //
  // This is the same last-touch rule as fc-tracking.js (S2), implemented
  // independently so the guard cannot be defeated by blocking that file:
  // the current URL wins, any utm_* or fbclid in the URL replaces the stored
  // bundle entirely, and with no such parameters the stored bundle is used
  // unchanged. Presence counts, not value, so a bare "?fbclid=" is paid.
  // fc-tracking.js does not run on these pages, so the replacement write has
  // to happen here or a later parameterless visit would still read the old
  // bundle. Nothing else in the stored bundle is ever modified here.
  // ─────────────────────────────────────────────
  const FC_UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const FC_BUNDLE_KEYS = FC_UTM_KEYS.concat(['fbclid']);

  function fcReadBundle() {
    let urlBundle = {};
    let urlHasBundle = false;
    try {
      const qs = new URLSearchParams(window.location.search);
      for (const k of FC_BUNDLE_KEYS) {
        if (qs.has(k)) { urlHasBundle = true; urlBundle[k] = qs.get(k) || ''; }
      }
    } catch (e) {
      urlBundle = {}; urlHasBundle = false;
    }

    if (urlHasBundle) {
      try { window.sessionStorage.setItem('fc_attr', JSON.stringify(urlBundle)); } catch (e) { /* ignore */ }
      return urlBundle;
    }

    try {
      const raw = window.sessionStorage.getItem('fc_attr');
      if (!raw) { return {}; }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') { return {}; }
      const out = {};
      for (const k of FC_BUNDLE_KEYS) {
        if (typeof parsed[k] === 'string') { out[k] = parsed[k]; }
      }
      return out;
    } catch (e) {
      return {};
    }
  }

  function isPaidSession() {
    const PAID_SOURCES = ['facebook', 'instagram', 'meta', 'fb', 'ig'];
    const PAID_MEDIUMS = ['paid', 'cpc', 'paid_social', 'paidsocial'];
    try {
      const attr = fcReadBundle();
      if (Object.prototype.hasOwnProperty.call(attr, 'fbclid')) { return true; }
      const src = (attr.utm_source || '').toLowerCase();
      const med = (attr.utm_medium || '').toLowerCase();
      return PAID_SOURCES.includes(src) && PAID_MEDIUMS.includes(med);
    } catch (e) {
      return false;
    }
  }

  function chatbotDisabled() {
    try {
      const b = document.body;
      return (b && b.dataset && b.dataset.fcChatbot === 'off') ||
             (b && b.getAttribute('data-fc-chatbot') === 'off');
    } catch (e) {
      return false;
    }
  }

  if (isPaidSession() || chatbotDisabled()) {
    return; // no DOM, no CSS, no listeners
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { buildWidget(); scheduleAutoOpen(); });
  } else {
    buildWidget();
    scheduleAutoOpen();
  }

})();
