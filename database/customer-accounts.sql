-- Customer-owned cart and wishlist data. Run once in the Supabase SQL Editor
-- for the same project configured in supabase-config.js.
create table if not exists public.customer_cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.customer_wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  address text not null check (length(trim(address)) between 1 and 500),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_cart_items enable row level security;
alter table public.customer_wishlist_items enable row level security;
alter table public.customer_profiles enable row level security;

revoke all on public.customer_cart_items from public, anon, authenticated;
revoke all on public.customer_wishlist_items from public, anon, authenticated;
revoke all on public.customer_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.customer_cart_items to authenticated;
grant select, insert, update, delete on public.customer_wishlist_items to authenticated;
grant select, insert, update on public.customer_profiles to authenticated;

drop policy if exists "Customers read their own profile" on public.customer_profiles;
create policy "Customers read their own profile"
  on public.customer_profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Customers create their own profile" on public.customer_profiles;
create policy "Customers create their own profile"
  on public.customer_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers update their own profile" on public.customer_profiles;
create policy "Customers update their own profile"
  on public.customer_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers manage their own cart" on public.customer_cart_items;
create policy "Customers manage their own cart"
  on public.customer_cart_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Customers manage their own wishlist" on public.customer_wishlist_items;
create policy "Customers manage their own wishlist"
  on public.customer_wishlist_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.set_customer_cart_item_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_customer_cart_item_updated_at() from public, anon, authenticated;

drop trigger if exists customer_cart_items_updated_at on public.customer_cart_items;
create trigger customer_cart_items_updated_at
  before update on public.customer_cart_items
  for each row execute function public.set_customer_cart_item_updated_at();

drop trigger if exists customer_profiles_updated_at on public.customer_profiles;
create trigger customer_profiles_updated_at
  before update on public.customer_profiles
  for each row execute function public.set_customer_cart_item_updated_at();

comment on table public.customer_cart_items is 'Private cart quantities keyed by Supabase Auth user.';
comment on table public.customer_wishlist_items is 'Private wishlist membership keyed by Supabase Auth user.';
comment on table public.customer_profiles is 'Private name and shipping address keyed by Supabase Auth user; passwords stay in Supabase Auth.';
