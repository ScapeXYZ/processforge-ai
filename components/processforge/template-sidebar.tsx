import { Clock3, FileText, Headphones, ShoppingBag, Store, Users } from "lucide-react";

export type Template = { title: string; industry: string; department: string; description: string; audience: string };

const templates: Array<Template & { icon: typeof FileText }> = [
  { title: "Customer refund", industry: "E-commerce", department: "Customer Support", description: "Process customer refund requests from initial verification through payment reversal and customer confirmation.", audience: "Support agents and team leads", icon: ShoppingBag },
  { title: "Employee onboarding", industry: "Professional Services", department: "People Operations", description: "Onboard a new employee from signed offer through a successful first 30 days.", audience: "Hiring managers and People Ops", icon: Users },
  { title: "Support escalation", industry: "SaaS", department: "Customer Support", description: "Triage and escalate complex customer issues while maintaining clear ownership and response timelines.", audience: "Tier 1 and Tier 2 support agents", icon: Headphones },
  { title: "Restaurant opening", industry: "Hospitality", department: "Operations", description: "Prepare the restaurant, team, systems, and service areas before opening to guests.", audience: "Opening managers and front-of-house staff", icon: Store },
];

export const refundTemplate = templates[0];

export function TemplateSidebar({ onSelect }: { onSelect: (template: Template) => void }) {
  return (
    <aside className="border-b border-border/80 bg-card/30 lg:border-b-0 lg:border-r">
      <div className="p-4 lg:sticky lg:top-0 lg:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Templates</p>
          <span className="text-[10px] text-muted-foreground">4 available</span>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1">
          {templates.map(({ icon: Icon, ...template }) => (
            <button key={template.title} type="button" onClick={() => onSelect(template)} className="group flex w-full items-start gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-secondary/70">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-emerald-400"><Icon className="size-4" /></span>
              <span><span className="block text-sm font-medium">{template.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{template.department}</span></span>
            </button>
          ))}
        </div>
        <div className="mt-7 border-t border-border/80 pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recent SOPs</p>
          <div className="space-y-2">
            {["Vendor approval workflow", "Weekly inventory count"].map((title) => (
              <div key={title} className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-muted-foreground"><Clock3 className="size-3.5" /><span className="truncate">{title}</span></div>
            ))}
          </div>
          <p className="mt-3 px-2 text-[11px] leading-4 text-muted-foreground/70">Recent documents are placeholders in this local prototype.</p>
        </div>
      </div>
    </aside>
  );
}
