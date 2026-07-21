import type { Sop } from "@/lib/sop-schema";

export function exportSopJson(sop: Sop): void {
  const blob = new Blob([JSON.stringify(sop, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, exportFilename(sop.documentId, "json"));
}

export function exportFilename(documentId: string, extension: "json" | "docx" | "pdf"): string {
  const safeId = documentId.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "sop";
  return `processforge-${safeId}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
