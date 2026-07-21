"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SopForm, type SopFormValues } from "@/components/processforge/sop-form";
import { generateMockSop, SopPreview, type MockSop } from "@/components/processforge/sop-preview";
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
  const [sop, setSop] = useState<MockSop | null>(null);
  const [revision, setRevision] = useState(1);
  const generate = () => { const next = sop ? revision + 1 : revision; setRevision(next); setSop(generateMockSop(values, next)); };
  const clear = () => { setSop(null); setRevision(1); };
  const chooseTemplate = (template: Template) => { setValues(fromTemplate(template)); setSop(null); setRevision(1); };

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><WorkflowLogo className="pointer-events-none fixed left-1/2 top-1/2 z-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.035]" /><div className="relative z-10"><WorkspaceHeader /><div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_minmax(22rem,0.85fr)_minmax(28rem,1.3fr)]"><TemplateSidebar onSelect={chooseTemplate} /><SopForm values={values} onChange={setValues} onSubmit={generate} isGenerated={Boolean(sop)} /><SopPreview sop={sop} onRegenerate={generate} onClear={clear} /></div></div></main>;
}

function fromTemplate(template: Template): SopFormValues { return { title: template.title, industry: template.industry, department: template.department, description: template.description, audience: template.audience, detailLevel: "standard" }; }
