import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeReturnUrl } from "@/lib/auth/return-url";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

const protectedPrefixes = ["/create", "/workspace", "/workspaces", "/history", "/versions", "/knowledge-base", "/dashboard", "/settings"];
const authPages = ["/login", "/signup", "/forgot-password", "/reset-password"];

export async function updateSession(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(config.url, config.key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll: (items) => {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  if (!signedIn && protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?returnTo=${encodeURIComponent(safeReturnUrl(`${path}${request.nextUrl.search}`, "/dashboard"))}`;
    return NextResponse.redirect(login);
  }
  if (signedIn && authPages.includes(path)) return NextResponse.redirect(new URL("/dashboard", request.url));
  return response;
}
