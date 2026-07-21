import { VersionHistory } from "@/components/processforge/version-history";
import { WorkflowLogo } from "@/components/processforge/workflow-logo";
import { WorkspaceHeader } from "@/components/processforge/workspace-header";

export default function VersionsPage() {
  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><WorkflowLogo className="pointer-events-none fixed left-1/2 top-1/2 z-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.035]" /><div className="relative z-10"><WorkspaceHeader /><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"><div className="mb-8"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Change control</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Version history</h1><p className="mt-2 text-sm text-muted-foreground">Review, restore and compare every saved SOP revision.</p></div><VersionHistory /></div></div></main>;
}
