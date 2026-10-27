# GOGO MART — System Documentation

This document provides a comprehensive overview of the GOGO MART premium e-commerce platform, detailing its architecture, features, and database structure.

## 1. Project Overview
**GOGO MART** is a high-end e-commerce platform designed for premium culinary and daily consumer assets. It prioritizes a high-fidelity visual experience with a modern dark-gold aesthetic and professional management tools.

### Technology Stack
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Tailwind CSS v4.
- **Backend-as-a-Service**: Supabase (PostgreSQL, Authentication, Real-time Storage).
- **Libraries**:
    - `jspdf` & `jspdf-autotable`: For professional transaction report generation.
    - `supabase-js`: Direct database & storage communication.
    - `Google Fonts`: Playfair Display & DM Sans for typography.

---

## 2. Platform Architecture

### A. Customer Storefront
1. **Home (`index.html`)**: Interactive landing page with brand story and featured categories.
2. **Catalogue (`products.html`)**: 
    - **Sidebar Filtering**: Permanent left-side filters for desktop.
    - **Multi-Category Selection**: Select multiple groupings via checkboxes.
    - **Price Control**: Range slider to filter by maximum budget.
    - **Real-time Search**: Search bar for instant asset discovery.
3. **Product Details (`product-detail.html`)**:
    - Multi-image gallery with thumbnails and zoom transitions.
    - Dynamic strike-through pricing for deals.
4. **Offers (`offers.html`)**:
    - Database-driven Promo Code display.
    - Ongoing Deals (Discounted items) summary.
5. **Checkout Flow (`checkout.html`)**:
    - **WhatsApp Identification**: Mandatory phone and optional WhatsApp field for communication.
    - **Promo Logic**: Live validation of discount codes targeting the total settlement.
6. **Post-Purchase (`thank-you.html`)**:
    - **Instant PDF Invoice**: A button to generate a branded, itemized PDF report including Order ID, items, and delivery path.

---

## 3. Administrative Ecosystem (Admin Portal)

1. **Dashboard (`admin-dashboard.html`)**:
    - Live tracking of global revenue and order density.
2. **Inventory Management (`admin-products.html`)**:
    - **Asset Sync**: Direct image upload to Supabase Storage.
    - **Deal Logic**: Manage Original vs. Selling prices for front-end strike-throughs.
3. **Order Flow & Logistics (`admin-orders.html`)**:
    - **Advanced Filtering**: Categorize orders by status (Pending, Processing, Delivered) via UI tabs.
    - **Order Search**: Locate specific transactions by Customer Name or ID.
    - **Deep Review Modal**:
        - Displays **Order Date & Time** precisely.
        - Displays **WhatsApp Number** with direct identification.
        - **WhatsApp Confirmation**: A dedicated green button that opens a pre-formatted message to the customer with full order details, requesting their confirmation.
4. **Promo Management (`admin-offers.html`)**:
    - Create and toggle the status of global marketing incentives.

---

## 4. Database Schema (Supabase)

### Table: `products`
- Handles multi-images (`images` array), tiered pricing (`price`, `old_price`), and categorization.

### Table: `orders`
- Stores customer identity, delivery paths, and communication channels (Phone + WhatsApp).
- Includes status tracking and total settlement records.

### Table: `order_items`
- Maintains the relational link between specific orders and the quantity/price of assets purchased.

### Table: `promo_codes`
- Controls marketing discount logic and active states.

---

## 5. Logistics & Communication
- **Automated Messaging**: Use of `wa.me` API for admin-to-customer confirmation.
- **Verified Shop Contact**: Default admin contact used in templates: `+94711289934`.
- **Media Preservation**: Supabase Storage holds all high-resolution culinary photography.

---
**Maintained by RASA Development — Last Updated: April 2026**
