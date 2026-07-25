import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { agentError } from "@/lib/agent/contract";
import { generateAgentSop } from "@/lib/agent/generate";
import {
  runOfficialPaymentGate,
  type OfficialPaymentGateResult,
} from "@/lib/agent/official-x402-middleware";
import {
  recordUsage,
  updateAgentRequest,
} from "@/lib/agent/payment-store";
import { acquireGenerationSlot, checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { validateAgentRequestPayload } from "@/lib/agent/request-validation";
import { AGENT_SCHEMA_VERSION, AGENT_SERVICE } from "@/lib/agent/service";
import {
  ensureRouteHandlerResponse,
  isNextContinuationResponse,
} from "@/lib/http/route-handler-response";
import { securityLog } from "@/lib/security/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return agentError("METHOD_NOT_ALLOWED", "Use POST for this operation.", 405);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const fallbackRequestId = randomUUID();
  securityLog("route_handler_entered", {
    request_id: fallbackRequestId,
    route: "/api/agent/generate-sop",
    settled_payment: false,
  });

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return agentError("INVALID_REQUEST", "Request body could not be read.", 400, fallbackRequestId);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return agentError("INVALID_REQUEST", "Request body must be valid JSON.", 400, fallbackRequestId);
  }
  const validated = validateAgentRequestPayload(
    bodyText,
    payload,
    Number(request.headers.get("content-length") || 0),
  );
  if (!validated.ok) {
    return Response.json({
      error: {
        code: validated.code,
        message: validated.message,
        ...(validated.details ? { details: validated.details } : {}),
        request_id: fallbackRequestId,
      },
    }, { status: validated.status });
  }

  const paymentResult = await runOfficialPaymentGate(request, bodyText);
  if (paymentResult.type === "response") {
    if (isNextContinuationResponse(paymentResult.response)) {
      securityLog("route_continuation_rejected", {
        request_id: fallbackRequestId,
        route: "/api/agent/generate-sop",
        http_status: paymentResult.response.status,
      });
    }
    return ensureRouteHandlerResponse(paymentResult.response, fallbackRequestId);
  }
  const requestId = paymentResult.requestId;
  const finalize = (response: Response) => withPaymentReceipt(response, paymentResult);
  securityLog("route_handler_entered", {
    request_id: requestId,
    route: "/api/agent/generate-sop",
    settled_payment: true,
  });
  await updateAgentRequest(requestId, { status: "processing", error_code: null });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkAgentRateLimit(clientKey);
  if (!rate.allowed) {
    await updateAgentRequest(requestId, { status: "paid", error_code: "RATE_LIMITED" });
    return finalize(Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Retry later; payment will not be charged again.", request_id: requestId } },
      { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
    ));
  }

  const release = acquireGenerationSlot();
  if (!release) {
    await updateAgentRequest(requestId, { status: "paid", error_code: "SERVICE_BUSY" });
    return finalize(agentError("SERVICE_BUSY", "Generation capacity is busy. Retry the same paid request later.", 503, requestId));
  }
  try {
    securityLog("generation_started", { request_id: requestId, route: "/api/agent/generate-sop" });
    const generated = await generateAgentSop(validated.input);
    const completedAt = new Date().toISOString();
    const duration = Date.now() - startedAt;
    const response = {
      request_id: requestId,
      service: AGENT_SERVICE,
      status: "completed",
      ...generated,
      generated_at: completedAt,
      processing_time_ms: duration,
      schema_version: AGENT_SCHEMA_VERSION,
    };
    await updateAgentRequest(requestId, {
      status: "completed",
      response_payload: response,
      processing_time_ms: duration,
      completed_at: completedAt,
    });
    await recordUsage({
      request_id: requestId,
      service: AGENT_SERVICE,
      outcome: "success",
      processing_time_ms: duration,
    });
    securityLog("generation_completed", {
      request_id: requestId,
      route: "/api/agent/generate-sop",
      duration_ms: duration,
    });
    securityLog("sop_response_status", {
      request_id: requestId,
      route: "/api/agent/generate-sop",
      http_status: 200,
      sop_present: true,
    });
    return finalize(Response.json(response, { headers: { "cache-control": "no-store" } }));
  } catch (error) {
    const timeout = error instanceof OpenAI.APIConnectionTimeoutError;
    const code = timeout ? "AI_TIMEOUT" : "GENERATION_FAILED";
    const duration = Date.now() - startedAt;
    await updateAgentRequest(requestId, {
      status: "failed",
      error_code: code,
      processing_time_ms: duration,
      completed_at: new Date().toISOString(),
    });
    await recordUsage({
      request_id: requestId,
      service: AGENT_SERVICE,
      outcome: "failed",
      error_code: code,
      processing_time_ms: duration,
    });
    securityLog("generation_failed", {
      request_id: requestId,
      route: "/api/agent/generate-sop",
      error_name: error instanceof Error ? error.name : "UnknownError",
      duration_ms: duration,
    });
    securityLog("sop_response_status", {
      request_id: requestId,
      route: "/api/agent/generate-sop",
      http_status: timeout ? 504 : 502,
      sop_present: false,
    });
    return finalize(agentError(
      code,
      timeout ? "SOP generation timed out. Retry the same paid request." : "SOP generation failed. Retry the same paid request.",
      timeout ? 504 : 502,
      requestId,
    ));
  } finally {
    release();
  }
}

function withPaymentReceipt(
  response: Response,
  payment: Extract<OfficialPaymentGateResult, { type: "verified" }>,
): Response {
  if (payment.paymentResponseHeader) {
    response.headers.set("payment-response", payment.paymentResponseHeader);
  }
  return response;
}
