import { WorkspaceHeader } from "@/components/processforge/workspace-header";import { WorkspaceManager } from "@/components/processforge/workspace-manager";
export const dynamic="force-dynamic";export default function WorkspacesPage(){return <main className="min-h-screen bg-background"><WorkspaceHeader/><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><WorkspaceManager/></div></main>}
