# Shared product reaction counts

## Shared product reviews

Run `product-reviews.sql` once in the Supabase SQL Editor for the project configured in `supabase-config.js`. It creates `public.reviews`, enables RLS, allows public review reads and inserts, and grants storefront roles access only to the public review columns. `author_email` is stored but excluded from storefront reads. Project owners/database operators can still access stored data.

Product detail reviews save rating, full name, email, comment, photos, and timestamp in Supabase. Photos are resized and compressed in the browser, then stored in the review row (up to three photos and 350 KB total). Product detail pages fetch at most 20 reviews; the homepage reads up to 100 reviews without selecting photo data. A product foreign key with `ON DELETE CASCADE` permanently removes its reviews and embedded photo data when the admin deletes the product. The homepage reads the shared rows and refreshes when another tab submits a review. Reviews saved only in the old `gogo-reviews-<product-id>` localStorage keys are legacy browser-only entries and are not automatically migrated. The review SQL limits new photo rows to 512 KB. Re-run the updated SQL in Supabase to apply the tighter limit to an existing setup. Git deployment does not run SQL.
## Customer accounts, carts and wishlists

`customer-accounts.sql` creates private account cart and wishlist tables with
row-level security, plus a private customer profile table for names and delivery
addresses. Run this updated SQL in the Supabase SQL Editor for this store. It is
safe to re-run after the earlier cart/wishlist setup. GitHub deployment does
not run SQL.
Each signed-in customer can read and change only rows whose `user_id` matches
their Supabase Auth user ID; deleting a product or Auth account cascades to its
saved rows.

Passwords are submitted only to Supabase Auth, which stores salted password
hashes. The app does not save passwords in the profile table. Profile rows are
restricted by RLS to their owning Auth user. Project owners and anyone with
database-owner/service-role access can still read database rows; RLS does not
hide data from the project operator or protect against a modified frontend.

Phone/password signup and login use Supabase Auth. To avoid OTP, disable phone
confirmation in **Authentication → Sign In / Providers → Phone**. Keep the Phone
provider enabled; an SMS provider is not needed when confirmation is disabled.
Unverified phone numbers can be used as login identifiers, so customers must
enter a number they control. Existing email accounts remain separate and can
continue to sign in with email; a new phone account has a different user ID and
will not automatically share the old account's cart or wishlist.

To verify the setup, configure the SQL and disable phone confirmation, register
with a test mobile number, save the profile, and add products to the cart and
wishlist. Sign out and sign in again from a second browser profile. The profile
and saved items should load from Supabase. Signing out clears the local account
cache from that browser.

The storefront displays separate Like, Love and Wow totals. The SQL must be
installed in the existing Supabase project; pushing to GitHub does not apply it.

## Activate

1. Open the SQL Editor for the same Supabase project used in `supabase-config.js`.
2. Paste all of `product-reactions.sql` and run it as the database owner.
3. Keep `gogo_private` out of **Data API → Exposed schemas**. Only `public` RPC
   wrappers should be reachable through the API.
4. Run the read-only query below. It returns three zero counts initially and
   `my_reaction = null`. With no products, it returns no rows.

```sql
select * from public.get_product_reactions(
  array(select id from public.products order by id limit 3), null
);
```

Reload the storefront. React from two different browser profiles and verify
that both show the same totals. Change one reaction and remove it again to
verify that each count changes independently. Removing the test reaction
returns that profile's contribution to zero.

## Data and permissions

- `gogo_private.product_reactions` has one row per product and visitor hash.
  A composite primary key prevents repeated submissions from incrementing totals.
  Counts are calculated from rows rather than browser-supplied increments.
- The table has RLS enabled and no direct `anon`/`authenticated` permissions.
  Privileged functions have an empty search path and live in an unexposed schema;
  public wrappers are `SECURITY INVOKER`. No visitor tokens/hashes or other
  visitors' individual reactions are returned to the browser.
- `get_product_reactions` accepts up to 100 product IDs and returns totals plus
  the caller's reaction if they provide their token. The token is sent in the
  POST body, not in a URL. No service-role key is used by the frontend.
- `set_product_reaction` accepts only `like`, `love`, `wow`, or `null` (remove).
  The browser sends the desired state, making retries idempotent. Per-visitor
  transaction locks serialize conflicting updates/deletes. Product removal
  cascades to reaction rows.
- Guest browser tokens are bearer credentials. This supports casual shopping
  reactions, not verified-person voting. Clearing storage or changing devices
  creates a new guest identity. Existing customer sign-in and Wishlist behavior
  are unchanged. Legacy local-only reactions are not included in public counts.

## Verification

```powershell
npm install --no-save --package-lock=false @electric-sql/pglite playwright
node tests/product-reactions-db.cjs
$env:PLAYWRIGHT_CHANNEL = 'msedge' # or install a Playwright Chromium browser
node tests/product-engagement.cjs
```

The SQL tests execute real PostgreSQL in PGlite and run public functions as
`anon`. They verify two independent visitors, duplicate submission, switching,
removal, invalid input, private-table read/write denial, RLS, and cascading
deletion. Browser tests use the same SQL behind a local test transport; they do
not modify production data. Multi-process database concurrency/load and live
Supabase deployment still require verification in the deployed project.

Design references: [Supabase database functions](https://supabase.com/docs/guides/database/functions),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security),
and [PostgreSQL binary/hash functions](https://www.postgresql.org/docs/current/functions-binarystring.html).

## Storefront egress controls

Customer catalogue pages do not poll Supabase. Local and Realtime change notifications are debounced for three seconds, and Realtime payloads for products/categories include only the row ID. Product listing pages select card fields rather than descriptions, galleries, or video. Homepage review queries omit photos. Admin image/video/banner uploads must succeed in Storage before the URL is saved in a database row; upload failures are surfaced and do not fall back to storing base64 in the database.
