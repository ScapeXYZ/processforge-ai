"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { selectRelevantPassages } from "@/lib/document-text";
import { getKnowledgeDocuments, KNOWLEDGE_BASE_EVENT } from "@/lib/knowledge-base-manager";
import type { ReadinessInput } from "@/lib/readiness-score";
import type { KnowledgeDocument } from "@/types/knowledge-base";

export function KnowledgeBaseSelector({ selectedIds, onChange, context }: { selectedIds: string[]; onChange: (ids: string[]) => void; context: ReadinessInput }) {
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  useEffect(() => {
    const load = () => setDocuments(getKnowledgeDocuments());
    const timer = window.setTimeout(load, 0);
    window.addEventListener(KNOWLEDGE_BASE_EVENT, load);
    return () => { window.clearTimeout(timer); window.removeEventListener(KNOWLEDGE_BASE_EVENT, load); };
  }, []);
  const enabled = documents.filter((document) => document.enabled && document.status === "ready");
  const selected = enabled.filter((document) => selectedIds.includes(document.id));
  const grounding = selectRelevantPassages(selected, context);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);

  return <section className="rounded-lg border border-border bg-card/50 p-4">
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><BookOpen className="size-4 text-emerald-400" /><div><h2 className="text-xs font-medium">Knowledge Sources</h2><p className="text-[10px] text-muted-foreground">Select company references for this SOP.</p></div></div><Link href="/knowledge-base" className={buttonVariants({ variant: "ghost", size: "xs" })}>Manage</Link></div>
    {enabled.length === 0 ? <p className="mt-3 rounded-md border border-dashed border-border p-3 text-[11px] text-muted-foreground">No enabled documents. Upload references in the Knowledge Base.</p> : <div className="mt-3 space-y-1.5">{enabled.map((document) => <label key={document.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background/50 px-2.5 py-2 text-[11px] text-muted-foreground hover:text-foreground"><input type="checkbox" checked={selectedIds.includes(document.id)} onChange={() => toggle(document.id)} className="size-4 accent-emerald-500" /><FileText className="size-3.5" /><span className="min-w-0 flex-1 truncate">{document.name}</span><span>{document.wordCount.toLocaleString()} words</span></label>)}</div>}
    {selected.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Selected knowledge sources">{selected.map((document) => <button key={document.id} type="button" onClick={() => toggle(document.id)} className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">{document.name}<X className="size-3" /></button>)}</div>}
    {grounding.truncatedNames.length > 0 && <p className="mt-3 text-[10px] leading-4 text-amber-300">Prompt-size protection will truncate selected passages from: {grounding.truncatedNames.join(", ")}.</p>}
  </section>;
}
