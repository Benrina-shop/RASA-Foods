# RASA Foods — System Documentation

This document provides a comprehensive overview of the RASA Foods premium e-commerce platform, detailing its architecture, features, and database structure.

## 1. Project Overview
**RASA Foods** is a high-end, luxury e-commerce platform designed for premium culinary assets. It prioritizes a high-fidelity visual experience with a modern dark-gold aesthetic and professional management tools.

### Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS v4.
- **Backend-as-a-Service**: Supabase (PostgreSQL, Authentication, Real-time Storage).
- **Libraries**:
    - `jspdf` & `jspdf-autotable`: For transaction report generation.
    - `supabase-js`: Database communication.
    - `Google Fonts`: Playfair Display & DM Sans for typography.

---

## 2. Platform Architecture

### A. Customer Storefront
1. **Home (`index.html`)**: Interactive landing page with brand story, featured categories, and newsletter integration.
2. **Catalogue (`products.html`)**: 
    - Advanced left-sidebar filtering.
    - Multiple category selection (checkboxes).
    - Price range slider (up to Rs. 10,000+).
    - Real-time search by name/essence.
    - Sort by Price/Newest.
3. **Product Details (`product-detail.html`)**:
    - Multi-image gallery with thumbnails.
    - Dynamic inventory data.
    - Interactive quantity selection.
4. **Offers (`offers.html`)**:
    - Real-time sync with database-driven promo codes.
    - "Ongoing Deals" section for discounted products.
5. **Basket (`cart.html`)**: Premium slide-out or full-page inventory management for the user.
6. **Checkout (`checkout.html`)**:
    - Step-based identification flow.
    - Promo Code validation system (Real-time).
    - WhatsApp Number integration.
7. **Confirmation (`thank-you.html`)**:
    - Immediate order verification.
    - **One-click PDF Invoice Download** containing full transaction details.

---

## 3. Administrative Ecosystem (Admin Portal)
Accessible via the footer link and protected via an `isAdmin` local verification.

1. **Dashboard (`admin-dashboard.html`)**:
    - Real-time revenue tracking.
    - Order volume analytics.
    - Recent transaction feed.
2. **Inventory Management (`admin-products.html`)**:
    - **Local Image Upload**: Direct upload to Supabase Storage.
    - **Multi-Image Support**: Store multiple visual assets per item.
    - **Category Management**: On-the-fly category creation.
    - **Deal Management**: Set original vs. selling prices for strike-through effects.
3. **Order Control (`admin-orders.html`)**:
    - Detailed Modal View: View customer info, WhatsApp, address, and line items.
    - Status Management: Update order lifecycle.
    - Deletion/Archiving: Wipe records from the system.
4. **Marketing Control (`admin-offers.html`)**:
    - Create/Toggle/Delete promo codes (e.g., RASA40).
    - Monitor discount impact.

---

## 4. Database Schema (Supabase)

### Table: `products`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | bigint | Primary Key |
| `name` | text | Asset Name |
| `description` | text | Detailed content |
| `price` | numeric | Selling price |
| `old_price` | numeric | Original price (for deals) |
| `category_slug` | text | Relational link to categories |
| `image_url` | text | Primary image link |
| `images` | text[] | Array of secondary image links |
| `is_new` | boolean | New arrival flag |

### Table: `orders`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | bigint | Primary Key |
| `customer_name` | text | Full name |
| `customer_email` | text | Email for comms |
| `customer_phone` | text | Primary phone |
| `whatsapp_number`| text | Secondary WhatsApp channel |
| `shipping_address`| text | Full delivery path |
| `total_amount` | numeric | Final settlement |
| `status` | text | Pending/Fulfilled/etc. |

### Table: `promo_codes`
| Column | Type | Description |
| :--- | :--- | :--- |
| `code` | text | Unique string (RASA40) |
| `discount_percentage`| int | Percent reduction |
| `is_active` | boolean | Status toggle |

---

## 5. Security & Storage
- **Row Level Security (RLS)**: Enabled and configured for public read/write where required.
- **Supabase Storage**: `products` bucket used for localized media assets.
- **Storage Policies**: Public Access, Public Insert, and Public Update/Delete authorized for admin actions.

---

## 6. How to Extend
1. **New Table**: Add to Supabase and update `supabase-config.js` if keys change.
2. **Styling**: All styles are in-page or using Tailwind. Maintain the `--accent: #f97316` and `--gold: #f59e0b` harmony.
3. **Email Hooks**: Can be added via Supabase Edge Functions for order notifications.

---
**Maintained by RASA Development.**
