import { NextResponse, type NextRequest } from "next/server";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeReturnUrl(url.searchParams.get("next"));
  if (code) {
    try {
      const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    } catch { /* Redirect safely below. */ }
  }
  return NextResponse.redirect(new URL("/login?error=callback", request.url));
}
