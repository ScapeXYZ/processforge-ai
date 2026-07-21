import type { KnowledgeDocument } from "@/types/knowledge-base";
import { authenticatedClient } from "@/lib/cloud/auth";
import { knowledgeToInsert } from "@/lib/cloud/mappers";
import { cloudFailure, type CloudResult } from "@/lib/cloud/result";

export async function syncKnowledgeMetadata(document: KnowledgeDocument): Promise<CloudResult<true>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { error } = await auth.data.client.from("knowledge_documents").upsert(knowledgeToInsert(document, auth.data.userId));
  return error ? cloudFailure("Knowledge metadata could not be synced.") : { ok: true, data: true };
}
export async function fetchKnowledgeMetadata() {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { data, error } = await auth.data.client.from("knowledge_documents").select("*").order("updated_at", { ascending: false });
  return error ? cloudFailure("Could not load knowledge metadata.") : { ok: true as const, data: data ?? [] };
}
export async function deleteKnowledgeMetadata(id: string): Promise<CloudResult<true>> { const auth = await authenticatedClient(); if (!auth.ok) return auth; const { error } = await auth.data.client.from("knowledge_documents").delete().eq("id", id); return error ? cloudFailure("Could not remove knowledge metadata.") : { ok: true, data: true }; }

