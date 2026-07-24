import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { agentError } from "@/lib/agent/contract";
import { generateAgentSop } from "@/lib/agent/generate";
import { getOfficialPaymentConfig } from "@/lib/agent/official-payment-config";
import {
  findAgentRequest,
  findAgentPayment,
  recordUsage,
  updateAgentRequest,
} from "@/lib/agent/payment-store";
import { readSettledPaymentHandoff } from "@/lib/agent/payment-internal";
import { acquireGenerationSlot, checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { validateAgentRequest } from "@/lib/agent/request-validation";
import { AGENT_SCHEMA_VERSION, AGENT_SERVICE } from "@/lib/agent/service";
import { securityLog } from "@/lib/security/logger";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  return agentError("METHOD_NOT_ALLOWED", "Use POST for this operation.", 405);
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const fallbackRequestId = randomUUID();
  const handoff = readSettledPaymentHandoff(request.headers);
  securityLog("route_handler_entered", {
    request_id: handoff?.requestId ?? fallbackRequestId,
    route: "/api/agent/generate-sop",
    settled_payment: Boolean(handoff),
  });
  const config = getOfficialPaymentConfig();
  if (config.requested && !config.ready) {
    return agentError("PAYMENT_CONFIGURATION_ERROR", "Official payment processing is unavailable.", 503, fallbackRequestId);
  }
  if (!config.enabled) {
    return agentError("SERVICE_BUSY", "Paid SOP generation is disabled.", 503, fallbackRequestId);
  }

  if (!handoff) {
    return agentError("PAYMENT_REQUIRED", "A successfully settled payment is required.", 402, fallbackRequestId);
  }

  const validated = await validateAgentRequest(request);
  if (!validated.ok) {
    await updateAgentRequest(handoff.requestId, {
      status: "failed",
      error_code: "INVALID_REQUEST",
    });
    return Response.json({
      error: {
        code: validated.code,
        message: validated.message,
        ...(validated.details ? { details: validated.details } : {}),
        request_id: handoff.requestId,
        payment_status: "settled_recoverable",
      },
    }, { status: validated.status });
  }

  const stored = await findAgentRequest(handoff.replayKey);
  if (!stored || stored.id !== handoff.requestId) {
    return agentError("PAYMENT_REQUIRED", "Payment is required.", 402, fallbackRequestId);
  }
  await updateAgentRequest(stored.id, { status: "processing", error_code: null });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkAgentRateLimit(clientKey);
  if (!rate.allowed) {
    await updateAgentRequest(stored.id, { status: "paid", error_code: "RATE_LIMITED" });
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Retry later; payment will not be charged again.", request_id: stored.id } },
      { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
    );
  }

  const release = acquireGenerationSlot();
  if (!release) {
    await updateAgentRequest(stored.id, { status: "paid", error_code: "SERVICE_BUSY" });
    return agentError("SERVICE_BUSY", "Generation capacity is busy. Retry the same paid request later.", 503, stored.id);
  }
  try {
    securityLog("generation_started", { request_id: stored.id, route: "/api/agent/generate-sop" });
    const generated = await generateAgentSop(validated.input);
    const payment = await findAgentPayment(stored.id);
    const completedAt = new Date().toISOString();
    const duration = Date.now() - startedAt;
    const response = {
      request_id: stored.id,
      service: AGENT_SERVICE,
      status: "completed",
      ...generated,
      payment: payment ? {
        status: payment.settlement_status,
        transaction: payment.transaction_hash,
        settlement_reference: payment.settlement_reference ?? payment.transaction_hash,
        payer: payment.payer_address,
        recipient: payment.recipient_address,
        amount: payment.amount,
        network: payment.network,
      } : null,
      generated_at: completedAt,
      processing_time_ms: duration,
      schema_version: AGENT_SCHEMA_VERSION,
    };
    await updateAgentRequest(stored.id, {
      status: "completed",
      response_payload: response,
      processing_time_ms: duration,
      completed_at: completedAt,
    });
    await recordUsage({
      request_id: stored.id,
      service: AGENT_SERVICE,
      outcome: "success",
      processing_time_ms: duration,
    });
    securityLog("generation_completed", {
      request_id: stored.id,
      route: "/api/agent/generate-sop",
      duration_ms: duration,
    });
    securityLog("sop_response_status", {
      request_id: stored.id,
      route: "/api/agent/generate-sop",
      http_status: 200,
      sop_present: true,
    });
    return Response.json(response, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const timeout = error instanceof OpenAI.APIConnectionTimeoutError;
    const code = timeout ? "AI_TIMEOUT" : "GENERATION_FAILED";
    const duration = Date.now() - startedAt;
    await updateAgentRequest(stored.id, {
      status: "failed",
      error_code: code,
      processing_time_ms: duration,
      completed_at: new Date().toISOString(),
    });
    await recordUsage({
      request_id: stored.id,
      service: AGENT_SERVICE,
      outcome: "failed",
      error_code: code,
      processing_time_ms: duration,
    });
    securityLog("generation_failed", {
      request_id: stored.id,
      route: "/api/agent/generate-sop",
      error_name: error instanceof Error ? error.name : "UnknownError",
      duration_ms: duration,
    });
    securityLog("sop_response_status", {
      request_id: stored.id,
      route: "/api/agent/generate-sop",
      http_status: timeout ? 504 : 502,
      sop_present: false,
    });
    return agentError(
      code,
      timeout ? "SOP generation timed out. Retry the same paid request." : "SOP generation failed. Retry the same paid request.",
      timeout ? 504 : 502,
      stored.id,
    );
  } finally {
    release();
  }
}
