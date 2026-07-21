import { getSopHistory } from "@/lib/sop-history";
import { getSopVersions } from "@/lib/version-manager";
import { getKnowledgeDocuments } from "@/lib/knowledge-base-manager";
import { fetchSops, createSop } from "@/lib/cloud/sop-service";
import { createVersion } from "@/lib/cloud/version-service";
import { syncKnowledgeMetadata } from "@/lib/cloud/knowledge-service";

export type MigrationCounts = { imported: number; skipped: number; failed: number };
const flagKey = (userId: string) => `processforge.migration.${userId}.v1`;
export function localWorkSummary() { return { sops: getSopHistory().length, versions: getSopVersions().length, documents: getKnowledgeDocuments().length }; }
export function migrationComplete(userId: string) { try { return localStorage.getItem(flagKey(userId)) === "complete"; } catch { return false; } }
export function setMigrationSkipped(userId: string) { try { localStorage.setItem(flagKey(userId), "skipped"); } catch { /* optional flag */ } }
export function clearMigratedLocalData() { try { localStorage.removeItem("processforge.sop-history.v1"); localStorage.removeItem("processforge.sop-versions.v1"); localStorage.removeItem("processforge.knowledge-base.v1"); } catch { /* local data is left intact */ } }

export async function migrateLocalData(userId: string, onProgress?: (done: number, total: number) => void): Promise<MigrationCounts> {
  const history = getSopHistory(); const versions = getSopVersions(); const documents = getKnowledgeDocuments(); const total = history.length + versions.length + documents.length; let done = 0; const counts = { imported: 0, skipped: 0, failed: 0 };
  const cloud = await fetchSops(); if (!cloud.ok) return { imported: 0, skipped: 0, failed: total };
  const byDocument = new Map(cloud.data.map((item) => [item.sop.documentId, item]));
  for (const entry of history) { if (byDocument.has(entry.documentId)) counts.skipped++; else { const saved = await createSop(entry.sop, { industry: entry.industry, department: entry.department, createdAt: entry.generatedAt }); if (saved.ok) { byDocument.set(entry.documentId, saved.data); counts.imported++; } else counts.failed++; } onProgress?.(++done, total); }
  const existingVersions = new Set<string>();
  for (const version of versions) { const parent = byDocument.get(version.documentId); const key = `${version.documentId}:${version.versionNumber}`; if (!parent || existingVersions.has(key)) counts.skipped++; else { const saved = await createVersion(parent.row.id, version.sop, `${version.versionNumber}.0`, `${version.name}: ${version.changeSummary}`, version.timestamp); if (saved.ok) { existingVersions.add(key); counts.imported++; } else if (saved.error.message.includes("already")) counts.skipped++; else counts.failed++; } onProgress?.(++done, total); }
  for (const document of documents) { const saved = await syncKnowledgeMetadata(document); if (saved.ok) counts.imported++; else counts.failed++; onProgress?.(++done, total); }
  if (counts.failed === 0) try { localStorage.setItem(flagKey(userId), "complete"); } catch { /* not required for successful import */ }
  return counts;
}
