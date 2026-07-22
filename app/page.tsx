import {
  ArrowRight,
  Check,
  ClipboardCheck,
  Code2,
  Headphones,
  ShoppingBag,
  Sparkles,
  Store,
  UserRoundCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { WorkflowLogo } from "@/components/processforge/workflow-logo";

const services = [
  {
    title: "SOP Generator",
    description: "Turn a process description into a complete operating procedure.",
    icon: ClipboardCheck,
  },
  {
    title: "Employee Onboarding",
    description: "Build a clear, repeatable path for every new team member.",
    icon: UserRoundCheck,
  },
  {
    title: "Customer Support Workflow",
    description: "Standardize issue handling from first response to resolution.",
    icon: Headphones,
  },
  {
    title: "Sales Process",
    description: "Define every stage from qualified lead to closed customer.",
    icon: ShoppingBag,
  },
  {
    title: "Restaurant Operations",
    description: "Document reliable opening, service, and closing routines.",
    icon: Store,
  },
  {
    title: "Software Runbook",
    description: "Create dependable technical procedures for your systems.",
    icon: Code2,
  },
];

const steps = [
  { number: "01", title: "Describe", text: "Tell us what the process should accomplish." },
  { number: "02", title: "Generate", text: "ProcessForge structures every operational detail." },
  { number: "03", title: "Review", text: "Refine roles, steps, controls, and checklists." },
  { number: "04", title: "Export", text: "Share a readable SOP or agent-ready JSON." },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <nav className="relative z-20 border-b border-border/80" aria-label="Main navigation">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
          <a href="#" className="flex items-center gap-2.5 font-semibold tracking-tight" aria-label="ProcessForge AI home">
            <WorkflowLogo className="size-7 text-emerald-500" />
            <span>ProcessForge <span className="text-muted-foreground">AI</span></span>
          </a>

          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#product" className="transition-colors hover:text-foreground">Product</a>
            <a href="#templates" className="transition-colors hover:text-foreground">Templates</a>
            <a href="#how-it-works" className="transition-colors hover:text-foreground">How it works</a>
          </div>

          <Button
            size="sm"
            nativeButton={false}
            render={<a href="/create" />}
            className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
          >
            Create SOP <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </nav>

      <section id="create" className="relative border-b border-border/80">
        <WorkflowLogo className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.04] sm:size-[46rem]" />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-28 lg:py-32">
          <Badge variant="outline" className="mb-6 border-emerald-500/30 bg-emerald-500/5 px-3 py-1 text-emerald-400">
            <Sparkles className="mr-1.5 size-3.5" /> Professional workflow intelligence
          </Badge>

          <h1 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            Turn any business process into a complete, usable SOP.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Describe how your work gets done. ProcessForge AI turns it into a clear,
            structured procedure your team and systems can follow with confidence.
          </p>

          <Card id="product" className="mt-10 w-full border-border bg-card text-left shadow-2xl shadow-black/20 sm:mt-12">
            <CardContent className="p-3 sm:p-4">
              <form action="/create" method="get">
              <Textarea
                name="description"
                aria-label="Describe the process you want to document"
                placeholder="Describe the process you want to document. Example: Create a customer refund SOP for an online store."
                className="min-h-36 resize-none border-0 bg-transparent p-3 text-base leading-7 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 sm:min-h-40"
              />
              <Separator className="my-2" />
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="px-2 text-xs tracking-wide text-muted-foreground">
                  Purpose <span className="text-border">•</span> Roles <span className="text-border">•</span> Steps <span className="text-border">•</span> Checklist <span className="text-border">•</span> Training quiz
                </p>
                <div className="flex gap-2">
                  <Button nativeButton={false} render={<a href="/create?example=refund" />} variant="outline" className="flex-1 sm:flex-none">View example</Button>
                  <Button type="submit" className="flex-1 bg-emerald-500 text-emerald-950 hover:bg-emerald-400 sm:flex-none">
                    Generate SOP <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section aria-label="Product benefits" className="border-b border-border/80">
        <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:grid-cols-4 lg:px-10">
          {["Ready in minutes", "Structured output", "Human-readable", "Agent-ready JSON"].map((metric, index) => (
            <div key={metric} className={`flex items-center justify-center gap-2 py-6 text-center text-sm font-medium ${index % 2 ? "border-l border-border" : ""} ${index > 1 ? "border-t border-border lg:border-t-0" : ""} ${index === 2 ? "lg:border-l" : ""}`}>
              <Check className="size-4 text-emerald-500" /> {metric}
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Workflow templates</p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start with the process you need.</h2>
          <p className="mt-4 leading-7 text-muted-foreground">Purpose-built starting points for the work that keeps your business moving.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {services.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="group border-border bg-card transition-colors hover:border-emerald-500/40">
              <CardContent className="flex h-full min-h-56 flex-col p-6">
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors group-hover:text-emerald-400">
                    <Icon className="size-5" />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">0.05 USDT</span>
                </div>
                <div className="mt-auto pt-8">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border/80 bg-card/30">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">How it works</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">From intent to execution.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">A simple workflow designed to preserve your expertise and make it operational.</p>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="bg-background p-6 sm:p-7">
                <span className="font-mono text-xs text-emerald-500">{step.number}</span>
                <h3 className="mt-8 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <div className="flex items-center gap-2.5 font-semibold">
            <WorkflowLogo className="size-6 text-emerald-500" /> ProcessForge AI
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/acceptable-use">Acceptable Use</a><a href="/ai-disclaimer">AI Disclaimer</a><a href="/data-handling">Data Handling</a></nav>
        </div>
      </footer>
    </main>
  );
}
