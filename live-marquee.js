/**
 * live-marquee.js — GOGO MART Real-time News Marquee Ticker
 * Clean, lightweight announcement bar
 */

(function () {
  const DEFAULT_NEWS = [
    { id: 1, text: '🔥 Special Flash Offer: Islandwide fast delivery for just Rs. 399 on all orders!', badge: 'HOT DEAL', active: true },
    { id: 2, text: '🎉 Welcome to GOGO MART! Enjoy fresh artisanal treats, organic essentials & premium chocolates delivered to your door.', badge: 'ANNOUNCEMENT', active: true },
    { id: 3, text: '⚡ Same Day Dispatch: Place your order before 2:00 PM for rapid priority delivery!', badge: 'DELIVERY INFO', active: true }
  ];

  let newsItems = [];

  async function initLiveMarquee() {
    try {
      const sb = typeof getSupabase === 'function' ? getSupabase() : null;
      if (sb) {
        const { data } = await sb.from('categories').select('image_url').eq('slug', 'system_marquee_news').single();
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

    if (!document.getElementById('live-marquee-style')) {
      const style = document.createElement('style');
      style.id = 'live-marquee-style';
      style.textContent = `
        #top-marquee-bar {
          position: relative;
          width: 100%;
          height: 34px;
          background: linear-gradient(90deg, #1e3a8a 0%, #2563eb 35%, #ec4899 75%, #f59e0b 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          overflow: hidden;
          font-family: 'Plus Jakarta Sans', sans-serif;
          z-index: 50;
        }
        .marquee-label-badge {
          flex-shrink: 0;
          height: 100%;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 0 12px;
          background: rgba(15, 23, 42, 0.9);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.08em;
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
          gap: 6px;
          padding: 0 20px;
          font-size: 11px;
          font-weight: 600;
          color: #ffffff;
        }
        .marquee-tag {
          padding: 1px 6px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.25);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .marquee-separator {
          opacity: 0.4;
          font-size: 12px;
        }
        @keyframes marqueeScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `;
      document.head.appendChild(style);
    }

    const contentHtml = newsItems.map(item => `
      <span class="marquee-item">
        ${item.badge ? `<span class="marquee-tag">${item.badge}</span>` : ''}
        <span>${item.text}</span>
        <span class="marquee-separator">✦</span>
      </span>
    `).join('');

    const fullHtml = `
      <div id="top-marquee-bar">
        <div class="marquee-label-badge">
          <span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
          <span>LIVE</span>
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
