import type { ReactNode } from "react";
import Link from "next/link";

export function AuthCard({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return <main className="min-h-screen bg-[#080b12] px-4 py-12 text-white"><div className="mx-auto w-full max-w-md"><Link href="/" className="mb-8 flex items-center justify-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-emerald-400 text-black">PF</span>ProcessForge AI</Link><section className="rounded-2xl border border-white/10 bg-[#111722] p-6 shadow-2xl shadow-black/30 sm:p-8"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-slate-400">{description}</p><div className="mt-6">{children}</div>{footer && <div className="mt-6 border-t border-white/10 pt-5 text-center text-sm text-slate-400">{footer}</div>}</section></div></main>;
}

