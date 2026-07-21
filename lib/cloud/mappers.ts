import { sopSchema, migrateSopSnapshot, type Sop } from "@/lib/sop-schema";
import type { SopHistoryEntry } from "@/lib/sop-history";
import type { KnowledgeDocument } from "@/types/knowledge-base";
import type { Database } from "@/types/database";
import type { Json } from "@/types/json";

export type SopRow = Database["public"]["Tables"]["sops"]["Row"];
export type SopInsert = Database["public"]["Tables"]["sops"]["Insert"];
export type VersionRow = Database["public"]["Tables"]["sop_versions"]["Row"];

const asJson = (value: unknown) => value as Json;

export function sopToInsert(sop: Sop, userId: string, workspaceId: string, context: Partial<{ industry: string; department: string; description: string; audience: string; detailLevel: string; createdAt: string }> = {}): SopInsert {
  return { user_id: userId, workspace_id: workspaceId, title: sop.title, industry: context.industry ?? null, department: context.department ?? null, description: context.description ?? null, audience: context.audience ?? null, detail_level: context.detailLevel ?? null, content: asJson(sop), readiness_score: sop.documentReadinessScore, input_quality_score: sop.inputReadinessScore, source_notes: asJson(sop.knowledgeSources.sourceNotes), knowledge_source_names: sop.knowledgeSources.documentNames, created_at: context.createdAt };
}

export function rowToSop(row: SopRow): Sop | null {
  const parsed = sopSchema.safeParse(migrateSopSnapshot(row.content));
  return parsed.success ? parsed.data : null;
}

export function rowToHistoryEntry(row: SopRow): SopHistoryEntry | null {
  const sop = rowToSop(row); if (!sop) return null;
  return { id: row.id, title: row.title, documentId: sop.documentId, generatedAt: row.created_at, industry: row.industry ?? "Unspecified", department: row.department ?? "Unspecified", documentReadinessScore: sop.documentReadinessScore, inputReadinessScore: sop.inputReadinessScore, sop };
}

export function versionRowToSnapshot(row: VersionRow): { id: string; sopId: string; versionNumber: string; timestamp: string; changeSummary: string; sop: Sop } | null {
  const parsed = sopSchema.safeParse(migrateSopSnapshot(row.snapshot));
  return parsed.success ? { id: row.id, sopId: row.sop_id, versionNumber: row.version_number, timestamp: row.created_at, changeSummary: row.change_summary ?? "SOP snapshot", sop: parsed.data } : null;
}

export function knowledgeToInsert(document: KnowledgeDocument, userId: string): Database["public"]["Tables"]["knowledge_documents"]["Insert"] {
  return { id: document.id, user_id: userId, name: document.name, mime_type: document.type, size_bytes: document.size, word_count: document.wordCount, character_count: document.characterCount, enabled: document.enabled, metadata: { status: document.status, uploadedAt: document.uploadedAt, errorMessage: document.errorMessage } };
}
