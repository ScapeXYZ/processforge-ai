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
  const validated = await validateAgentRequest(request);
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

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkAgentRateLimit(clientKey);
  if (!rate.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "Too many requests. Please retry later.", request_id: fallbackRequestId } },
      { status: 429, headers: { "retry-after": String(rate.retryAfter) } },
    );
  }

  const config = getOfficialPaymentConfig();
  if (config.requested && !config.ready) {
    return agentError("PAYMENT_CONFIGURATION_ERROR", "Official payment processing is unavailable.", 503, fallbackRequestId);
  }
  if (!config.enabled) {
    return agentError("SERVICE_BUSY", "Paid SOP generation is disabled.", 503, fallbackRequestId);
  }

  const stored = await findAgentRequest(validated.idempotencyKey);
  if (!stored) {
    return agentError("PAYMENT_REQUIRED", "Payment is required.", 402, fallbackRequestId);
  }
  if (stored.request_hash !== validated.requestHash) {
    return agentError("IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used with different request content.", 409, stored.id);
  }
  if (stored.status === "completed" && stored.response_payload) {
    return Response.json(stored.response_payload, {
      headers: { "x-idempotent-replay": "true", "cache-control": "no-store" },
    });
  }
  if (stored.error_code === "PAYMENT_PERSISTENCE_FAILED") {
    return agentError("PAYMENT_CONFIGURATION_ERROR", "Payment settled, but durable evidence could not be recorded. No content was generated.", 503, stored.id);
  }
  if (stored.status === "settling" || stored.error_code === "PAYMENT_SETTLEMENT_UNKNOWN") {
    return agentError(
      "PAYMENT_SETTLEMENT_PENDING",
      "Settlement is pending reconciliation. No new payment authorization will be issued.",
      409,
      stored.id,
    );
  }
  if (stored.status !== "paid") {
    return agentError("PAYMENT_REQUIRED", "A successfully settled payment is required.", 402, stored.id);
  }

  const release = acquireGenerationSlot();
  if (!release) {
    return agentError("SERVICE_BUSY", "Generation capacity is busy. Retry with the same Idempotency-Key.", 503, stored.id);
  }
  try {
    await updateAgentRequest(stored.id, { status: "processing" });
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
    return agentError(
      code,
      timeout ? "SOP generation timed out. Retry with the same Idempotency-Key." : "SOP generation failed.",
      timeout ? 504 : 502,
      stored.id,
    );
  } finally {
    release();
  }
}
