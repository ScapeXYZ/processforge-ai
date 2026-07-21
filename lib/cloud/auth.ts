import { createClient } from "@/lib/supabase/client";
import type { CloudResult } from "@/lib/cloud/result";
import { cloudFailure } from "@/lib/cloud/result";

export async function authenticatedClient(): Promise<CloudResult<{ client: ReturnType<typeof createClient>; userId: string }>> {
  try {
    const client = createClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return cloudFailure("Please sign in to use cloud sync.", "auth");
    return { ok: true, data: { client, userId: data.user.id } };
  } catch { return cloudFailure("Cloud service is currently unavailable.", typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "provider"); }
}

