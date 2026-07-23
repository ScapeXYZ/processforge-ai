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

export async function createAgentRequest(row: Record<string, unknown>): Promise<void> {
  const { error } = await database().from("agent_requests").insert(row);
  if (error && error.code !== "23505") throw new Error(`AGENT_REQUEST_INSERT_${error.code}`);
}

export async function updateAgentRequest(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await database().from("agent_requests").update(patch).eq("id", id);
  if (error) throw new Error(`AGENT_REQUEST_UPDATE_${error.code}`);
}

export async function paymentFingerprintExists(fingerprint: string): Promise<boolean> {
  const { data, error } = await database()
    .from("agent_payments")
    .select("id")
    .eq("payment_reference", fingerprint)
    .maybeSingle();
  if (error) throw new Error(`PAYMENT_REPLAY_LOOKUP_${error.code}`);
  return Boolean(data);
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

export async function reserveVerifiedPayment(row: Record<string, unknown>): Promise<void> {
  const paymentRow = {
    request_id: row.request_id,
    payment_reference: row.payment_reference,
    transaction_hash: null,
    payer_address: row.payer_address,
    recipient_address: row.recipient_address,
    network: row.network,
    asset: row.asset,
    amount: row.amount,
    verification_status: row.verification_status,
    settlement_status: row.settlement_status,
    verified_at: row.verified_at,
    settled_at: row.settled_at,
  };
  const { error } = await database().from("agent_payments").insert(paymentRow);
  if (error?.code === "23505") throw new Error("PAYMENT_REPLAYED");
  if (error) throw new Error(`PAYMENT_EVIDENCE_INSERT_${error.code}`);
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
