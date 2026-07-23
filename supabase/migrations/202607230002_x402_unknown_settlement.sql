begin;

alter table public.agent_payments
  add column if not exists settlement_reference text;

alter table public.agent_payments
  drop constraint if exists agent_payments_settlement_check;

alter table public.agent_payments
  add constraint agent_payments_settlement_check
  check (settlement_status in ('pending','settled','failed','unknown'));

create unique index if not exists agent_payments_settlement_reference_unique
  on public.agent_payments(settlement_reference)
  where settlement_reference is not null;

commit;

notify pgrst, 'reload schema';
