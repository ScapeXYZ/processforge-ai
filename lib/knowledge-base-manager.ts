import { z } from "zod";
import type { KnowledgeDocument } from "@/types/knowledge-base";

const STORAGE_KEY = "processforge.knowledge-base.v1";
const STORAGE_VERSION = 1;
export const KNOWLEDGE_BASE_EVENT = "processforge:knowledge-base-updated";

const documentSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), type: z.enum(["pdf", "docx", "txt"]), size: z.number().int().positive(), uploadedAt: z.string().datetime(), status: z.enum(["processing", "ready", "error"]), characterCount: z.number().int().nonnegative(), wordCount: z.number().int().nonnegative(), extractedText: z.string(), errorMessage: z.string().nullable(), enabled: z.boolean(),
}).strict();
const storageSchema = z.object({ version: z.literal(STORAGE_VERSION), documents: z.array(documentSchema).max(10) }).strict();

export type KnowledgeWriteResult = { success: true; documents: KnowledgeDocument[] } | { success: false; documents: KnowledgeDocument[]; error: string };

export function getKnowledgeDocuments(): KnowledgeDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const json: unknown = JSON.parse(raw);
    const migrated = Array.isArray(json) ? { version: STORAGE_VERSION, documents: json } : json;
    const parsed = storageSchema.safeParse(migrated);
    if (!parsed.success) { window.localStorage.removeItem(STORAGE_KEY); return []; }
    return parsed.data.documents.sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    return [];
  }
}

export function saveKnowledgeDocument(document: KnowledgeDocument): KnowledgeWriteResult {
  const current = getKnowledgeDocuments();
  const next = [document, ...current.filter((item) => item.id !== document.id)].slice(0, 10);
  return writeDocuments(next);
}

export function updateKnowledgeDocument(id: string, update: Partial<Pick<KnowledgeDocument, "name" | "enabled" | "status" | "errorMessage">>): KnowledgeWriteResult {
  const next = getKnowledgeDocuments().map((document) => document.id === id ? { ...document, ...update } : document);
  return writeDocuments(next);
}

export function deleteKnowledgeDocument(id: string): KnowledgeWriteResult {
  return writeDocuments(getKnowledgeDocuments().filter((document) => document.id !== id));
}

export function getKnowledgeDocumentsByIds(ids: string[]): KnowledgeDocument[] {
  const selected = new Set(ids);
  return getKnowledgeDocuments().filter((document) => selected.has(document.id) && document.enabled && document.status === "ready");
}

function writeDocuments(documents: KnowledgeDocument[]): KnowledgeWriteResult {
  if (typeof window === "undefined") return { success: false, documents, error: "Knowledge storage is only available in the browser." };
  const parsed = storageSchema.safeParse({ version: STORAGE_VERSION, documents });
  if (!parsed.success) return { success: false, documents, error: "Knowledge document data is invalid." };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.data));
    window.dispatchEvent(new CustomEvent(KNOWLEDGE_BASE_EVENT));
    return { success: true, documents: parsed.data.documents };
  } catch (error) {
    const isQuota = error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
    return { success: false, documents: getKnowledgeDocuments(), error: isQuota ? "Local storage limit reached. Delete a document and try again." : "The knowledge base could not be saved locally." };
  }
}
