create table if not exists public.project_task_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid not null references public.project_tasks(id) on delete cascade,
  file_name text not null,
  file_size bigint not null default 0,
  mime_type text not null default 'application/octet-stream',
  dropbox_path text not null unique,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.project_task_files enable row level security;

drop policy if exists "Project viewers can read task files" on public.project_task_files;
create policy "Project viewers can read task files"
  on public.project_task_files
  for select
  using (public.user_can_view_project(project_id));

drop policy if exists "Project members can upload task files" on public.project_task_files;
create policy "Project members can upload task files"
  on public.project_task_files
  for insert
  with check (
    public.user_can_view_project(project_id)
    and auth.uid() = uploaded_by
    and (
      public.user_is_project_manager()
      or public.user_is_project_member(project_id)
    )
  );

drop policy if exists "Project managers and uploaders can delete task files"
  on public.project_task_files;
create policy "Project managers and uploaders can delete task files"
  on public.project_task_files
  for delete
  using (
    public.user_is_project_manager()
    or uploaded_by = auth.uid()
  );

create index if not exists project_task_files_project_created_idx
  on public.project_task_files (project_id, created_at desc);

create index if not exists project_task_files_task_created_idx
  on public.project_task_files (task_id, created_at desc);

create index if not exists project_task_files_uploaded_by_idx
  on public.project_task_files (uploaded_by, created_at desc);