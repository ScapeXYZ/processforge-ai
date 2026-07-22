begin;

create table if not exists public.agent_requests (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'payment_required',
  network text not null,
  price text not null,
  asset text not null,
  response_payload jsonb,
  processing_time_ms integer,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint agent_requests_idempotency_key_unique unique (idempotency_key),
  constraint agent_requests_status_check check (status in ('payment_required','payment_rejected','settling','paid','processing','completed','failed')),
  constraint agent_requests_processing_time_check check (processing_time_ms is null or processing_time_ms >= 0)
);

create table if not exists public.agent_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.agent_requests(id) on delete cascade,
  payment_reference text not null,
  transaction_hash text,
  payer_address text,
  recipient_address text not null,
  network text not null,
  asset text not null,
  amount text not null,
  verification_status text not null default 'pending',
  settlement_status text not null default 'pending',
  verified_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_payments_reference_unique unique (payment_reference),
  constraint agent_payments_request_unique unique (request_id),
  constraint agent_payments_verification_check check (verification_status in ('pending','verified','rejected')),
  constraint agent_payments_settlement_check check (settlement_status in ('pending','settled','failed'))
);

create table if not exists public.agent_usage (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.agent_requests(id) on delete cascade,
  service text not null,
  outcome text not null,
  error_code text,
  processing_time_ms integer,
  created_at timestamptz not null default now(),
  constraint agent_usage_outcome_check check (outcome in ('success','failed')),
  constraint agent_usage_request_unique unique (request_id)
);

create index if not exists agent_requests_created_at_idx on public.agent_requests(created_at desc);
create index if not exists agent_requests_status_idx on public.agent_requests(status);
create index if not exists agent_payments_transaction_idx on public.agent_payments(transaction_hash) where transaction_hash is not null;
create unique index if not exists agent_payments_transaction_unique on public.agent_payments(transaction_hash) where transaction_hash is not null;
create index if not exists agent_usage_created_at_idx on public.agent_usage(created_at desc);

alter table public.agent_requests enable row level security;
alter table public.agent_payments enable row level security;
alter table public.agent_usage enable row level security;

revoke all on public.agent_requests, public.agent_payments, public.agent_usage from anon, authenticated;
grant select, insert, update, delete on public.agent_requests, public.agent_payments, public.agent_usage to service_role;

commit;
notify pgrst, 'reload schema';
