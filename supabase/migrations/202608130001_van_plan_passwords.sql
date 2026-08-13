alter table public.van_plan_users
  add column if not exists password_hash text;

alter table public.van_plan_users
  add column if not exists must_reset_password boolean not null default false;
