alter table public.portal_users
  add column if not exists can_access_projects boolean not null default false;

create or replace function public.user_has_project_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select is_admin or can_access_projects
      from public.portal_users
      where id = auth.uid()
    ),
    false
  );
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'active'
    check (status in ('active', 'on_hold', 'completed', 'cancelled')),
  start_date date,
  target_end_date date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'completed', 'blocked')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date date,
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_tasks enable row level security;

drop policy if exists "Project managers can read projects" on public.projects;
create policy "Project managers can read projects"
  on public.projects
  for select
  using (public.user_has_project_access());

drop policy if exists "Project managers can create projects" on public.projects;
create policy "Project managers can create projects"
  on public.projects
  for insert
  with check (public.user_has_project_access() and auth.uid() = created_by);

drop policy if exists "Project managers can update projects" on public.projects;
create policy "Project managers can update projects"
  on public.projects
  for update
  using (public.user_has_project_access())
  with check (public.user_has_project_access());

drop policy if exists "Project managers can delete projects" on public.projects;
create policy "Project managers can delete projects"
  on public.projects
  for delete
  using (public.user_has_project_access());

drop policy if exists "Project managers can read tasks" on public.project_tasks;
create policy "Project managers can read tasks"
  on public.project_tasks
  for select
  using (public.user_has_project_access());

drop policy if exists "Project managers can create tasks" on public.project_tasks;
create policy "Project managers can create tasks"
  on public.project_tasks
  for insert
  with check (public.user_has_project_access() and auth.uid() = created_by);

drop policy if exists "Project managers can update tasks" on public.project_tasks;
create policy "Project managers can update tasks"
  on public.project_tasks
  for update
  using (public.user_has_project_access())
  with check (public.user_has_project_access());

drop policy if exists "Project managers can delete tasks" on public.project_tasks;
create policy "Project managers can delete tasks"
  on public.project_tasks
  for delete
  using (public.user_has_project_access());

create index if not exists projects_status_created_idx
  on public.projects (status, created_at desc);

create index if not exists project_tasks_project_sort_idx
  on public.project_tasks (project_id, sort_order, created_at);

create index if not exists project_tasks_project_due_idx
  on public.project_tasks (project_id, due_date);

create or replace function public.set_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_projects_updated_at();

create or replace function public.set_project_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();

  if new.status = 'completed' and (old.status is distinct from 'completed') then
    new.completed_at = coalesce(new.completed_at, now());
  elsif new.status is distinct from 'completed' then
    new.completed_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists set_project_tasks_updated_at on public.project_tasks;
create trigger set_project_tasks_updated_at
  before update on public.project_tasks
  for each row
  execute function public.set_project_tasks_updated_at();