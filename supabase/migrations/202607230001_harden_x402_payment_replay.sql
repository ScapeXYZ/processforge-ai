begin;
alter table public.agent_payments add column if not exists replay_fingerprint text;
alter table public.agent_payments add column if not exists settlement_reference text;
update public.agent_payments set replay_fingerprint = payment_reference where replay_fingerprint is null;
alter table public.agent_payments alter column replay_fingerprint set not null;
create unique index if not exists agent_payments_replay_fingerprint_unique on public.agent_payments(replay_fingerprint);
create unique index if not exists agent_payments_settlement_reference_unique on public.agent_payments(settlement_reference) where settlement_reference is not null;
commit;
notify pgrst, 'reload schema';
