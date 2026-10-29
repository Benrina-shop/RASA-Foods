# Shared product reaction counts

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
