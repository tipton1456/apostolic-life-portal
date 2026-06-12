update public.project_revenue
set status = 'committed'
where status = 'planned';

update public.project_expenses
set status = 'committed'
where status = 'planned';

alter table public.project_revenue
  drop constraint if exists project_revenue_status_check;

alter table public.project_revenue
  alter column status set default 'committed';

alter table public.project_revenue
  add constraint project_revenue_status_check
  check (status in ('committed', 'received', 'cancelled'));

alter table public.project_expenses
  drop constraint if exists project_expenses_status_check;

alter table public.project_expenses
  alter column status set default 'committed';

alter table public.project_expenses
  add constraint project_expenses_status_check
  check (status in ('committed', 'paid', 'cancelled'));