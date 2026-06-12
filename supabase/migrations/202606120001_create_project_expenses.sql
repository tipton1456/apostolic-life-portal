create table if not exists public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  description text not null,
  category text not null default 'other'
    check (category in ('labor', 'materials', 'equipment', 'travel', 'fees', 'other')),
  amount numeric(12, 2) not null check (amount >= 0),
  expense_date date not null,
  vendor text not null default '',
  notes text not null default '',
  status text not null default 'planned'
    check (status in ('planned', 'committed', 'paid', 'cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_expenses enable row level security;

create policy "Project viewers can read expenses"
  on public.project_expenses
  for select
  using (public.user_can_view_project(project_id));

create policy "Project managers can create expenses"
  on public.project_expenses
  for insert
  with check (public.user_is_project_manager() and auth.uid() = created_by);

create policy "Project managers can update expenses"
  on public.project_expenses
  for update
  using (public.user_is_project_manager())
  with check (public.user_is_project_manager());

create policy "Project managers can delete expenses"
  on public.project_expenses
  for delete
  using (public.user_is_project_manager());

create index if not exists project_expenses_project_date_idx
  on public.project_expenses (project_id, expense_date desc);

create index if not exists project_expenses_project_status_idx
  on public.project_expenses (project_id, status);

create index if not exists project_expenses_project_category_idx
  on public.project_expenses (project_id, category);

create or replace function public.set_project_expenses_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists project_expenses_updated_at on public.project_expenses;

create trigger project_expenses_updated_at
  before update on public.project_expenses
  for each row
  execute function public.set_project_expenses_updated_at();