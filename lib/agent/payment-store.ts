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
    .eq("replay_fingerprint", fingerprint)
    .maybeSingle();
  if (error) throw new Error(`PAYMENT_REPLAY_LOOKUP_${error.code}`);
  return Boolean(data);
}

export async function persistSettledPayment(row: Record<string, unknown>): Promise<void> {
  const { error } = await database().from("agent_payments").insert(row);
  if (error?.code === "23505") throw new Error("PAYMENT_REPLAYED");
  if (error) throw new Error(`PAYMENT_EVIDENCE_INSERT_${error.code}`);
}

export async function recordUsage(row: Record<string, unknown>): Promise<void> {
  const { error } = await database().from("agent_usage").insert(row);
  if (error && error.code !== "23505") throw new Error(`AGENT_USAGE_INSERT_${error.code}`);
}
