create table if not exists public.portal_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text not null default '',
  last_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portal_users enable row level security;

drop policy if exists "Users can read their own portal profile" on public.portal_users;
create policy "Users can read their own portal profile"
  on public.portal_users
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own portal profile names" on public.portal_users;
create policy "Users can update their own portal profile names"
  on public.portal_users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = false);

create or replace function public.set_portal_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_portal_users_updated_at on public.portal_users;
create trigger set_portal_users_updated_at
  before update on public.portal_users
  for each row
  execute function public.set_portal_users_updated_at();

create or replace function public.handle_new_portal_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.portal_users (id, email, first_name, last_name, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
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

drop trigger if exists on_auth_user_created_create_portal_user on auth.users;
create trigger on_auth_user_created_create_portal_user
  after insert on auth.users
  for each row
  execute function public.handle_new_portal_user();

insert into public.portal_users (id, email, first_name, last_name, is_admin)
select
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'first_name', ''),
  coalesce(users.raw_user_meta_data ->> 'last_name', ''),
  false
from auth.users users
where users.email is not null
on conflict (id) do update
set
  email = excluded.email,
  first_name = coalesce(nullif(public.portal_users.first_name, ''), excluded.first_name),
  last_name = coalesce(nullif(public.portal_users.last_name, ''), excluded.last_name);

update public.portal_users
set
  first_name = coalesce(nullif(first_name, ''), 'Steve'),
  last_name = coalesce(nullif(last_name, ''), 'Tipton'),
  is_admin = true
where lower(email) in (
  's.tipton@apostoliclifeupc.com',
  's.tipton@apostoliclifeupci.com',
  'stevetipton@apostoliclifeupc.com',
  'stevetipton@apostoliclifeupci.com',
  'tipton1456@gmail.com'
);
