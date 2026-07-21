import { createClient } from "@/lib/supabase/server";
export async function requireUser(): Promise<{ ok: true; userId: string } | { ok: false; status: 401 | 503; message: string }> {
  try { const { data, error } = await (await createClient()).auth.getUser(); return error || !data.user ? { ok: false, status: 401, message: "Please sign in to continue." } : { ok: true, userId: data.user.id }; }
  catch { return { ok: false, status: 503, message: "Account services are temporarily unavailable." }; }
}
