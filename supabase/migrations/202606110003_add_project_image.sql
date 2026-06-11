alter table public.projects
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Project images are publicly readable" on storage.objects;
create policy "Project images are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'project-images');

drop policy if exists "Project managers can upload project images" on storage.objects;
create policy "Project managers can upload project images"
  on storage.objects
  for insert
  with check (
    bucket_id = 'project-images'
    and public.user_is_project_manager()
  );

drop policy if exists "Project managers can update project images" on storage.objects;
create policy "Project managers can update project images"
  on storage.objects
  for update
  using (
    bucket_id = 'project-images'
    and public.user_is_project_manager()
  )
  with check (
    bucket_id = 'project-images'
    and public.user_is_project_manager()
  );

drop policy if exists "Project managers can delete project images" on storage.objects;
create policy "Project managers can delete project images"
  on storage.objects
  for delete
  using (
    bucket_id = 'project-images'
    and public.user_is_project_manager()
  );