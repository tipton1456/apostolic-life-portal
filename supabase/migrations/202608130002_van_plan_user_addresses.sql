alter table public.van_plan_users
  add column if not exists address_line1 text not null default '';

alter table public.van_plan_users
  add column if not exists address_line2 text not null default '';

alter table public.van_plan_users
  add column if not exists city text not null default '';

alter table public.van_plan_users
  add column if not exists state text not null default '';

alter table public.van_plan_users
  add column if not exists zip text not null default '';
