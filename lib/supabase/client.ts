import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");
  browserClient ??= createBrowserClient<Database>(config.url, config.key);
  return browserClient;
}

