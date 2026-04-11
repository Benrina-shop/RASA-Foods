// Supabase Configuration
const SB_URL = 'https://yswekhygaebgvowdrmxk.supabase.co';
const SB_KEY = 'sb_publishable_MU5IbIzhqi6W3rvj4pr3jw_vv7jFt6s';
const supabase = window.supabase.createClient(SB_URL, SB_KEY);

// Helper to format currency
function formatPrice(amount) {
    return 'Rs. ' + Number(amount).toLocaleString();
}

// Check if admin is logged in
function checkAdmin() {
    if (!localStorage.getItem('isAdmin')) {
        window.location.href = 'admin-login.html';
    }
}
