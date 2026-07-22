import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, updated = "July 22, 2026", children }: { title: string; updated?: string; children: ReactNode }) {
  return <main className="min-h-screen bg-background px-5 py-12 text-foreground sm:px-8"><article className="mx-auto max-w-3xl"><Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">← ProcessForge AI</Link><h1 className="mt-8 text-4xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}. This document requires legal review before production launch.</p><div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">{children}</div></article></main>;
}
