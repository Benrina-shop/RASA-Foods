// Supabase Configuration
const SB_URL = 'https://yswekhygaebgvowdrmxk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlzd2VraHlnYWViZ3Zvd2RybXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Njk0ODksImV4cCI6MjA5MTE0NTQ4OX0.Ou_il3hORcuIvsmUix4dH73lCy-CVRbAJAntEWM-Z1U';

let supabase;

try {
    if (window.supabase) {
        supabase = window.supabase.createClient(SB_URL, SB_KEY);
    } else {
        console.warn('Supabase JS not found on window. Will retry in init functions.');
    }
} catch (e) {
    console.error('Failed to initialize Supabase:', e);
}

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
