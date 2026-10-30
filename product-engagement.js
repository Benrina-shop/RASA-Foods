// Shared reaction totals from Supabase; wishlist stays in this browser.
(function () {
  'use strict';
  const prefix = 'gogo-product-preference:v1:';
  const reactions = { like: ['👍', 'Like'], love: ['❤️', 'Love'], wow: ['🤩', 'Wow'] };
  const visitorKey = 'gogo-reaction-visitor:v1';
  const changedKey = 'gogo-reactions-changed:v1';
  const totals = new Map();
  const pending = new Set();
  let requestVersion = 0;
  let loadTimer;
  let pickerNumber = 0;
  const countFetchTimes = new Map();
  const COUNT_REFRESH_TTL = 60000;

  function countText(value) {
    return new Intl.NumberFormat('en', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
  }

  function closePickers(except = null, restoreFocus = false) {
    document.querySelectorAll('[data-reaction-trigger][aria-expanded="true"]').forEach(trigger => {
      const widget = trigger.closest('[data-engagement-id]');
      if (widget === except) return;
      trigger.setAttribute('aria-expanded', 'false');
      widget.querySelector('.reaction-options').hidden = true;
      if (restoreFocus) trigger.focus();
    });
  }

  function togglePicker(widget) {
    const trigger = widget.querySelector('[data-reaction-trigger]');
    const open = trigger.getAttribute('aria-expanded') !== 'true';
    closePickers();
    trigger.setAttribute('aria-expanded', String(open));
    widget.querySelector('.reaction-options').hidden = !open;
    if (open) widget.querySelector('[data-product-reaction]:not(:disabled)')?.focus();
  }

  function visitorToken(create = false) {
    try {
      let token = localStorage.getItem(visitorKey);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token || '')) {
        if (!create) return null;
        token = crypto.randomUUID();
        localStorage.setItem(visitorKey, token);
      }
      return token;
    } catch (_) {
      if (create) throw new Error('Please allow browser storage to react.');
      return null;
    }
  }

  async function rpc(name, args) {
    const client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!client) throw new Error('Reaction service unavailable.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const { data, error } = await client.rpc(name, args).abortSignal(controller.signal);
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error('Invalid reaction response.');
      return data;
    } finally { clearTimeout(timeout); }
  }

  function accept(row) {
    const id = productId(row.product_id);
    const counts = [row.like_count, row.love_count, row.wow_count].map(Number);
    if (!id || counts.some(n => !Number.isSafeInteger(n) || n < 0) || (row.my_reaction !== null && !Object.hasOwn(reactions, row.my_reaction))) {
      throw new Error('Invalid reaction totals.');
    }
    totals.set(id, { like: counts[0], love: counts[1], wow: counts[2], mine: row.my_reaction, ready: true, failed: false });
  }

  function scheduleCounts(force = false) {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => loadCounts(force), 60);
  }

  async function loadCounts(force = false) {
    const ids = [...new Set([...document.querySelectorAll('[data-engagement-id]')].map(el => el.dataset.engagementId))];
    if (!ids.length || document.hidden) return;
    const now = Date.now();
    const idsToFetch = force ? ids : ids.filter(id => now - (countFetchTimes.get(id) || 0) >= COUNT_REFRESH_TTL);
    if (!idsToFetch.length) return;
    const version = ++requestVersion;
    const token = visitorToken();
    for (let start = 0; start < idsToFetch.length; start += 100) {
      const batch = idsToFetch.slice(start, start + 100);
      try {
        const rows = await rpc('get_product_reactions', { p_product_ids: batch, p_visitor_token: token });
        if (version !== requestVersion || token !== visitorToken()) return;
        const returned = new Set(rows.map(row => String(row.product_id)));
        if (batch.some(id => !returned.has(id))) throw new Error('Product no longer available.');
        rows.forEach(row => {
          const id = String(row.product_id);
          if (!pending.has(id)) accept(row);
          countFetchTimes.set(id, Date.now());
        });
      } catch (error) {
        if (version !== requestVersion) return;
        batch.forEach(id => { if (!pending.has(id)) totals.set(id, { ...totals.get(id), failed: true, localOnly: error.code === 'PGRST202' }); });
      }
      refresh();
    }
  }

  async function saveReaction(id, reaction) {
    let current = totals.get(id);
    if (pending.has(id)) return;
    if (current?.localOnly) { saveLocalReaction(id, reaction); return; }
    if (!current?.ready || current.failed) {
      pending.add(id);
      ++requestVersion;
      refresh();
      try {
        const rows = await rpc('get_product_reactions', { p_product_ids: [id], p_visitor_token: visitorToken() });
        const row = rows.find(item => String(item.product_id) === id);
        if (!row) throw new Error('Product unavailable');
        accept(row);
        current = totals.get(id);
      } catch (error) {
        totals.set(id, { ...current, failed: true, localOnly: error.code === 'PGRST202' });
        if (error.code === 'PGRST202') saveLocalReaction(id, reaction);
        else announce('Reactions are temporarily unavailable. Please try again.');
        return;
      } finally { pending.delete(id); refresh(); }
    }
    const next = current.mine === reaction ? null : reaction;
    pending.add(id);
    ++requestVersion; // Ignore any older read response arriving during this write.
    refresh();
    try {
      const token = visitorToken(true);
      const rows = await rpc('set_product_reaction', { p_product_id: id, p_reaction: next, p_visitor_token: token });
      const row = rows.find(item => String(item.product_id) === id);
      if (!row) throw new Error('Missing reaction result.');
      ++requestVersion;
      if (token !== visitorToken()) { totals.delete(id); scheduleCounts(true); return; }
      accept(row);
      try { localStorage.setItem(changedKey, crypto.randomUUID()); } catch (_) { /* Saved on the server already. */ }
      announce(next ? `${reactions[next][1]} reaction saved.` : 'Reaction removed.');
    } catch (error) {
      announce(error.message === 'Please allow browser storage to react.' ? error.message : 'Unable to confirm your reaction. Please try again.');
      // A timed-out request may have committed. Read the server before another edit.
      totals.set(id, { ...current, failed: true });
      scheduleCounts(true);
    } finally {
      pending.delete(id);
      refresh();
    }
  }

  function saveLocalReaction(id, reaction) {
    const state = read(id);
    state.reaction = state.reaction === reaction ? null : reaction;
    try {
      if (!state.saved && !state.reaction) localStorage.removeItem(prefix + id);
      else localStorage.setItem(prefix + id, JSON.stringify(state));
      refresh();
      announce('Reaction saved in this browser only. Shared counts are unavailable.');
    } catch (_) { announce('Unable to save your choice. Please allow browser storage and try again.'); }
  }

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
    const counts = totals.get(id);
    const pickerId = `reaction-picker-${++pickerNumber}`;
    const mine = counts?.localOnly ? state.reaction : counts?.mine;
    const selected = reactions[mine];
    scheduleCounts();
    return `<div class="product-engagement" data-engagement-id="${id}" role="group" aria-label="Product reactions and wishlist">
      <div class="reaction-summary" role="group" aria-label="Reaction counts">
        ${['love', 'like', 'wow'].map(key => `<span class="reaction-total" data-reaction-total="${key}" title="${reactions[key][1]} reactions"><span aria-hidden="true">${reactions[key][0]}</span> <span data-reaction-count="${key}">${counts?.ready ? countText(counts[key]) : '—'}</span></span>`).join('<span class="reaction-dot" aria-hidden="true">·</span>')}
      </div>
      <div class="reaction-actions">
        <button type="button" class="reaction-trigger" data-reaction-trigger aria-label="React to product" aria-expanded="false" aria-controls="${pickerId}"><span aria-hidden="true">${selected ? selected[0] : '👍'}</span> ${selected ? selected[1] : 'React'}</button>
        <button type="button" class="wishlist-toggle" data-product-wishlist aria-label="${state.saved ? 'Saved to Wishlist' : 'Add to Wishlist'}" title="${state.saved ? 'Saved to Wishlist' : 'Add to Wishlist'}" aria-pressed="${state.saved}"><span aria-hidden="true">${state.saved ? '🔖' : '🤍'}</span></button>
      </div>
      <div id="${pickerId}" class="reaction-options" role="group" aria-label="Choose one reaction" hidden>
        ${Object.entries(reactions).map(([key, [emoji, label]]) => `<button type="button" data-product-reaction="${key}" aria-label="${label}" aria-pressed="${mine === key}" ${pending.has(id) ? 'disabled' : ''} title="${label}"><span aria-hidden="true">${emoji}</span> ${label}</button>`).join('')}
      </div>
      <span class="reaction-sync-note" ${counts?.ready && !counts.failed ? 'hidden' : ''}>${counts?.ready ? '' : 'Loading reactions…'}</span>
      <button type="button" class="reaction-retry" data-reaction-retry ${counts?.failed ? '' : 'hidden'}>Retry counts</button>
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
      const id = widget.dataset.engagementId;
      const state = read(id);
      const counts = totals.get(id);
      const mine = counts?.localOnly ? state.reaction : counts?.mine;
      widget.setAttribute('aria-busy', String(pending.has(id)));
      widget.querySelectorAll('[data-product-reaction]').forEach(button => {
        const key = button.dataset.productReaction;
        button.setAttribute('aria-pressed', String(mine === key));
        button.disabled = pending.has(id);
        button.title = `${mine === key ? 'Remove' : 'React with'} ${reactions[key][1]}`;
        const count = widget.querySelector(`[data-reaction-count="${key}"]`);
        count.textContent = counts?.ready ? countText(counts[key]) : '—';
        const total = count.closest('[data-reaction-total]');
        const label = `${reactions[key][1]}: ${counts?.ready ? counts[key].toLocaleString('en-US') : 'unavailable'}`;
        total.setAttribute('aria-label', label);
        total.title = label;
      });
      const selected = reactions[mine];
      const trigger = widget.querySelector('[data-reaction-trigger]');
      trigger.innerHTML = `<span aria-hidden="true">${selected ? selected[0] : '👍'}</span> ${selected ? selected[1] : 'React'}`;
      trigger.classList.toggle('has-reaction', Boolean(selected));
      trigger.disabled = false;
      const note = widget.querySelector('.reaction-sync-note');
      note.hidden = Boolean(counts?.ready && !counts.failed && !pending.has(id));
      note.textContent = pending.has(id) ? 'Saving reaction…' : counts?.localOnly ? 'Reactions saved on this browser only. Shared counts unavailable.' : counts?.failed ? (counts.ready ? 'Counts may be outdated.' : 'Counts unavailable.') : counts?.ready ? '' : 'Loading reactions…';
      widget.querySelector('[data-reaction-retry]').hidden = !counts?.failed;
      const button = widget.querySelector('[data-product-wishlist]');
      button.setAttribute('aria-pressed', String(state.saved));
      button.innerHTML = `<span aria-hidden="true">${state.saved ? '🔖' : '🤍'}</span>`;
      button.setAttribute('aria-label', state.saved ? 'Saved to Wishlist' : 'Add to Wishlist');
      button.title = state.saved ? 'Saved to Wishlist' : 'Add to Wishlist';
    });
    const count = savedIds().length;
    document.querySelectorAll('[data-wishlist-count]').forEach(el => { el.textContent = String(count); });
  }

  // Capture before card onclick handlers so reacting never opens the product or buys it.
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-product-reaction], [data-product-wishlist], [data-reaction-retry], [data-reaction-trigger]');
    if (!button) { closePickers(); return; }
    const widget = button.closest('[data-engagement-id]');
    if (!widget) return;
    event.preventDefault();
    event.stopPropagation();
    const id = productId(widget.dataset.engagementId);
    if (!id) return;
    if (button.hasAttribute('data-reaction-trigger')) { togglePicker(widget); return; }
    if (button.hasAttribute('data-reaction-retry')) { scheduleCounts(true); return; }
    if (button.hasAttribute('data-product-reaction')) {
      const reaction = button.dataset.productReaction;
      closePickers(null, true);
      if (Object.hasOwn(reactions, reaction)) void saveReaction(id, reaction);
      return;
    }
    const state = read(id);
    state.saved = !state.saved;
    try {
      if (!state.saved && !state.reaction) localStorage.removeItem(prefix + id);
      else localStorage.setItem(prefix + id, JSON.stringify(state));
    } catch (_) {
      announce('Unable to save your choice. Please allow browser storage and try again.');
      return;
    }
    refresh();
    window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { id, isWishlist: true } }));
    announce(state.saved ? 'Added to your wishlist.' : 'Removed from your wishlist.');
    if (window.GogoCustomerData?.getUser()) {
      const requestedState = state.saved;
      void window.GogoCustomerData.setWishlist(id, requestedState).catch(() => {
        const latest = read(id);
        latest.saved = !requestedState;
        try {
          if (!latest.saved && !latest.reaction) localStorage.removeItem(prefix + id);
          else localStorage.setItem(prefix + id, JSON.stringify(latest));
        } catch (_) {}
        refresh();
        window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { id, isWishlist: true } }));
        announce('Wishlist was not synced. Please try again.');
      });
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('[data-reaction-trigger][aria-expanded="true"]')) {
      event.preventDefault();
      closePickers(null, true);
    }
  });
  document.addEventListener('focusin', event => {
    closePickers(event.target.closest('[data-engagement-id]'));
  });

  window.addEventListener('storage', event => {
    if (event.key === null || event.key === visitorKey || event.key === changedKey) {
      ++requestVersion;
      if (event.key === null || event.key === visitorKey) totals.clear();
      scheduleCounts(true);
    }
    if (event.key === null || event.key.startsWith(prefix)) {
      refresh();
      window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { isWishlist: true } }));
    }
  });
  window.addEventListener('focus', scheduleCounts);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleCounts(); });
  setInterval(() => { if (!document.hidden) scheduleCounts(); }, 120000);
  window.ProductEngagement = { render, isSaved: id => read(id).saved, savedIds, refresh };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh);
  else refresh();
})();
