import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCompliance } from "@/lib/compliance/compliance-engine";
import { detectSensitiveContent, sanitizePublicPreview } from "@/lib/marketplace/sanitization";
import { createTemplateSlug } from "@/lib/marketplace/slug";
import { checkRateLimit, requestClientKey } from "@/lib/security/rate-limit";
import { readJsonWithLimit, RequestPayloadError } from "@/lib/security/request";
import { migrateSopSnapshot, sopSchema } from "@/lib/sop-schema";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/json";

const schema = z.object({ sourceSopId: z.uuid(), title: z.string().trim().min(3).max(140), summary: z.string().trim().min(20).max(300), description: z.string().trim().min(20).max(4_000), categoryId: z.uuid().nullable(), industry: z.string().trim().max(100), department: z.string().trim().max(100), tags: z.array(z.string().trim().min(1).max(40)).max(10), preview: z.string().trim().min(20).max(5_000), confirmedSensitiveRemoval: z.literal(true) }).strict();

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;
  try { input = schema.parse(await readJsonWithLimit(request, 32_768)); }
  catch (error) { if (error instanceof RequestPayloadError) return reply(error.message, error.status); return reply("Complete all required publishing fields and confirm sensitive data removal.", 400); }
  let db;
  try { db = await createClient(); } catch { return reply("Marketplace service is unavailable.", 503); }
  const { data: { user } } = await db.auth.getUser();
  if (!user) return reply("Sign in to publish templates.", 401);
  const limited = checkRateLimit(requestClientKey(request, "template-publish", user.id), 10, 60 * 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Publication limit reached. Please retry later." }, { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } });
  const { data: row, error } = await db.from("sops").select("id,content").eq("id", input.sourceSopId).single();
  if (error || !row) return reply("The source SOP is unavailable or you cannot publish it.", 404);
  const parsed = sopSchema.safeParse(migrateSopSnapshot(row.content));
  if (!parsed.success) return reply("The source SOP is not valid for publication.", 422);
  const findings = detectSensitiveContent(parsed.data);
  if (findings.length) return NextResponse.json({ error: "Sensitive information was detected. Remove every flagged item before publishing.", findings }, { status: 422 });
  const display = String(user.user_metadata.display_name || "ProcessForge Creator").replace(/[<>]/g, "").trim().slice(0, 80) || "ProcessForge Creator";
  await db.from("marketplace_creator_profiles").upsert({ user_id: user.id, display_name: display }, { onConflict: "user_id" });
  const approved = process.env.MARKETPLACE_AUTO_APPROVE === "true";
  const slug = createTemplateSlug(input.title, crypto.randomUUID().slice(0, 8));
  const compliance = analyzeCompliance(parsed.data);
  const { data: template, error: insertError } = await db.from("sop_templates").insert({ creator_id: user.id, source_sop_id: row.id, title: input.title, slug, summary: input.summary, description: input.description, industry: input.industry || null, department: input.department || null, category_id: input.categoryId, template_content: parsed.data as unknown as Json, preview_content: sanitizePublicPreview(input.preview), visibility: "public", publication_status: approved ? "published" : "draft", moderation_status: approved ? "approved" : "pending_review", version: "1.0", risk_level: compliance.riskRating, is_free: true, paid_ready: false, published_at: approved ? new Date().toISOString() : null }).select("id,slug").single();
  if (insertError || !template) return reply("Template publication could not be completed.", 500);
  if (input.tags.length) { const tags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))]; const result = await db.from("template_tags").insert(tags.map((tag) => ({ template_id: template.id, tag }))); if (result.error) return reply("Template saved, but its tags could not be added.", 500); }
  return NextResponse.json({ ok: true, id: template.id, slug: template.slug, status: approved ? "published" : "pending_review" });
}

function reply(error: string, status: number) { return NextResponse.json({ error }, { status }); }
