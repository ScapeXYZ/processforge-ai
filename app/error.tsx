"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => { if (process.env.NODE_ENV === "development") console.error(error.name, error.digest); }, [error]); return <main className="grid min-h-[70vh] place-items-center px-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="mt-3 text-sm text-muted-foreground">Your work has not been intentionally cleared. Retry, or return after checking your connection.</p><Button onClick={reset} className="mt-6">Try again</Button></div></main>; }
