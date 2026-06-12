create table if not exists public.project_revenue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  category text not null default 'other'
    check (category in ('donations', 'grants', 'sales', 'sponsorship', 'services', 'other')),
  amount numeric(12, 2) not null check (amount >= 0),
  revenue_date date not null,
  source text not null default '',
  notes text not null default '',
  status text not null default 'planned'
    check (status in ('planned', 'committed', 'received', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_revenue enable row level security;

create policy "Project viewers can read revenue"
  on public.project_revenue
  for select
  using (public.user_can_view_project(project_id));

create policy "Project managers can create revenue"
  on public.project_revenue
  for insert
  with check (public.user_is_project_manager() and auth.uid() = created_by);

create policy "Project managers can update revenue"
  on public.project_revenue
  for update
  using (public.user_is_project_manager())
  with check (public.user_is_project_manager());

create policy "Project managers can delete revenue"
  on public.project_revenue
  for delete
  using (public.user_is_project_manager());

create index if not exists project_revenue_project_date_idx
  on public.project_revenue (project_id, revenue_date desc);

create index if not exists project_revenue_project_status_idx
  on public.project_revenue (project_id, status);

create index if not exists project_revenue_project_category_idx
  on public.project_revenue (project_id, category);

create or replace function public.set_project_revenue_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_revenue_updated_at on public.project_revenue;

create trigger project_revenue_updated_at
  before update on public.project_revenue
  for each row
  execute function public.set_project_revenue_updated_at();