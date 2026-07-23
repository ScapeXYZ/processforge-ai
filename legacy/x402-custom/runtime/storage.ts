import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const localPaymentFingerprints = new Set<string>();
const localAgentRequestsByKey = new Map<string, Record<string, unknown>>();
const localAgentRequestsById = new Map<string, Record<string, unknown>>();

export async function findAgentRequest(idempotencyKey: string) {
  const db = requirePaymentDatabase(); if (!db) return localAgentRequestsByKey.get(idempotencyKey) ?? null;
  const { data, error } = await db.from("agent_requests").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (error) throw new Error(`Agent storage lookup failed: ${error.code}`);
  return data as Record<string, unknown> | null;
}

export async function createAgentRequest(row: Record<string, unknown>) {
  const db = requirePaymentDatabase();
  if (!db) {
    const id = String(row.id); const key = String(row.idempotency_key);
    if (!localAgentRequestsByKey.has(key)) { localAgentRequestsByKey.set(key, { ...row }); localAgentRequestsById.set(id, localAgentRequestsByKey.get(key)!); }
    return;
  }
  const { error } = await db.from("agent_requests").insert(row);
  if (error && error.code !== "23505") throw new Error(`Agent storage insert failed: ${error.code}`);
}

export async function updateAgentRequest(id: string, patch: Record<string, unknown>) {
  const db = requirePaymentDatabase();
  if (!db) { const row = localAgentRequestsById.get(id); if (row) Object.assign(row, patch); return; }
  const { error } = await db.from("agent_requests").update(patch).eq("id", id); if (error) throw new Error(`Agent storage update failed: ${error.code}`);
}

export async function reserveVerifiedPayment(row: Record<string, unknown>): Promise<"reserved" | "replay"> {
  const db = requirePaymentDatabase();
  if (!db) {
    const fingerprint = String(row.replay_fingerprint ?? row.payment_reference ?? "");
    if (!fingerprint || localPaymentFingerprints.has(fingerprint)) return "replay";
    localPaymentFingerprints.add(fingerprint);
    return "reserved";
  }
  const { error } = await db.from("agent_payments").insert(row);
  if (!error) return "reserved";
  if (error.code === "23505") return "replay";
  throw new Error(`Payment storage reservation failed: ${error.code}`);
}

export async function updatePayment(reference: string, patch: Record<string, unknown>) {
  const db = requirePaymentDatabase(); if (!db) return;
  const { error } = await db.from("agent_payments").update(patch).eq("payment_reference", reference); if (error) throw new Error(`Payment storage update failed: ${error.code}`);
}

export async function recordUsage(row: Record<string, unknown>) {
  const db = requirePaymentDatabase(); if (!db) return;
  const { error } = await db.from("agent_usage").insert(row); if (error && error.code !== "23505") throw new Error(`Usage storage insert failed: ${error.code}`);
}

function requirePaymentDatabase() {
  const db = createAdminClient();
  if (!db && process.env.NODE_ENV === "production" && (process.env.ENABLE_RELEASE_CHECK === "true" || process.env.VERCEL_ENV === "production")) throw new Error("PAYMENT_STORAGE_UNAVAILABLE");
  return db;
}
