create table if not exists public.project_managers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  milestone_date date not null,
  sort_order integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

alter table public.project_tasks
  add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null,
  add column if not exists due_date_mode text not null default 'custom'
    check (due_date_mode in ('milestone', 'custom'));

alter table public.project_managers enable row level security;
alter table public.project_milestones enable row level security;

create or replace function public.user_is_assigned_project_manager(project_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.project_managers
    where project_id = project_uuid
      and user_id = auth.uid()
  );
$$;

create or replace function public.user_can_manage_project(project_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select is_admin
      from public.portal_users
      where id = auth.uid()
    ),
    false
  )
  or public.user_is_assigned_project_manager(project_uuid);
$$;

create or replace function public.user_can_view_project(project_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.user_can_manage_project(project_uuid)
    or public.user_is_project_member(project_uuid);
$$;

create or replace function public.user_has_project_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.user_is_project_manager()
    or exists (
      select 1
      from public.project_managers
      where user_id = auth.uid()
    )
    or exists (
      select 1
      from public.project_members
      where user_id = auth.uid()
    );
$$;

drop policy if exists "Project managers can read projects" on public.projects;
drop policy if exists "Project viewers can read projects" on public.projects;
drop policy if exists "Project managers can create projects" on public.projects;
drop policy if exists "Project managers can update projects" on public.projects;
drop policy if exists "Project managers can delete projects" on public.projects;
drop policy if exists "Assigned project managers can update projects" on public.projects;
drop policy if exists "Assigned project managers can delete projects" on public.projects;

create policy "Project viewers can read projects"
  on public.projects
  for select
  using (public.user_can_view_project(id));

create policy "Project managers can create projects"
  on public.projects
  for insert
  with check (public.user_is_project_manager() and auth.uid() = created_by);

create policy "Assigned project managers can update projects"
  on public.projects
  for update
  using (public.user_can_manage_project(id))
  with check (public.user_can_manage_project(id));

create policy "Assigned project managers can delete projects"
  on public.projects
  for delete
  using (public.user_can_manage_project(id));

drop policy if exists "Project managers can create tasks" on public.project_tasks;
drop policy if exists "Project managers can update tasks" on public.project_tasks;
drop policy if exists "Project managers and assignees can update tasks" on public.project_tasks;
drop policy if exists "Project managers can delete tasks" on public.project_tasks;
drop policy if exists "Assigned project managers can create tasks" on public.project_tasks;
drop policy if exists "Assigned project managers and assignees can update tasks" on public.project_tasks;
drop policy if exists "Assigned project managers can delete tasks" on public.project_tasks;

create policy "Assigned project managers can create tasks"
  on public.project_tasks
  for insert
  with check (
    public.user_can_manage_project(project_id)
    and auth.uid() = created_by
  );

create policy "Assigned project managers and assignees can update tasks"
  on public.project_tasks
  for update
  using (
    public.user_can_manage_project(project_id)
    or (
      assigned_to = auth.uid()
      and public.user_is_project_member(project_id)
    )
  )
  with check (
    public.user_can_manage_project(project_id)
    or (
      assigned_to = auth.uid()
      and public.user_is_project_member(project_id)
    )
  );

create policy "Assigned project managers can delete tasks"
  on public.project_tasks
  for delete
  using (public.user_can_manage_project(project_id));

drop policy if exists "Project managers can add members" on public.project_members;
drop policy if exists "Project managers can remove members" on public.project_members;
drop policy if exists "Assigned project managers can add members" on public.project_members;
drop policy if exists "Assigned project managers can remove members" on public.project_members;

create policy "Assigned project managers can add members"
  on public.project_members
  for insert
  with check (
    public.user_can_manage_project(project_id)
    and auth.uid() = added_by
  );

create policy "Assigned project managers can remove members"
  on public.project_members
  for delete
  using (public.user_can_manage_project(project_id));

drop policy if exists "Project viewers can read project managers" on public.project_managers;
drop policy if exists "Assigned project managers can add project managers" on public.project_managers;
drop policy if exists "Assigned project managers can remove project managers" on public.project_managers;

create policy "Project viewers can read project managers"
  on public.project_managers
  for select
  using (public.user_can_view_project(project_id));

create policy "Assigned project managers can add project managers"
  on public.project_managers
  for insert
  with check (
    public.user_can_manage_project(project_id)
    and auth.uid() = added_by
  );

create policy "Assigned project managers can remove project managers"
  on public.project_managers
  for delete
  using (public.user_can_manage_project(project_id));

drop policy if exists "Project viewers can read milestones" on public.project_milestones;
drop policy if exists "Assigned project managers can create milestones" on public.project_milestones;
drop policy if exists "Assigned project managers can update milestones" on public.project_milestones;
drop policy if exists "Assigned project managers can delete milestones" on public.project_milestones;

create policy "Project viewers can read milestones"
  on public.project_milestones
  for select
  using (public.user_can_view_project(project_id));

create policy "Assigned project managers can create milestones"
  on public.project_milestones
  for insert
  with check (
    public.user_can_manage_project(project_id)
    and auth.uid() = created_by
  );

create policy "Assigned project managers can update milestones"
  on public.project_milestones
  for update
  using (public.user_can_manage_project(project_id))
  with check (public.user_can_manage_project(project_id));

create policy "Assigned project managers can delete milestones"
  on public.project_milestones
  for delete
  using (public.user_can_manage_project(project_id));

create index if not exists project_managers_project_user_idx
  on public.project_managers (project_id, user_id);

create index if not exists project_managers_user_idx
  on public.project_managers (user_id);

create index if not exists project_milestones_project_date_idx
  on public.project_milestones (project_id, milestone_date, sort_order);

create index if not exists project_tasks_milestone_idx
  on public.project_tasks (milestone_id);

create or replace function public.set_project_milestones_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_milestones_updated_at on public.project_milestones;

create trigger project_milestones_updated_at
  before update on public.project_milestones
  for each row
  execute function public.set_project_milestones_updated_at();

insert into public.project_managers (project_id, user_id, added_by)
select p.id, p.created_by, p.created_by
from public.projects p
join public.portal_users u on u.id = p.created_by
where u.is_admin
  or u.project_role = 'project_manager'
  or u.can_access_projects
on conflict (project_id, user_id) do nothing;