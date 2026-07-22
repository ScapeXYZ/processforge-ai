begin;

alter table public.sops add column if not exists analytics jsonb;
alter table public.sops add column if not exists quality_score integer;
alter table public.sops add column if not exists risk_level text;
alter table public.sops add column if not exists analyzed_at timestamptz;

do $constraints$
begin
  alter table public.sops add constraint sops_quality_score_check
    check (quality_score is null or quality_score between 0 and 100);
exception when duplicate_object then null;
end
$constraints$;

do $constraints$
begin
  alter table public.sops add constraint sops_risk_level_check
    check (risk_level is null or risk_level in ('critical','high','medium','low'));
exception when duplicate_object then null;
end
$constraints$;

create index if not exists sops_workspace_quality_idx
  on public.sops (workspace_id, quality_score desc nulls last);
create index if not exists sops_workspace_risk_idx
  on public.sops (workspace_id, risk_level)
  where risk_level is not null;

commit;

notify pgrst, 'reload schema';
