/**
 * whatsapp-widget.js — GOGO MART Floating WhatsApp Chat Assistant Widget
 * Modern floating widget with animated pulse, quick greeting card, and 1-click WhatsApp redirection.
 */

(function () {
  const SHOP_PHONE = '94722423669'; // +94 72 242 3669

  function initWhatsAppWidget() {
    if (document.getElementById('whatsapp-floating-widget')) return;

    // Inject Styles
    const style = document.createElement('style');
    style.id = 'whatsapp-widget-styles';
    style.textContent = `
      #whatsapp-floating-widget {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999;
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .wa-trigger-btn {
        width: 62px;
        height: 62px;
        border-radius: 50%;
        background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 24px rgba(37, 211, 102, 0.4), 0 2px 8px rgba(0,0,0,0.12);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: none;
        outline: none;
        position: relative;
      }
      .wa-trigger-btn:hover {
        transform: scale(1.08) translateY(-3px);
        box-shadow: 0 12px 30px rgba(37, 211, 102, 0.55);
      }
      .wa-trigger-btn:active {
        transform: scale(0.95);
      }
      .wa-ping-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        background: #ef4444;
        border: 2.5px solid #ffffff;
        border-radius: 50%;
      }
      .wa-pulse-ring {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid #25D366;
        animation: waPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        pointer-events: none;
      }
      @keyframes waPulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        70% { transform: scale(1.3); opacity: 0; }
        100% { transform: scale(1.3); opacity: 0; }
      }
      /* Floating Chat Popup Window */
      .wa-chat-card {
        position: absolute;
        bottom: 76px;
        right: 0;
        width: 330px;
        max-width: calc(100vw - 32px);
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.22), 0 0 1px 1px rgba(0,0,0,0.06);
        overflow: hidden;
        transform-origin: bottom right;
        transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0;
        transform: scale(0.85) translateY(15px);
        pointer-events: none;
        visibility: hidden;
      }
      .wa-chat-card.open {
        opacity: 1;
        transform: scale(1) translateY(0);
        pointer-events: auto;
        visibility: visible;
      }
      .wa-card-header {
        background: linear-gradient(135deg, #128C7E 0%, #075E54 100%);
        padding: 16px 18px;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .wa-header-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #ffffff;
        border: 2px solid #25D366;
        padding: 2px;
        position: relative;
        flex-shrink: 0;
      }
      .wa-header-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
      }
      .wa-online-dot {
        position: absolute;
        bottom: 0px;
        right: 0px;
        width: 11px;
        height: 11px;
        border-radius: 50%;
        background: #22c55e;
        border: 2px solid #ffffff;
      }
      .wa-card-body {
        padding: 18px;
        background: #efeae2;
        background-image: radial-gradient(#d1c7b7 0.75px, transparent 0.75px);
        background-size: 14px 14px;
      }
      .wa-chat-bubble {
        background: #ffffff;
        padding: 12px 14px;
        border-radius: 16px 16px 16px 4px;
        box-shadow: 0 1.5px 3px rgba(0,0,0,0.08);
        font-size: 13px;
        line-height: 1.5;
        color: #1e293b;
        margin-bottom: 14px;
      }
      .wa-chat-meta {
        font-size: 10px;
        color: #94a3b8;
        text-align: right;
        margin-top: 4px;
      }
      .wa-send-btn {
        width: 100%;
        padding: 13px 18px;
        border-radius: 14px;
        background: #25D366;
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.02em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(37, 211, 102, 0.4);
        transition: all 0.2s;
        text-decoration: none;
      }
      .wa-send-btn:hover {
        background: #20bd5a;
        transform: translateY(-1.5px);
        box-shadow: 0 6px 18px rgba(37, 211, 102, 0.5);
      }
      .wa-tooltip {
        position: absolute;
        right: 74px;
        top: 50%;
        transform: translateY(-50%);
        background: #0f172a;
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        padding: 6px 14px;
        border-radius: 12px;
        white-space: nowrap;
        box-shadow: 0 6px 18px rgba(0,0,0,0.18);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s;
      }
      .wa-trigger-btn:hover .wa-tooltip {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    // Determine current page context message
    let autoMessage = "Hello GOGO MART! I would like to inquire about your products and fast delivery.";
    if (window.location.pathname.includes('product-detail.html')) {
      const pTitle = document.title.replace('— GOGO MART', '').replace('Product Details', '').trim();
      autoMessage = `Hello GOGO MART! I am interested in: ${pTitle || 'this item'} (Page: ${window.location.href}). Please assist me.`;
    } else if (window.location.pathname.includes('cart.html') || window.location.pathname.includes('checkout.html')) {
      autoMessage = "Hello GOGO MART! I have a question regarding my order and payment.";
    } else if (window.location.pathname.includes('offers.html')) {
      autoMessage = "Hello GOGO MART! I would like to claim the latest special discount & deals.";
    }

    const waLink = `https://wa.me/${SHOP_PHONE}?text=${encodeURIComponent(autoMessage)}`;

    // Build Floating Widget HTML
    const widgetEl = document.createElement('div');
    widgetEl.id = 'whatsapp-floating-widget';
    widgetEl.innerHTML = `
      <!-- Chat popup card -->
      <div id="wa-chat-window" class="wa-chat-card">
        <div class="wa-card-header">
          <div class="flex items-center gap-3">
            <div class="wa-header-avatar">
              <img src="logo.png" alt="GOGO MART">
              <span class="wa-online-dot"></span>
            </div>
            <div>
              <div class="font-bold text-sm leading-tight">GOGO MART Support</div>
              <div class="text-[10px] text-emerald-200 font-semibold tracking-wide flex items-center gap-1">
                <span>●</span> Online • Typically replies instantly
              </div>
            </div>
          </div>
          <button onclick="toggleWaChat(false)" class="text-white/80 hover:text-white text-lg p-1 transition-colors leading-none">✕</button>
        </div>

        <div class="wa-card-body">
          <div class="wa-chat-bubble">
            <p class="font-bold text-xs text-emerald-800 mb-1">GOGO MART Customer Care</p>
            <p>Hi there! 👋 How can we help you today with your order or delivery inquiries?</p>
            <div class="wa-chat-meta">Just now</div>
          </div>

          <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="wa-send-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.587 1.838.883 2.789.883 3.18 0 5.766-2.587 5.767-5.766.002-3.18-2.584-5.769-5.765-5.769zm3.393 8.354c-.145.405-.737.749-1.025.795-.278.046-.642.067-2.072-.524-1.748-.72-2.855-2.502-2.942-2.617-.087-.116-.708-.941-.708-1.793 0-.853.449-1.272.609-1.446.16-.175.348-.218.464-.218.116 0 .232.001.333.006.107.005.25-.041.391.298.145.349.494 1.205.538 1.293.044.088.073.19.015.305-.059.117-.088.19-.175.292-.087.103-.184.229-.263.308-.088.087-.18.182-.078.358.102.175.452.746.97 1.209.667.595 1.229.779 1.404.867.174.087.276.073.378-.044.102-.116.436-.508.552-.682.116-.175.233-.146.392-.087.16.058 1.017.48 1.192.568.174.087.291.131.334.204.043.073.043.421-.102.826z"/>
            </svg>
            <span>Start WhatsApp Chat</span>
          </a>
        </div>
      </div>

      <!-- Floating Trigger Button -->
      <button class="wa-trigger-btn" onclick="toggleWaChat()" aria-label="Chat on WhatsApp">
        <span class="wa-pulse-ring"></span>
        <span class="wa-ping-badge"></span>
        <span class="wa-tooltip">Chat with us on WhatsApp</span>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.969.587 1.838.883 2.789.883 3.18 0 5.766-2.587 5.767-5.766.002-3.18-2.584-5.769-5.765-5.769zm3.393 8.354c-.145.405-.737.749-1.025.795-.278.046-.642.067-2.072-.524-1.748-.72-2.855-2.502-2.942-2.617-.087-.116-.708-.941-.708-1.793 0-.853.449-1.272.609-1.446.16-.175.348-.218.464-.218.116 0 .232.001.333.006.107.005.25-.041.391.298.145.349.494 1.205.538 1.293.044.088.073.19.015.305-.059.117-.088.19-.175.292-.087.103-.184.229-.263.308-.088.087-.18.182-.078.358.102.175.452.746.97 1.209.667.595 1.229.779 1.404.867.174.087.276.073.378-.044.102-.116.436-.508.552-.682.116-.175.233-.146.392-.087.16.058 1.017.48 1.192.568.174.087.291.131.334.204.043.073.043.421-.102.826zM12 2C6.477 2 2 6.477 2 12c0 1.891.526 3.662 1.438 5.176L2 22l4.962-1.399A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
        </svg>
      </button>
    `;

    document.body.appendChild(widgetEl);

    // Global toggle function
    window.toggleWaChat = function (forceState) {
      const card = document.getElementById('wa-chat-window');
      if (!card) return;
      if (typeof forceState === 'boolean') {
        if (forceState) card.classList.add('open');
        else card.classList.remove('open');
      } else {
        card.classList.toggle('open');
      }
    };

    // Close chat popup if clicked outside
    document.addEventListener('click', function (e) {
      const widget = document.getElementById('whatsapp-floating-widget');
      if (widget && !widget.contains(e.target)) {
        window.toggleWaChat(false);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppWidget);
  } else {
    initWhatsAppWidget();
  }
})();

