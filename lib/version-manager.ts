import { z } from "zod";
import { migrateSopSnapshot, sopSchema, type Sop } from "@/lib/sop-schema";

const STORAGE_KEY = "processforge.sop-versions.v1";
const VERSION_LIMIT = 200;

const versionSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  versionNumber: z.number().int().positive(),
  name: z.string().min(1),
  timestamp: z.string().datetime(),
  changeSummary: z.string().min(1),
  sop: sopSchema,
}).strict();

const versionsSchema = z.array(versionSchema);
export type SopVersion = z.infer<typeof versionSchema>;

export function getSopVersions(documentId?: string): SopVersion[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const raw: unknown = JSON.parse(stored);
    const migrated = Array.isArray(raw) ? raw.map((version) => typeof version === "object" && version !== null && "sop" in version ? { ...version, sop: migrateSopSnapshot(version.sop) } : version) : raw;
    const parsed = versionsSchema.safeParse(migrated);
    if (!parsed.success) {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.data.filter((version) => !documentId || version.documentId === documentId).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  } catch {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be unavailable. */ }
    return [];
  }
}

export function getSopVersion(id: string): SopVersion | null {
  return getSopVersions().find((version) => version.id === id) ?? null;
}

export function createSopVersion({ sop, changeSummary, name }: { sop: Sop; changeSummary: string; name?: string }): SopVersion | null {
  if (typeof window === "undefined") return null;
  const existing = getSopVersions();
  const versionNumber = Math.max(0, ...existing.filter((version) => version.documentId === sop.documentId).map((version) => version.versionNumber)) + 1;
  const version = versionSchema.parse({ id: createId(), documentId: sop.documentId, versionNumber, name: name?.trim() || `Version ${versionNumber}`, timestamp: new Date().toISOString(), changeSummary: changeSummary.trim() || "SOP snapshot saved", sop });
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([version, ...existing].slice(0, VERSION_LIMIT)));
    return version;
  } catch {
    return null;
  }
}

export function renameSopVersion(id: string, name: string): SopVersion[] {
  const trimmed = name.trim();
  if (!trimmed) return getSopVersions();
  const next = getSopVersions().map((version) => version.id === id ? { ...version, name: trimmed } : version);
  writeVersions(next);
  return next;
}

export function deleteSopVersion(id: string): SopVersion[] {
  const next = getSopVersions().filter((version) => version.id !== id);
  writeVersions(next);
  return next;
}

function writeVersions(versions: SopVersion[]): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(versions.slice(0, VERSION_LIMIT))); } catch { /* Storage may be unavailable. */ }
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
