"use client";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeReturnUrl } from "@/lib/auth/return-url";

const inputClass = "mt-1.5 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-400/10";
const buttonClass = "mt-5 w-full rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50";
const messageFor = (message: string) => message.toLowerCase().includes("invalid login") ? "Email or password is incorrect." : message.toLowerCase().includes("already registered") ? "An account may already exist. Try signing in or resetting your password." : "We could not complete that request. Please try again.";

export function LoginForm() {
  const router = useRouter(); const params = useSearchParams(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); try { const { error: authError } = await createClient().auth.signInWithPassword({ email: String(form.get("email")).trim(), password: String(form.get("password")) }); if (authError) setError(messageFor(authError.message)); else { router.replace(safeReturnUrl(params.get("returnTo"))); router.refresh(); } } catch { setError("Authentication is not configured. Check the Supabase environment variables."); } finally { setBusy(false); } }
  return <form onSubmit={submit}><label className="text-sm text-slate-300">Email<input className={inputClass} name="email" type="email" required autoComplete="email" /></label><label className="mt-4 block text-sm text-slate-300">Password<input className={inputClass} name="password" type="password" minLength={8} required autoComplete="current-password" /></label><div className="mt-3 text-right"><Link className="text-xs text-emerald-300 hover:text-emerald-200" href="/forgot-password">Forgot password?</Link></div>{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}<button className={buttonClass} disabled={busy}>{busy ? "Signing in…" : "Sign In"}</button></form>;
}

export function SignupForm() {
  const params = useSearchParams();
  useEffect(() => { const returnTo = safeReturnUrl(params.get("returnTo")); if (returnTo.startsWith("/invitations/accept")) document.cookie = `processforge_invitation_return=${encodeURIComponent(returnTo)}; Path=/; Max-Age=604800; SameSite=Lax`; }, [params]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => { const returnTo = safeReturnUrl(params.get("returnTo")); if (message.startsWith("Account created") && returnTo.startsWith("/invitations/accept")) window.location.assign(returnTo); }, [message, params]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const password = String(form.get("password")); if (password.length < 8) { setError("Use at least 8 characters for your password."); setBusy(false); return; } try { const origin = window.location.origin; const { data, error: authError } = await createClient().auth.signUp({ email: String(form.get("email")).trim(), password, options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard`, data: { display_name: String(form.get("displayName")).trim().slice(0, 80) } } }); if (authError) setError(messageFor(authError.message)); else setMessage(data.session ? "Account created. You can continue to your dashboard." : "Check your email to verify your account, then sign in."); } catch { setError("Authentication is not configured. Check the Supabase environment variables."); } finally { setBusy(false); } }
  return <form onSubmit={submit}><label className="text-sm text-slate-300">Display name<input className={inputClass} name="displayName" maxLength={80} required autoComplete="name" /></label><label className="mt-4 block text-sm text-slate-300">Email<input className={inputClass} name="email" type="email" required autoComplete="email" /></label><label className="mt-4 block text-sm text-slate-300">Password<input className={inputClass} name="password" type="password" minLength={8} required autoComplete="new-password" /></label>{message && <p role="status" className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">{message}</p>}{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}<button className={buttonClass} disabled={busy}>{busy ? "Creating account…" : "Create Account"}</button></form>;
}

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { await createClient().auth.resetPasswordForEmail(String(new FormData(event.currentTarget).get("email")).trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` }); setSent(true); } catch { setError("Password recovery is temporarily unavailable. Please try again."); } finally { setBusy(false); } }
  return <form onSubmit={submit}><label className="text-sm text-slate-300">Email<input className={inputClass} name="email" type="email" required autoComplete="email" /></label>{sent && <p role="status" className="mt-4 rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">If an account matches that address, a reset link has been sent.</p>}{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}<button className={buttonClass} disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button></form>;
}

export function ResetPasswordForm() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const password = String(form.get("password")); const confirm = String(form.get("confirm")); if (password.length < 8 || password !== confirm) { setError(password !== confirm ? "Passwords do not match." : "Use at least 8 characters."); setBusy(false); return; } try { const { error: authError } = await createClient().auth.updateUser({ password }); if (authError) setError("The reset link is invalid or expired. Request a new one."); else { router.replace("/dashboard"); router.refresh(); } } catch { setError("Password reset is temporarily unavailable."); } finally { setBusy(false); } }
  return <form onSubmit={submit}><label className="text-sm text-slate-300">New password<input className={inputClass} name="password" type="password" minLength={8} required autoComplete="new-password" /></label><label className="mt-4 block text-sm text-slate-300">Confirm password<input className={inputClass} name="confirm" type="password" minLength={8} required autoComplete="new-password" /></label>{error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}<button className={buttonClass} disabled={busy}>{busy ? "Updating…" : "Update Password"}</button></form>;
}
