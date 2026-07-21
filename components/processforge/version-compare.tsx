import type { SopVersion } from "@/lib/version-manager";

const sections = [
  { label: "Purpose", get: (version: SopVersion) => [version.sop.purpose] },
  { label: "Scope", get: (version: SopVersion) => [version.sop.scope] },
  { label: "Roles and responsibilities", get: (version: SopVersion) => version.sop.roles.map((item) => `${item.role}: ${item.responsibility}`) },
  { label: "Prerequisites", get: (version: SopVersion) => version.sop.prerequisites },
  { label: "Procedure", get: (version: SopVersion) => version.sop.procedureSteps.map((item) => `${item.stepNumber}. ${item.title} — ${item.instruction} | Owner: ${item.owner} | Evidence: ${item.evidence}`) },
  { label: "Escalation rules", get: (version: SopVersion) => version.sop.escalationRules },
  { label: "Quality checklist", get: (version: SopVersion) => version.sop.qualityChecklist },
  { label: "Training quiz", get: (version: SopVersion) => version.sop.trainingQuiz.map((item) => `${item.question} — ${item.correctAnswer}`) },
  { label: "Agent-ready JSON", get: (version: SopVersion) => JSON.stringify(version.sop.agentReadyJson, null, 2).split("\n") },
  { label: "Source Notes", get: (version: SopVersion) => JSON.stringify(version.sop.knowledgeSources, null, 2).split("\n") },
] as const;

export function VersionCompare({ before, after }: { before: SopVersion; after: SopVersion }) {
  return <section className="mt-8 rounded-xl border border-border bg-card/40 p-4 sm:p-6">
    <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-500">Version comparison</p><h2 className="mt-1 text-lg font-semibold">{before.name} vs. {after.name}</h2><div className="mt-2 flex gap-4 text-[11px] text-muted-foreground"><span><i className="mr-1 inline-block size-2 rounded-full bg-rose-400" />Removed</span><span><i className="mr-1 inline-block size-2 rounded-full bg-emerald-400" />Added</span></div></div>
    <div className="space-y-5">{sections.map((section) => {
      const beforeLines = section.get(before);
      const afterLines = section.get(after);
      const changed = JSON.stringify(beforeLines) !== JSON.stringify(afterLines);
      return <div key={section.label}><div className="mb-2 flex items-center gap-2"><h3 className="text-xs font-medium text-foreground">{section.label}</h3>{changed && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-300">Changed</span>}</div><div className="grid gap-3 lg:grid-cols-2"><CompareSide label={before.name} lines={beforeLines} otherLines={afterLines} tone="removed" /><CompareSide label={after.name} lines={afterLines} otherLines={beforeLines} tone="added" /></div></div>;
    })}</div>
  </section>;
}

function CompareSide({ label, lines, otherLines, tone }: { label: string; lines: readonly string[]; otherLines: readonly string[]; tone: "added" | "removed" }) {
  return <div className="overflow-hidden rounded-lg border border-border bg-background/70"><p className="border-b border-border px-3 py-2 text-[10px] font-medium text-muted-foreground">{label}</p><div className="space-y-1 p-3">{lines.map((line, index) => { const different = !otherLines.includes(line); return <p key={`${index}-${line}`} className={`whitespace-pre-wrap rounded px-2 py-1 text-[11px] leading-4 ${different ? tone === "added" ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200" : "text-muted-foreground"}`}>{line}</p>; })}</div></div>;
}
