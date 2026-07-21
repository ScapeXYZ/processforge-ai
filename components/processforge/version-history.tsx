"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GitCompareArrows, History, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { VersionCompare } from "@/components/processforge/version-compare";
import { deleteSopVersion, getSopVersions, renameSopVersion, type SopVersion } from "@/lib/version-manager";

export function VersionHistory() {
  const [versions, setVersions] = useState<SopVersion[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setVersions(getSopVersions()), 0); return () => window.clearTimeout(timer); }, []);
  const left = useMemo(() => versions.find((version) => version.id === leftId), [versions, leftId]);
  const right = useMemo(() => versions.find((version) => version.id === rightId), [versions, rightId]);

  const rename = (version: SopVersion) => {
    const name = window.prompt("Rename this version", version.name);
    if (name) setVersions(renameSopVersion(version.id, name));
  };

  return <>
    {versions.length === 0 ? <EmptyVersions /> : <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="divide-y divide-border/80 rounded-xl border border-border bg-card/30 px-4 sm:px-5">{versions.map((version) => <article key={version.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-emerald-400"><History className="size-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-medium">{version.name}</h2><span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[9px] text-muted-foreground">v{version.versionNumber}</span></div><p className="mt-1 text-[11px] text-muted-foreground">{version.changeSummary}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{version.documentId} · {formatDate(version.timestamp)}</p></div></div><div className="flex gap-1 pl-12 sm:pl-0"><Link href={`/create?version=${encodeURIComponent(version.id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}><RotateCcw /> Restore</Link><Button variant="ghost" size="icon-sm" onClick={() => rename(version)} aria-label={`Rename ${version.name}`}><Pencil /></Button><Button variant="ghost" size="icon-sm" onClick={() => setVersions(deleteSopVersion(version.id))} aria-label={`Delete ${version.name}`}><Trash2 /></Button></div></article>)}</div>
      <aside className="h-fit rounded-xl border border-border bg-card/40 p-4 lg:sticky lg:top-6"><div className="flex items-center gap-2"><GitCompareArrows className="size-4 text-emerald-400" /><h2 className="text-sm font-medium">Compare versions</h2></div><p className="mt-1 text-[11px] text-muted-foreground">Select any two snapshots.</p><label className="mt-4 block text-[11px] text-muted-foreground">Earlier version<select value={leftId} onChange={(event) => setLeftId(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"><option value="">Select version</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.name} · v{version.versionNumber}</option>)}</select></label><label className="mt-3 block text-[11px] text-muted-foreground">Later version<select value={rightId} onChange={(event) => setRightId(event.target.value)} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"><option value="">Select version</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.name} · v{version.versionNumber}</option>)}</select></label></aside>
    </div>}
    {left && right && left.id !== right.id && <VersionCompare before={left} after={right} />}
  </>;
}

function EmptyVersions() { return <div className="flex min-h-[28rem] items-center justify-center text-center"><div><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-card"><History className="size-5 text-muted-foreground" /></div><h2 className="mt-4 text-sm font-medium">No versions saved yet</h2><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">Generate an SOP or save a version manually to begin tracking changes.</p><Link href="/create" className={buttonVariants({ className: "mt-5 bg-emerald-500 text-emerald-950 hover:bg-emerald-400" })}>Create an SOP</Link></div></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
