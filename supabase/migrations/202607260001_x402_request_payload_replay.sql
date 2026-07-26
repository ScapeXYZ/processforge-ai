begin;

create table if not exists public.agent_request_payloads (
  replay_key text primary key,
  request_hash text not null,
  body_text text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_authorization_hash text,
  created_at timestamptz not null default now(),
  constraint agent_request_payloads_consumption_check check (
    (consumed_at is null and consumed_authorization_hash is null)
    or (consumed_at is not null and consumed_authorization_hash is not null)
  )
);

create index if not exists agent_request_payloads_expires_at_idx
  on public.agent_request_payloads(expires_at);

alter table public.agent_request_payloads enable row level security;

revoke all on public.agent_request_payloads from public, anon, authenticated;
grant select, insert, update, delete on public.agent_request_payloads to service_role;

commit;

notify pgrst, 'reload schema';
