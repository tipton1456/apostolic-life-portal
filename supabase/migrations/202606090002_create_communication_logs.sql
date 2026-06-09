create table if not exists public.communication_opt_outs (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'sms',
  phone_number text not null,
  source text not null default 'manual',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, phone_number)
);

create table if not exists public.communication_message_batches (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'sms',
  group_id text,
  group_name text,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_email text,
  message_body text not null,
  recipient_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  skipped_count integer not null default 0,
  status text not null default 'created',
  created_at timestamptz not null default now()
);

create table if not exists public.communication_message_recipients (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.communication_message_batches(id) on delete cascade,
  person_id text,
  person_name text not null,
  phone_number text,
  phone_type text,
  status text not null default 'queued',
  twilio_message_sid text,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communication_opt_outs enable row level security;
alter table public.communication_message_batches enable row level security;
alter table public.communication_message_recipients enable row level security;

create index if not exists communication_opt_outs_phone_number_idx
  on public.communication_opt_outs (channel, phone_number);

create index if not exists communication_message_batches_created_at_idx
  on public.communication_message_batches (created_at desc);

create index if not exists communication_message_recipients_batch_id_idx
  on public.communication_message_recipients (batch_id);

create index if not exists communication_message_recipients_status_idx
  on public.communication_message_recipients (status);
