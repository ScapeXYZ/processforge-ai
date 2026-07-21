"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ReadinessPanel } from "@/components/processforge/readiness-panel";
import { calculateReadinessScore } from "@/lib/readiness-score";

export type DetailLevel = "concise" | "standard" | "detailed";
export type SopFormValues = { title: string; industry: string; department: string; description: string; audience: string; detailLevel: DetailLevel };

const generationStages = [
  "Analyzing process",
  "Structuring responsibilities",
  "Writing procedure steps",
  "Building controls and training",
  "Finalizing SOP",
] as const;

const stageStartSeconds = [0, 3, 7, 12, 18] as const;

const fieldClass = "h-10 bg-background/60 px-3";

export function SopForm({ values, onChange, onSubmit, isGenerated, isLoading, error }: { values: SopFormValues; onChange: (values: SopFormValues) => void; onSubmit: () => void; isGenerated: boolean; isLoading: boolean; error: string | null }) {
  const set = <K extends keyof SopFormValues>(key: K, value: SopFormValues[K]) => onChange({ ...values, [key]: value });
  const readiness = calculateReadinessScore(values);
  return (
    <section className="p-4 sm:p-6 lg:p-7">
      <div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">SOP brief</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Describe the process</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Give ProcessForge the operational context needed to build a useful first draft.</p></div>
      <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }} className="space-y-5">
        <Field label="Process title"><Input required value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Customer refund process" className={fieldClass} /></Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Industry"><Input required value={values.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. E-commerce" className={fieldClass} /></Field>
          <Field label="Department"><Input required value={values.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Customer Support" className={fieldClass} /></Field>
        </div>
        <Field label="Process description" hint="Be specific about the trigger, desired result, and important constraints."><Textarea required value={values.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe how the process starts, what should happen, and the expected outcome..." className="min-h-32 resize-y bg-background/60 p-3 leading-6" /></Field>
        <Field label="Target audience"><Input required value={values.audience} onChange={(e) => set("audience", e.target.value)} placeholder="e.g. Support agents and team leads" className={fieldClass} /></Field>
        <fieldset><legend className="mb-2 text-sm font-medium">Detail level</legend><div className="grid grid-cols-3 gap-2">{(["concise", "standard", "detailed"] as const).map((level) => <button key={level} type="button" onClick={() => set("detailLevel", level)} className={`rounded-lg border px-2 py-2.5 text-sm capitalize transition-colors ${values.detailLevel === level ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400" : "border-border bg-background/60 text-muted-foreground hover:text-foreground"}`}>{level}</button>)}</div></fieldset>
        <ReadinessPanel readiness={readiness} />
        {isLoading && <GenerationProgress />}
        {error && <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-200">{error}</div>}
        <Button type="submit" size="lg" disabled={isLoading} className="mt-2 h-11 w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed">
          {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {isLoading ? "Building your SOP…" : isGenerated ? "Regenerate SOP" : "Generate SOP"}
        </Button>
        <p className="text-center text-[11px] text-muted-foreground">Generated securely with AI. A local draft is used if the service is unavailable.</p>
      </form>
    </section>
  );
}

function GenerationProgress() {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, []);
  const activeStage = stageStartSeconds.reduce<number>((current, start, index) => elapsedSeconds >= start ? index : current, 0);
  const elapsed = `${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, "0")}`;
  return <div aria-live="polite" className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
    <div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-medium text-foreground">Generating SOP</span><span className="font-mono text-[11px] text-muted-foreground">{elapsed} elapsed</span></div>
    <ol className="space-y-2">{generationStages.map((stage, index) => <li key={stage} className={`flex items-center gap-2 text-xs ${index <= activeStage ? "text-foreground" : "text-muted-foreground/50"}`}>
      <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${index < activeStage ? "border-emerald-500 bg-emerald-500 text-emerald-950" : index === activeStage ? "border-emerald-400 text-emerald-400" : "border-border"}`}>
        {index < activeStage ? <Check className="size-2.5" /> : index === activeStage ? <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> : null}
      </span>{stage}
    </li>)}</ol>
  </div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}{hint && <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{hint}</span>}</label>; }
