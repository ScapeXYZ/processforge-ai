import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sopSchema } from "@/lib/sop-schema";
import { requireUser } from "@/lib/supabase/require-user";

export const runtime = "nodejs";
export const maxDuration = 90;

const sectionSchema = z.enum(["entire", "purpose", "scope", "roles", "prerequisites", "procedureSteps", "escalationRules", "qualityChecklist", "trainingQuiz", "agentReadyJson"]);
const editRequestSchema = z.object({ sop: sopSchema, section: sectionSchema, prompt: z.string().trim().min(1).max(2_000) }).strict();

export async function POST(request: Request) {
  const startedAt = Date.now();
  const auth = await requireUser();
  if (!auth.ok) return errorResponse(auth.message, auth.status);
  let body: unknown;
  try { body = await request.json(); } catch { return errorResponse("Request body must be valid JSON.", 400); }

  const parsed = editRequestSchema.safeParse(body);
  if (!parsed.success) return errorResponse("Choose an edit scope and enter a valid instruction.", 400);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return errorResponse("AI editing is temporarily unavailable. Please retry later.", 503);

  try {
    const openai = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
    const { sop, section, prompt } = parsed.data;
    const response = await openai.responses.parse({
      model: "gpt-5-mini",
      store: false,
      instructions: `You are a senior operations consultant editing an existing SOP. Return only data matching the supplied schema. Preserve documentId, version, inputReadinessScore, documentReadinessScore, estimatedCompletionTime, and knowledgeSources exactly. Do not invent laws, certifications, company policies, or claims of compliance. Clearly label necessary assumptions. Keep every procedure step measurable with an owner and evidence. Keep the agent-ready JSON consistent when the requested scope permits it.`,
      input: `Editing scope: ${section === "entire" ? "the entire SOP" : `only the ${section} section`}.
User instruction: ${prompt}

Existing SOP JSON:
${JSON.stringify(sop)}

Apply the instruction to the selected scope. Copy all fields outside that scope exactly.`,
      text: { format: zodTextFormat(sopSchema, "processforge_edited_sop") },
    });

    if (!response.output_parsed) return errorResponse("The editor could not produce a usable revision. Please retry.", 502);
    return NextResponse.json(response.output_parsed);
  } catch (error: unknown) {
    logProviderError(error, startedAt);
    if (error instanceof OpenAI.RateLimitError) return errorResponse("AI editing is busy. Please retry shortly.", 429);
    if (error instanceof OpenAI.APIConnectionTimeoutError) return errorResponse("Editing took too long. Please retry.", 504);
    if (error instanceof OpenAI.APIError) return errorResponse("The AI editor could not complete the request. Please retry.", 502);
    return errorResponse("AI editing failed. Please retry.", 500);
  }
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function logProviderError(error: unknown, startedAt: number): void {
  console.error({
    errorName: error instanceof Error ? error.name : "UnknownError",
    httpStatus: error instanceof OpenAI.APIError ? error.status : null,
    errorCode: error instanceof OpenAI.APIError ? error.code : null,
    requestDurationMs: Date.now() - startedAt,
  });
}
