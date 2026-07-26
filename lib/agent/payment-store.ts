import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type AgentRequestRecord = {
  id: string;
  idempotency_key: string;
  request_hash: string;
  status: string;
  error_code: string | null;
  response_payload: Record<string, unknown> | null;
};

export type AgentPaymentRecord = {
  id: string;
  request_id: string;
  payment_reference: string;
  transaction_hash: string | null;
  settlement_reference: string | null;
  payer_address: string | null;
  recipient_address: string;
  network: string;
  asset: string;
  amount: string;
  verification_status: string;
  settlement_status: "pending" | "settled" | "failed" | "unknown";
};

export type VerifiedPaymentReservation = {
  request_id: string;
  request_status: string;
  error_code: string | null;
  response_payload: Record<string, unknown> | null;
  settlement_status: AgentPaymentRecord["settlement_status"];
  is_new: boolean;
  hash_matches: boolean;
};

export type AgentRequestClaim = {
  request_id: string | null;
  state: "claimed" | "completed" | "busy" | "conflict" | "missing" | "unpaid";
  response_payload: Record<string, unknown> | null;
};

export type AgentRequestPayloadRecord = {
  replay_key: string;
  endpoint: string;
  payer_address: string | null;
  request_hash: string;
  body_text: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_authorization_hash: string | null;
};

export type AgentRequestPayloadClaim =
  | { status: "found"; matchCount: 1; payload: AgentRequestPayloadRecord }
  | { status: "unavailable"; matchCount: 0; payload: null }
  | { status: "ambiguous"; matchCount: number; payload: null };

function database() {
  const client = createAdminClient();
  if (!client) throw new Error("PAYMENT_STORAGE_UNAVAILABLE");
  return client;
}

export async function findAgentRequest(idempotencyKey: string): Promise<AgentRequestRecord | null> {
  const { data, error } = await database()
    .from("agent_requests")
    .select("id,idempotency_key,request_hash,status,error_code,response_payload")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (error) throw new Error(`AGENT_REQUEST_LOOKUP_${error.code}`);
  return data as AgentRequestRecord | null;
}

export async function storeAgentRequestPayload(row: {
  replay_key: string;
  endpoint: string;
  payer_address?: string | null;
  request_hash: string;
  body_text: string;
  expires_at: string;
}): Promise<void> {
  const { error: cleanupError } = await database()
    .from("agent_request_payloads")
    .delete()
    .lt("expires_at", new Date().toISOString());
  if (cleanupError) throw new Error(`REQUEST_PAYLOAD_CLEANUP_${cleanupError.code}`);
  const { error } = await database().from("agent_request_payloads").insert(row);
  if (error) throw new Error(`REQUEST_PAYLOAD_INSERT_${error.code}`);
}

export async function resolveAgentRequestPayload(input: {
  endpoint: string;
  authorizationHash: string;
  replayKey?: string | null;
  payerAddress?: string | null;
  createdAfter: string;
}): Promise<AgentRequestPayloadClaim> {
  const { data, error } = await database().rpc("resolve_agent_request_payload", {
    p_endpoint: input.endpoint,
    p_authorization_hash: input.authorizationHash,
    p_replay_key: input.replayKey ?? null,
    p_payer_address: input.payerAddress ?? null,
    p_created_after: input.createdAfter,
  });
  if (error) throw new Error(`REQUEST_PAYLOAD_RESOLVE_${error.code}`);
  const result = Array.isArray(data) ? data[0] : data;
  const matchCount = Number(result?.match_count ?? 0);
  if (result?.match_status === "found" && result?.replay_key) {
    return {
      status: "found",
      matchCount: 1,
      payload: {
        replay_key: result.replay_key,
        endpoint: result.endpoint,
        payer_address: result.payer_address,
        request_hash: result.request_hash,
        body_text: result.body_text,
        expires_at: result.expires_at,
        consumed_at: result.consumed_at,
        consumed_authorization_hash: result.consumed_authorization_hash,
      },
    };
  }
  if (result?.match_status === "ambiguous") {
    return { status: "ambiguous", matchCount, payload: null };
  }
  return { status: "unavailable", matchCount: 0, payload: null };
}

export async function claimAgentRequestPayload(input: {
  endpoint: string;
  authorizationHash: string;
  replayKey: string;
  payerAddress?: string | null;
  createdAfter: string;
}): Promise<AgentRequestPayloadClaim> {
  const { data, error } = await database().rpc("claim_agent_request_payload", {
    p_endpoint: input.endpoint,
    p_authorization_hash: input.authorizationHash,
    p_replay_key: input.replayKey,
    p_payer_address: input.payerAddress ?? null,
    p_created_after: input.createdAfter,
  });
  if (error) throw new Error(`REQUEST_PAYLOAD_CLAIM_${error.code}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (result?.match_status === "found" && result?.replay_key) {
    return {
      status: "found",
      matchCount: 1,
      payload: {
        replay_key: result.replay_key,
        endpoint: result.endpoint,
        payer_address: result.payer_address,
        request_hash: result.request_hash,
        body_text: result.body_text,
        expires_at: result.expires_at,
        consumed_at: result.consumed_at,
        consumed_authorization_hash: result.consumed_authorization_hash,
      },
    };
  }
  return { status: "unavailable", matchCount: 0, payload: null };
}

export async function reserveVerifiedPaymentAtomic(
  row: Record<string, unknown>,
): Promise<VerifiedPaymentReservation> {
  const { data, error } = await database().rpc("reserve_agent_verified_payment", {
    p_replay_key: row.replay_key,
    p_request_hash: row.request_hash,
    p_service: row.service,
    p_network: row.network,
    p_price: row.price,
    p_asset: row.asset,
    p_payer_address: row.payer_address,
    p_recipient_address: row.recipient_address,
    p_amount: row.amount,
  });
  if (error) throw new Error(`PAYMENT_RESERVATION_${error.code}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.request_id) throw new Error("PAYMENT_RESERVATION_EMPTY");
  return result as VerifiedPaymentReservation;
}

export async function claimAgentRequest(
  replayKey: string,
  requestHash: string,
): Promise<AgentRequestClaim> {
  const { data, error } = await database().rpc("claim_agent_request_generation", {
    p_replay_key: replayKey,
    p_request_hash: requestHash,
  });
  if (error) throw new Error(`AGENT_REQUEST_CLAIM_${error.code}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.state) throw new Error("AGENT_REQUEST_CLAIM_EMPTY");
  return result as AgentRequestClaim;
}

export async function updateAgentRequest(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await database().from("agent_requests").update(patch).eq("id", id);
  if (error) throw new Error(`AGENT_REQUEST_UPDATE_${error.code}`);
}

export async function findAgentPayment(requestId: string): Promise<AgentPaymentRecord | null> {
  const { data, error } = await database()
    .from("agent_payments")
    .select("id,request_id,payment_reference,transaction_hash,settlement_reference,payer_address,recipient_address,network,asset,amount,verification_status,settlement_status")
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw new Error(`PAYMENT_LOOKUP_${error.code}`);
  return data as AgentPaymentRecord | null;
}

export async function updatePaymentSettlement(
  requestId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await database()
    .from("agent_payments")
    .update(patch)
    .eq("request_id", requestId);
  if (error) throw new Error(`PAYMENT_SETTLEMENT_UPDATE_${error.code}`);
}

export async function recordUsage(row: Record<string, unknown>): Promise<void> {
  const { error } = await database().from("agent_usage").insert(row);
  if (error && error.code !== "23505") throw new Error(`AGENT_USAGE_INSERT_${error.code}`);
}
