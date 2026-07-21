"use client";

import { Check, Clipboard, Download, FileJson, FileText, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SopFormValues } from "./sop-form";

export type MockSop = ReturnType<typeof generateMockSop>;

export function generateMockSop(values: SopFormValues, revision = 1) {
  const title = values.title.trim() || "Untitled process";
  const idSeed = title.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  return {
    title: `${title} — Standard Operating Procedure`, documentId: `PF-${idSeed}-${String(100 + revision).padStart(3, "0")}`, version: `1.${revision - 1}`, readiness: Math.min(96, 86 + revision), completionTime: values.detailLevel === "concise" ? "10–15 minutes" : values.detailLevel === "detailed" ? "25–35 minutes" : "15–25 minutes",
    purpose: `To provide a consistent, auditable method for ${values.description.trim().replace(/[.]$/, "").toLowerCase()}, ensuring timely execution and a reliable experience for all stakeholders.`,
    scope: `This SOP applies to ${values.audience} within ${values.department}. It covers the process from initial request or trigger through completion, documentation, and follow-up.`,
    roles: [
      { role: "Process owner", responsibility: `Maintains this SOP, monitors performance, and approves exceptions within ${values.department}.` },
      { role: "Process operator", responsibility: "Completes each procedure step, records evidence, and communicates status." },
      { role: "Escalation lead", responsibility: "Reviews high-risk, ambiguous, or overdue cases and authorizes corrective action." },
    ],
    prerequisites: ["Access to the relevant customer or operational record", "Required system permissions and approved communication templates", "Current policy, approval limits, and escalation contacts"],
    steps: [
      { title: "Receive and log the request", body: "Capture the request, timestamp, requester details, source channel, and desired outcome in the system of record." },
      { title: "Validate required information", body: "Confirm identity, eligibility, supporting evidence, and that all mandatory fields are complete before proceeding." },
      { title: "Assess and classify", body: `Categorize the case by type, urgency, operational risk, and the applicable ${values.industry} policy.` },
      { title: "Execute the approved action", body: "Complete the required system actions in sequence. Record identifiers, approvals, and any variance from the standard path." },
      { title: "Quality-check the outcome", body: "Verify the final state against the original request, confirm records are synchronized, and resolve discrepancies." },
      { title: "Communicate and close", body: "Notify relevant stakeholders in clear language, document the result, schedule any follow-up, and close the case." },
    ],
    decisions: ["If required information is missing, pause the process and request it; do not infer or fabricate data.", "Escalate policy exceptions, suspected fraud, safety risk, or requests outside the operator’s approval limit.", "Escalate any case that remains unresolved beyond one business day or the department service-level target."],
    checklist: ["Request and outcome are fully documented", "Identity, eligibility, and approvals were verified", "System records match the completed action", "Stakeholders received a clear completion message", "Exceptions and follow-up owners are recorded"],
    quiz: [
      { question: "What must happen before the approved action is executed?", answer: "Validate required information and classify the request." },
      { question: "When should an operator escalate a case?", answer: "For policy exceptions, risk, approval-limit breaches, or overdue resolution." },
      { question: "What evidence is required at closure?", answer: "The request, action, approvals, final state, and stakeholder communication." },
    ],
  };
}

function sopToText(sop: MockSop) { return [sop.title, `Document ID: ${sop.documentId} | Version: ${sop.version}`, "", "PURPOSE", sop.purpose, "", "SCOPE", sop.scope, "", "PROCEDURE", ...sop.steps.map((step, i) => `${i + 1}. ${step.title}\n${step.body}`), "", "QUALITY CONTROL", ...sop.checklist.map((item) => `- ${item}`)].join("\n"); }

export function SopPreview({ sop, onRegenerate, onClear }: { sop: MockSop | null; onRegenerate: () => void; onClear: () => void }) {
  const copy = async () => { if (sop) await navigator.clipboard.writeText(sopToText(sop)); };
  return (
    <section className="min-w-0 border-t border-border/80 bg-card/30 lg:border-l lg:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3 sm:px-5">
        <div><p className="text-sm font-medium">Document preview</p><p className="text-[11px] text-muted-foreground">{sop ? "Draft generated locally" : "Your SOP will appear here"}</p></div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={copy} disabled={!sop}><Clipboard /> Copy</Button>
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={!sop}><RotateCcw /> Regenerate</Button>
          <Button variant="ghost" size="icon-sm" onClick={onClear} disabled={!sop} aria-label="Clear SOP"><Trash2 /></Button>
        </div>
      </div>
      {!sop ? <EmptyPreview /> : <article className="max-h-none overflow-y-auto p-4 sm:p-6 lg:max-h-[calc(100vh-7.3rem)] lg:p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-border bg-background p-5 shadow-2xl shadow-black/10 sm:p-8">
          <div className="border-b border-border pb-6"><div className="mb-4 flex items-center justify-between"><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">Ready for review</span><span className="font-mono text-[10px] text-muted-foreground">{sop.documentId}</span></div><h2 className="text-2xl font-semibold tracking-tight">{sop.title}</h2><div className="mt-5 grid grid-cols-3 gap-3 text-xs"><Meta label="Version" value={sop.version} /><Meta label="Readiness" value={`${sop.readiness}%`} accent /><Meta label="Est. time" value={sop.completionTime} /></div></div>
          <Section title="1. Purpose"><p>{sop.purpose}</p></Section><Section title="2. Scope"><p>{sop.scope}</p></Section>
          <Section title="3. Roles and responsibilities"><div className="overflow-hidden rounded-lg border border-border">{sop.roles.map((item) => <div key={item.role} className="grid gap-1 border-b border-border p-3 last:border-0 sm:grid-cols-[8rem_1fr]"><strong className="text-foreground">{item.role}</strong><span>{item.responsibility}</span></div>)}</div></Section>
          <Section title="4. Prerequisites"><List items={sop.prerequisites} /></Section>
          <Section title="5. Procedure"><ol className="space-y-4">{sop.steps.map((step, index) => <li key={step.title} className="flex gap-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 font-mono text-xs text-emerald-400">{index + 1}</span><div><strong className="text-sm text-foreground">{step.title}</strong><p className="mt-1">{step.body}</p></div></li>)}</ol></Section>
          <Section title="6. Decision and escalation rules"><List items={sop.decisions} /></Section>
          <Section title="7. Quality-control checklist"><div className="space-y-2">{sop.checklist.map((item) => <div key={item} className="flex gap-2"><span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-emerald-500/40"><Check className="size-2.5 text-emerald-400" /></span>{item}</div>)}</div></Section>
          <Section title="8. Training quiz"><div className="space-y-4">{sop.quiz.map((item, index) => <div key={item.question}><p className="font-medium text-foreground">{index + 1}. {item.question}</p><p className="mt-1 text-xs">Answer: {item.answer}</p></div>)}</div></Section>
          <Section title="9. Agent-ready JSON preview"><pre className="max-h-60 overflow-auto rounded-lg border border-border bg-card p-4 font-mono text-[10px] leading-5 text-emerald-300/80">{JSON.stringify({ schema: "processforge.sop.v1", document_id: sop.documentId, title: sop.title, version: sop.version, procedure: sop.steps.map((step, i) => ({ order: i + 1, action: step.title, instruction: step.body })), escalation_rules: sop.decisions, quality_controls: sop.checklist }, null, 2)}</pre></Section>
        </div>
      </article>}
      <div className="flex flex-wrap items-center gap-2 border-t border-border/80 p-3 sm:px-5"><span className="mr-auto text-[11px] text-muted-foreground">Export becomes available after review.</span>{[{ label: "PDF", icon: FileText }, { label: "DOCX", icon: Download }, { label: "JSON", icon: FileJson }].map(({ label, icon: Icon }) => <Button key={label} variant="outline" size="sm" disabled><Icon /> {label}</Button>)}</div>
    </section>
  );
}

function EmptyPreview() { return <div className="flex min-h-[32rem] items-center justify-center p-8 text-center"><div><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-border bg-background"><FileText className="size-5 text-muted-foreground" /></div><h2 className="mt-4 text-sm font-medium">No SOP generated yet</h2><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">Complete the brief or choose a template, then generate a structured operating procedure.</p></div></div>; }
function Meta({ label, value, accent }: { label: string; value: string; accent?: boolean }) { return <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><span className={`mt-1 block font-medium ${accent ? "text-emerald-400" : "text-foreground"}`}>{value}</span></div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-b border-border py-6 last:border-0 last:pb-0"><h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{title}</h3><div className="text-sm leading-6 text-muted-foreground">{children}</div></section>; }
function List({ items }: { items: string[] }) { return <ul className="space-y-2">{items.map((item) => <li key={item} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-emerald-500" />{item}</li>)}</ul>; }
