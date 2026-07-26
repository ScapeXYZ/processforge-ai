begin;

alter table public.agent_request_payloads
  add column if not exists endpoint text;

alter table public.agent_request_payloads
  add column if not exists payer_address text;

update public.agent_request_payloads
set endpoint = 'https://processforgeai.xyz/api/agent/generate-sop'
where endpoint is null;

alter table public.agent_request_payloads
  alter column endpoint set not null;

create index if not exists agent_request_payloads_recent_endpoint_idx
  on public.agent_request_payloads(endpoint, created_at desc)
  where consumed_at is null;

create or replace function public.resolve_agent_request_payload(
  p_endpoint text,
  p_authorization_hash text,
  p_replay_key text default null,
  p_payer_address text default null,
  p_created_after timestamptz default now() - interval '10 minutes'
)
returns table (
  match_status text,
  match_count bigint,
  replay_key text,
  endpoint text,
  payer_address text,
  request_hash text,
  body_text text,
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_authorization_hash text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count bigint;
  v_row public.agent_request_payloads%rowtype;
  v_prefer_payer boolean := false;
begin
  if p_endpoint is null or p_endpoint = '' or p_authorization_hash is null or p_authorization_hash = '' then
    return query select 'unavailable'::text, 0::bigint, null::text, null::text,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  if p_replay_key is not null then
    select count(*) into v_count
    from public.agent_request_payloads arp
    where arp.replay_key = p_replay_key
      and arp.endpoint = p_endpoint
      and arp.created_at >= p_created_after
      and arp.expires_at > now()
      and (
        arp.consumed_at is null
        or arp.consumed_authorization_hash = p_authorization_hash
      )
      and (
        arp.payer_address is null
        or p_payer_address is null
        or arp.payer_address = lower(p_payer_address)
      );
  else
    if p_payer_address is not null then
      select exists (
        select 1
        from public.agent_request_payloads arp
        where arp.endpoint = p_endpoint
          and arp.payer_address = lower(p_payer_address)
          and arp.created_at >= p_created_after
          and arp.expires_at > now()
          and (
            arp.consumed_at is null
            or arp.consumed_authorization_hash = p_authorization_hash
          )
      ) into v_prefer_payer;
    end if;

    select count(*) into v_count
    from public.agent_request_payloads arp
    where arp.endpoint = p_endpoint
      and arp.created_at >= p_created_after
      and arp.expires_at > now()
      and (
        arp.consumed_at is null
        or arp.consumed_authorization_hash = p_authorization_hash
      )
      and (
        not v_prefer_payer
        or arp.payer_address = lower(p_payer_address)
      );
  end if;

  if v_count = 0 then
    return query select 'unavailable'::text, 0::bigint, null::text, null::text,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  if v_count > 1 then
    return query select 'ambiguous'::text, v_count, null::text, null::text,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  select arp.* into v_row
  from public.agent_request_payloads arp
  where arp.endpoint = p_endpoint
    and (p_replay_key is null or arp.replay_key = p_replay_key)
    and arp.created_at >= p_created_after
    and arp.expires_at > now()
    and (
      arp.consumed_at is null
      or arp.consumed_authorization_hash = p_authorization_hash
    )
    and (
      p_replay_key is not null
      or not v_prefer_payer
      or arp.payer_address = lower(p_payer_address)
    )
  order by arp.created_at desc
  limit 1
  ;

  if v_row.replay_key is null then
    return query select 'unavailable'::text, 0::bigint, null::text, null::text,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  return query select
    'found'::text,
    1::bigint,
    v_row.replay_key,
    v_row.endpoint,
    v_row.payer_address,
    v_row.request_hash,
    v_row.body_text,
    v_row.expires_at,
    v_row.consumed_at,
    v_row.consumed_authorization_hash;
end;
$$;

revoke all on function public.resolve_agent_request_payload(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.resolve_agent_request_payload(text, text, text, text, timestamptz)
  to service_role;

create or replace function public.claim_agent_request_payload(
  p_endpoint text,
  p_authorization_hash text,
  p_replay_key text,
  p_payer_address text default null,
  p_created_after timestamptz default now() - interval '10 minutes'
)
returns table (
  match_status text,
  match_count bigint,
  replay_key text,
  endpoint text,
  payer_address text,
  request_hash text,
  body_text text,
  expires_at timestamptz,
  consumed_at timestamptz,
  consumed_authorization_hash text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.agent_request_payloads%rowtype;
begin
  if p_endpoint is null or p_endpoint = ''
    or p_authorization_hash is null or p_authorization_hash = ''
    or p_replay_key is null or p_replay_key = '' then
    return query select 'unavailable'::text, 0::bigint, null::text, null::text,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_replay_key, 0));

  select arp.* into v_row
  from public.agent_request_payloads arp
  where arp.replay_key = p_replay_key
    and arp.endpoint = p_endpoint
    and arp.created_at >= p_created_after
    and arp.expires_at > now()
    and (
      arp.consumed_at is null
      or arp.consumed_authorization_hash = p_authorization_hash
    )
    and (
      arp.payer_address is null
      or p_payer_address is null
      or arp.payer_address = lower(p_payer_address)
    )
  for update;

  if v_row.replay_key is null then
    return query select 'unavailable'::text, 0::bigint, null::text, null::text,
      null::text, null::text, null::text, null::timestamptz, null::timestamptz, null::text;
    return;
  end if;

  if v_row.consumed_at is null then
    update public.agent_request_payloads arp
    set consumed_at = now(),
        consumed_authorization_hash = p_authorization_hash
    where arp.replay_key = v_row.replay_key
    returning arp.* into v_row;
  end if;

  return query select
    'found'::text,
    1::bigint,
    v_row.replay_key,
    v_row.endpoint,
    v_row.payer_address,
    v_row.request_hash,
    v_row.body_text,
    v_row.expires_at,
    v_row.consumed_at,
    v_row.consumed_authorization_hash;
end;
$$;

revoke all on function public.claim_agent_request_payload(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_agent_request_payload(text, text, text, text, timestamptz)
  to service_role;

commit;

notify pgrst, 'reload schema';
