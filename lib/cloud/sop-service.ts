import type { Sop } from "@/lib/sop-schema";
import { authenticatedClient } from "@/lib/cloud/auth";
import { cloudFailure, type CloudResult } from "@/lib/cloud/result";
import { rowToSop, sopToInsert, type SopRow } from "@/lib/cloud/mappers";
import type { Database } from "@/types/database";
import type { Json } from "@/types/json";
import { activeWorkspace, getActiveWorkspaceId } from "@/lib/cloud/workspace-service";
import type { SopAnalytics } from "@/types/sop-analytics";

export type CloudSop = { row: SopRow; sop: Sop };
export type SopContext = Partial<{ industry: string; department: string; description: string; audience: string; detailLevel: string; createdAt: string }>;

export async function fetchSops(options: { allWorkspaces?: boolean } = {}): Promise<CloudResult<CloudSop[]>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  let query = auth.data.client.from("sops").select("*").order("updated_at", { ascending: false });
  const workspaceId = getActiveWorkspaceId(); if (workspaceId && !options.allWorkspaces) query = query.eq("workspace_id", workspaceId);
  const { data, error } = await query;
  if (error) return cloudFailure("Could not load cloud SOPs.");
  return { ok: true, data: (data ?? []).flatMap((row) => { const sop = rowToSop(row); return sop ? [{ row, sop }] : []; }) };
}

export async function fetchSop(id: string): Promise<CloudResult<CloudSop>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { data, error } = await auth.data.client.from("sops").select("*").eq("id", id).single();
  if (error || !data) return cloudFailure("SOP could not be found.");
  const sop = rowToSop(data); return sop ? { ok: true, data: { row: data, sop } } : cloudFailure("Cloud SOP data is invalid.", "validation");
}

export async function createSop(sop: Sop, context: SopContext = {}): Promise<CloudResult<CloudSop>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const workspace = await activeWorkspace(); if (!workspace.ok) return workspace;
  if (workspace.data.role === "viewer") return cloudFailure("Viewers cannot create SOPs.", "auth");
  const { data, error } = await auth.data.client.from("sops").insert(sopToInsert(sop, auth.data.userId, workspace.data.id, context)).select().single();
  return error || !data ? cloudFailure("Cloud save failed.") : { ok: true, data: { row: data, sop } };
}

export async function updateSop(id: string, sop: Sop, expectedUpdatedAt?: string, context: SopContext = {}): Promise<CloudResult<CloudSop>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const current = await auth.data.client.from("sops").select("workspace_id").eq("id", id).single();
  if (current.error || !current.data) return cloudFailure("SOP could not be found.");
  const insert = sopToInsert(sop, auth.data.userId, current.data.workspace_id, context);
  const update: Database["public"]["Tables"]["sops"]["Update"] = { title: insert.title, industry: insert.industry, department: insert.department, description: insert.description, audience: insert.audience, detail_level: insert.detail_level, content: sop as unknown as Json, readiness_score: sop.documentReadinessScore, input_quality_score: sop.inputReadinessScore, source_notes: insert.source_notes, knowledge_source_names: insert.knowledge_source_names,analytics:insert.analytics,quality_score:insert.quality_score,risk_level:insert.risk_level,analyzed_at:insert.analyzed_at };
  let query = auth.data.client.from("sops").update(update).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error } = await query.select().maybeSingle();
  if (error) return cloudFailure("Cloud save failed.");
  if (!data) return cloudFailure("A newer cloud version exists. Review it before replacing it.", "conflict");
  return { ok: true, data: { row: data, sop } };
}

export async function saveSopAnalytics(id:string,analytics:SopAnalytics):Promise<CloudResult<true>>{const auth=await authenticatedClient();if(!auth.ok)return auth;const{error}=await auth.data.client.from("sops").update({analytics:analytics as unknown as Json,quality_score:analytics.overallQuality,risk_level:analytics.riskLevel,analyzed_at:analytics.analyzedAt}).eq("id",id);return error?cloudFailure("Analytics could not be saved."):{ok:true,data:true}}

export async function setSopFlags(id: string, flags: { is_favorite?: boolean; is_archived?: boolean }): Promise<CloudResult<true>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { error } = await auth.data.client.from("sops").update(flags).eq("id", id);
  return error ? cloudFailure("Could not update the SOP.") : { ok: true, data: true };
}

export async function deleteCloudSop(id: string): Promise<CloudResult<true>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { error } = await auth.data.client.from("sops").delete().eq("id", id);
  return error ? cloudFailure("Could not delete the SOP.") : { ok: true, data: true };
}
