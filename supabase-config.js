// Supabase Configuration
var SB_URL = 'https://yswekhygaebgvowdrmxk.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2VraHlnYWViZ3Zvd2RybXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk0ODksImV4cCI6MjA5MTE0NTQ4OX0.Ou_il3hORcuIvsmUix4dH73lCy-CVRbAJAntEWM-Z1U';

window.supabaseClient = null;

function getSupabase() {
    if (window.supabaseClient) return window.supabaseClient;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.supabaseClient = window.supabase.createClient(SB_URL, SB_KEY);
        return window.supabaseClient;
    }
    return null;
}

// Global variable for backward compatibility
var supabase = getSupabase();

// Helper to format currency
function formatPrice(amount) {
    if (amount === undefined || amount === null) return 'Rs. 0';
    return 'Rs. ' + Number(amount).toLocaleString();
}

// The browser flag is only a UI hint; Supabase Auth plus RLS authorizes admin access.
var _gogoAdminCheck = null;
function checkAdmin() {
    if (_gogoAdminCheck) return _gogoAdminCheck;
    _gogoAdminCheck = (async function() {
        var sb = getSupabase();
        if (!sb || !sb.auth) {
            window.location.replace('admin-login.html');
            return null;
        }
        var { data: userData, error: userError } = await sb.auth.getUser();
        if (userError || !userData || !userData.user) {
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('adminUser');
            window.location.replace('admin-login.html');
            return null;
        }
        var { data: adminAllowed, error: adminError } = await sb.rpc('is_admin');
        if (adminError || adminAllowed !== true) {
            localStorage.removeItem('isAdmin');
            localStorage.removeItem('adminUser');
            window.location.replace('admin-login.html');
            return null;
        }
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminUser');
        return userData.user;
    })().catch(function(error) {
        console.error('Admin session check failed:', error);
        window.location.replace('admin-login.html');
        return null;
    });
    return _gogoAdminCheck;
}

function requireAdmin() {
    return checkAdmin();
}

async function logoutAdmin() {
    var sb = getSupabase();
    if (sb && sb.auth) await sb.auth.signOut();
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('adminUser');
    window.location.replace('admin-login.html');
}

// ==========================================
// REAL-TIME SYNCHRONIZATION INFRASTRUCTURE
// ==========================================
var _gogoBroadcast = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('gogo_store_sync_channel') : null;

/**
 * Broadcast an update event across all tabs and storage listeners.
 * @param {string} type - e.g. 'CATEGORIES_CHANGED', 'PRODUCTS_CHANGED'
 * @param {object} payload - Optional extra details
 */
function notifyStoreUpdate(type, payload) {
    var eventData = { type: type, payload: payload || {}, timestamp: Date.now() };
    invalidateStoreCacheForEvent(eventData);
    if (_gogoBroadcast) {
        try { _gogoBroadcast.postMessage(eventData); } catch(e){}
    }
    try {
        localStorage.setItem('gogo_store_sync_event', JSON.stringify(eventData));
    } catch(e){}
}

/**
 * Subscribe to store update events across open tabs and windows.
 * @param {function} callback - Called with eventData
 */
function onStoreUpdate(callback) {
    if (typeof callback !== 'function') return;
    if (_gogoBroadcast) {
        _gogoBroadcast.addEventListener('message', function(e) {
            if (e && e.data) {
                invalidateStoreCacheForEvent(e.data);
                callback(e.data);
            }
        });
    }
    window.addEventListener('storage', function(e) {
        if (e.key === 'gogo_store_sync_event' && e.newValue) {
            try {
                var data = JSON.parse(e.newValue);
                invalidateStoreCacheForEvent(data);
                callback(data);
            } catch(err){}
        }
    });
}

/**
 * Listen to Supabase Postgres Realtime changes over WebSocket
 * @param {object} sb - Supabase client
 * @param {string[]} tables - e.g. ['categories', 'products']
 * @param {function} callback - Called on any change
 */
function subscribeToSupabaseRealtime(sb, tables, callback) {
    if (!sb || typeof sb.channel !== 'function') return null;
    try {
        var chanName = 'gogo-rt-' + Math.random().toString(36).substring(7);
        var ch = sb.channel(chanName);
        tables.forEach(function(tbl) {
            // Storefronts only need the change notification to reload their data;
            // never send large description/images/video columns over Realtime.
            var realtimeConfig = { event: '*', schema: 'public', table: tbl };
            if (tbl === 'products' || tbl === 'categories') realtimeConfig.select = ['id'];
            ch = ch.on('postgres_changes', realtimeConfig, function(payload) {
                var eventData = { source: 'supabase', table: tbl, payload: payload, timestamp: Date.now() };
                invalidateStoreCacheForEvent(eventData);
                callback(eventData);
            });
        });
        ch.subscribe(function(status) {
            if (status === 'SUBSCRIBED') {
                console.log('[GOGO Realtime] Uplink established for: ' + tables.join(', '));
            }
        });
        return ch;
    } catch(e) {
        console.warn('Supabase realtime init error:', e);
        return null;
    }
}

var GOGO_SESSION_CACHE_TTL = 5 * 60 * 1000;
var GOGO_PRODUCTS_CACHE_KEY = 'gogo-products-list:v1';
var GOGO_CATEGORIES_CACHE_KEY = 'gogo-store-categories:v1';
var _gogoProductsRequest = null;
var _gogoCategoriesRequest = null;
var _gogoProductsCacheVersion = 0;
var _gogoCategoriesCacheVersion = 0;

function readGogoSessionCache(key) {
    try {
        var cached = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (cached && Number.isFinite(cached.t) && Date.now() - cached.t < GOGO_SESSION_CACHE_TTL) return cached.data;
        if (cached) sessionStorage.removeItem(key);
    } catch (_) {}
    return null;
}

function writeGogoSessionCache(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), data: data })); } catch (_) {}
}

function invalidateCachedProducts() {
    _gogoProductsCacheVersion++;
    _gogoProductsRequest = null;
    try { sessionStorage.removeItem(GOGO_PRODUCTS_CACHE_KEY); } catch (_) {}
}

function invalidateCachedCategories() {
    _gogoCategoriesCacheVersion++;
    _gogoCategoriesRequest = null;
    try { sessionStorage.removeItem(GOGO_CATEGORIES_CACHE_KEY); } catch (_) {}
}

function invalidateStoreCacheForEvent(eventData) {
    if (!eventData) return;
    var table = eventData.table;
    var type = eventData.type;
    if (table === 'products' || type === 'PRODUCTS_CHANGED') invalidateCachedProducts();
    if (table === 'categories' || type === 'CATEGORIES_CHANGED') invalidateCachedCategories();
}

async function getCachedProducts() {
    var cached = readGogoSessionCache(GOGO_PRODUCTS_CACHE_KEY);
    if (cached) return cached;
    if (_gogoProductsRequest) return _gogoProductsRequest;
    var sb = getSupabase();
    if (!sb) throw new Error('Store connection unavailable');
    var version = _gogoProductsCacheVersion;
    var request = (async function() {
        var result = await sb.from('products')
            .select('id,name,price,old_price,category_slug,image_url,stock,created_at,images,badge,is_new');
        if (result.error) throw result.error;
        var rows = result.data || [];
        if (version === _gogoProductsCacheVersion) writeGogoSessionCache(GOGO_PRODUCTS_CACHE_KEY, rows);
        return rows;
    })();
    _gogoProductsRequest = request;
    try { return await request; }
    finally { if (_gogoProductsRequest === request) _gogoProductsRequest = null; }
}

// Category rows are authoritative; legacy popular metadata cannot resurrect deleted rows.
async function loadStoreCategories() {
    var cached = readGogoSessionCache(GOGO_CATEGORIES_CACHE_KEY);
    if (cached) return cached;
    if (_gogoCategoriesRequest) return _gogoCategoriesRequest;
    const sb = getSupabase();
    if (!sb) throw new Error('Store connection unavailable');
    var version = _gogoCategoriesCacheVersion;
    var request = (async function() {
        const { data, error } = await sb.from('categories').select('id,name,slug,image_url').order('name');
        if (error) throw error;
        let metadata = [];
        try {
            const row = (data || []).find(c => c.slug === 'system_popular_categories');
            metadata = row ? JSON.parse(row.image_url || '[]') : [];
        } catch (_) {}
        if (!Array.isArray(metadata)) metadata = [];
        var categories = (data || []).filter(c => c.name && c.slug && !/^system_/i.test(c.slug)).map(c => {
            const extra = metadata.find(m => m.slug === c.slug) || {};
            const popularImage = extra.image_url && extra.image_url !== 'logo.png' ? extra.image_url : '';
            const categoryImage = c.image_url && c.image_url !== 'logo.png' ? c.image_url : '';
            return { ...c, subtitle: extra.subtitle || '', image_url: popularImage || categoryImage || extra.image_url || c.image_url || 'logo.png' };
        });
        if (version === _gogoCategoriesCacheVersion) writeGogoSessionCache(GOGO_CATEGORIES_CACHE_KEY, categories);
        return categories;
    })();
    _gogoCategoriesRequest = request;
    try { return await request; }
    finally { if (_gogoCategoriesRequest === request) _gogoCategoriesRequest = null; }
}
async function checkedStoreWrite(query) {
    const { data, error } = await query.select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('No records changed. Check your access and refresh before retrying.');
    return data;
}

// Use the first saved product image as the category-card image when no
// administrator-selected category image exists yet.
async function syncCategoryImageFromProduct(sb, slug, imageUrl) {
    if (!sb || !slug || !imageUrl || !/^https?:\/\//i.test(imageUrl)) return false;

    const { data: category, error: categoryError } = await sb.from('categories')
        .select('id, name, slug, image_url').eq('slug', slug).single();
    if (categoryError) throw categoryError;
    if (!category || (category.image_url && category.image_url !== 'logo.png')) return false;

    const { data: systemRow, error: systemError } = await sb.from('categories')
        .select('id, image_url').eq('slug', 'system_popular_categories').single();
    if (systemError && systemError.code !== 'PGRST116') throw systemError;

    let popular = [];
    try { popular = JSON.parse(systemRow?.image_url || '[]'); } catch (_) {}
    if (!Array.isArray(popular)) popular = [];
    const entry = popular.find(item => item.slug === slug);
    if (entry?.image_url && entry.image_url !== 'logo.png') return false;

    await checkedStoreWrite(sb.from('categories').update({ image_url: imageUrl }).eq('id', category.id));
    if (entry) entry.image_url = imageUrl;
    else popular.push({ name: category.name, slug, subtitle: '', image_url: imageUrl });

    const payload = {
        name: 'SYSTEM_POPULAR_CATEGORIES',
        slug: 'system_popular_categories',
        image_url: JSON.stringify(popular)
    };
    if (systemRow) await checkedStoreWrite(sb.from('categories').update(payload).eq('id', systemRow.id));
    else await checkedStoreWrite(sb.from('categories').insert(payload));
    try { localStorage.setItem('gogo-popular-categories', JSON.stringify(popular)); } catch (_) {}
    return true;
}
