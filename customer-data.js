// Account-scoped cart and wishlist storage. Browser storage remains the fast guest cache;
// authenticated customers also get a private copy in Supabase.
(function () {
  'use strict';
  const cartKey = 'rasa-cart';
  const cacheUserKey = 'gogo-customer-cache-user';
  const preferencePrefix = 'gogo-product-preference:v1:';
  const state = { user: null, client: null };
  let writes = Promise.resolve();
  let pendingWrites = 0;

  function localCart() {
    try {
      const value = JSON.parse(localStorage.getItem(cartKey) || '[]');
      return Array.isArray(value) ? value.filter(item => item && item.id != null && Number(item.qty) > 0) : [];
    } catch (_) { return []; }
  }

  function saveLocalCart(cart) {
    const safe = Array.isArray(cart) ? cart : [];
    localStorage.setItem(cartKey, JSON.stringify(safe));
    window.dispatchEvent(new CustomEvent('customer-cart-changed', { detail: { cart: safe } }));
    return safe;
  }

  function localWishlist() {
    try {
      return Object.keys(localStorage).filter(key => key.startsWith(preferencePrefix))
        .filter(key => JSON.parse(localStorage.getItem(key) || '{}').saved === true)
        .map(key => key.slice(preferencePrefix.length));
    } catch (_) { return []; }
  }

  function applyWishlist(ids) {
    const keep = new Set((ids || []).map(String));
    const all = new Set([...localWishlist(), ...Object.keys(localStorage)
      .filter(key => key.startsWith(preferencePrefix)).map(key => key.slice(preferencePrefix.length))]);
    all.forEach(id => {
      const key = preferencePrefix + id;
      let pref = {};
      try { pref = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
      pref.saved = keep.has(id);
      if (!pref.saved && !pref.reaction) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(pref));
    });
    window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { isWishlist: true } }));
    window.ProductEngagement?.refresh();
  }

  async function replaceRemoteCart(cart) {
    if (!state.user) return;
    const rows = cart.map(item => ({ user_id: state.user.id, product_id: item.id, quantity: Number(item.qty) }))
      .filter(row => Number.isSafeInteger(row.quantity) && row.quantity > 0);
    if (rows.length) {
      const { error } = await state.client.from('customer_cart_items').upsert(rows, { onConflict: 'user_id,product_id' });
      if (error) throw error;
    }
    const ids = rows.map(row => row.product_id);
    let query = state.client.from('customer_cart_items').delete().eq('user_id', state.user.id);
    if (ids.length) query = query.not('product_id', 'in', `(${ids.join(',')})`);
    const { error } = await query;
    if (error) throw error;
  }

  async function replaceRemoteWishlist(ids) {
    if (!state.user) return;
    const unique = [...new Set(ids.map(String))];
    if (unique.length) {
      const rows = unique.map(id => ({ user_id: state.user.id, product_id: id }));
      const { error } = await state.client.from('customer_wishlist_items').upsert(rows, { onConflict: 'user_id,product_id', ignoreDuplicates: true });
      if (error) throw error;
    }
    let query = state.client.from('customer_wishlist_items').delete().eq('user_id', state.user.id);
    if (unique.length) query = query.not('product_id', 'in', `(${unique.join(',')})`);
    const { error } = await query;
    if (error) throw error;
  }

  function enqueue(work) {
    pendingWrites++;
    const job = writes.then(work);
    writes = job.catch(error => {
      console.error('Customer data sync failed:', error);
      announce('Your account data could not sync. Please check your connection and retry.');
    }).finally(() => { pendingWrites--; });
    return job;
  }

  async function hydrate(user) {
    if (!user || !state.client) return;
    state.user = user;
    const [cartResult, wishlistResult] = await Promise.all([
      state.client.from('customer_cart_items').select('product_id,quantity').eq('user_id', user.id),
      state.client.from('customer_wishlist_items').select('product_id').eq('user_id', user.id)
    ]);
    if (cartResult.error) throw cartResult.error;
    if (wishlistResult.error) throw wishlistResult.error;

    const cacheOwner = localStorage.getItem(cacheUserKey);
    const guestCart = !cacheOwner ? localCart() : [];
    const accountCart = (cartResult.data || []).map(row => ({ id: row.product_id, qty: Number(row.quantity) }));
    guestCart.forEach(guest => {
      const saved = accountCart.find(item => String(item.id) === String(guest.id));
      if (saved) saved.qty += Number(guest.qty) || 0;
      else accountCart.push(guest);
    });
    const productIds = [...new Set(accountCart.map(item => String(item.id)))];
    let products = [];
    if (productIds.length) {
      const result = await state.client.from('products').select('*').in('id', productIds);
      if (result.error) throw result.error;
      products = result.data || [];
    }
    const fullCart = accountCart.map(item => ({ ...products.find(p => String(p.id) === String(item.id)), ...item }));
    saveLocalCart(fullCart);

    const savedIds = (wishlistResult.data || []).map(row => String(row.product_id));
    const mergedWishlist = [...new Set([...savedIds, ...(!cacheOwner ? localWishlist() : [])])];
    localStorage.setItem(cacheUserKey, user.id);
    applyWishlist(mergedWishlist);
    await Promise.all([replaceRemoteCart(fullCart), replaceRemoteWishlist(mergedWishlist)]);
    window.dispatchEvent(new CustomEvent('customer-data-ready', { detail: { user } }));
    updateAccountLinks(user);
  }

  function announce(message) {
    let el = document.getElementById('customer-sync-status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'customer-sync-status';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;z-index:99999;bottom:16px;left:16px;right:16px;max-width:520px;margin:auto;padding:12px 16px;background:#b91c1c;color:white;border-radius:12px;font:600 14px sans-serif;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = message;
    setTimeout(() => el.remove(), 5000);
  }

  function updateAccountLinks(user) {
    document.querySelectorAll('a[href="sign-in.html"], a[href="sign-up.html"]').forEach(link => {
      if (!user) return;
      link.href = 'account.html';
      link.textContent = 'My Account';
    });
  }

  async function clearAccountCache() {
    state.user = null;
    localStorage.removeItem(cartKey);
    localStorage.removeItem(cacheUserKey);
    Object.keys(localStorage).filter(key => key.startsWith(preferencePrefix)).forEach(key => {
      let pref = {};
      try { pref = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
      pref.saved = false;
      if (!pref.reaction) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(pref));
    });
    window.dispatchEvent(new CustomEvent('customer-cart-changed', { detail: { cart: [] } }));
    window.dispatchEvent(new CustomEvent('product-preferences-changed', { detail: { isWishlist: true } }));
  }

  const ready = (async () => {
    state.client = typeof getSupabase === 'function' ? getSupabase() : null;
    if (!state.client) return null;
    const { data, error } = await state.client.auth.getSession();
    if (error) throw error;
    if (data.session?.user) await hydrate(data.session.user);
    state.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) setTimeout(() => hydrate(session.user).catch(err => { console.error(err); announce('Could not load your saved account data.'); }), 0);
      if (event === 'SIGNED_OUT') void clearAccountCache();
    });
    return state.user;
  })().catch(error => { console.error('Customer account data initialization failed:', error); return null; });

  window.GogoCustomerData = {
    ready,
    getUser: () => state.user,
    saveCart(cart) {
      const safe = saveLocalCart(cart);
      if (state.user) {
        localStorage.setItem(cacheUserKey, state.user.id);
        void enqueue(() => replaceRemoteCart(safe));
      }
      return safe;
    },
    async flush() { await writes; },
    async setWishlist(productId, saved) {
      if (state.user) {
        localStorage.setItem(cacheUserKey, state.user.id);
        const ids = new Set(localWishlist());
        if (saved) ids.add(String(productId)); else ids.delete(String(productId));
        await enqueue(() => replaceRemoteWishlist([...ids]));
      }
    },
    async signOut() {
      if (!state.client) throw new Error('Account service unavailable.');
      await writes;
      const { error } = await state.client.auth.signOut();
      if (error) throw error;
      await clearAccountCache();
      location.href = 'index.html';
    }
  };

  // Wait for account data writes before same-tab navigation can unload their requests.
  document.addEventListener('click', event => {
    if (!pendingWrites || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    let destination;
    try { destination = new URL(link.href, location.href); } catch (_) { return; }
    if (destination.origin !== location.origin || destination.href === location.href) return;
    event.preventDefault();
    const href = destination.href;
    void writes.finally(() => location.assign(href));
  }, true);
})();
