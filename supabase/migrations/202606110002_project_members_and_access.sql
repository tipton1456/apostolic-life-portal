create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (project_id, user_id)
);

alter table public.project_members enable row level security;

create or replace function public.user_is_project_manager()
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

create or replace function public.user_is_project_member(project_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members
    where project_id = project_uuid
      and user_id = auth.uid()
  );
$$;

create or replace function public.user_can_view_project(project_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.user_is_project_manager()
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
      from public.project_members
      where user_id = auth.uid()
    );
$$;

drop policy if exists "Project managers can read projects" on public.projects;
drop policy if exists "Project managers can create projects" on public.projects;
drop policy if exists "Project managers can update projects" on public.projects;
drop policy if exists "Project managers can delete projects" on public.projects;

create policy "Project viewers can read projects"
  on public.projects
  for select
  using (public.user_can_view_project(id));

create policy "Project managers can create projects"
  on public.projects
  for insert
  with check (public.user_is_project_manager() and auth.uid() = created_by);

create policy "Project managers can update projects"
  on public.projects
  for update
  using (public.user_is_project_manager())
  with check (public.user_is_project_manager());

create policy "Project managers can delete projects"
  on public.projects
  for delete
  using (public.user_is_project_manager());

drop policy if exists "Project managers can read tasks" on public.project_tasks;
drop policy if exists "Project managers can create tasks" on public.project_tasks;
drop policy if exists "Project managers can update tasks" on public.project_tasks;
drop policy if exists "Project managers can delete tasks" on public.project_tasks;

create policy "Project viewers can read tasks"
  on public.project_tasks
  for select
  using (public.user_can_view_project(project_id));

create policy "Project managers can create tasks"
  on public.project_tasks
  for insert
  with check (public.user_is_project_manager() and auth.uid() = created_by);

create policy "Project managers and assignees can update tasks"
  on public.project_tasks
  for update
  using (
    public.user_is_project_manager()
    or (
      assigned_to = auth.uid()
      and public.user_is_project_member(project_id)
    )
  )
  with check (
    public.user_is_project_manager()
    or (
      assigned_to = auth.uid()
      and public.user_is_project_member(project_id)
    )
  );

create policy "Project managers can delete tasks"
  on public.project_tasks
  for delete
  using (public.user_is_project_manager());

drop policy if exists "Project viewers can read members" on public.project_members;
drop policy if exists "Project managers can add members" on public.project_members;
drop policy if exists "Project managers can remove members" on public.project_members;

create policy "Project viewers can read members"
  on public.project_members
  for select
  using (public.user_can_view_project(project_id));

create policy "Project managers can add members"
  on public.project_members
  for insert
  with check (
    public.user_is_project_manager()
    and auth.uid() = added_by
  );

create policy "Project managers can remove members"
  on public.project_members
  for delete
  using (public.user_is_project_manager());

create index if not exists project_members_project_user_idx
  on public.project_members (project_id, user_id);

create index if not exists project_members_user_idx
  on public.project_members (user_id);