"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SopForm, type SopFormValues } from "@/components/processforge/sop-form";
import { generateMockSop, SopPreview } from "@/components/processforge/sop-preview";
import { sopSchema, type Sop } from "@/lib/sop-schema";
import { refundTemplate, TemplateSidebar, type Template } from "@/components/processforge/template-sidebar";
import { WorkflowLogo } from "@/components/processforge/workflow-logo";
import { WorkspaceHeader } from "@/components/processforge/workspace-header";
import { getSopHistoryEntry, saveSopToHistory } from "@/lib/sop-history";
import { calculateReadinessScore } from "@/lib/readiness-score";
import { createSopVersion, getSopVersion } from "@/lib/version-manager";
import { selectRelevantPassages } from "@/lib/document-text";
import { getKnowledgeDocumentsByIds } from "@/lib/knowledge-base-manager";

const emptyValues: SopFormValues = { title: "", industry: "", department: "", description: "", audience: "", detailLevel: "standard" };

export default function CreatePage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><CreateWorkspace /></Suspense>;
}

function CreateWorkspace() {
  const searchParams = useSearchParams();
  const initial = useMemo(() => searchParams.get("example") === "refund" ? fromTemplate(refundTemplate) : { ...emptyValues, description: searchParams.get("description") ?? "" }, [searchParams]);
  const [values, setValues] = useState<SopFormValues>(initial);
  const [sop, setSop] = useState<Sop | null>(null);
  const [generationSource, setGenerationSource] = useState<"ai" | "fallback" | null>(null);
  const [revision, setRevision] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const historyId = searchParams.get("history");
  const versionId = searchParams.get("version");

  useEffect(() => {
    if (!historyId && !versionId) return;
    const timer = window.setTimeout(() => {
      if (versionId) {
        const version = getSopVersion(versionId);
        if (!version) { setError("This SOP version is no longer available."); return; }
        setValues((current) => ({ ...current, title: version.sop.title }));
        setSop(version.sop);
        setSelectedKnowledgeIds(version.sop.knowledgeSources.documentIds);
        setGenerationSource("ai");
        setError(null);
        return;
      }
      if (!historyId) return;
      const entry = getSopHistoryEntry(historyId);
      if (!entry) {
        setError("This saved SOP is no longer available.");
        return;
      }
      setValues((current) => ({ ...current, title: entry.title, industry: entry.industry, department: entry.department }));
      setSop(entry.sop);
      setSelectedKnowledgeIds(entry.sop.knowledgeSources.documentIds);
      setGenerationSource("ai");
      setError(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [historyId, versionId]);
  const generate = async () => {
    if (isLoading) return;
    const next = sop ? revision + 1 : revision;
    setIsLoading(true);
    setError(null);
    try {
      const inputReadinessScore = calculateReadinessScore(values).score;
      const knowledgeSources = selectRelevantPassages(getKnowledgeDocumentsByIds(selectedKnowledgeIds), values).references;
      const response = await fetch("/api/generate-sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processTitle: values.title, industry: values.industry, department: values.department, processDescription: values.description, targetAudience: values.audience, detailLevel: values.detailLevel, inputReadinessScore, knowledgeSources }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "The AI service could not generate this SOP.";
        throw new Error(message);
      }
      const generatedSop = sopSchema.parse(payload);
      setSop(generatedSop);
      setGenerationSource("ai");
      setRevision(next);
      saveSopToHistory({ sop: generatedSop, industry: values.industry, department: values.department });
      createSopVersion({ sop: generatedSop, changeSummary: sop ? "SOP regenerated from the current process brief" : "Initial SOP generated" });
    } catch (cause) {
      if (!sop) {
        const fallbackSop = generateMockSop(values, next);
        setSop(fallbackSop);
        setGenerationSource("fallback");
        setRevision(next);
        createSopVersion({ sop: fallbackSop, changeSummary: "Initial local fallback SOP generated" });
      }
      const message = cause instanceof Error ? cause.message : "Generation failed. Please retry.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };
  const clear = () => { setSop(null); setGenerationSource(null); setRevision(1); setError(null); setSelectedKnowledgeIds([]); };
  const chooseTemplate = (template: Template) => { setValues(fromTemplate(template)); setSop(null); setGenerationSource(null); setRevision(1); setError(null); setSelectedKnowledgeIds([]); };
  const applySopChange = (nextSop: Sop, changeSummary?: string) => { setSop(nextSop); if (changeSummary) createSopVersion({ sop: nextSop, changeSummary }); };
  const saveVersion = () => Boolean(sop && createSopVersion({ sop, changeSummary: "Manual SOP snapshot saved" }));

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><WorkflowLogo className="pointer-events-none fixed left-1/2 top-1/2 z-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.035]" /><div className="relative z-10"><WorkspaceHeader /><div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_minmax(22rem,0.85fr)_minmax(28rem,1.3fr)]"><TemplateSidebar onSelect={chooseTemplate} /><SopForm values={values} onChange={setValues} onSubmit={generate} isGenerated={Boolean(sop)} isLoading={isLoading} error={error} selectedKnowledgeIds={selectedKnowledgeIds} onKnowledgeSelectionChange={setSelectedKnowledgeIds} /><SopPreview sop={sop} source={generationSource} onRegenerate={generate} onClear={clear} onSopChange={applySopChange} onSaveVersion={saveVersion} isLoading={isLoading} /></div></div></main>;
}

function fromTemplate(template: Template): SopFormValues { return { title: template.title, industry: template.industry, department: template.department, description: template.description, audience: template.audience, detailLevel: "standard" }; }
