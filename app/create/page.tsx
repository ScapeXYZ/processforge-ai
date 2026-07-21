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
import { fetchSop, type CloudSop } from "@/lib/cloud/sop-service";
import { linkCloudSop, syncSop, type CloudSaveState } from "@/lib/cloud/sync-manager";
import { fetchVersions } from "@/lib/cloud/version-service";
import { SopCollaboration } from "@/components/processforge/sop-collaboration";
import { activeWorkspace } from "@/lib/cloud/workspace-service";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

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
  const [cloudStatus, setCloudStatus] = useState<CloudSaveState>("idle");
  const [cloudRecord, setCloudRecord] = useState<CloudSop | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const historyId = searchParams.get("history");
  const versionId = searchParams.get("version");
  const cloudId = searchParams.get("cloud");
  const cloudVersionId = searchParams.get("cloudVersion");

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
  useEffect(() => {
    if (!cloudId) return;
    let active = true;
    void fetchSop(cloudId).then((result) => {
      if (!active) return;
      if (!result.ok) { setError(result.error.message); return; }
      const { row, sop: loaded } = result.data;
      setValues({ title: loaded.title, industry: row.industry ?? "", department: row.department ?? "", description: row.description ?? "", audience: row.audience ?? "", detailLevel: row.detail_level === "concise" || row.detail_level === "detailed" ? row.detail_level : "standard" });
      setSop(loaded); setCloudRecord(result.data); setSelectedKnowledgeIds(loaded.knowledgeSources.documentIds); setGenerationSource("ai"); linkCloudSop(loaded.documentId, row.id, row.updated_at); setCloudStatus("saved"); setError(null); try { void createSupabaseClient().rpc("workspace_role_for", { target: row.workspace_id }).then(({ data }) => setIsReadOnly(data === "viewer")); } catch { setIsReadOnly(true); }
    });
    return () => { active = false; };
  }, [cloudId]);
  useEffect(() => {
    if (!cloudVersionId) return;
    let active = true;
    void fetchVersions().then(async (result) => { if (!active) return; const version = result.ok ? result.data.find((item) => item.id === cloudVersionId) : null; if (!version) { setError("This cloud version is unavailable."); return; } const parent = await fetchSop(version.sopId); if (parent.ok) linkCloudSop(version.sop.documentId, parent.data.row.id, parent.data.row.updated_at); if (!active) return; setSop(version.sop); setValues((current) => ({ ...current, title: version.sop.title })); setSelectedKnowledgeIds(version.sop.knowledgeSources.documentIds); setGenerationSource("ai"); setError(null); });
    return () => { active = false; };
  }, [cloudVersionId]);
  const saveCloud = async (snapshot: Sop, changeSummary: string) => {
    setCloudStatus("saving");
    const result = await syncSop({ sop: snapshot, context: { industry: values.industry, department: values.department, description: values.description, audience: values.audience, detailLevel: values.detailLevel }, changeSummary });
    setCloudStatus(result.ok ? "saved" : result.error.code === "offline" ? "offline" : result.error.code === "conflict" ? "conflict" : "failed");
    if (result.ok) setCloudRecord(result.data);
    if (!result.ok && result.error.code === "conflict") setError(result.error.message);
  };
  const generate = async () => {
    if (isLoading) return;
    const workspace = await activeWorkspace();
    if (workspace.ok && workspace.data.role === "viewer") { setError("Viewers have read-only access. Ask an editor or admin to generate this SOP."); return; }
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
      void saveCloud(generatedSop, sop ? "SOP regenerated from the current process brief" : "Initial SOP generated");
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
  const clear = () => { setSop(null); setCloudRecord(null); setGenerationSource(null); setRevision(1); setError(null); setSelectedKnowledgeIds([]); };
  const chooseTemplate = (template: Template) => { setValues(fromTemplate(template)); setSop(null); setGenerationSource(null); setRevision(1); setError(null); setSelectedKnowledgeIds([]); };
  const applySopChange = (nextSop: Sop, changeSummary?: string) => { setSop(nextSop); if (changeSummary) { createSopVersion({ sop: nextSop, changeSummary }); void saveCloud(nextSop, changeSummary); } };
  const saveVersion = () => { if (!sop) return false; const saved = Boolean(createSopVersion({ sop, changeSummary: "Manual SOP snapshot saved" })); if (saved) void saveCloud(sop, "Manual SOP snapshot saved"); return saved; };

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><WorkflowLogo className="pointer-events-none fixed left-1/2 top-1/2 z-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.035]"/><div className="relative z-10"><WorkspaceHeader cloudStatus={cloudStatus} onRetry={sop&&!isReadOnly?()=>void saveCloud(sop,"Cloud save retried"):undefined}/><div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_minmax(22rem,0.85fr)_minmax(28rem,1.3fr)]"><TemplateSidebar onSelect={chooseTemplate}/><SopForm values={values} onChange={setValues} onSubmit={generate} isGenerated={Boolean(sop)} isLoading={isLoading||isReadOnly} error={error} selectedKnowledgeIds={selectedKnowledgeIds} onKnowledgeSelectionChange={setSelectedKnowledgeIds}/><div className="min-w-0"><SopPreview sop={sop} source={generationSource} onRegenerate={generate} onClear={clear} onSopChange={applySopChange} onSaveVersion={saveVersion} isLoading={isLoading||isReadOnly}/>{cloudRecord&&<SopCollaboration sopId={cloudRecord.row.id} workspaceId={cloudRecord.row.workspace_id} status={cloudRecord.row.status} onStatusChange={status=>setCloudRecord(current=>current?{...current,row:{...current.row,status}}:current)}/>}</div></div></div></main>;
}

function fromTemplate(template: Template): SopFormValues { return { title: template.title, industry: template.industry, department: template.department, description: template.description, audience: template.audience, detailLevel: "standard" }; }
