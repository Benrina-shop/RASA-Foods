// Personal product reactions and wishlist. Stored on this browser, not public counts.
(function () {
  'use strict';
  const prefix = 'gogo-product-preference:v1:';
  const reactions = { like: ['👍', 'Like'], love: ['❤️', 'Love'], wow: ['🤩', 'Wow'] };

  function productId(id) {
    const value = String(id == null ? '' : id);
    return /^[a-zA-Z0-9_-]+$/.test(value) ? value : '';
  }

  function read(id) {
    try {
      const data = JSON.parse(localStorage.getItem(prefix + productId(id)) || '{}');
      return { reaction: Object.hasOwn(reactions, data?.reaction) ? data.reaction : null, saved: data?.saved === true };
    } catch (_) {
      return { reaction: null, saved: false };
    }
  }

  function savedIds() {
    try {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length))
        .filter(id => productId(id) && read(id).saved);
    } catch (_) { return []; }
  }

  function render(product) {
    const id = productId(product.id);
    if (!id) return '';
    const state = read(id);
    return `<div class="product-engagement" data-engagement-id="${id}" role="group" aria-label="Product reactions and wishlist">
      <span class="engagement-label">Your reaction</span>
      <div class="reaction-options" role="group" aria-label="Choose one reaction">
        ${Object.entries(reactions).map(([key, [emoji, label]]) => `<button type="button" data-product-reaction="${key}" aria-pressed="${state.reaction === key}" title="${state.reaction === key ? 'Remove' : 'React with'} ${label}"><span aria-hidden="true">${emoji}</span> ${label}</button>`).join('')}
      </div>
      <button type="button" class="wishlist-toggle" data-product-wishlist aria-pressed="${state.saved}"><span aria-hidden="true">${state.saved ? '🔖' : '🤍'}</span> ${state.saved ? 'Saved to Wishlist' : 'Add to Wishlist'}</button>
    </div>`;
  }

  function announce(message) {
    let status = document.getElementById('engagement-status');
    if (!status) {
      status = document.createElement('div');
      status.id = 'engagement-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      document.body.appendChild(status);
    }
    status.textContent = message;
    status.hidden = false;
    clearTimeout(announce.timer);
    announce.timer = setTimeout(() => { status.hidden = true; }, 3500);
  }

  function refresh() {
    document.querySelectorAll('[data-engagement-id]').forEach(widget => {
      const state = read(widget.dataset.engagementId);
      widget.querySelectorAll('[data-product-reaction]').forEach(button => {
        const key = button.dataset.productReaction;
        button.setAttribute('aria-pressed', String(state.reaction === key));
        button.title = `${state.reaction === key ? 'Remove' : 'React with'} ${reactions[key][1]}`;
      });
      const button = widget.querySelector('[data-product-wishlist]');
      button.setAttribute('aria-pressed', String(state.saved));
      button.innerHTML = `<span aria-hidden="true">${state.saved ? '🔖' : '🤍'}</span> ${state.saved ? 'Saved to Wishlist' : 'Add to Wishlist'}`;
    });
    const count = savedIds().length;
    document.querySelectorAll('[data-wishlist-count]').forEach(el => { el.textContent = String(count); });
  }

  // Capture before card onclick handlers so reacting never opens the product or buys it.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-product-reaction], [data-product-wishlist]');
    if (!button) return;
    const widget = button.closest('[data-engagement-id]');
    if (!widget) return;
    event.preventDefault();
    event.stopPropagation();
    const id = productId(widget.dataset.engagementId);
    if (!id) return;
    const state = read(id);
    const isWishlist = button.hasAttribute('data-product-wishlist');
    if (isWishlist) state.saved = !state.saved;
    else {
      const reaction = button.dataset.productReaction;
      if (!Object.hasOwn(reactions, reaction)) return;
      state.reaction = state.reaction === reaction ? null : reaction;
    }
    try {
      if (!state.saved && !state.reaction) localStorage.removeItem(prefix + id);
      else localStorage.setItem(prefix + id, JSON.stringify(state));
    } catch (_) {
      announce('Unable to save your choice. Please allow browser storage and try again.');
      return;
    }
    refresh();
    window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { id, isWishlist } }));
    announce(isWishlist ? (state.saved ? 'Added to your wishlist.' : 'Removed from your wishlist.') : (state.reaction ? `${reactions[state.reaction][1]} reaction saved.` : 'Reaction removed.'));
  }, true);

  window.addEventListener('storage', event => {
    if (event.key === null || event.key.startsWith(prefix)) {
      refresh();
      window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { isWishlist: true } }));
    }
  });
  window.ProductEngagement = { render, isSaved: id => read(id).saved, savedIds, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})();
