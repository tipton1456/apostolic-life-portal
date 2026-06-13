-- Link project expenses to Cognito Forms reimbursements for bidirectional sync.
-- 
-- Goals:
-- - When an expense report is filled in the published Cognito form (or the portal custom form)
--   and a project is selected, the expense appears in the project's expense area.
-- - Pre-approval: status = 'committed' (treated as "outstanding" in reports/stats).
-- - On approval in Cognito (Entry_Status / workflow): update to 'paid'.
--
-- The standalone Cognito expense form needs a "Project" (or "Project Name") field
-- (ideally a Lookup against a separate Projects catalog form — see cognito-forms.ts for sync helper).

alter table public.project_expenses
  add column if not exists cognito_entry_id text;

alter table public.project_expenses
  add column if not exists source text not null default 'manual';

-- Valid sources for future validation (enforced in application layer for now):
-- 'manual'               — entered directly in the project UI
-- 'cognito-reimbursement' — originated from the published Cognito expense form
-- 'portal-reimbursement'  — originated from the portal's custom expense-reimbursement form

create index if not exists project_expenses_cognito_entry_idx
  on public.project_expenses (cognito_entry_id)
  where cognito_entry_id is not null;

create index if not exists project_expenses_source_idx
  on public.project_expenses (source);

comment on column public.project_expenses.cognito_entry_id is 
  'Cognito Forms entry identifier (e.g. "3-12345") when this expense came from a reimbursement submission that included a project. Used for deduping and status sync on approval.';

comment on column public.project_expenses.source is 
  'Origin of the record. "committed" status means outstanding/pending approval; "paid" means the Cognito report (or equivalent) has been approved.';

-- No policy changes needed — existing RLS still applies (viewers can read, managers manage). 
-- Imported expenses will be visible to project viewers/managers once created.