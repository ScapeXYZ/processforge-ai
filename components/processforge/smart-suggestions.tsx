import { AlertTriangle, Check, Sparkles } from "lucide-react";
import type { SmartSuggestionsResult } from "@/lib/smart-suggestions";

export function SmartSuggestions({ analysis }: { analysis: SmartSuggestionsResult }) {
  const completedCount = analysis.checks.filter((check) => check.complete).length;
  return <aside className="rounded-lg border border-border bg-card/50 p-4" aria-label="AI Suggestions">
    <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-violet-500/10 text-violet-300"><Sparkles className="size-3.5" /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h2 className="text-xs font-medium text-foreground">AI Suggestions</h2><span className="text-[10px] text-muted-foreground">{completedCount}/8 detected</span></div><p className="text-[10px] text-muted-foreground">Instant local analysis · No API call</p></div></div>
    {analysis.recommendations.length > 0 && <div className="mt-3 space-y-1.5 rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5">{analysis.recommendations.map((recommendation) => <p key={recommendation} className="text-[11px] leading-4 text-violet-200">{recommendation}</p>)}</div>}
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">{analysis.checks.map((check) => <li key={check.label} className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-[11px] ${check.complete ? "border-emerald-500/15 bg-emerald-500/5 text-emerald-300" : "border-amber-500/15 bg-amber-500/5 text-amber-200"}`}>
      <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${check.complete ? "bg-emerald-500/15" : "bg-amber-500/10"}`}>{check.complete ? <Check className="size-2.5" /> : <AlertTriangle className="size-2.5" />}</span><span>{check.complete ? check.completeMessage : check.missingMessage}</span>
    </li>)}</ul>
  </aside>;
}
