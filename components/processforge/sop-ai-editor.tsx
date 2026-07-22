"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Redo2, Sparkles, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sopSchema, type Sop } from "@/lib/sop-schema";

type EditorSection = "entire" | "purpose" | "scope" | "roles" | "prerequisites" | "procedureSteps" | "escalationRules" | "qualityChecklist" | "trainingQuiz" | "agentReadyJson";

const quickActions = [
  ["Improve", "Improve this SOP professionally while preserving its intent."],
  ["Rewrite", "Rewrite this SOP for clarity, precision and operational usability."],
  ["Expand", "Expand this SOP with useful operational detail, responsibilities and measurable evidence."],
  ["Shorten", "Shorten this SOP without removing essential controls, responsibilities or evidence."],
  ["Make Professional", "Make this SOP more professional, direct and business-ready."],
  ["Add Checklist", "Add or improve a practical quality-control checklist for this SOP."],
  ["Add Risks", "Add relevant operational risks, mitigations and escalation conditions without inventing policies."],
  ["Add KPIs", "Add measurable performance indicators and success criteria where appropriate."],
  ["Add Compliance", "Add clearly labeled placeholders for applicable compliance requirements without inventing laws or claiming compliance."],
  ["Make ISO 9001", "Align the SOP structure with ISO 9001 quality-management principles without claiming certification or inventing requirements."],
] as const;

const sections: Array<{ value: EditorSection; label: string }> = [
  { value: "entire", label: "Entire SOP" }, { value: "purpose", label: "Purpose" }, { value: "scope", label: "Scope" }, { value: "roles", label: "Roles and responsibilities" }, { value: "prerequisites", label: "Prerequisites" }, { value: "procedureSteps", label: "Procedure" }, { value: "escalationRules", label: "Escalation rules" }, { value: "qualityChecklist", label: "Quality checklist" }, { value: "trainingQuiz", label: "Training quiz" }, { value: "agentReadyJson", label: "Agent-ready JSON" },
];

export function SopAiEditor({ sop, onChange, disabled }: { sop: Sop; onChange: (sop: Sop, changeSummary?: string) => void; disabled: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [section, setSection] = useState<EditorSection>("entire");
  const [isEditing, setIsEditing] = useState(false);
  const [undoStack, setUndoStack] = useState<Sop[]>([]);
  const [redoStack, setRedoStack] = useState<Sop[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => { const receive=(event:Event)=>{const detail=(event as CustomEvent<unknown>).detail;if(typeof detail==="string"){setPrompt(detail);setMessage(null)}};window.addEventListener("processforge:editor-prompt",receive);return()=>window.removeEventListener("processforge:editor-prompt",receive); }, []);

  const applyEdit = async () => {
    if (!prompt.trim() || isEditing || disabled) return;
    setIsEditing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/edit-sop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sop, section, prompt: prompt.trim() }) });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "The AI editor could not complete this edit.";
        throw new Error(error);
      }
      const edited = preserveDocumentMetadata(sop, sopSchema.parse(payload));
      const next = mergeEditedSection(sop, edited, section);
      setUndoStack((current) => [...current, sop]);
      setRedoStack([]);
      onChange(next, `AI Editor updated ${section === "entire" ? "the entire SOP" : sections.find((item) => item.value === section)?.label ?? section}: ${prompt.trim().slice(0, 140)}`);
      setMessage({ type: "success", text: section === "entire" ? "SOP updated successfully." : `${sections.find((item) => item.value === section)?.label} updated successfully.` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "AI editing failed. Please retry." });
    } finally {
      setIsEditing(false);
    }
  };

  const undo = () => {
    const previous = undoStack.at(-1);
    if (!previous || isEditing) return;
    setUndoStack((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, sop]);
    onChange(previous);
    setMessage({ type: "success", text: "Edit undone." });
  };

  const redo = () => {
    const next = redoStack.at(-1);
    if (!next || isEditing) return;
    setRedoStack((current) => current.slice(0, -1));
    setUndoStack((current) => [...current, sop]);
    onChange(next);
    setMessage({ type: "success", text: "Edit restored." });
  };

  return <section className="border-t border-border/80 p-4 sm:p-5">
    <div className="rounded-xl border border-border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles className="size-4 text-emerald-400" /><h2 className="text-sm font-medium">Ask ProcessForge AI</h2></div><p className="mt-1 text-[11px] text-muted-foreground">Refine the whole document or update one section.</p></div><div className="flex gap-1"><Button variant="ghost" size="icon-sm" onClick={undo} disabled={disabled || isEditing || undoStack.length === 0} aria-label="Undo edit"><Undo2 /></Button><Button variant="ghost" size="icon-sm" onClick={redo} disabled={disabled || isEditing || redoStack.length === 0} aria-label="Redo edit"><Redo2 /></Button></div></div>
      <div className="mt-4 flex flex-wrap gap-1.5">{quickActions.map(([label, actionPrompt]) => <Button key={label} type="button" variant="outline" size="xs" disabled={disabled || isEditing} onClick={() => setPrompt(actionPrompt)}>{label}</Button>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[11rem_1fr]">
        <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Edit scope</span><select value={section} onChange={(event) => setSection(event.target.value as EditorSection)} disabled={disabled || isEditing} className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs text-foreground outline-none focus:border-emerald-500/50">{sections.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Editing instruction</span><Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={disabled || isEditing} placeholder="e.g. Clarify the approval path and add measurable evidence..." className="min-h-20 resize-y bg-card p-3 text-xs leading-5" /></label>
      </div>
      {isEditing && <EditorProgress />}
      {message && <div role={message.type === "error" ? "alert" : "status"} className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] ${message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-200"}`}>{message.type === "success" && <CheckCircle2 className="size-3.5" />}{message.text}</div>}
      <Button onClick={applyEdit} disabled={disabled || isEditing || !prompt.trim()} className="mt-3 bg-emerald-500 text-emerald-950 hover:bg-emerald-400">{isEditing ? <LoaderCircle className="animate-spin" /> : <Sparkles />} {isEditing ? "Applying edit…" : "Apply AI edit"}</Button>
    </div>
  </section>;
}

function EditorProgress() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const startedAt = Date.now(); const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500); return () => window.clearInterval(timer); }, []);
  const stage = seconds < 3 ? "Reviewing selected content" : seconds < 7 ? "Applying your instruction" : "Validating SOP structure";
  return <div className="mt-3" aria-live="polite"><div className="mb-1.5 flex justify-between text-[10px] text-muted-foreground"><span>{stage}</span><span>{seconds}s</span></div><div className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-500" /></div></div>;
}

function preserveDocumentMetadata(original: Sop, edited: Sop): Sop {
  return { ...edited, documentId: original.documentId, version: original.version, inputReadinessScore: original.inputReadinessScore, documentReadinessScore: original.documentReadinessScore, estimatedCompletionTime: original.estimatedCompletionTime, knowledgeSources: original.knowledgeSources };
}

function mergeEditedSection(original: Sop, edited: Sop, section: EditorSection): Sop {
  if (section === "entire") return edited;
  return { ...original, [section]: edited[section] };
}
