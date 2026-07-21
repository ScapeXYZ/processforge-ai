import { z } from "zod";
import { authenticatedClient } from "@/lib/cloud/auth";
import { cloudFailure, type CloudResult } from "@/lib/cloud/result";

export const displayNameSchema = z.string().trim().min(1).max(80).regex(/^[^<>]*$/, "Display name contains unsupported characters.");
export type CloudProfile = { id: string; email: string; displayName: string | null; avatarUrl: string | null };

export async function fetchProfile(): Promise<CloudResult<CloudProfile>> {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { data: userData } = await auth.data.client.auth.getUser();
  const { data, error } = await auth.data.client.from("profiles").select("*").eq("id", auth.data.userId).single();
  return error || !data ? cloudFailure("Could not load your profile.") : { ok: true, data: { id: data.id, email: userData.user?.email ?? "", displayName: data.display_name, avatarUrl: data.avatar_url } };
}
export async function updateProfile(displayName: string): Promise<CloudResult<CloudProfile>> {
  const parsed = displayNameSchema.safeParse(displayName); if (!parsed.success) return cloudFailure(parsed.error.issues[0]?.message ?? "Invalid display name.", "validation");
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const { data, error } = await auth.data.client.from("profiles").update({ display_name: parsed.data }).eq("id", auth.data.userId).select().single();
  const { data: userData } = await auth.data.client.auth.getUser();
  return error || !data ? cloudFailure("Could not save your profile.") : { ok: true, data: { id: data.id, email: userData.user?.email ?? "", displayName: data.display_name, avatarUrl: data.avatar_url } };
}

