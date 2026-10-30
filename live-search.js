/**
 * live-search.js — GOGO MART Instant Live Search
 * Responsive desktop and mobile header search bar with instant dropdown
 */

var LIVE_SEARCH_PRODUCTS = [];
var liveSearchRefreshTimer = null;

async function initLiveSearchData() {
  if (LIVE_SEARCH_PRODUCTS.length > 0) return;
  try {
    if (typeof getCachedProducts === 'function') LIVE_SEARCH_PRODUCTS = await getCachedProducts();
  } catch (err) {
    console.warn('Live search fetch error:', err);
  }
}

if (typeof onStoreUpdate === 'function') {
  onStoreUpdate(function(event) {
    if (event.type !== 'PRODUCTS_CHANGED' && event.table !== 'products') return;
    clearTimeout(liveSearchRefreshTimer);
    liveSearchRefreshTimer = setTimeout(function() {
      LIVE_SEARCH_PRODUCTS = [];
      initLiveSearchData().then(function() {
        document.querySelectorAll('#nav-search-input, #nav-search-input-mob').forEach(function(input) {
          if (input.value.trim()) handleLiveSearch(input.value, input.id.endsWith('-mob'));
        });
      });
    }, 3000);
  });
}

function handleLiveSearch(query, isMobile) {
  query = (query || '').trim().toLowerCase();
  var suffix = isMobile ? '-mob' : '';
  var dropdown = document.getElementById('live-search-dropdown' + suffix) || document.getElementById('live-search-dropdown');
  var resultsContainer = document.getElementById('live-search-results' + suffix) || document.getElementById('live-search-results');
  var viewAllLink = document.getElementById('view-all-search-link' + suffix) || document.getElementById('view-all-search-link');

  if (!dropdown || !resultsContainer) return;

  if (query.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  // Filter products
  var matches = LIVE_SEARCH_PRODUCTS.filter(function(p) {
    var nameMatch = p.name && p.name.toLowerCase().indexOf(query) !== -1;
    var catMatch = p.category_slug && p.category_slug.toLowerCase().indexOf(query) !== -1;
    return nameMatch || catMatch;
  }).slice(0, 5);

  if (matches.length === 0) {
    resultsContainer.innerHTML = '<div class="p-4 text-center text-slate-400">' +
      '<p class="text-xs font-semibold">No products found for "' + query + '"</p>' +
      '<p class="text-[10px] text-slate-400 mt-0.5">Try another keyword</p>' +
      '</div>';
    if (viewAllLink) viewAllLink.classList.add('hidden');
  } else {
    resultsContainer.innerHTML = matches.map(function(p) {
      var img = p.image_url || 'logo.png';
      var formattedPrice = typeof formatPrice === 'function' ? formatPrice(p.price) : 'Rs. ' + p.price;
      return '<a href="product-detail.html?id=' + p.id + '" class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-blue-50/70 transition-colors group">' +
        '<img src="' + img + '" alt="' + p.name + '" class="w-11 h-11 rounded-lg object-contain border border-slate-200 bg-white shrink-0 group-hover:scale-105 transition-transform">' +
        '<div class="flex-1 min-w-0">' +
        '<p class="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">' + p.name + '</p>' +
        '<p class="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">' + (p.category_slug || '') + '</p>' +
        '</div>' +
        '<div class="text-right shrink-0">' +
        '<span class="text-xs font-black text-blue-600">' + formattedPrice + '</span>' +
        '</div>' +
        '</a>';
    }).join('');

    if (viewAllLink) {
      viewAllLink.classList.remove('hidden');
      viewAllLink.href = 'products.html?q=' + encodeURIComponent(query);
      viewAllLink.textContent = 'View all results for "' + query + '" →';
    }
  }

  dropdown.classList.remove('hidden');
}

function handleNavSearch(e, form) {
  if (e && e.preventDefault) e.preventDefault();
  var input = form ? form.querySelector('input[name="q"]') : (document.getElementById('nav-search-input-mob') || document.getElementById('nav-search-input'));
  var query = input ? input.value.trim() : '';
  if (query) {
    window.location.href = 'products.html?q=' + encodeURIComponent(query);
  } else {
    window.location.href = 'products.html';
  }
  return false;
}

// Close dropdown on outside click
document.addEventListener('click', function(e) {
  var dropdowns = document.querySelectorAll('[id^="live-search-dropdown"]');
  var containers = document.querySelectorAll('[id^="nav-search-container"]');
  var clickedInside = false;

  containers.forEach(function(c) {
    if (c.contains(e.target)) clickedInside = true;
  });

  if (!clickedInside) {
    dropdowns.forEach(function(d) {
      d.classList.add('hidden');
    });
  }
});

// Auto load data on startup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveSearchData);
} else {
  initLiveSearchData();
}
