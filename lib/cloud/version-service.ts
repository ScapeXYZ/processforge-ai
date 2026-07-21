import type { Sop } from "@/lib/sop-schema";
import { authenticatedClient } from "@/lib/cloud/auth";
import { cloudFailure, type CloudResult } from "@/lib/cloud/result";
import { versionRowToSnapshot } from "@/lib/cloud/mappers";
import type { Json } from "@/types/json";

export type CloudVersion = NonNullable<ReturnType<typeof versionRowToSnapshot>>;
export async function fetchVersions(sopId?: string): Promise<CloudResult<CloudVersion[]>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  let query = auth.data.client.from("sop_versions").select("*").order("created_at", { ascending: false });
  if (sopId) query = query.eq("sop_id", sopId);
  const { data, error } = await query;
  return error ? cloudFailure("Could not load versions.") : { ok: true, data: (data ?? []).flatMap((row) => { const value = versionRowToSnapshot(row); return value ? [value] : []; }) };
}
export async function createVersion(sopId: string, sop: Sop, versionNumber: string, changeSummary: string, createdAt?: string): Promise<CloudResult<CloudVersion>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { data, error } = await auth.data.client.from("sop_versions").insert({ sop_id: sopId, user_id: auth.data.userId, version_number: versionNumber, change_summary: changeSummary.slice(0, 500), snapshot: sop as unknown as Json, created_at: createdAt }).select().single();
  const parsed = data ? versionRowToSnapshot(data) : null;
  return error || !parsed ? cloudFailure(error?.code === "23505" ? "This version was already saved." : "Could not save the cloud version.") : { ok: true, data: parsed };
}
export async function renameVersion(id: string, summary: string): Promise<CloudResult<true>> { const auth = await authenticatedClient(); if (!auth.ok) return auth; const { error } = await auth.data.client.from("sop_versions").update({ change_summary: summary.slice(0, 500) }).eq("id", id); return error ? cloudFailure("Could not rename the version.") : { ok: true, data: true }; }
export async function deleteVersion(id: string): Promise<CloudResult<true>> { const auth = await authenticatedClient(); if (!auth.ok) return auth; const { error } = await auth.data.client.from("sop_versions").delete().eq("id", id); return error ? cloudFailure("Could not delete the version.") : { ok: true, data: true }; }

