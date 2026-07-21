"use client";

import { useState } from "react";
import { Check, Clipboard, Download, FileJson, FileText, Info, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportSopDocx } from "@/lib/export-sop-docx";
import { exportSopJson } from "@/lib/export-sop-json";
import { exportSopPdf } from "@/lib/export-sop-pdf";
import type { Sop } from "@/lib/sop-schema";
import type { SopFormValues } from "./sop-form";
import { calculateReadinessScore } from "@/lib/readiness-score";

export function generateMockSop(values: SopFormValues, revision = 1): Sop {
  const title = values.title.trim() || "Untitled process";
  const idSeed = title.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const inputReadinessScore = calculateReadinessScore(values).score;
  return {
    title: `${title} — Standard Operating Procedure`, documentId: `PF-${idSeed}-${String(100 + revision).padStart(3, "0")}`, version: `1.${revision - 1}`, documentReadinessScore: Math.min(96, 86 + revision), inputReadinessScore, estimatedCompletionTime: values.detailLevel === "concise" ? "10–15 minutes" : values.detailLevel === "detailed" ? "25–35 minutes" : "15–25 minutes",
    purpose: `To provide a consistent, auditable method for ${values.description.trim().replace(/[.]$/, "").toLowerCase()}, ensuring timely execution and a reliable experience for all stakeholders.`,
    scope: `This SOP applies to ${values.audience} within ${values.department}. It covers the process from initial request or trigger through completion, documentation, and follow-up.`,
    roles: [
      { role: "Process owner", responsibility: `Maintains this SOP, monitors performance, and approves exceptions within ${values.department}.` },
      { role: "Process operator", responsibility: "Completes each procedure step, records evidence, and communicates status." },
      { role: "Escalation lead", responsibility: "Reviews high-risk, ambiguous, or overdue cases and authorizes corrective action." },
    ],
    prerequisites: ["Access to the relevant customer or operational record", "Required system permissions and approved communication templates", "Current policy, approval limits, and escalation contacts"],
    procedureSteps: [
      { stepNumber: 1, title: "Receive and log the request", instruction: "Capture the request, timestamp, requester details, source channel, and desired outcome in the system of record.", owner: "Process operator", evidence: "A complete, timestamped request record" },
      { stepNumber: 2, title: "Validate required information", instruction: "Confirm identity, eligibility, supporting evidence, and that all mandatory fields are complete before proceeding.", owner: "Process operator", evidence: "Completed validation fields and attached evidence" },
      { stepNumber: 3, title: "Assess and classify", instruction: `Categorize the case by type, urgency, and operational risk. Assumption: ${values.department} maintains an approved classification method.`, owner: "Process operator", evidence: "Classification and risk level recorded" },
      { stepNumber: 4, title: "Execute the approved action", instruction: "Complete the required system actions in sequence. Record identifiers, approvals, and any variance from the standard path.", owner: "Process operator", evidence: "System transaction identifiers and approval record" },
      { stepNumber: 5, title: "Quality-check the outcome", instruction: "Verify the final state against the original request, confirm records are synchronized, and resolve discrepancies.", owner: "Process operator", evidence: "Completed quality check with no unresolved discrepancy" },
      { stepNumber: 6, title: "Communicate and close", instruction: "Notify relevant stakeholders, document the result and any follow-up owner, then close the case.", owner: "Process operator", evidence: "Sent notification and closed case record" },
    ],
    escalationRules: ["If required information is missing, pause the process and request it; do not infer or fabricate data.", "Escalate exceptions, suspected fraud, safety risk, or requests outside the operator’s documented authority.", "Assumption: Escalate overdue cases according to the department's approved service target."],
    qualityChecklist: ["Request and outcome are fully documented", "Identity, eligibility, and approvals were verified", "System records match the completed action", "Stakeholders received a clear completion message", "Exceptions and follow-up owners are recorded"],
    trainingQuiz: [
      { question: "What must happen before the approved action is executed?", options: ["Validate and classify the request", "Close the request", "Skip directly to communication"], correctAnswer: "Validate and classify the request" },
      { question: "When should an operator escalate a case?", options: ["When an exception or risk exceeds documented authority", "For every routine request", "Only after closing the case"], correctAnswer: "When an exception or risk exceeds documented authority" },
      { question: "What evidence is required at closure?", options: ["A sent notification and closed case record", "A verbal recollection", "No evidence is required"], correctAnswer: "A sent notification and closed case record" },
    ],
    agentReadyJson: { schemaVersion: "processforge.sop.v1", processName: title, objective: `Complete ${title} consistently and with auditable evidence.`, trigger: "A valid process request is received.", completionCriteria: ["The requested outcome is verified", "Evidence and stakeholder communication are recorded"], requiredInputs: ["Complete request details", "Required supporting evidence"], steps: [
      { order: 1, action: "Receive and log the request", owner: "Process operator", evidence: "A complete, timestamped request record" },
      { order: 2, action: "Validate required information", owner: "Process operator", evidence: "Completed validation fields and attached evidence" },
      { order: 3, action: "Assess and classify", owner: "Process operator", evidence: "Classification and risk level recorded" },
      { order: 4, action: "Execute the approved action", owner: "Process operator", evidence: "System transaction identifiers and approval record" },
      { order: 5, action: "Quality-check the outcome", owner: "Process operator", evidence: "Completed quality check with no unresolved discrepancy" },
      { order: 6, action: "Communicate and close", owner: "Process operator", evidence: "Sent notification and closed case record" },
    ], escalationConditions: ["Missing required information", "Exception or risk exceeds documented authority"] },
  };
}

function sopToText(sop: Sop) { return [sop.title, `Document ID: ${sop.documentId} | Version: ${sop.version}`, "", "PURPOSE", sop.purpose, "", "SCOPE", sop.scope, "", "PROCEDURE", ...sop.procedureSteps.map((step) => `${step.stepNumber}. ${step.title}\nOwner: ${step.owner}\n${step.instruction}\nEvidence: ${step.evidence}`), "", "QUALITY CONTROL", ...sop.qualityChecklist.map((item) => `- ${item}`)].join("\n"); }

export function SopPreview({ sop, source, onRegenerate, onClear, isLoading }: { sop: Sop | null; source: "ai" | "fallback" | null; onRegenerate: () => void; onClear: () => void; isLoading: boolean }) {
  const [exporting, setExporting] = useState<"PDF" | "DOCX" | "JSON" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const copy = async () => { if (sop) await navigator.clipboard.writeText(sopToText(sop)); };
  const isAiEnhanced = Boolean(sop && sop.documentReadinessScore > sop.inputReadinessScore);
  const isSignificantlyEnhanced = Boolean(sop && sop.documentReadinessScore - sop.inputReadinessScore > 20);
  const runExport = async (format: "PDF" | "DOCX" | "JSON") => {
    if (!sop || exporting) return;
    setExporting(format);
    setExportError(null);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (format === "PDF") exportSopPdf(sop);
      if (format === "DOCX") await exportSopDocx(sop);
      if (format === "JSON") exportSopJson(sop);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };
  return (
    <section className="min-w-0 border-t border-border/80 bg-card/30 lg:border-l lg:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3 sm:px-5">
        <div><p className="text-sm font-medium">Document preview</p><p className="text-[11px] text-muted-foreground">{isLoading ? "Generating a business-ready draft…" : sop ? "Draft ready for review" : "Your SOP will appear here"}</p></div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={copy} disabled={!sop}><Clipboard /> Copy</Button>
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={!sop || isLoading}><RotateCcw /> Regenerate</Button>
          <Button variant="ghost" size="icon-sm" onClick={onClear} disabled={!sop || isLoading} aria-label="Clear SOP"><Trash2 /></Button>
        </div>
      </div>
      {!sop ? <EmptyPreview /> : <article className="max-h-none overflow-y-auto p-4 sm:p-6 lg:max-h-[calc(100vh-7.3rem)] lg:p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-background p-5 shadow-2xl shadow-black/10 sm:p-8">
          <div className="border-b border-border pb-6"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">Ready for review</span>{source && <span className="text-[10px] text-muted-foreground">{source === "ai" ? "Generated with AI" : "Local fallback"}</span>}</div><span className="font-mono text-[10px] text-muted-foreground">{sop.documentId}</span></div><h2 className="text-2xl font-semibold tracking-tight">{sop.title}</h2><div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><Meta label="Input quality" value={`${sop.inputReadinessScore}%`} tooltip="Measures how complete and detailed your instructions are before AI generation." /><Meta label="SOP readiness" value={`${sop.documentReadinessScore}%`} accent tooltip="Measures the completeness and operational quality of the generated SOP. AI may improve missing details using industry best practices while preserving your intent." /><Meta label="Version" value={sop.version} /><Meta label="Est. time" value={sop.estimatedCompletionTime} /></div>{isAiEnhanced && <div className="mt-4 flex flex-wrap items-center gap-2"><Tooltip label="AI Enhanced" content="The AI expanded your instructions by adding structure, best practices, responsibilities, assumptions, checklists and training content."><span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400"><Sparkles className="size-3" /> AI Enhanced</span></Tooltip>{isSignificantlyEnhanced && <span className="text-[11px] text-emerald-300/80">AI significantly improved this SOP.</span>}</div>}</div>
          <Section title="1. Purpose"><p>{sop.purpose}</p></Section><Section title="2. Scope"><p>{sop.scope}</p></Section>
          <Section title="3. Roles and responsibilities"><div className="overflow-hidden rounded-lg border border-border">{sop.roles.map((item) => <div key={item.role} className="grid gap-1 border-b border-border p-3 last:border-0 sm:grid-cols-[8rem_1fr]"><strong className="text-foreground">{item.role}</strong><span>{item.responsibility}</span></div>)}</div></Section>
          <Section title="4. Prerequisites"><List items={sop.prerequisites} /></Section>
          <Section title="5. Procedure"><ol className="space-y-4">{sop.procedureSteps.map((step) => <li key={step.stepNumber} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-mono text-xs text-emerald-400">{step.stepNumber}</span><div><strong className="text-sm text-foreground">{step.title}</strong><p className="mt-1">{step.instruction}</p><p className="mt-1 text-xs"><span className="text-foreground">Owner:</span> {step.owner} · <span className="text-foreground">Evidence:</span> {step.evidence}</p></div></li>)}</ol></Section>
          <Section title="6. Decision and escalation rules"><List items={sop.escalationRules} /></Section>
          <Section title="7. Quality-control checklist"><div className="space-y-2">{sop.qualityChecklist.map((item) => <div key={item} className="flex gap-2"><span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-emerald-500/40"><Check className="size-2.5 text-emerald-400" /></span>{item}</div>)}</div></Section>
          <Section title="8. Training quiz"><div className="space-y-4">{sop.trainingQuiz.map((item, index) => <div key={item.question}><p className="font-medium text-foreground">{index + 1}. {item.question}</p><ul className="mt-1 list-inside list-disc text-xs">{item.options.map((option) => <li key={option}>{option}</li>)}</ul><p className="mt-1 text-xs">Answer: {item.correctAnswer}</p></div>)}</div></Section>
          <Section title="9. Agent-ready JSON preview"><pre className="max-h-60 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-[10px] leading-5 text-emerald-300/80">{JSON.stringify(sop.agentReadyJson, null, 2)}</pre></Section>
        </div>
      </article>}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/80 p-3 sm:px-5">
        <span className={`mr-auto text-[11px] ${exportError ? "text-amber-400" : "text-muted-foreground"}`} role={exportError ? "alert" : undefined}>{exportError ?? (exporting ? `Preparing ${exporting} export...` : sop ? "Export this reviewed SOP." : "Generate an SOP to enable exports.")}</span>
        <Button variant="outline" size="sm" onClick={() => runExport("PDF")} disabled={!sop || Boolean(exporting)}><FileText /> PDF</Button>
        <Button variant="outline" size="sm" onClick={() => runExport("DOCX")} disabled={!sop || Boolean(exporting)}><Download /> DOCX</Button>
        <Button variant="outline" size="sm" onClick={() => runExport("JSON")} disabled={!sop || Boolean(exporting)}><FileJson /> JSON</Button>
      </div>
    </section>
  );
}

function EmptyPreview() { return <div className="flex min-h-[32rem] items-center justify-center p-8 text-center"><div><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-background"><FileText className="size-5 text-muted-foreground" /></div><h2 className="mt-4 text-sm font-medium">No SOP generated yet</h2><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Complete the brief or choose a template, then generate a structured operating procedure.</p></div></div>; }
function Meta({ label, value, accent, tooltip }: { label: string; value: string; accent?: boolean; tooltip?: string }) { return <div><span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}{tooltip && <Tooltip content={tooltip}><Info className="size-3" /></Tooltip>}</span><span className={`mt-1 block font-medium ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</span></div>; }
function Tooltip({ content, children, label }: { content: string; children: React.ReactNode; label?: string }) { return <button type="button" className="group relative inline-flex cursor-help items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50" aria-label={label ? `${label}. ${content}` : content}><span aria-hidden="true">{children}</span><span role="tooltip" className="pointer-events-none invisible absolute bottom-full left-0 z-30 mb-2 w-64 rounded-lg border border-border bg-popover px-3 py-2 text-left text-[11px] font-normal normal-case leading-4 tracking-normal text-popover-foreground opacity-0 shadow-xl transition-opacity group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">{content}</span></button>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-border py-6 last:border-0 last:pb-0"><h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{title}</h3><div className="text-sm leading-6 text-muted-foreground">{children}</div></section>; }
function List({ items }: { items: string[] }) { return <ul className="space-y-2">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-emerald-500" />{item}</li>)}</ul>; }
