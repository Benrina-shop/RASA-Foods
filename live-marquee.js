/**
 * live-marquee.js — GOGO MART Real-time News Marquee Ticker
 * Displays smooth scrolling announcement bar at the very top of storefront pages
 */

(function () {
  const DEFAULT_NEWS = [
    { id: 1, text: '🔥 Special Flash Offer: Islandwide fast delivery for just Rs. 399 on all orders!', badge: 'HOT DEAL', active: true },
    { id: 2, text: '🎉 Welcome to GOGO MART! Enjoy fresh artisanal treats, organic essentials & premium chocolates delivered to your door.', badge: 'ANNOUNCEMENT', active: true },
    { id: 3, text: '⚡ Same Day Dispatch: Place your order before 2:00 PM for rapid priority delivery!', badge: 'DELIVERY INFO', active: true }
  ];

  let newsItems = [];

  async function initLiveMarquee() {
    // 1. Fetch from Supabase
    try {
      const sb = typeof getSupabase === 'function' ? getSupabase() : null;
      if (sb) {
        const { data } = await sb.from('categories').select('*').eq('slug', 'system_marquee_news').single();
        if (data && data.image_url) {
          try {
            const parsed = JSON.parse(data.image_url);
            if (Array.isArray(parsed) && parsed.length > 0) {
              newsItems = parsed.filter(item => item.active !== false);
              renderMarqueeBar();
              return;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('Marquee DB fetch bypass');
    }

    // 2. Fetch from localStorage
    const local = JSON.parse(localStorage.getItem('gogo-marquee-news') || 'null');
    if (local && Array.isArray(local) && local.length > 0) {
      newsItems = local.filter(item => item.active !== false);
    } else {
      newsItems = DEFAULT_NEWS;
      localStorage.setItem('gogo-marquee-news', JSON.stringify(newsItems));
    }

    renderMarqueeBar();
  }

  function renderMarqueeBar() {
    if (!newsItems || newsItems.length === 0) return;

    // Inject CSS styles for Marquee
    if (!document.getElementById('live-marquee-style')) {
      const style = document.createElement('style');
      style.id = 'live-marquee-style';
      style.textContent = `
        #top-marquee-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 38px;
          z-index: 1000;
          background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 35%, #ec4899 75%, #f59e0b 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.15);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .marquee-label-badge {
          flex-shrink: 0;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 16px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-right: 1px solid rgba(255,255,255,0.15);
          z-index: 2;
        }
        .marquee-track-container {
          flex: 1;
          overflow: hidden;
          position: relative;
          white-space: nowrap;
          height: 100%;
          display: flex;
          align-items: center;
        }
        .marquee-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: marqueeScroll 35s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        .marquee-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 28px;
          font-size: 12px;
          font-weight: 600;
          color: #ffffff;
        }
        .marquee-tag {
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.22);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .marquee-separator {
          opacity: 0.5;
          font-size: 14px;
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        /* Offset navbar and body to avoid overlapping */
        #navbar {
          top: 38px !important;
        }
        .sidebar {
          top: 38px !important;
          height: calc(100vh - 38px) !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Build ticker HTML
    const contentHtml = newsItems.map(item => `
      <span class="marquee-item">
        ${item.badge ? `<span class="marquee-tag">${item.badge}</span>` : ''}
        <span>${item.text}</span>
        <span class="marquee-separator">✦</span>
      </span>
    `).join('');

    // Duplicate content twice for seamless infinite scrolling loop
    const fullHtml = `
      <div id="top-marquee-bar">
        <div class="marquee-label-badge">
          <span class="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
          <span>LIVE UPDATES</span>
        </div>
        <div class="marquee-track-container">
          <div class="marquee-track">
            ${contentHtml}
            ${contentHtml}
          </div>
        </div>
      </div>
    `;

    const existingBar = document.getElementById('top-marquee-bar');
    if (existingBar) existingBar.remove();

    document.body.insertAdjacentHTML('afterbegin', fullHtml);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLiveMarquee);
  } else {
    initLiveMarquee();
  }
})();
