import { NextResponse, type NextRequest } from "next/server"; import { createClient } from "@/lib/supabase/server";
export async function POST(request: NextRequest) { try { await (await createClient()).auth.signOut(); } catch { /* Clear navigation still remains safe. */ } return NextResponse.redirect(new URL("/login", request.url), 303); }

