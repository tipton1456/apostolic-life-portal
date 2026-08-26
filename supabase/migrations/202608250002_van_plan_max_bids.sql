-- Optional per-item max bids with bidder-chosen increments.
-- A user picks their bid amount (no forced minimum increment). If they enable
-- a max bid, later competing bids can raise them by their increment up to that max.

alter table public.van_plan_bids
  add column if not exists is_auto boolean not null default false;

create table if not exists public.van_plan_bid_proxies (
  item_id uuid not null references public.van_plan_items(id) on delete cascade,
  user_id uuid not null references public.van_plan_users(id) on delete cascade,
  max_bid_cents integer not null check (max_bid_cents > 0),
  increment_cents integer not null check (increment_cents > 0),
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists van_plan_bid_proxies_item_id_idx
  on public.van_plan_bid_proxies (item_id);

drop trigger if exists set_van_plan_bid_proxies_updated_at on public.van_plan_bid_proxies;
create trigger set_van_plan_bid_proxies_updated_at
  before update on public.van_plan_bid_proxies
  for each row
  execute function public.set_van_plan_updated_at();

alter table public.van_plan_bid_proxies enable row level security;

revoke all on table public.van_plan_bid_proxies from public, anon, authenticated;
grant all on table public.van_plan_bid_proxies to service_role;

create or replace function public.place_van_plan_bid(
  p_item_id uuid,
  p_user_id uuid,
  p_amount_cents integer,
  p_max_bid_enabled boolean,
  p_max_bid_cents integer,
  p_increment_cents integer
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status public.van_plan_item_status;
  v_high_user uuid;
  v_high_amount integer;
  v_placed boolean := false;
  v_settings_only boolean := false;
  v_proxy_user uuid;
  v_next_amount integer;
  v_iterations integer := 0;
  v_money text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text, 0));

  select status
  into v_status
  from public.van_plan_items
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Item not found.';
  end if;

  if v_status <> 'open' then
    raise exception 'Bidding is not open on this item.';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Enter a bid amount.';
  end if;

  if p_max_bid_enabled then
    if p_max_bid_cents is null or p_max_bid_cents <= 0 then
      raise exception 'Enter a max bid.';
    end if;

    if p_increment_cents is null or p_increment_cents <= 0 then
      raise exception 'Enter an increment greater than zero.';
    end if;

    if p_max_bid_cents < p_amount_cents then
      raise exception 'Your max bid must be at least your bid amount.';
    end if;
  end if;

  select user_id, amount_cents
  into v_high_user, v_high_amount
  from public.van_plan_bids
  where item_id = p_item_id
  order by amount_cents desc, created_at asc
  limit 1;

  if v_high_amount is not null then
    if p_user_id = v_high_user and p_amount_cents = v_high_amount then
      v_settings_only := true;
    elsif p_amount_cents <= v_high_amount then
      v_money := '$' || trim(to_char(v_high_amount / 100.0, 'FM999999990.00'));
      raise exception 'Your bid must be higher than the current high bid of %.', v_money;
    end if;
  end if;

  if not v_settings_only then
    insert into public.van_plan_bids (
      item_id,
      user_id,
      amount_cents,
      is_auto,
      created_at
    )
    values (
      p_item_id,
      p_user_id,
      p_amount_cents,
      false,
      clock_timestamp()
    );

    v_placed := true;
  end if;

  if p_max_bid_enabled then
    insert into public.van_plan_bid_proxies (
      item_id,
      user_id,
      max_bid_cents,
      increment_cents,
      enabled
    )
    values (
      p_item_id,
      p_user_id,
      p_max_bid_cents,
      p_increment_cents,
      true
    )
    on conflict (item_id, user_id) do update
    set
      max_bid_cents = excluded.max_bid_cents,
      increment_cents = excluded.increment_cents,
      enabled = true;
  else
    update public.van_plan_bid_proxies
    set enabled = false
    where item_id = p_item_id
      and user_id = p_user_id;
  end if;

  if v_placed then
    loop
      v_iterations := v_iterations + 1;

      if v_iterations > 500 then
        raise exception 'Unable to settle automatic bids.';
      end if;

      select user_id, amount_cents
      into v_high_user, v_high_amount
      from public.van_plan_bids
      where item_id = p_item_id
      order by amount_cents desc, created_at asc
      limit 1;

      v_proxy_user := null;
      v_next_amount := null;

      select
        p.user_id,
        least(v_high_amount + p.increment_cents, p.max_bid_cents)
      into v_proxy_user, v_next_amount
      from public.van_plan_bid_proxies p
      where p.item_id = p_item_id
        and p.enabled
        and p.user_id is distinct from v_high_user
        and p.max_bid_cents > v_high_amount
        and least(v_high_amount + p.increment_cents, p.max_bid_cents) > v_high_amount
      order by p.max_bid_cents desc, p.created_at asc
      limit 1;

      exit when not found or v_proxy_user is null;

      insert into public.van_plan_bids (
        item_id,
        user_id,
        amount_cents,
        is_auto,
        created_at
      )
      values (
        p_item_id,
        v_proxy_user,
        v_next_amount,
        true,
        clock_timestamp()
      );
    end loop;
  end if;

  select user_id, amount_cents
  into v_high_user, v_high_amount
  from public.van_plan_bids
  where item_id = p_item_id
  order by amount_cents desc, created_at asc
  limit 1;

  return jsonb_build_object(
    'placed_bid', v_placed,
    'high_user_id', v_high_user,
    'high_amount_cents', v_high_amount
  );
end;
$$;

revoke all on function public.place_van_plan_bid(uuid, uuid, integer, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.place_van_plan_bid(uuid, uuid, integer, boolean, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
