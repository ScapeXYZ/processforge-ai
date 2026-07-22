import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { buildSopPrompt, SOP_SYSTEM_PROMPT } from "@/lib/sop-prompt";
import { sopRequestSchema, sopSchema } from "@/lib/sop-schema";
import { requireUser } from "@/lib/supabase/require-user";
import { checkRateLimit, requestClientKey } from "@/lib/security/rate-limit";
import { readJsonWithLimit, RequestPayloadError } from "@/lib/security/request";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const auth = await requireUser();
  if (!auth.ok) return errorResponse(auth.message, auth.status);
  const limited = checkRateLimit(requestClientKey(request, "generate-sop", auth.userId), 10, 60_000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many generation requests. Please retry shortly." }, { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } });
  let body: unknown;

  try {
    body = await readJsonWithLimit(request, 128_000);
  } catch (error) {
    return errorResponse(error instanceof RequestPayloadError ? error.message : "Request body must be valid JSON.", error instanceof RequestPayloadError ? error.status : 400);
  }

  const parsedRequest = sopRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse("Please complete every required field with valid information.", 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse("SOP generation is temporarily unavailable. Please try again later.", 503);
  }

  try {
    const openai = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 1 });
    const response = await openai.responses.parse({
      model: "gpt-5-mini",
      store: false,
      instructions: SOP_SYSTEM_PROMPT,
      input: buildSopPrompt(parsedRequest.data),
      text: { format: zodTextFormat(sopSchema, "processforge_sop") },
    });

    if (!response.output_parsed) {
      return errorResponse("The provider could not generate a usable SOP. Please try again.", 502);
    }

    const selectedSources = parsedRequest.data.knowledgeSources;
    return NextResponse.json({ ...response.output_parsed, inputReadinessScore: parsedRequest.data.inputReadinessScore, knowledgeSources: { ...response.output_parsed.knowledgeSources, documentIds: selectedSources.map((source) => source.id), documentNames: selectedSources.map((source) => source.name), sourceNotes: { ...response.output_parsed.knowledgeSources.sourceNotes, documentsUsed: selectedSources.map((source) => source.name) } } });
  } catch (error: unknown) {
    logProviderError(error, startedAt);
    if (error instanceof OpenAI.RateLimitError) {
      return errorResponse("Generation is busy right now. Please wait a moment and retry.", 429);
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return errorResponse("Generation took too long. Please retry.", 504);
    }
    if (error instanceof OpenAI.APIError) {
      return errorResponse("The AI provider could not complete the request. Please retry.", 502);
    }
    return errorResponse("SOP generation failed unexpectedly. Please retry.", 500);
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
