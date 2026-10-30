-- Admin authentication and storefront data access hardening.
-- Run this in the Supabase SQL Editor as project owner/postgres.
-- After running it, create the admin account in Authentication -> Users and
-- run the allowlist INSERT at the bottom with that user's exact email.
begin;

create schema if not exists gogo_private;
revoke all on schema gogo_private from public, anon, authenticated;
grant usage on schema gogo_private to anon, authenticated;

create table if not exists gogo_private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table gogo_private.admin_users enable row level security;
revoke all on gogo_private.admin_users from public, anon, authenticated;

create or replace function gogo_private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from gogo_private.admin_users a
    where a.user_id = (select auth.uid())
  );
$$;
revoke all on function gogo_private.is_admin() from public, anon, authenticated;
grant execute on function gogo_private.is_admin() to authenticated;

-- A narrow API wrapper lets the login page confirm its own admin role.
create or replace function public.is_admin()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select gogo_private.is_admin(); $$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- Replace old policies on admin-managed/public catalogue tables with known rules.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array['products','categories','promo_codes','orders','order_items'])
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end;
$$;

alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.promo_codes enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.products, public.categories, public.promo_codes,
  public.orders, public.order_items from public, anon, authenticated;
grant select on public.products, public.categories to anon, authenticated;
grant insert, update, delete on public.products, public.categories to authenticated;
grant select on public.promo_codes to anon, authenticated;
grant insert, update, delete on public.promo_codes to authenticated;
grant select, insert, update, delete on public.orders, public.order_items to authenticated;

create policy "Public can read products" on public.products
  for select to anon, authenticated using (true);
create policy "Admins manage products" on public.products
  for all to authenticated using ((select gogo_private.is_admin()))
  with check ((select gogo_private.is_admin()));

create policy "Public can read categories" on public.categories
  for select to anon, authenticated using (true);
create policy "Admins manage categories" on public.categories
  for all to authenticated using ((select gogo_private.is_admin()))
  with check ((select gogo_private.is_admin()));

create policy "Public can read active promo codes" on public.promo_codes
  for select to anon, authenticated using (is_active = true);
create policy "Admins manage promo codes" on public.promo_codes
  for all to authenticated using ((select gogo_private.is_admin()))
  with check ((select gogo_private.is_admin()));

create policy "Admins manage orders" on public.orders
  for all to authenticated using ((select gogo_private.is_admin()))
  with check ((select gogo_private.is_admin()));
create policy "Admins manage order items" on public.order_items
  for all to authenticated using ((select gogo_private.is_admin()))
  with check ((select gogo_private.is_admin()));

-- Every order has an unguessable receipt key. Public order reads use a guarded
-- function that checks this key; the orders table itself stays admin-only.
alter table public.orders add column if not exists access_token uuid;
update public.orders set access_token = gen_random_uuid() where access_token is null;
alter table public.orders alter column access_token set default gen_random_uuid();
alter table public.orders alter column access_token set not null;
create unique index if not exists orders_access_token_uidx on public.orders(access_token);

create or replace function gogo_private.place_store_order(
  p_customer jsonb, p_items jsonb, p_coupon text default null
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_order_id public.orders.id%type;
  v_access_token uuid := pg_catalog.gen_random_uuid();
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id bigint;
  v_quantity integer;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_discount_percent numeric := 0;
  v_total numeric;
  v_coupon text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_coupon, '')));
  v_customer_name text := pg_catalog.btrim(coalesce(p_customer->>'customer_name', ''));
  v_customer_email text := nullif(pg_catalog.btrim(coalesce(p_customer->>'customer_email', '')), '');
  v_customer_phone text := pg_catalog.btrim(coalesce(p_customer->>'customer_phone', ''));
  v_whatsapp text := pg_catalog.btrim(coalesce(p_customer->>'whatsapp_number', ''));
  v_address text := pg_catalog.btrim(coalesce(p_customer->>'shipping_address', ''));
begin
  if pg_catalog.jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Invalid order items';
  end if;
  if pg_catalog.jsonb_array_length(p_items) < 1
      or pg_catalog.jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid order items';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_items) as items(value)
    group by value->>'id' having count(*) > 1
  ) then
    raise exception 'Duplicate products in order';
  end if;
  if v_customer_name = '' or v_customer_phone = '' or v_address = '' then
    raise exception 'Customer name, phone, and delivery address are required';
  end if;

  -- Lock products and calculate prices/stock from the database, never from the browser.
  for v_item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'id')::bigint;
    v_quantity := (v_item->>'qty')::integer;
    if v_quantity is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid product quantity';
    end if;
    select p.* into v_product from public.products p
    where p.id = v_product_id for update;
    if not found then raise exception 'A product in this order is unavailable'; end if;
    if v_product.stock is not null and v_product.stock < v_quantity then
      raise exception 'Not enough stock for %', v_product.name;
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if v_coupon <> '' then
    select pc.discount_percentage into v_discount_percent
    from public.promo_codes pc
    where pg_catalog.upper(pc.code) = v_coupon and pc.is_active = true;
    if not found then raise exception 'Promo code is invalid or inactive'; end if;
    if v_discount_percent < 0 or v_discount_percent > 100 then
      raise exception 'Promo code discount is invalid';
    end if;
  end if;
  v_discount := v_subtotal * v_discount_percent / 100;
  v_total := v_subtotal - v_discount + 399;

  insert into public.orders (
    customer_name, customer_email, customer_phone, whatsapp_number,
    shipping_address, total_amount, status, access_token
  ) values (
    v_customer_name, v_customer_email, v_customer_phone,
    coalesce(nullif(v_whatsapp, ''), v_customer_phone), v_address,
    v_total, 'Pending', v_access_token
  ) returning id into v_order_id;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'id')::bigint;
    v_quantity := (v_item->>'qty')::integer;
    select p.* into v_product from public.products p where p.id = v_product_id;
    insert into public.order_items (order_id, product_id, quantity, unit_price)
      values (v_order_id, v_product_id, v_quantity, v_product.price);
    if v_product.stock is not null then
      update public.products set stock = stock - v_quantity where id = v_product_id;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'id', v_order_id, 'total_amount', v_total, 'access_token', v_access_token
  );
end;
$$;

create or replace function gogo_private.get_store_order(p_order_id text, p_access_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_order jsonb;
  v_items jsonb;
begin
  select pg_catalog.to_jsonb(o) - 'access_token' into v_order
  from public.orders o
  where o.id::text = p_order_id and o.access_token = p_access_token;
  if v_order is null then return null; end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'order_id', oi.order_id, 'product_id', oi.product_id,
    'quantity', oi.quantity, 'unit_price', oi.unit_price,
    'products', pg_catalog.jsonb_build_object('name', p.name, 'image_url', p.image_url)
  )), '[]'::jsonb) into v_items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  where oi.order_id::text = p_order_id;
  return v_order || pg_catalog.jsonb_build_object('order_items', v_items);
end;
$$;

revoke all on function gogo_private.place_store_order(jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function gogo_private.get_store_order(text, uuid) from public, anon, authenticated;
grant execute on function gogo_private.place_store_order(jsonb, jsonb, text) to anon, authenticated;
grant execute on function gogo_private.get_store_order(text, uuid) to anon, authenticated;

create or replace function public.place_store_order(p_customer jsonb, p_items jsonb, p_coupon text default null)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select gogo_private.place_store_order(p_customer, p_items, p_coupon); $$;
create or replace function public.get_store_order(p_order_id text, p_access_token uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select gogo_private.get_store_order(p_order_id, p_access_token); $$;
revoke all on function public.place_store_order(jsonb, jsonb, text) from public, anon, authenticated;
revoke all on function public.get_store_order(text, uuid) from public, anon, authenticated;
grant execute on function public.place_store_order(jsonb, jsonb, text) to anon, authenticated;
grant execute on function public.get_store_order(text, uuid) to anon, authenticated;

-- Only authenticated admins can write files into the public products bucket.
drop policy if exists "Anon cannot upload store assets" on storage.objects;
create policy "Anon cannot upload store assets" on storage.objects
  as restrictive for insert to anon with check (bucket_id <> 'products');
drop policy if exists "Anon cannot update store assets" on storage.objects;
create policy "Anon cannot update store assets" on storage.objects
  as restrictive for update to anon using (bucket_id <> 'products') with check (bucket_id <> 'products');
drop policy if exists "Anon cannot delete store assets" on storage.objects;
create policy "Anon cannot delete store assets" on storage.objects
  as restrictive for delete to anon using (bucket_id <> 'products');

drop policy if exists "Admins upload store assets" on storage.objects;
drop policy if exists "Only admins insert store objects" on storage.objects;
create policy "Only admins insert store objects" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'products' or (select gogo_private.is_admin()));
create policy "Admins upload store assets" on storage.objects
  for insert to authenticated with check (bucket_id = 'products' and (select gogo_private.is_admin()));
drop policy if exists "Admins update store assets" on storage.objects;
drop policy if exists "Only admins update store objects" on storage.objects;
create policy "Only admins update store objects" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'products' or (select gogo_private.is_admin()))
  with check (bucket_id <> 'products' or (select gogo_private.is_admin()));
create policy "Admins update store assets" on storage.objects
  for update to authenticated using (bucket_id = 'products' and (select gogo_private.is_admin()))
  with check (bucket_id = 'products' and (select gogo_private.is_admin()));
drop policy if exists "Admins delete store assets" on storage.objects;
drop policy if exists "Only admins delete store objects" on storage.objects;
create policy "Only admins delete store objects" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'products' or (select gogo_private.is_admin()));
create policy "Admins delete store assets" on storage.objects
  for delete to authenticated using (bucket_id = 'products' and (select gogo_private.is_admin()));

-- Remove Data API access to legacy password records, if that table exists.
do $$
declare p record;
begin
  if to_regclass('public.admins') is not null then
    for p in select policyname from pg_policies where schemaname='public' and tablename='admins'
    loop execute format('drop policy %I on public.admins', p.policyname); end loop;
    alter table public.admins enable row level security;
    revoke all on public.admins from public, anon, authenticated;
    alter table public.admins drop column if exists password_hash;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- After creating the Auth admin user in the Dashboard, replace the email below
-- and run this separately to grant that user admin privileges:
-- insert into gogo_private.admin_users (user_id)
-- select id from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL')
-- on conflict (user_id) do nothing;
