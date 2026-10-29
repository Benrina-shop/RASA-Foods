-- Run once in the project's Supabase SQL Editor, as the database owner.
-- This setup script is transactional and can be re-run without deleting reactions.
-- Keep gogo_private OUT of the Data API's exposed schemas.
begin;

create schema if not exists gogo_private;
revoke all on schema gogo_private from public;
grant usage on schema gogo_private to anon, authenticated;

create table if not exists gogo_private.product_reactions (
  product_id bigint not null references public.products(id) on delete cascade,
  visitor_hash bytea not null check (octet_length(visitor_hash) = 32),
  reaction text not null check (reaction in ('like', 'love', 'wow')),
  primary key (product_id, visitor_hash)
);
alter table gogo_private.product_reactions enable row level security;
revoke all on gogo_private.product_reactions from public, anon, authenticated;
-- No client table policies/grants: only the narrow functions below access rows.
-- The primary key also indexes product_id for the count queries and FK cleanup.

create or replace function gogo_private.get_product_reactions(
  p_product_ids bigint[], p_visitor_token uuid default null
)
returns table (product_id bigint, like_count bigint, love_count bigint, wow_count bigint, my_reaction text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_product_ids is null or cardinality(p_product_ids) > 100 then
    raise exception 'Provide at most 100 product IDs' using errcode = '22023';
  end if;
  return query
    select p.id,
      count(r.reaction) filter (where r.reaction = 'like'),
      count(r.reaction) filter (where r.reaction = 'love'),
      count(r.reaction) filter (where r.reaction = 'wow'),
      max(r.reaction) filter (where r.visitor_hash = pg_catalog.sha256(pg_catalog.uuid_send(p_visitor_token)))
    from public.products p
    left join gogo_private.product_reactions r on r.product_id = p.id
    where p.id = any(p_product_ids)
    group by p.id;
end;
$$;

create or replace function gogo_private.set_product_reaction(
  p_product_id bigint, p_reaction text, p_visitor_token uuid
)
returns table (product_id bigint, like_count bigint, love_count bigint, wow_count bigint, my_reaction text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  token_hash bytea;
begin
  if p_visitor_token is null or p_visitor_token = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'A visitor token is required' using errcode = '22023';
  end if;
  if p_reaction is not null and p_reaction not in ('like', 'love', 'wow') then
    raise exception 'Invalid reaction' using errcode = '22023';
  end if;
  -- Hold a key-share lock so product deletion cannot race an insert.
  perform 1 from public.products p where p.id = p_product_id for key share;
  if not found then
    raise exception 'Product not found' using errcode = '22023';
  end if;
  token_hash := pg_catalog.sha256(pg_catalog.uuid_send(p_visitor_token));
  -- Serialize writes for this visitor/product, including deletes with no row yet.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_product_id::text || ':' || p_visitor_token::text, 0));
  if p_reaction is null then
    delete from gogo_private.product_reactions r
    where r.product_id = p_product_id and r.visitor_hash = token_hash;
  else
    insert into gogo_private.product_reactions as r (product_id, visitor_hash, reaction)
      values (p_product_id, token_hash, p_reaction)
    on conflict on constraint product_reactions_pkey
      do update set reaction = excluded.reaction;
  end if;
  return query select * from gogo_private.get_product_reactions(array[p_product_id], p_visitor_token);
end;
$$;

-- PostgREST endpoints are SECURITY INVOKER; privileged logic stays unexposed.
create or replace function public.get_product_reactions(p_product_ids bigint[], p_visitor_token uuid default null)
returns table (product_id bigint, like_count bigint, love_count bigint, wow_count bigint, my_reaction text)
language sql stable security invoker set search_path = ''
as $$ select * from gogo_private.get_product_reactions(p_product_ids, p_visitor_token); $$;

create or replace function public.set_product_reaction(p_product_id bigint, p_reaction text, p_visitor_token uuid)
returns table (product_id bigint, like_count bigint, love_count bigint, wow_count bigint, my_reaction text)
language sql volatile security invoker set search_path = ''
as $$ select * from gogo_private.set_product_reaction(p_product_id, p_reaction, p_visitor_token); $$;

revoke all on function gogo_private.get_product_reactions(bigint[], uuid) from public;
revoke all on function gogo_private.set_product_reaction(bigint, text, uuid) from public;
revoke all on function public.get_product_reactions(bigint[], uuid) from public;
revoke all on function public.set_product_reaction(bigint, text, uuid) from public;
grant execute on function gogo_private.get_product_reactions(bigint[], uuid) to anon, authenticated;
grant execute on function gogo_private.set_product_reaction(bigint, text, uuid) to anon, authenticated;
grant execute on function public.get_product_reactions(bigint[], uuid) to anon, authenticated;
grant execute on function public.set_product_reaction(bigint, text, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
