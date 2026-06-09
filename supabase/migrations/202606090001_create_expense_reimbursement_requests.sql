create table if not exists public.expense_reimbursement_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  cognito_form_id text not null,
  cognito_entry_id text not null unique,
  report_type text not null default '',
  event text not null default '',
  request_date date,
  amount_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expense_reimbursement_requests enable row level security;

drop policy if exists "Users can read their own reimbursement requests"
  on public.expense_reimbursement_requests;
create policy "Users can read their own reimbursement requests"
  on public.expense_reimbursement_requests
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own reimbursement requests"
  on public.expense_reimbursement_requests;
create policy "Users can create their own reimbursement requests"
  on public.expense_reimbursement_requests
  for insert
  with check (auth.uid() = user_id);

create index if not exists expense_reimbursement_requests_user_created_idx
  on public.expense_reimbursement_requests (user_id, created_at desc);

create or replace function public.set_expense_reimbursement_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_expense_reimbursement_requests_updated_at
  on public.expense_reimbursement_requests;
create trigger set_expense_reimbursement_requests_updated_at
  before update on public.expense_reimbursement_requests
  for each row
  execute function public.set_expense_reimbursement_requests_updated_at();
