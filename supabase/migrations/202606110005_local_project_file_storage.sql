alter table public.projects
  add column if not exists archived_files_url text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_task_files'
      and column_name = 'dropbox_path'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_task_files'
      and column_name = 'storage_path'
  ) then
    alter table public.project_task_files
      rename column dropbox_path to storage_path;
  end if;
end $$;