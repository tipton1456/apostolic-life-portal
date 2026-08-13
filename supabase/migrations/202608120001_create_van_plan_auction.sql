-- The Great Van Plan silent auction
-- Standalone from portal auth. All application access goes through the
-- service role after the auction module checks its own session.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'van_plan_permission'
  ) then
    create type public.van_plan_permission as enum ('admin', 'auctioneer', 'user');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'van_plan_item_status'
  ) then
    create type public.van_plan_item_status as enum ('draft', 'open', 'closed', 'sold');
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'van_plan_invoice_status'
  ) then
    create type public.van_plan_invoice_status as enum ('pending', 'sent', 'failed');
  end if;
end
$$;

create table if not exists public.van_plan_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  phone_digits text not null,
  permission public.van_plan_permission not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint van_plan_users_email_unique unique (email),
  constraint van_plan_users_phone_digits_unique unique (phone_digits)
);

create table if not exists public.van_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.van_plan_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.van_plan_login_attempts (
  id bigserial primary key,
  email text not null,
  ip_address text not null default '',
  success boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.van_plan_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  starting_price_cents integer not null check (starting_price_cents >= 0),
  status public.van_plan_item_status not null default 'draft',
  created_by uuid references public.van_plan_users(id) on delete set null,
  sold_to_user_id uuid references public.van_plan_users(id) on delete set null,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.van_plan_item_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.van_plan_items(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.van_plan_bids (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.van_plan_items(id) on delete cascade,
  user_id uuid not null references public.van_plan_users(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.van_plan_invoices (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.van_plan_items(id) on delete cascade,
  user_id uuid not null references public.van_plan_users(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  memo text not null default 'The Great Van Plan',
  status public.van_plan_invoice_status not null default 'pending',
  stripe_customer_id text,
  stripe_invoice_id text,
  stripe_invoice_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists van_plan_sessions_user_id_idx
  on public.van_plan_sessions (user_id);

create index if not exists van_plan_sessions_expires_at_idx
  on public.van_plan_sessions (expires_at);

create index if not exists van_plan_login_attempts_lookup_idx
  on public.van_plan_login_attempts (email, created_at desc);

create index if not exists van_plan_items_status_idx
  on public.van_plan_items (status);

create index if not exists van_plan_item_images_item_id_idx
  on public.van_plan_item_images (item_id, sort_order);

create index if not exists van_plan_bids_item_id_idx
  on public.van_plan_bids (item_id, amount_cents desc, created_at desc);

create index if not exists van_plan_bids_user_id_idx
  on public.van_plan_bids (user_id);

create index if not exists van_plan_invoices_item_id_idx
  on public.van_plan_invoices (item_id, created_at desc);

create or replace function public.set_van_plan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_van_plan_users_updated_at on public.van_plan_users;
create trigger set_van_plan_users_updated_at
  before update on public.van_plan_users
  for each row
  execute function public.set_van_plan_updated_at();

drop trigger if exists set_van_plan_items_updated_at on public.van_plan_items;
create trigger set_van_plan_items_updated_at
  before update on public.van_plan_items
  for each row
  execute function public.set_van_plan_updated_at();

drop trigger if exists set_van_plan_invoices_updated_at on public.van_plan_invoices;
create trigger set_van_plan_invoices_updated_at
  before update on public.van_plan_invoices
  for each row
  execute function public.set_van_plan_updated_at();

alter table public.van_plan_users enable row level security;
alter table public.van_plan_sessions enable row level security;
alter table public.van_plan_login_attempts enable row level security;
alter table public.van_plan_items enable row level security;
alter table public.van_plan_item_images enable row level security;
alter table public.van_plan_bids enable row level security;
alter table public.van_plan_invoices enable row level security;

revoke all on table public.van_plan_users from public, anon, authenticated;
revoke all on table public.van_plan_sessions from public, anon, authenticated;
revoke all on table public.van_plan_login_attempts from public, anon, authenticated;
revoke all on table public.van_plan_items from public, anon, authenticated;
revoke all on table public.van_plan_item_images from public, anon, authenticated;
revoke all on table public.van_plan_bids from public, anon, authenticated;
revoke all on table public.van_plan_invoices from public, anon, authenticated;

grant all on table public.van_plan_users to service_role;
grant all on table public.van_plan_sessions to service_role;
grant all on table public.van_plan_login_attempts to service_role;
grant all on table public.van_plan_items to service_role;
grant all on table public.van_plan_item_images to service_role;
grant all on table public.van_plan_bids to service_role;
grant all on table public.van_plan_invoices to service_role;
grant usage, select on sequence public.van_plan_login_attempts_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'van-plan-images',
  'van-plan-images',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
