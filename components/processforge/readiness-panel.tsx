import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReadinessResult } from "@/lib/readiness-score";

export function ReadinessPanel({ readiness }: { readiness: ReadinessResult }) {
  const isReady = readiness.score >= 70;
  return <aside className="rounded-lg border border-border bg-card/50 p-4" aria-label="Input readiness">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-medium text-muted-foreground">Input readiness</p><p className={`mt-1 text-sm font-medium ${isReady ? "text-emerald-400" : "text-amber-300"}`}>{readiness.status}</p></div><span className="text-2xl font-semibold tracking-tight text-foreground">{readiness.score}<span className="text-sm text-muted-foreground">%</span></span></div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.score}><div className={`h-full rounded-full transition-[width] duration-300 ${isReady ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${readiness.score}%` }} /></div>
    {!isReady && <p className="mt-3 flex gap-1.5 text-[11px] leading-4 text-amber-200"><AlertTriangle className="mt-0.5 size-3 shrink-0" />You can generate now, but more context will improve the result.</p>}
    {readiness.suggestions.length > 0 ? <ul className="mt-3 space-y-1.5">{readiness.suggestions.map((suggestion) => <li key={suggestion} className="flex gap-2 text-[11px] leading-4 text-muted-foreground"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-500" />{suggestion}</li>)}</ul> : <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><CheckCircle2 className="size-3 text-emerald-400" />The brief has strong operational context.</p>}
  </aside>;
}
