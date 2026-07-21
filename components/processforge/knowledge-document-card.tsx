"use client";

import { FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KnowledgeDocument } from "@/types/knowledge-base";

export function KnowledgeDocumentCard({ document, onToggle, onRename, onDelete }: { document: KnowledgeDocument; onToggle: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const rename = () => { const name = window.prompt("Rename knowledge document", document.name); if (name?.trim()) onRename(name.trim()); };
  return <article className="rounded-xl border border-border bg-card/40 p-4">
    <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-emerald-400"><FileText className="size-4" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-medium">{document.name}</h2><div className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground"><span>{document.type.toUpperCase()}</span><span>{formatBytes(document.size)}</span><span>{formatDate(document.uploadedAt)}</span></div></div><span className={`rounded-full px-2 py-1 text-[9px] font-medium uppercase tracking-wider ${document.status === "ready" ? "bg-emerald-500/10 text-emerald-400" : document.status === "error" ? "bg-amber-500/10 text-amber-300" : "bg-secondary text-muted-foreground"}`}>{document.status}</span></div>
    <div className="mt-4 flex items-center justify-between gap-3"><div><p className="text-[11px] text-muted-foreground">{document.wordCount.toLocaleString()} words · {document.characterCount.toLocaleString()} characters</p>{document.errorMessage && <p className="mt-1 text-[10px] text-amber-300">{document.errorMessage}</p>}</div><label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={document.enabled} onChange={onToggle} className="size-4 accent-emerald-500" />{document.enabled ? "Enabled" : "Disabled"}</label></div>
    <details className="mt-4 rounded-lg border border-border bg-background/60"><summary className="cursor-pointer px-3 py-2 text-[11px] font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">Preview extracted text</summary><pre className="max-h-56 overflow-auto whitespace-pre-wrap border-t border-border p-3 font-sans text-[11px] leading-5 text-muted-foreground">{document.extractedText.slice(0, 12_000)}</pre></details>
    <div className="mt-3 flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={rename}><Pencil /> Rename</Button><Button variant="ghost" size="sm" onClick={onDelete}><Trash2 /> Delete</Button></div>
  </article>;
}

function formatBytes(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
