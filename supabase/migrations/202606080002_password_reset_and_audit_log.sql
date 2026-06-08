alter table public.portal_users
  add column if not exists must_reset_password boolean not null default false;

create table if not exists public.portal_user_audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.portal_user_audit_logs enable row level security;

create index if not exists portal_user_audit_logs_created_at_idx
  on public.portal_user_audit_logs (created_at desc);

create index if not exists portal_user_audit_logs_target_user_id_idx
  on public.portal_user_audit_logs (target_user_id);

create or replace function public.handle_new_portal_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_users (
    id,
    email,
    first_name,
    last_name,
    is_admin,
    must_reset_password
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    false,
    false
  )
  on conflict (id) do update
  set
    email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name;

  return new;
end;
$$;
