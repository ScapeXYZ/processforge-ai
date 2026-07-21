import { authenticatedClient } from "@/lib/cloud/auth";
import { cloudFailure } from "@/lib/cloud/result";

export async function exportAccountData() {
  const auth = await authenticatedClient(); if (!auth.ok) return auth;
  const client = auth.data.client;
  const [profile, sops, versions, documents] = await Promise.all([
    client.from("profiles").select("*").eq("id", auth.data.userId).maybeSingle(), client.from("sops").select("*"), client.from("sop_versions").select("*"), client.from("knowledge_documents").select("*"),
  ]);
  if (profile.error || sops.error || versions.error || documents.error) return cloudFailure("Could not prepare your account export.");
  return { ok: true as const, data: { exportedAt: new Date().toISOString(), profile: profile.data, sops: sops.data, sopVersions: versions.data, knowledgeDocuments: documents.data } };
}

