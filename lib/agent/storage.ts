import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function findAgentRequest(idempotencyKey: string) {
  const db = requirePaymentDatabase(); if (!db) return null;
  const { data, error } = await db.from("agent_requests").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (error) throw new Error(`Agent storage lookup failed: ${error.code}`);
  return data as Record<string, unknown> | null;
}

export async function createAgentRequest(row: Record<string, unknown>) {
  const db = requirePaymentDatabase(); if (!db) return;
  const { error } = await db.from("agent_requests").insert(row);
  if (error && error.code !== "23505") throw new Error(`Agent storage insert failed: ${error.code}`);
}

export async function updateAgentRequest(id: string, patch: Record<string, unknown>) {
  const db = requirePaymentDatabase(); if (!db) return;
  const { error } = await db.from("agent_requests").update(patch).eq("id", id); if (error) throw new Error(`Agent storage update failed: ${error.code}`);
}

export async function reservePayment(row: Record<string, unknown>): Promise<boolean> {
  const db = requirePaymentDatabase(); if (!db) return true;
  const { error } = await db.from("agent_payments").insert(row);
  return !error;
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
