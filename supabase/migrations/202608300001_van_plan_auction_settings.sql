-- Singleton auction open/close override. When status is 'scheduled', the
-- calendar in lib/van-plan/constants.ts is used. 'open' and 'closed' force
-- bidding live or shut regardless of the scheduled times.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'van_plan_auction_status'
  ) then
    create type public.van_plan_auction_status as enum ('scheduled', 'open', 'closed');
  end if;
end
$$;

create table if not exists public.van_plan_auction_settings (
  id integer primary key default 1 check (id = 1),
  status public.van_plan_auction_status not null default 'scheduled',
  updated_by uuid references public.van_plan_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_van_plan_auction_settings_updated_at
  on public.van_plan_auction_settings;
create trigger set_van_plan_auction_settings_updated_at
  before update on public.van_plan_auction_settings
  for each row
  execute function public.set_van_plan_updated_at();

alter table public.van_plan_auction_settings enable row level security;

revoke all on table public.van_plan_auction_settings from public, anon, authenticated;
grant all on table public.van_plan_auction_settings to service_role;
