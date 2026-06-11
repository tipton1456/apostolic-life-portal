insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Project viewers can read project files" on storage.objects;
create policy "Project viewers can read project files"
  on storage.objects
  for select
  using (
    bucket_id = 'project-files'
    and public.user_can_view_project(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "Project members can upload project files" on storage.objects;
create policy "Project members can upload project files"
  on storage.objects
  for insert
  with check (
    bucket_id = 'project-files'
    and auth.uid() is not null
    and public.user_can_view_project(((storage.foldername(name))[1])::uuid)
    and (
      public.user_is_project_manager()
      or public.user_is_project_member(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists "Project managers can delete project files" on storage.objects;
create policy "Project managers can delete project files"
  on storage.objects
  for delete
  using (
    bucket_id = 'project-files'
    and public.user_is_project_manager()
  );