import { notFound } from "next/navigation";
import { ReleaseCheckDashboard } from "@/components/processforge/release-check-dashboard";
import { WorkspaceHeader } from "@/components/processforge/workspace-header";

export const dynamic = "force-dynamic";

export default function ReleaseCheckPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_RELEASE_CHECK !== "true") notFound();
  return <main className="min-h-screen bg-background"><WorkspaceHeader/><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-500">Internal release QA</p><h1 className="mt-2 text-2xl font-semibold">ProcessForge release check</h1><p className="mt-2 mb-6 max-w-3xl text-sm text-muted-foreground">Run the automated harness first, then record manual evidence here. This route is disabled in production unless explicitly enabled server-side.</p><ReleaseCheckDashboard/></div></main>;
}
