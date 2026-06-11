create table if not exists public.project_task_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  comment text not null,
  previous_status text
    check (previous_status is null or previous_status in ('todo', 'in_progress', 'completed', 'blocked')),
  new_status text
    check (new_status is null or new_status in ('todo', 'in_progress', 'completed', 'blocked')),
  task_file_id uuid references public.project_task_files(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.project_task_updates enable row level security;

drop policy if exists "Project viewers can read task updates" on public.project_task_updates;
create policy "Project viewers can read task updates"
  on public.project_task_updates
  for select
  using (public.user_can_view_project(project_id));

drop policy if exists "Project managers and assignees can add task updates"
  on public.project_task_updates;
create policy "Project managers and assignees can add task updates"
  on public.project_task_updates
  for insert
  with check (
    auth.uid() = created_by
    and (
      public.user_is_project_manager()
      or exists (
        select 1
        from public.project_tasks task
        where task.id = task_id
          and task.project_id = project_task_updates.project_id
          and task.assigned_to = auth.uid()
          and public.user_is_project_member(task.project_id)
      )
    )
  );

create index if not exists project_task_updates_task_created_idx
  on public.project_task_updates (task_id, created_at desc);

create index if not exists project_task_updates_project_created_idx
  on public.project_task_updates (project_id, created_at desc);