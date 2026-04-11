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
