import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { NextResponse } from "next/server";
import { buildSopPrompt, SOP_SYSTEM_PROMPT } from "@/lib/sop-prompt";
import { sopRequestSchema, sopSchema } from "@/lib/sop-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
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
    const openai = new OpenAI({ apiKey, timeout: 55_000, maxRetries: 1 });
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

    return NextResponse.json(response.output_parsed);
  } catch (error: unknown) {
    if (error instanceof OpenAI.RateLimitError) {
      return errorResponse("Generation is busy right now. Please wait a moment and retry.", 429);
    }
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      return errorResponse("Generation timed out. Please retry.", 504);
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
