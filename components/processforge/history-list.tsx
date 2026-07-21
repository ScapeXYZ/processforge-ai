"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, FileText, Search, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearSopHistory, deleteSopHistoryEntry, getSopHistory, type SopHistoryEntry } from "@/lib/sop-history";

export function HistoryList() {
  const [entries, setEntries] = useState<SopHistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = useMemo(() => entries.filter((entry) => !normalizedQuery || [entry.title, entry.industry, entry.department, entry.documentId].some((value) => value.toLowerCase().includes(normalizedQuery))), [entries, normalizedQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setEntries(getSopHistory()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const clearAll = () => {
    if (!window.confirm("Clear all saved SOP history? This cannot be undone.")) return;
    clearSopHistory();
    setEntries([]);
  };

  return <section>
    <div className="flex flex-col gap-3 border-b border-border/80 pb-5 sm:flex-row sm:items-center">
      <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, industry, department or document ID" className="h-10 bg-card/60 pl-9" /></div>
      <Button variant="outline" onClick={clearAll} disabled={entries.length === 0}><Trash2 /> Clear history</Button>
    </div>

    {entries.length === 0 ? <HistoryEmpty /> : filteredEntries.length === 0 ? <div className="py-20 text-center"><Search className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-4 text-sm font-medium">No matching SOPs</h2><p className="mt-1 text-xs text-muted-foreground">Try a different search term.</p></div> : <div className="divide-y divide-border/80">{filteredEntries.map((entry) => <HistoryRow key={entry.id} entry={entry} onDelete={() => setEntries(deleteSopHistoryEntry(entry.id))} />)}</div>}
  </section>;
}

function HistoryRow({ entry, onDelete }: { entry: SopHistoryEntry; onDelete: () => void }) {
  return <article className="group flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
    <div className="flex min-w-0 flex-1 gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-emerald-400"><FileText className="size-4" /></span>
      <div className="min-w-0"><h2 className="truncate text-sm font-medium text-foreground">{entry.title}</h2><div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span className="font-mono">{entry.documentId}</span><span>{entry.industry}</span><span>{entry.department}</span><span className="flex items-center gap-1"><Clock3 className="size-3" />{formatGeneratedAt(entry.generatedAt)}</span></div></div>
    </div>
    <div className="flex items-center gap-2 pl-13 sm:pl-0"><span className="mr-1 text-xs text-muted-foreground">Input {entry.inputReadinessScore}%</span><span className="mr-1 text-xs font-medium text-emerald-400">SOP {entry.documentReadinessScore}%</span><Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/create?history=${encodeURIComponent(entry.id)}`}>Reopen</Link><Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete ${entry.title}`}><Trash2 /></Button></div>
  </article>;
}

function HistoryEmpty() {
  return <div className="flex min-h-[28rem] items-center justify-center text-center"><div><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-card"><FileText className="size-5 text-muted-foreground" /></div><h2 className="mt-4 text-sm font-medium">No saved SOPs yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Successfully generated SOPs will appear here automatically and remain available on this device.</p><Link className={buttonVariants({ className: "mt-5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" })} href="/create">Create an SOP</Link></div></div>;
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
