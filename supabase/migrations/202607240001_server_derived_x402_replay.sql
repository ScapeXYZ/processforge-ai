begin;

create or replace function public.reserve_agent_verified_payment(
  p_replay_key text,
  p_request_hash text,
  p_service text,
  p_network text,
  p_price text,
  p_asset text,
  p_payer_address text,
  p_recipient_address text,
  p_amount text
)
returns table (
  request_id uuid,
  request_status text,
  error_code text,
  response_payload jsonb,
  settlement_status text,
  is_new boolean,
  hash_matches boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.agent_requests%rowtype;
  v_payment public.agent_payments%rowtype;
  v_inserted_id uuid;
begin
  insert into public.agent_requests (
    service,
    idempotency_key,
    request_hash,
    status,
    network,
    price,
    asset
  )
  values (
    p_service,
    p_replay_key,
    p_request_hash,
    'settling',
    p_network,
    p_price,
    p_asset
  )
  on conflict (idempotency_key) do nothing
  returning id into v_inserted_id;

  select *
  into v_request
  from public.agent_requests as ar
  where ar.idempotency_key = p_replay_key
  for update;

  if v_request.id is null then
    raise exception 'VERIFIED_PAYMENT_REQUEST_MISSING';
  end if;

  if v_inserted_id is not null then
    insert into public.agent_payments (
      request_id,
      payment_reference,
      replay_fingerprint,
      transaction_hash,
      settlement_reference,
      payer_address,
      recipient_address,
      network,
      asset,
      amount,
      verification_status,
      settlement_status,
      verified_at,
      settled_at
    )
    values (
      v_request.id,
      p_replay_key,
      p_replay_key,
      null,
      null,
      p_payer_address,
      p_recipient_address,
      p_network,
      p_asset,
      p_amount,
      'verified',
      'pending',
      now(),
      null
    );
  end if;

  select *
  into v_payment
  from public.agent_payments as ap
  where ap.request_id = v_request.id
  for update;

  if v_payment.id is null then
    raise exception 'VERIFIED_PAYMENT_EVIDENCE_MISSING';
  end if;

  if v_request.request_hash <> p_request_hash then
    if v_request.status = 'failed'
      and v_request.error_code = 'INVALID_REQUEST'
      and v_payment.settlement_status = 'settled' then
      update public.agent_requests
      set request_hash = p_request_hash,
          status = 'paid',
          error_code = null,
          response_payload = null,
          processing_time_ms = null,
          completed_at = null
      where id = v_request.id
      returning * into v_request;
    else
      return query
      select
        v_request.id,
        v_request.status,
        v_request.error_code,
        v_request.response_payload,
        v_payment.settlement_status,
        false,
        false;
      return;
    end if;
  end if;

  return query
  select
    v_request.id,
    v_request.status,
    v_request.error_code,
    v_request.response_payload,
    v_payment.settlement_status,
    v_inserted_id is not null,
    true;
end;
$$;

create or replace function public.claim_agent_request_generation(
  p_replay_key text,
  p_request_hash text
)
returns table (
  request_id uuid,
  state text,
  response_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.agent_requests%rowtype;
  v_payment public.agent_payments%rowtype;
begin
  select *
  into v_request
  from public.agent_requests as ar
  where ar.idempotency_key = p_replay_key
  for update;

  if v_request.id is null then
    return query select null::uuid, 'missing'::text, null::jsonb;
    return;
  end if;

  if v_request.request_hash <> p_request_hash then
    return query select v_request.id, 'conflict'::text, v_request.response_payload;
    return;
  end if;

  select *
  into v_payment
  from public.agent_payments as ap
  where ap.request_id = v_request.id
  for update;

  if v_payment.id is null or v_payment.settlement_status <> 'settled' then
    return query select v_request.id, 'unpaid'::text, v_request.response_payload;
    return;
  end if;

  if v_request.status = 'completed' and v_request.response_payload is not null then
    return query select v_request.id, 'completed'::text, v_request.response_payload;
    return;
  end if;

  if v_request.status in ('processing', 'settling') then
    return query select v_request.id, 'busy'::text, v_request.response_payload;
    return;
  end if;

  if v_request.status in ('paid', 'failed') then
    update public.agent_requests
    set status = 'processing',
        error_code = null
    where id = v_request.id;
    return query select v_request.id, 'claimed'::text, v_request.response_payload;
    return;
  end if;

  return query select v_request.id, 'busy'::text, v_request.response_payload;
end;
$$;

revoke all on function public.reserve_agent_verified_payment(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_agent_request_generation(text, text) from public, anon, authenticated;
grant execute on function public.reserve_agent_verified_payment(text, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.claim_agent_request_generation(text, text) to service_role;

commit;
notify pgrst, 'reload schema';
