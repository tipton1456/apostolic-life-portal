alter table public.communication_message_batches
  add column if not exists subject text,
  add column if not exists attachment_names text[] not null default '{}'::text[];

alter table public.communication_message_recipients
  add column if not exists recipient_email text,
  add column if not exists resend_message_id text;

create index if not exists communication_message_recipients_recipient_email_idx
  on public.communication_message_recipients (recipient_email);