import { z } from "zod";
import { migrateSopSnapshot, sopSchema, type Sop } from "@/lib/sop-schema";

const STORAGE_KEY = "processforge.sop-history.v1";
const HISTORY_LIMIT = 50;

const historyEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  documentId: z.string().min(1),
  generatedAt: z.string().datetime(),
  industry: z.string().min(1),
  department: z.string().min(1),
  documentReadinessScore: z.number().int().min(0).max(100),
  inputReadinessScore: z.number().int().min(0).max(100),
  sop: sopSchema,
}).strict();

const historySchema = z.array(historyEntrySchema);

export type SopHistoryEntry = z.infer<typeof historyEntrySchema>;

export function getSopHistory(): SopHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const raw: unknown = JSON.parse(stored);
    const migrated = Array.isArray(raw) ? raw.map((entry) => typeof entry === "object" && entry !== null && "sop" in entry ? { ...entry, sop: migrateSopSnapshot(entry.sop) } : entry) : raw;
    const parsed = historySchema.safeParse(migrated);
    if (!parsed.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.data.sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt)).slice(0, HISTORY_LIMIT);
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    return [];
  }
}

export function getSopHistoryEntry(id: string): SopHistoryEntry | null {
  return getSopHistory().find((entry) => entry.id === id) ?? null;
}

export function saveSopToHistory({ sop, industry, department }: { sop: Sop; industry: string; department: string }): SopHistoryEntry | null {
  if (typeof window === "undefined") return null;

  const entry = historyEntrySchema.parse({
    id: createHistoryId(),
    title: sop.title,
    documentId: sop.documentId,
    generatedAt: new Date().toISOString(),
    industry: industry.trim(),
    department: department.trim(),
    documentReadinessScore: sop.documentReadinessScore,
    inputReadinessScore: sop.inputReadinessScore,
    sop,
  });

  try {
    const next = [entry, ...getSopHistory()].slice(0, HISTORY_LIMIT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

export function deleteSopHistoryEntry(id: string): SopHistoryEntry[] {
  const next = getSopHistory().filter((entry) => entry.id !== id);
  writeHistory(next);
  return next;
}

export function clearSopHistory(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
}

function writeHistory(entries: SopHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT))); } catch { /* Storage may be unavailable. */ }
}

function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
