import Link from "next/link";
import { ChevronLeft, Cloud, History, MoreHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkflowLogo } from "./workflow-logo";

export function WorkspaceHeader() {
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="ProcessForge AI home">
          <WorkflowLogo className="size-7 text-emerald-500" />
          <span className="hidden sm:inline">ProcessForge <span className="text-muted-foreground">AI</span></span>
        </Link>
        <span className="h-5 w-px bg-border" />
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Workspace
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/history" className={buttonVariants({ variant: "ghost", size: "sm" })}><History /> History</Link>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Cloud className="size-3.5" /> Saved locally</span>
        <Button variant="ghost" size="icon" aria-label="More options"><MoreHorizontal /></Button>
      </div>
    </header>
  );
}
