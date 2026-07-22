import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function findAgentRequest(idempotencyKey: string) {
  const db = createAdminClient(); if (!db) return null;
  const { data } = await db.from("agent_requests").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  return data as Record<string, unknown> | null;
}

export async function createAgentRequest(row: Record<string, unknown>) {
  const db = createAdminClient(); if (!db) return;
  const { error } = await db.from("agent_requests").insert(row);
  if (error && error.code !== "23505") throw new Error(`Agent storage insert failed: ${error.code}`);
}

export async function updateAgentRequest(id: string, patch: Record<string, unknown>) {
  const db = createAdminClient(); if (!db) return;
  await db.from("agent_requests").update(patch).eq("id", id);
}

export async function reservePayment(row: Record<string, unknown>): Promise<boolean> {
  const db = createAdminClient(); if (!db) return true;
  const { error } = await db.from("agent_payments").insert(row);
  return !error;
}

export async function updatePayment(reference: string, patch: Record<string, unknown>) {
  const db = createAdminClient(); if (!db) return;
  await db.from("agent_payments").update(patch).eq("payment_reference", reference);
}

export async function recordUsage(row: Record<string, unknown>) {
  const db = createAdminClient(); if (!db) return;
  await db.from("agent_usage").insert(row);
}
