import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { agentError } from "@/lib/agent/contract";
import { generateAgentSop } from "@/lib/agent/generate";
import { getOfficialPaymentConfig } from "@/lib/agent/official-payment-config";
import {
  runOfficialPaymentGate,
  type OfficialPaymentGateResult,
} from "@/lib/agent/official-x402-middleware";
import {
  recordUsage,
  resolveAgentRequestPayload,
  storeAgentRequestPayload,
  updateAgentRequest,
} from "@/lib/agent/payment-store";
import { acquireGenerationSlot, checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { validateAgentRequestPayload } from "@/lib/agent/request-validation";
import {
  canonicalReplayEndpoint,
  createRequestReplayLocator,
  deriveRequestReplayKey,
  inspectPaidRequestCorrelation,
  paymentAuthorizationHash,
  readRequestReplayLocator,
  REQUEST_REPLAY_TTL_MS,
} from "@/lib/agent/request-payload-replay";
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
  bodyText = bodyText.trim().length === 0 ? "{}" : bodyText;

  const paidRequest =
    request.headers.has("payment-signature")
    || request.headers.has("x-payment");
  const correlation = inspectPaidRequestCorrelation(request);
  const authorizationHash = paymentAuthorizationHash(request);
  const requestUrlLocator = readRequestReplayLocator(request.url);
  let replayLocator =
    requestUrlLocator
    ?? correlation.paymentResourceLocator;
  let replayKey = replayLocator ? deriveRequestReplayKey(replayLocator) : null;
  let restoredPayload = false;
  const requestEndpoint = canonicalReplayEndpoint(request.url);
  const correlationEndpoint = correlation.paymentResourceUrl
    ? canonicalReplayEndpoint(correlation.paymentResourceUrl)
    : requestEndpoint;

  securityLog("x402_request_shape", {
    phase: paidRequest ? "paid_retry" : "initial_unpaid",
    route: "/api/agent/generate-sop",
    method: request.method,
    header_names: correlation.headerNames,
    body_byte_count: new TextEncoder().encode(bodyText).byteLength,
    body_empty: isEmptyJsonObjectText(bodyText),
    payment_header_kind: correlation.paymentHeaderKind ?? "none",
    payment_payload_decoded: correlation.decoded,
    payment_payload_keys: correlation.paymentPayloadKeys,
    request_url_locator_present: Boolean(requestUrlLocator),
    payment_resource_present: Boolean(correlation.paymentResourceUrl),
    payment_resource_locator_present: Boolean(correlation.paymentResourceLocator),
    payer_exists: Boolean(correlation.payerAddress),
  });

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    securityLog("request_body_parse_failed", {
      request_id: fallbackRequestId,
      route: "/api/agent/generate-sop",
      method: request.method,
      body_byte_count: new TextEncoder().encode(bodyText).byteLength,
      body_empty: false,
      declared_mime_kind: request.headers.get("content-type"),
      first_non_whitespace_character: [...bodyText.trim()][0] ?? null,
      payment_signature_present: request.headers.has("payment-signature"),
    });
    return agentError("INVALID_JSON", "Request body contains malformed JSON.", 400, fallbackRequestId);
  }

  const emptyBusinessPayload = isEmptyJsonObject(payload);
  if (paidRequest && emptyBusinessPayload) {
    securityLog("empty_paid_body_detected", {
      request_id: fallbackRequestId,
      route: "/api/agent/generate-sop",
      request_url_locator_present: Boolean(requestUrlLocator),
      payment_resource_locator_present: Boolean(correlation.paymentResourceLocator),
    });
    let claim = null;
    try {
      claim = authorizationHash
        ? await resolveAgentRequestPayload({
          endpoint: correlationEndpoint,
          authorizationHash,
          replayKey,
          payerAddress: correlation.payerAddress,
          createdAfter: new Date(Date.now() - REQUEST_REPLAY_TTL_MS).toISOString(),
        })
        : null;
    } catch {
      // Treat unavailable durable storage exactly like an expired/missing payload.
    }
    if (claim?.status === "ambiguous") {
      securityLog("replay_payload_ambiguous", {
        request_id: fallbackRequestId,
        route: "/api/agent/generate-sop",
        match_count: claim.matchCount,
        payer_exists: Boolean(correlation.payerAddress),
      });
      return agentError(
        "REPLAY_PAYLOAD_AMBIGUOUS",
        "The paid request body was empty and multiple recent payloads matched. No payment was settled.",
        409,
        fallbackRequestId,
      );
    }
    if (claim?.status !== "found") {
      securityLog("replay_payload_missing", {
        request_id: fallbackRequestId,
        route: "/api/agent/generate-sop",
        request_url_locator_present: Boolean(requestUrlLocator),
        payment_resource_locator_present: Boolean(correlation.paymentResourceLocator),
        payer_exists: Boolean(correlation.payerAddress),
      });
      return agentError(
        "REPLAY_PAYLOAD_UNAVAILABLE",
        "The paid request body was empty and its temporary replay payload is unavailable or expired.",
        500,
        fallbackRequestId,
      );
    }
    const stored = claim.payload;
    replayKey = stored.replay_key;
    bodyText = stored.body_text;
    restoredPayload = true;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return agentError(
        "REPLAY_PAYLOAD_UNAVAILABLE",
        "The restored replay payload is unavailable or invalid. No payment was settled.",
        500,
        fallbackRequestId,
      );
    }
    securityLog("request_payload_restored", {
      request_id: fallbackRequestId,
      route: "/api/agent/generate-sop",
      request_hash: stored.request_hash,
    });
  }

  let paymentResult: OfficialPaymentGateResult | null = null;
  if (!paidRequest && emptyBusinessPayload) {
    paymentResult = await runOfficialPaymentGate(request, bodyText);
    if (paymentResult.type === "response") {
      return ensureRouteHandlerResponse(paymentResult.response, fallbackRequestId);
    }
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

  const paymentConfig = getOfficialPaymentConfig();
  if (!paidRequest && paymentConfig.ready) {
    replayLocator = createRequestReplayLocator();
    replayKey = deriveRequestReplayKey(replayLocator);
    securityLog("replay_key_created", {
      request_id: fallbackRequestId,
      route: "/api/agent/generate-sop",
      request_hash: validated.requestHash,
    });
    try {
      await storeAgentRequestPayload({
        replay_key: replayKey,
        endpoint: requestEndpoint,
        payer_address: correlation.payerAddress,
        request_hash: validated.requestHash,
        body_text: bodyText,
        expires_at: new Date(Date.now() + REQUEST_REPLAY_TTL_MS).toISOString(),
      });
    } catch {
      securityLog("request_payload_store_failed", {
        request_id: fallbackRequestId,
        route: "/api/agent/generate-sop",
      });
      return agentError(
        "SERVICE_BUSY",
        "Temporary request replay storage is unavailable. No payment was requested.",
        503,
        fallbackRequestId,
      );
    }
    securityLog("request_payload_stored", {
      request_id: fallbackRequestId,
      route: "/api/agent/generate-sop",
      request_hash: validated.requestHash,
      expires_in_seconds: REQUEST_REPLAY_TTL_MS / 1000,
    });
  }

  paymentResult ??= await runOfficialPaymentGate(
      request,
      bodyText,
      replayLocator,
      restoredPayload
        ? restoredPayloadCorrelation(replayKey, authorizationHash, correlationEndpoint)
        : null,
    );
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

function isEmptyJsonObject(value: unknown): boolean {
  return Boolean(
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 0,
  );
}

function isEmptyJsonObjectText(value: string): boolean {
  try {
    return isEmptyJsonObject(JSON.parse(value));
  } catch {
    return false;
  }
}

function restoredPayloadCorrelation(
  replayKey: string | null,
  authorizationHash: string | null,
  endpoint: string,
) {
  return replayKey && authorizationHash
    ? { replayKey, authorizationHash, endpoint }
    : null;
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
