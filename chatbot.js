// chatbot.js
// FisherCapital chat widget -- vanilla JS, no framework
// Drop this script + chatbot.css into the FisherCapital.ca HTML

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // Config
  // ─────────────────────────────────────────────
  const CONFIG = {
    apiBase:      'https://fishercapital-chatbot-v2.vercel.app', // your Vercel deployment URL
    intakeUrl:    'https://tally.so/r/KYGDrk',
    calendlyUrl:  'https://calendly.com/raymond-finance-co/mortgage-consultation',
    pollInterval: 8000,  // ms between takeover status polls
    welcomeDelay: 2000,  // ms before showing welcome message on first open
    autoOpenDelay: 5000, // ms after page load before auto-opening chat
  };

  const COMPLIANCE_FOOTER =
    'General information only. Not mortgage advice. Raymond F, Licensed Mortgage Agent 1, FSRA Lic. #M26000144 | Centum Financial Services LP, FSRA Lic. #13054.';

  const WELCOME_MESSAGE =
    'Hi, welcome to Fisher Capital.\n\nMany of the people who visit this site are self-employed, have been turned down by a bank, or simply aren\'t sure what options are available.\n\nIf that sounds like you, you\'re in the right place.\n\nWhat would you like help with today?';

  const QUICK_ACTIONS = [
    { label: "I'm Self-Employed",   action: 'message', message: "I'm self-employed and want to understand my mortgage options." },
    { label: 'Bank Said No',        action: 'message', message: "I've been turned down by a bank and I'm not sure what to do next." },
    { label: 'Renewal Questions',   action: 'message', message: "My mortgage is coming up for renewal and I have questions." },
    { label: 'Debt Consolidation',  action: 'message', message: "I want to understand if I can use my home equity to consolidate debt." },
    { label: 'Book a Call',         action: 'calendly' },
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
    // Inject CSS if not already loaded
    if (!document.getElementById('fc-chatbot-css')) {
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

  function showContextualActions(labels) {
    const container = document.getElementById('fc-quick-actions');
    container.innerHTML = '';

    labels.forEach(label => {
      const btn = el('button', { class: 'fc-quick-btn fc-quick-btn--contextual' });
      btn.textContent = label;
      btn.addEventListener('click', () => {
        restoreDefaultActions();
        handleQuickAction('message', label);
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

    // Update launcher icon to X
    const launcher = document.getElementById('fc-chat-launcher');
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
  function scheduleAutoOpen() {
    if (sessionStorage.getItem('fc_greeted')) return;
    setTimeout(() => {
      if (!isOpen) {
        sessionStorage.setItem('fc_greeted', '1');
        openChat();
      }
    }, CONFIG.autoOpenDelay);
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
