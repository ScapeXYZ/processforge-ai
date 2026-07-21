"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SopForm, type SopFormValues } from "@/components/processforge/sop-form";
import { generateMockSop, SopPreview } from "@/components/processforge/sop-preview";
import { sopSchema, type Sop } from "@/lib/sop-schema";
import { refundTemplate, TemplateSidebar, type Template } from "@/components/processforge/template-sidebar";
import { WorkflowLogo } from "@/components/processforge/workflow-logo";
import { WorkspaceHeader } from "@/components/processforge/workspace-header";

const emptyValues: SopFormValues = { title: "", industry: "", department: "", description: "", audience: "", detailLevel: "standard" };

export default function CreatePage() {
  return <Suspense fallback={<div className="min-h-screen bg-background" />}><CreateWorkspace /></Suspense>;
}

function CreateWorkspace() {
  const searchParams = useSearchParams();
  const initial = useMemo(() => searchParams.get("example") === "refund" ? fromTemplate(refundTemplate) : { ...emptyValues, description: searchParams.get("description") ?? "" }, [searchParams]);
  const [values, setValues] = useState<SopFormValues>(initial);
  const [sop, setSop] = useState<Sop | null>(null);
  const [revision, setRevision] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generate = async () => {
    if (isLoading) return;
    const next = sop ? revision + 1 : revision;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/generate-sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processTitle: values.title, industry: values.industry, department: values.department, processDescription: values.description, targetAudience: values.audience, detailLevel: values.detailLevel }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "The AI service could not generate this SOP.";
        throw new Error(message);
      }
      setSop(sopSchema.parse(payload));
      setRevision(next);
    } catch (cause) {
      setSop(generateMockSop(values, next));
      setRevision(next);
      const message = cause instanceof Error ? cause.message : "The AI service could not generate this SOP.";
      setError(`${message} A local fallback draft is shown. Retry when ready.`);
    } finally {
      setIsLoading(false);
    }
  };
  const clear = () => { setSop(null); setRevision(1); setError(null); };
  const chooseTemplate = (template: Template) => { setValues(fromTemplate(template)); setSop(null); setRevision(1); setError(null); };

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><WorkflowLogo className="pointer-events-none fixed left-1/2 top-1/2 z-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.035]" /><div className="relative z-10"><WorkspaceHeader /><div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_minmax(22rem,0.85fr)_minmax(28rem,1.3fr)]"><TemplateSidebar onSelect={chooseTemplate} /><SopForm values={values} onChange={setValues} onSubmit={generate} isGenerated={Boolean(sop)} isLoading={isLoading} error={error} /><SopPreview sop={sop} onRegenerate={generate} onClear={clear} isLoading={isLoading} /></div></div></main>;
}

function fromTemplate(template: Template): SopFormValues { return { title: template.title, industry: template.industry, department: template.department, description: template.description, audience: template.audience, detailLevel: "standard" }; }
