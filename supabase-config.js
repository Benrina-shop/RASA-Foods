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

// Check if admin is logged in
function checkAdmin() {
    if (!localStorage.getItem('isAdmin')) {
        window.location.href = 'admin-login.html';
    }
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
            if (e && e.data) callback(e.data);
        });
    }
    window.addEventListener('storage', function(e) {
        if (e.key === 'gogo_store_sync_event' && e.newValue) {
            try {
                var data = JSON.parse(e.newValue);
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
            ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: tbl }, function(payload) {
                callback({ source: 'supabase', table: tbl, payload: payload, timestamp: Date.now() });
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

// Category rows are authoritative; legacy popular metadata cannot resurrect deleted rows.
async function loadStoreCategories() {
    const sb = getSupabase();
    if (!sb) throw new Error('Store connection unavailable');
    const { data, error } = await sb.from('categories').select('*').order('name');
    if (error) throw error;
    let metadata = [];
    try {
        const row = (data || []).find(c => c.slug === 'system_popular_categories');
        metadata = row ? JSON.parse(row.image_url || '[]') : [];
    } catch (_) {}
    if (!Array.isArray(metadata)) metadata = [];
    return (data || []).filter(c => c.name && c.slug && !/^system_/i.test(c.slug)).map(c => {
        const extra = metadata.find(m => m.slug === c.slug) || {};
        return { ...c, subtitle: extra.subtitle || '', image_url: c.image_url || extra.image_url || 'logo.png' };
    });
}
async function checkedStoreWrite(query) {
    const { data, error } = await query.select();
    if (error) throw error;
    if (!data || !data.length) throw new Error('No records changed. Check your access and refresh before retrying.');
    return data;
}
