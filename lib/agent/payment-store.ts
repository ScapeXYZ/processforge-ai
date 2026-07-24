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
