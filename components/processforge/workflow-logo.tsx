import { cn } from "@/lib/utils";

export function WorkflowLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" aria-hidden="true" className={cn(className)}>
      <path d="M60 16v24M60 80v24M16 60h24M80 60h24" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      <rect x="42" y="42" width="36" height="36" rx="8" stroke="currentColor" strokeWidth="8" />
      <circle cx="60" cy="12" r="7" fill="currentColor" />
      <circle cx="60" cy="108" r="7" fill="currentColor" />
      <circle cx="12" cy="60" r="7" fill="currentColor" />
      <circle cx="108" cy="60" r="7" fill="currentColor" />
    </svg>
  );
}
