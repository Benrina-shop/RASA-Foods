# GOGO MART — Complete System Documentation & Architecture Guide

Welcome to the official, full-scope system documentation for **GOGO MART** (formerly RASA Foods). This document contains an exhaustive breakdown of the web application's frontend pages, admin management portals, modular JavaScript subsystems, database schemas, and all modern features developed and enhanced.

---

## 1. Project Overview & Identity

- **Platform Name**: GOGO MART
- **Tagline**: *Your Trusted Online Store.*
- **Official Brand Footer**: `© 2026 GOGO MART. Your Trusted Online Store.`
- **Official WhatsApp Support Number**: `+94 71 128 9934` (`94711289934`)
- **Flat Delivery Fee**: `Rs. 399` across Sri Lanka
- **Default Currency**: Sri Lankan Rupee (`Rs.`) with thousands separator (e.g. `Rs. 1,450`)

### Core Philosophy
GOGO MART is built as an ultra-fast, user-friendly, responsive e-commerce web platform. It incorporates an approachable, modern design theme (**Pure White, Royal Blue `#2563eb`, Rose Pink `#ec4899`, and Vibrant Amber `#f59e0b`**) with **Plus Jakarta Sans** and **Inter** typography, full mobile touchscreen support, real-time inventory synchronization, rich media reviews with photos, and automated customer support widgets.

### Tech Stack
- **Frontend Architecture**: HTML5, Vanilla JavaScript (ES6+ Modules, REST API integrations & DOM Lifecycle Guards), Tailwind CSS.
- **Backend & Database**: Supabase (PostgreSQL 15, Row Level Security, Supabase Storage buckets).
- **Client Libraries**:
  - `@supabase/supabase-js v2`: Realtime database querying and direct authenticated/anonymous storage uploading.
  - `jspdf` & `jspdf-autotable`: In-browser client-side itemized invoice PDF rendering and downloading.
  - `Google Fonts`: Plus Jakarta Sans (headings & brand display) & Inter (body and data readouts).
- **Deployment Platform**: Vercel Git-Integrated Production Pipeline with zero server overhead.

---

## 2. Customer Storefront Ecosystem

### Product Reactions & Wishlist

- `product-engagement.js` and `product-engagement.css` provide **Like**, **Love**, and **Wow**, each with its own shared count, plus a separate **Add to Wishlist** button on home, catalogue, offers, and product-detail views. All customer-facing labels are in English.
- Counts appear in a compact **Love · Like · Wow** row above a pill-shaped **React** button. Clicking or tapping React opens the three reaction choices; selecting one closes the picker and updates the button. Escape, outside click, or moving focus away closes it. Large counts use compact notation, with exact totals in accessible labels/tooltips. Wishlist has a separate heart/bookmark icon button.
- Each product allows one reaction per browser identity. Selecting it again removes it; selecting another replaces it. Counts come from Supabase, update after a confirmed write, and refresh every 15 seconds while the page is visible or on window focus. Wishlist membership is independent of reactions and cart contents, including for out-of-stock products.
- **Wishlist** navigation opens `products.html?wishlist=1`. The catalogue checkbox filters saved products using current catalogue data and supports existing search/category/price filters. Products removed from the catalogue are not displayed.
- Wishlist preferences are cached under `gogo-product-preference:v1:<product-id>` and synchronize to `customer_wishlist_items` for signed-in customers. Guest wishlist choices remain in that browser until an account signs in and merges them. The reaction owner token is a cryptographically random UUID stored as `gogo-reaction-visitor:v1`; only its SHA-256 hash is stored in the private reaction table. Browsers can read public totals and manage their own reaction without a customer login. This is guest-browser identity, not one verified vote per person: another browser or cleared storage creates a new identity. Old local-only reactions are not automatically published; a new explicit selection submits a shared reaction.
- Customer sign-in and signup are temporarily hidden because the Supabase phone provider cannot be enabled without SMS provider credentials. Guest cart and wishlist remain available in the current browser; account pages redirect to the storefront.
- The mobile navigation includes a small Staff link to `admin-login.html`; admin authentication and customer authentication remain separate.
- Storage/network failures show an English error without presenting an unconfirmed update as successful. Failed initial reads show a dash and **Counts unavailable**, never a fabricated zero. Previously loaded totals are marked as potentially outdated on failure. **Retry counts** retries the read. Native buttons expose `aria-pressed` and counts, support keyboard interaction, and a status region announces updates.
- **Deployment prerequisite:** run `database/product-reactions.sql` as the database owner in the project's Supabase SQL Editor, or apply it through an authenticated database connection. A Git push deploys frontend files but does not execute SQL. Until setup is applied, React remains clickable and choices are saved only in this browser with an explicit notice; shared totals remain unavailable. Temporary network errors allow retrying without falsely reporting a saved shared reaction. See `database/README.md` for setup and verification.
- Browser verification: install Playwright and `@electric-sql/pglite` in the test environment, then run `node tests/product-engagement.cjs`. `PLAYWRIGHT_CHANNEL=msedge` can select installed Edge; `PLAYWRIGHT_MODULE_PATH` can point to an existing Playwright package. The test uses product API fixtures and the actual reaction SQL in local PostgreSQL, without production writes. It covers separate counts across independent browsers, reaction changes/removal, persistence, cross-page/tab synchronization, wishlist, cart, mobile, and network/storage errors. `node tests/product-reactions-db.cjs` separately checks SQL idempotency, validation, permissions, RLS, and product-delete cleanup.

### 2.1. Home Page (`index.html`)
- **Supabase egress controls**: Customer catalogue pages do not poll. Product and category Realtime events carry only row IDs, and paired refresh notifications are debounced for three seconds. Homepage, catalogue, and offer product reads select card fields only; product detail loads the full record for one selected product. Homepage reviews omit photo data and load at most 100 recent reviews; product detail loads at most 20 reviews. Admin product, video, cover, and promo uploads must succeed in Storage before their URLs are saved; failed uploads do not fall back to base64 database values.
- **Responsive shared content width**: Header and hero use a 1,648px outer container with 24px desktop side padding, giving the same 1,600px inner content width as lower homepage sections. The hero promo ad card is capped at 520px so it does not grow too large at 100% browser zoom. Products, Best Sellers, New Arrivals, Browse Departments, and Customer Reviews share the 1,600px content width.
- **Homepage section order**: Hero cover and promo ad; Popular Categories; Best Sellers; New Arrivals; Browse Departments; Customer Reviews; footer.
- **Popular Categories**: Loads regular category rows and card image metadata from Supabase `categories`. The first four unique categories show on initial load. If more than four categories exist, the visible set shuffles every five seconds without reloading; cards are unique and the exact previous set is not repeated. Cards fill four columns on desktop and two on tablet/mobile. Category image, name, add/update/delete changes, and catalogue links follow admin-managed category rows. Arrow controls request another set.
- **Best Sellers**: Displays up to eight products selected independently in `admin-best-sellers.html`. Selection is stored as product IDs in `categories.slug = system_best_sellers`; product details always come from `products`, so product edits appear automatically.
- **New Arrivals**: Displays up to eight products selected independently in `admin-new-arrivals.html`. Selection is stored as product IDs in `categories.slug = system_new_arrivals`; product details always come from `products`.
- **Browse Departments**: Groups current products by `category_slug`, shows up to five products from one category at a time, and switches category every ten seconds without reloading. Section heading and product-card labels use the matching display name from `categories.name`, with a readable slug fallback. Products use a four-column desktop grid, two columns on tablet, and one on mobile. Categories with no products are not shown.
- **Customer Reviews**: Appears above the footer. It reads shared Supabase review rows, ranks products by average rating, shows reviews for the four highest-rated products, includes product names and ratings, supports responsive cards and arrow navigation, and shuffles reviews every five seconds. A cross-tab storage signal refreshes the section after review submission.
- **Review persistence and privacy**: `database/product-reviews.sql` creates `public.reviews`. Product-detail submissions save rating, full name, email, comment, compressed photos, and timestamp in Supabase. The public API can read review display fields but has no permission to read `author_email`. Photos are embedded in the row (up to three and 350 KB total), so the product foreign key's `ON DELETE CASCADE` permanently removes review data and photos when an admin deletes a product. Legacy `gogo-reviews-<product-id>` localStorage entries are not shared or auto-migrated. Apply the SQL in Supabase; a Git push does not apply it.
- Clicking a category opens the catalogue filtered to that category. Category data is read from Supabase `categories` and respects admin updates.
- **Full-Width Hero Background Slideshow**:
  - Dynamically cycles high-resolution background covers (configured via `admin-banners.html`) every 5 seconds with smooth cross-fade animation.
- **Interactive Promo Ads Card (Multi-Image Auto-Rotating)**:
  - Supports multiple images per promotion advertisement with an internal 2.5-second image flipper and manual arrow/dot controls.
- **Real-Time Live Search Bar**:
  - Dedicated search bar on both Desktop and Mobile (`#nav-search-input-mob`) with placeholder `Search Your Products`.
  - Instant live dropdown search powered by `live-search.js` displaying product thumbnails, categories, and prices as the customer types.
- **Top Announcement Marquee Ticker**:
  - Dynamic announcement bar (`live-marquee.js`) with live status badge and customizable scrolling ticker messages.
- **Hover Slideshow on Product Cards**:
  - Hovering over a product card cycles through its additional product images every 850ms, previewing different angles without leaving the catalogue.
- **Integrated Direct Navigation**:
  - Clean sticky two-row mobile navbar with responsive slide-out drawer menu (`#mob-menu`).

---

### 2.2. Products Catalogue (`products.html`)
- **Desktop Sticky Sidebar & Mobile Filter Drawer**:
  - Multi-category checkboxes, stock availability toggles, and dynamic price range slider.
  - **Filtered System Slugs (NEW)**: System configuration categories (`SYSTEM_COVER_BANNER`, `SYSTEM_MARQUEE_NEWS`, `SYSTEM_POPULAR_CATEGORIES`) are automatically excluded from customer-facing category filters.
- **Dual Action Buttons on Product Cards**:
  - **"Add To Cart"** with reactive badge animation and count updater.
  - **"Buy Now"** for instant 1-click checkout redirection.
- **Real-Time Inventory Badges**:
  - Live indicators: `In Stock`, `Only X Left` (when stock = 5), or `Out of Stock` with automatic button disabling.

### 2.3. Product Details Page (`product-detail.html`)
- **Touch Gesture Mobile Image Gallery**:
  - Full touch swipe left/right (`touchstart`/`touchend` gesture handler) on mobile phones to effortlessly swipe through product photos.
  - Thumbnail selector with zoom preview lightbox.
- **Product Video Demonstration**:
  - HD video playback container for products with attached demo videos (`.mp4` / `.webm`), giving customers a 360-degree real-world view before purchasing.
- **Trust Guarantee Badges**:
  - ?? `Quality Products`
  - ??? `Best Prices`
  - ??? `Peace of Mind`
- **Customer Feedback & Product Review System**:
  - 5-Star interactive star rating selector with average score calculation.
  - Customer review submission with optional photo attachments. Rating, name, private email, comment, and compressed photo data are saved together in Supabase `public.reviews`; the email column is excluded from public API reads.
  - Review photo thumbnail gallery with clickable Lightbox Modal zoom-in preview.

### 2.4. Exclusive Offers Page (`offers.html`)
- **Promo Code Cards with 1-Click Copy**:
  - Active coupons retrieved from `promo_codes` table with instantaneous clipboard copy buttons.
- **Discounted Deals Showcase**:
  - Lists items on sale with original price strike-throughs and discount percentage pills.
- **Mobile Hamburger Menu**:
  - Fully integrated slide-down drawer with quick navigation links.

### 2.5. Dedicated Contact Page (`contact.html`)
- **Direct Communication Center**:
  - Physical location, direct email (`hello@gogomart.lk`), and official phone (`+94 71 128 9934`).
  - Interactive Contact Form storing direct customer inquiries into Supabase.
  - 1-Click WhatsApp Live Chat redirect button.

### 2.6. Cart & Shopping Basket (`cart.html`)
- **Mobile 100% Fluid Layout**:
  - Clean single-column layout on mobile screens with compact quantity adjusters (`+` / `-`), line prices, and remove buttons.
  - Summary box showing subtotal, standard `Rs. 399` express delivery fee, and net total.
  - **"Proceed to Checkout"** button linking directly to delivery details.

### 2.7. Checkout Page (`checkout.html`)
- **Mobile-First Seamless Flow**:
  - Screen auto-fits 100% width with zero horizontal scrolling or manual zoom-out required on any device.
  - **Mobile Layout**: Order summary displayed at the top so customers immediately review items and totals before completing the delivery form below.
  - **Desktop Layout**: 12-column split with Form on the left and sticky Summary Card on the right.
- **Customer Details Form**:
  - Name, Mobile Phone, Optional WhatsApp, Street Address, City/Town, and Special Delivery Notes (landmarks, delivery time preferences).
- **Live Promo Code Engine**:
  - Validates discount codes in real-time against `promo_codes` table and recalculates total settlement dynamically.
- **Automated Stock Deduction**:
  - When an order is placed, purchased item quantities are automatically deducted from the `products.stock` column in Supabase.
- **Cash on Delivery (COD)**:
  - 1-Click secure order placement saving records to `orders` and `order_items` tables.

### 2.8. Post-Purchase Confirmation (`thank-you.html`)
- **Transaction Receipt & Report**:
  - Displays unique Order ID, confirmed COD status, delivery address, and total settlement.
- **Client-Side PDF Invoice Generator**:
  - Generates and downloads branded `GOGO_MART_Order_{id}.pdf` in 1 click using `jspdf` and `jspdf-autotable` with shop header, item table, and delivery address.

---

## 3. Global Subsystems & Modular Scripts

### 3.1. Floating WhatsApp Assistant (`whatsapp-widget.js`)
- Floating circular button at the bottom-right of every page with pulsing ring animation and red unread notification badge.
- **Context-Aware Smart Messaging**:
  - Clicking opens a stylish chat popup card.
  - If on a product page: Auto-generates a message including product name and URL (e.g., *"Hello GOGO MART! I am interested in ordering: Ceylon Cinnamon Sticks..."*).
  - If in Checkout or Cart: Auto-generates an order assistance message.
- Redirects seamlessly to `https://wa.me/94711289934`.

### 3.2. Real-Time News Marquee Ticker (`live-marquee.js`)
- Lightweight scrolling announcement ribbon rendered at the top of customer pages.
- Data fetched dynamically from Supabase `categories` table (`slug: system_marquee_news`) with instant fallback to `localStorage`.
- Features a glowing **"LIVE"** badge and infinite smooth CSS scroll animation (`@keyframes marqueeScroll`).

### 3.3. Instant Live Search (`live-search.js`)
- Debounced real-time product index caching.
- Renders responsive search dropdowns on both desktop and mobile header inputs with high-resolution image thumbnails, pricing, and category pills.

### 3.4. Supabase Client Configuration (`supabase-config.js`)
- Centralized helper initialization:
  - URL: `https://yswekhygaebgvowdrmxk.supabase.co`
  - Anon Public Key authentication.
  - Provides universal `getSupabase()` accessor and `formatPrice(amount)` utility function.

---

## 4. Administrative Control Ecosystem (Admin Portal)

### 4.1. Unified Admin Design System (NEW)
All admin portal pages share a completely unified, sleek dark UI matching GOGO MART’s signature identity:
- **Background**: Deep Slate Navy (`#0f172a`)
- **Surfaces & Cards**: Slate (`#1e293b` & `#334155`)
- **Primary Accent**: GOGO Royal Blue (`#2563eb` / `#3b82f6` with pink/amber highlights)
- **Typography & Sidebars**: Standardized 280px left navigation bar with consistent icons and active states.

### 4.2. Admin Authentication (`admin-login.html`)
- Secure login portal with role-based session token storage and automatic redirect security guards.
- Redesigned with the unified Royal Blue & Slate aesthetic.

### 4.3. Global Performance Dashboard (`admin-dashboard.html`)
- Real-time KPIs: Total Revenue, Total Orders, Active Catalogue Items, and Pending Deliveries.
- Recent sales chart, latest order stream, and low-stock warnings.

### 4.4. Popular Categories Manager (`admin-categories.html`) (NEW)
- Dedicated management portal for the home page’s Popular Categories section:
  - **Existing Store Category Selector**: Dropdown to select from existing store product categories (e.g. *Snacks, Bakery, Beverages, Mens*), auto-filling the name and target slug.
  - **Category Card Customization**: Custom display titles, optional subtitle tag badges (e.g. *"Hot Picks"*, *"Best Value"*), and card image upload/URL selector.
  - **Instant Supabase Cloud Storage**: Changes persist in `categories` under `slug: system_popular_categories` and immediately sync to the storefront category cards.

### 4.5. Best Sellers Manager (`admin-best-sellers.html`)
- Select, remove, and save up to eight homepage Best Sellers independently from New Arrivals.
- Product details stay synchronized with the main Products manager; selections are stored as IDs in `categories.slug = system_best_sellers`.

### 4.6. Product & Inventory Manager (`admin-products.html`)
- Add, Edit, Archive, and Delete products.
- **Multi-Photo Upload**: Supports uploading multiple photos directly to Supabase storage.
- **Product Video Uploader**: Upload MP4/WebM video clips directly to product listings.
- **Stock Control**: Exact numerical stock allocation per product, which decreases automatically upon customer order.
- **Pricing & Discounts**: Set regular selling price and higher comparison price (`old_price`) for automatic strike-through badge display.
- Excludes system slugs (`system_*`) from category dropdowns.

### 4.7. Hero Background Covers Manager (`admin-banners.html`)
- Upload and manage full-width hero background cover photos.
- Stored as JSON array in Supabase (`slug: system_cover_banner`) with instantaneous auto-swap on the home page hero section.

### 4.8. Promo Ads Banner Manager (`admin-ads.html`)
- Manage interactive promotion slides displayed inside the home page hero right column.
- Configure taglines, titles, descriptions, action button links, and multi-photo slide sets.

### 4.9. Live Announcement Marquee Manager (`admin-marquee.html`)
- Create, reorder, toggle on/off, and delete scrolling announcements for the top ticker bar.
- Custom tag badges (e.g., `HOT DEAL`, `ANNOUNCEMENT`, `NEW ARRIVAL`).

### 4.10. Orders & Dispatch Processing (`admin-orders.html`)
- Filter orders by status: `Pending`, `Processing`, `Delivered`, `Cancelled`.
- **Search & Filter**: Search orders by Customer Name, Order ID, or Phone Number.
- **Order Details Modal**:
  - Full customer name, address, email, phone, and optional WhatsApp number.
  - Special delivery notes display.
  - Itemized product list with quantities and unit prices.
- **1-Click WhatsApp Order Confirmation Button**:
  - Automatically composes and opens a structured Sinhala/English WhatsApp message to the customer with their order summary, requesting delivery confirmation before dispatch.

### 4.11. Marketing & Coupons Manager (`admin-offers.html`)
- Create and toggle promo coupon codes with customizable percentage discounts and expiration status.

---

## 5. Supabase Database Schema

### Table: `products`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint / uuid` | Primary key |
| `name` | `text` | Product title |
| `description`| `text` | Product details and specifications |
| `price` | `numeric` | Current selling price |
| `old_price` | `numeric` | Comparison / original price (optional) |
| `category_slug` | `text` | Category identifier |
| `image_url` | `text` | Primary product thumbnail |
| `images` | `jsonb / text[]`| Array of additional product photo URLs |
| `video_url` | `text` | URL of uploaded demo video (optional) |
| `stock` | `integer` | Current warehouse quantity available |
| `badge` | `text` | Optional marketing badge (e.g. "HOT DEAL") |
| `is_new` | `boolean` | Legacy flag; homepage New Arrivals are managed by `system_new_arrivals` |
| `created_at` | `timestamptz` | Record creation timestamp |

### Table: `orders`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | Primary key / Order Number |
| `customer_name` | `text` | Customer full name |
| `customer_email`| `text` | Email communication address |
| `customer_phone`| `text` | Primary contact mobile number |
| `whatsapp_number`| `text` | WhatsApp messaging number |
| `shipping_address`| `text` | Street, town, and special delivery notes |
| `note` | `text` | Special instructions (optional) |
| `total_amount` | `numeric` | Net total settlement after discounts |
| `status` | `text` | `Pending`, `Processing`, `Delivered`, `Cancelled` |
| `created_at` | `timestamptz` | Date and time order was placed |

### Table: `order_items`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | Primary key |
| `order_id` | `bigint` | Foreign key referencing `orders(id)` |
| `product_id` | `bigint` | Foreign key referencing `products(id)` |
| `quantity` | `integer` | Number of units purchased |
| `unit_price` | `numeric` | Price per unit at purchase time |

### Table: `promo_codes`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` | Primary key |
| `code` | `text` | Coupon code (e.g., `GOGO40`) |
| `discount_percentage` | `integer` | Discount percentage (e.g., `20`, `40`) |
| `is_active` | `boolean` | Enable / disable promo coupon |

### Table: `categories` (Standard Categories & Dynamic System JSON Store)
Stores standard store product categories as well as system configurations:
- Regular Store Categories: `snacks`, `sweets`, `beverages`, `spices`, `bakery`, `organic`, `sinhala-food`, `mens`, etc.
- **System Slugs**:
  - `system_cover_banner`: Full-width hero background cover banner images (JSON array).
  - `system_marquee_news`: Live top marquee ticker announcements (JSON array).
  - `system_popular_categories`: Featured category metadata and card images (JSON array).
  - `system_new_arrivals`: Ordered product IDs selected for the home page New Arrivals section (JSON array).
  - `system_best_sellers`: Ordered product IDs selected for the home page Best Sellers section (JSON array).


### Reviews storage and setup
- `database/product-reviews.sql` creates the public reviews table with RLS and restricted column grants. Run it in the configured Supabase SQL Editor before customers submit reviews.
- Storefront reads omit `author_email`; the submitted email is saved in the database but cannot be selected by anon/authenticated storefront roles. Database owners and project operators retain database-level access.
- Review photos are resized and compressed, then kept in the review row. Product deletion cascades to review rows and photo bytes, so no separate Storage cleanup is needed.
- Legacy browser-only review entries are not automatically migrated. Git deployment does not apply the SQL.

---

## 6. Storage Buckets (Supabase Storage)

- **`products`**:
  - Publicly accessible bucket storing product photos, admin hero covers, category card images, and demo MP4 videos. New customer review photos are stored in the review database rows so product deletion removes them with the review.

---

## 7. Version History & Comprehensive Milestone Log

### Complete Enhancements Summary (October 2026):
1. **Brand Identity Transition**: Modernized brand to **GOGO MART** with unified footer `"© 2026 GOGO MART. Your Trusted Online Store."` and refreshed color palette.
2. **Homepage New Arrivals and Rotating Categories**:
   - Admins choose up to eight New Arrivals products independently from Best Sellers.
   - Four unique category cards switch to a new random set every five seconds without page refresh.
3. **Dedicated Admin Categories Manager (`admin-categories.html`)**:
   - Dropdown to select and link existing store categories.
   - Image upload, custom titles, tags, and cloud sync.
4. **Unified Admin Panel Design**:
   - Modernized all admin management pages (`dashboard`, `products`, `orders`, `categories`, `offers`, `marquee`, `banners`, `ads`, `login`) to a consistent Royal Blue & Dark Slate UI.
5. **System Category Filtering**:
   - Internal system records (`SYSTEM_*`) cleanly excluded from client-facing filter sidebars and dropdowns.
6. **Hover Image Slideshow**: Multi-photo cycling upon card hover on catalogue views.
7. **Hero Cover Banners & Dedicated Admin**: Created `admin-banners.html` with multi-image local upload for background cover auto-swapping.
8. **Product Video Support**: Video upload in admin portal and responsive player on product details page.
9. **Real-time Live News Marquee**: Built `live-marquee.js` and `admin-marquee.html` for broadcast announcements.
10. **Customer Review Photo Attachment**: Star rating review form with photo attachments and lightbox zoom modal.
11. **Floating WhatsApp Chat Assistant**: Built `whatsapp-widget.js` with smart auto-generated context messages.
12. **Mobile Header Overhaul**: 2-row sticky header with dedicated full-width search input (`"Search Your Products"`).
13. **Touch Swipe on Mobile Gallery**: Seamless swipe gestures for mobile product browsing.
14. **Checkout & Cart Mobile Ground-Up Restructure**: Auto-fits 100% viewport width without horizontal scroll or manual zoom-out, with order summary on top followed by delivery details.
15. **Mobile Menu Drawer Fixes**: Unified slide-down drawer across all customer storefront pages.
16. **Homepage Width and Category Sections**: Aligned home content to a shared 1,600px inner width, capped the hero promo card at 520px, rendered Popular Categories as responsive full-width cards, kept the initial set visible before five-second shuffling, and added the ten-second Browse Departments product rotation using category display names.
17. **Homepage Customer Reviews**: Added a responsive review summary/cards section before the footer, ranking reviews by product average and shuffling every five seconds. The configured project initially lacked `public.reviews`; the checked-in SQL setup now defines shared persistence and email-safe column access.
18. **Shared Product Reviews**: Added Supabase persistence for customer name, email, rating, comment, compressed photos, and timestamp. Added RLS and restricted column grants so storefronts cannot read emails, cross-tab homepage refresh, and product-delete cascade cleanup for review/photo data. Legacy localStorage reviews are not automatically migrated.
19. **Supabase Egress Reduction**: Removed customer page polling, debounced Realtime refreshes, limited Realtime payloads to IDs and product queries to card fields, excluded photos from homepage review reads, limited reviews returned per page, and blocked database base64 fallback after Storage upload failures.

---
*Maintained by GOGO MART Core Engineering Team — Comprehensive Documentation Updated: October 2026.*
