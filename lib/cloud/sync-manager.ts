import type { Sop } from "@/lib/sop-schema";
import { createSop, updateSop, type CloudSop, type SopContext } from "@/lib/cloud/sop-service";
import { createVersion } from "@/lib/cloud/version-service";
import type { CloudResult } from "@/lib/cloud/result";
import { addActivity } from "@/lib/cloud/collaboration-service";

const LINK_KEY = "processforge.cloud-links.v1";
type CloudLink = { cloudId: string; updatedAt: string; version: number };
type LinkMap = Record<string, CloudLink>;
export type CloudSaveState = "idle" | "saving" | "saved" | "offline" | "failed" | "conflict";

function readLinks(): LinkMap { if (typeof window === "undefined") return {}; try { const value: unknown = JSON.parse(localStorage.getItem(LINK_KEY) ?? "{}"); return value && typeof value === "object" && !Array.isArray(value) ? value as LinkMap : {}; } catch { return {}; } }
function writeLink(documentId: string, link: CloudLink) { try { localStorage.setItem(LINK_KEY, JSON.stringify({ ...readLinks(), [documentId]: link })); } catch { /* Local SOP remains the fallback. */ } }
export function getCloudLink(documentId: string): CloudLink | null { return readLinks()[documentId] ?? null; }
export function linkCloudSop(documentId: string, cloudId: string, updatedAt: string, version = 0) { writeLink(documentId, { cloudId, updatedAt, version }); }

export async function syncSop({ sop, context, changeSummary, createSnapshot = true }: { sop: Sop; context?: SopContext; changeSummary: string; createSnapshot?: boolean }): Promise<CloudResult<CloudSop>> {
  const link = getCloudLink(sop.documentId);
  const saved = link ? await updateSop(link.cloudId, sop, link.updatedAt, context) : await createSop(sop, context);
  if (!saved.ok) return saved;
  const nextVersion = (link?.version ?? 0) + 1;
  if (createSnapshot) {
    const version = await createVersion(saved.data.row.id, sop, `${nextVersion}.0`, changeSummary);
    if (!version.ok && version.error.message !== "This version was already saved.") return version;
  }
  const activityType = link ? (changeSummary.toLowerCase().includes("restor") ? "version_restored" : changeSummary.toLowerCase().includes("generat") ? "ai_generated" : "sop_edited") : "sop_created";
  void addActivity(saved.data.row.workspace_id, saved.data.row.id, activityType, changeSummary);
  if (sop.knowledgeSources.documentNames.length) void addActivity(saved.data.row.workspace_id, saved.data.row.id, "knowledge_used", `${sop.knowledgeSources.documentNames.length} knowledge source(s) used`, { sourceNames: sop.knowledgeSources.documentNames });
  writeLink(sop.documentId, { cloudId: saved.data.row.id, updatedAt: saved.data.row.updated_at, version: nextVersion });
  return saved;
}
