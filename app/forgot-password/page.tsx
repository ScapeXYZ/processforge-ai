import Link from "next/link"; import { AuthCard } from "@/components/processforge/auth-card"; import { ForgotPasswordForm } from "@/components/processforge/auth-fields"; import { getAppBaseUrl } from "@/lib/env/server";
export const dynamic = "force-dynamic";
export default function ForgotPage() { return <AuthCard title="Reset your password" description="We’ll send secure recovery instructions if the address is registered." footer={<Link className="text-emerald-300" href="/login">Return to sign in</Link>}><ForgotPasswordForm callbackBaseUrl={getAppBaseUrl()} /></AuthCard>; }
