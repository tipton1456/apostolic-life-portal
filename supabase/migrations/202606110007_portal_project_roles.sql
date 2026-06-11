do $$
begin
  create type public.portal_project_role as enum (
    'project_manager',
    'project_participant'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.portal_users
  add column if not exists project_role public.portal_project_role;

update public.portal_users
set project_role = 'project_manager'::public.portal_project_role
where can_access_projects = true
  and project_role is null;

update public.portal_users pu
set project_role = 'project_participant'::public.portal_project_role
where project_role is null
  and exists (
    select 1
    from public.project_members pm
    where pm.user_id = pu.id
  );

create or replace function public.user_is_project_manager()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select is_admin
        or project_role = 'project_manager'::public.portal_project_role
        or can_access_projects
      from public.portal_users
      where id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.user_is_project_participant()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select project_role = 'project_participant'::public.portal_project_role
      from public.portal_users
      where id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.user_has_project_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.user_is_project_manager()
    or public.user_is_project_participant()
    or exists (
      select 1
      from public.project_members
      where user_id = auth.uid()
    );
$$;

create or replace function public.portal_user_is_project_manager(user_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select is_admin
        or project_role = 'project_manager'::public.portal_project_role
        or can_access_projects
      from public.portal_users
      where id = user_uuid
    ),
    false
  );
$$;

create or replace function public.task_assignee_allowed_for_participant(
  project_uuid uuid,
  assignee_uuid uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select assignee_uuid is not null
    and (
      public.portal_user_is_project_manager(assignee_uuid)
      or exists (
        select 1
        from public.project_members
        where project_id = project_uuid
          and user_id = assignee_uuid
      )
    );
$$;

drop policy if exists "Project managers and assignees can update tasks" on public.project_tasks;

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
      public.user_is_project_member(project_id)
      and (
        assigned_to = auth.uid()
        or public.task_assignee_allowed_for_participant(project_id, assigned_to)
      )
    )
  );