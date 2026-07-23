import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { agentError, agentSopRequestSchema } from "@/lib/agent/contract";
import { AGENT_SCHEMA_VERSION, AGENT_SERVICE, assertSafeProductionConfig, getX402Config } from "@/lib/agent/config";
import { getAppBaseUrl } from "@/lib/env/server";
import { securityLog } from "@/lib/security/logger";
import { stableHash } from "@/lib/agent/crypto";
import { generateAgentSop } from "@/lib/agent/generate";
import { generateMockAgentSop } from "@/lib/agent/mock";
import { acquireGenerationSlot, checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { createAgentRequest, findAgentRequest, recordUsage, reserveVerifiedPayment, updateAgentRequest, updatePayment } from "@/lib/agent/storage";
import { assertPaymentMatches, decodePayment, mockPaymentToken, paymentReference, paymentRequiredResponse, paymentRequirements, paymentResponseHeader, safePaymentFailure, settlePayment, verifyPayment, X402ProviderError } from "@/lib/agent/x402";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_BODY_BYTES = 32_768;

export async function GET() { return agentError("METHOD_NOT_ALLOWED", "Use POST for this paid operation.", 405); }

export async function POST(request: Request) {
  const startedAt = Date.now(); const requestId = randomUUID();
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) return agentError("INVALID_REQUEST", "A valid Idempotency-Key header (8-200 characters) is required.", 400, requestId);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rate = checkAgentRateLimit(stableHash(ip));
  if (!rate.allowed) return Response.json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please retry later.", request_id: requestId } }, { status: 429, headers: { "retry-after": String(rate.retryAfter) } });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return agentError("INVALID_REQUEST", "Request body is too large.", 413, requestId);
  let raw: string;
  try { raw = await request.text(); } catch { return agentError("INVALID_REQUEST", "Request body could not be read.", 400, requestId); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return agentError("INVALID_REQUEST", "Request body is too large.", 413, requestId);
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return agentError("INVALID_REQUEST", "Request body must be valid JSON.", 400, requestId); }
  const parsed = agentSopRequestSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: { code: "INVALID_REQUEST", message: "Request validation failed.", request_id: requestId, details: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) } }, { status: 400 });
  const config = getX402Config();
  if (!config.serviceEnabled) return agentError("SERVICE_BUSY", "Paid SOP generation is temporarily disabled.", 503, requestId);
  const hash = stableHash(parsed.data);
  const existing = await findAgentRequest(idempotencyKey);
  if (existing) {
    if (existing.request_hash !== hash) return agentError("IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used with different request content.", 409, String(existing.id));
    if (existing.status === "completed" && existing.response_payload) return Response.json(existing.response_payload, { headers: { "x-idempotent-replay": "true", "cache-control": "no-store" } });
    if (["processing", "settling"].includes(String(existing.status))) return agentError("REQUEST_IN_PROGRESS", "This request is already being processed.", 409, String(existing.id));
  }
  const effectiveId = existing ? String(existing.id) : requestId;
  try { assertSafeProductionConfig(config); } catch { return agentError("PAYMENT_CONFIGURATION_ERROR", "Payment verification is temporarily unavailable.", 503, effectiveId); }
  const resourceUrl = `${getAppBaseUrl()}/api/agent/generate-sop`;
  if (!existing) await createAgentRequest({ id: effectiveId, service: AGENT_SERVICE, idempotency_key: idempotencyKey, request_hash: hash, status: "payment_required", network: config.network, price: config.price, asset: config.assetAddress });
  log("request_received", effectiveId, { duration_ms: Date.now() - startedAt });
  const paymentHeader = request.headers.get("payment-signature") || request.headers.get("x-payment");
  const expectedMockToken = config.mock ? mockPaymentToken(hash, resourceUrl) : undefined;
  if (!paymentHeader) { log("payment_required", effectiveId); return paymentRequiredResponse(config, resourceUrl, effectiveId, expectedMockToken); }
  let settlementHeader: string | undefined;
  if (existing?.status !== "paid") {
    let reservedReference: string | undefined;
    try {
      if (!config.mock && (!config.ready || !process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error("PAYMENT_CONFIGURATION_ERROR");
      const payload = config.mock ? null : decodePayment(paymentHeader); const requirements = paymentRequirements(config);
      if (config.mock && paymentHeader !== expectedMockToken) throw new Error("PAYMENT_INVALID");
      if (payload) assertPaymentMatches(payload, requirements, resourceUrl);
      const reference = payload ? paymentReference(payload) : stableHash(paymentHeader);
      const facilitatorRequirements = payload?.accepted ?? requirements;
      const verified = payload ? await verifyPayment(config, payload, facilitatorRequirements) : null;
      const reservation = await reserveVerifiedPayment({ request_id: effectiveId, payment_reference: reference, replay_fingerprint: reference, recipient_address: config.payTo, network: config.network, asset: config.assetAddress, amount: config.price, payer_address: verified?.payer ?? (config.mock ? "mock-payer" : null), verification_status: "verified", settlement_status: "pending", verified_at: new Date().toISOString() });
      if (reservation === "replay") { log("payment_rejected", effectiveId, { reason: "replay" }); return agentError("PAYMENT_REPLAYED", "This payment proof has already been used for another request or settlement.", 409, effectiveId); }
      reservedReference = reference;
      await updateAgentRequest(effectiveId, { status: "settling" });
      if (config.mock) {
        settlementHeader = Buffer.from(JSON.stringify({ success: true, status: "success", network: config.network, transaction: `mock-${reference.slice(0, 24)}` })).toString("base64");
        await updatePayment(reference, { settlement_status: "settled", settlement_reference: `mock-${reference}`, settled_at: new Date().toISOString(), transaction_hash: `mock-${reference}` });
      } else if (payload) {
        const settlement = await settlePayment(config, payload, facilitatorRequirements);
        settlementHeader = paymentResponseHeader(settlement);
        await updatePayment(reference, { payer_address: settlement.payer ?? verified?.payer ?? null, settlement_status: "settled", settlement_reference: settlement.transaction, settled_at: new Date().toISOString(), transaction_hash: settlement.transaction });
      }
      await updateAgentRequest(effectiveId, { status: "paid" }); log("payment_verified", effectiveId, { provider: config.provider }); log("settlement_completed", effectiveId, { settlement_status: "success", provider: config.provider });
    } catch (error) {
      const failure = safePaymentFailure(error);
      log("payment_rejected", effectiveId, failure);
      if (reservedReference) await updatePayment(reservedReference, { settlement_status: "failed" });
      const settlementFailed = error instanceof X402ProviderError && error.operation === "settle";
      await updateAgentRequest(effectiveId, { status: "payment_rejected", error_code: settlementFailed ? "PAYMENT_SETTLEMENT_FAILED" : "PAYMENT_INVALID" });
      if (error instanceof Error && error.message.startsWith("Payment storage")) return agentError("PAYMENT_CONFIGURATION_ERROR", "Payment storage is temporarily unavailable.", 503, effectiveId);
      return agentError(settlementFailed ? "PAYMENT_SETTLEMENT_FAILED" : "PAYMENT_INVALID", settlementFailed ? "Payment settlement failed." : "Payment verification failed.", 402, effectiveId, { reason: failure.reason, reason_message: failure.reason_message });
    }
  }
  const release = acquireGenerationSlot();
  if (!release) return agentError("SERVICE_BUSY", "Generation capacity is busy. Retry with the same Idempotency-Key; no new payment is required.", 503, effectiveId);
  try {
    await updateAgentRequest(effectiveId, { status: "processing" }); log("generation_started", effectiveId);
    const generated = config.mock ? generateMockAgentSop(parsed.data) : await generateAgentSop(parsed.data); const completedAt = new Date().toISOString(); const duration = Date.now() - startedAt;
    const response = { request_id: effectiveId, service: AGENT_SERVICE, status: "completed", ...generated, generated_at: completedAt, processing_time_ms: duration, schema_version: AGENT_SCHEMA_VERSION };
    await updateAgentRequest(effectiveId, { status: "completed", response_payload: response, processing_time_ms: duration, completed_at: completedAt });
    await recordUsage({ request_id: effectiveId, service: AGENT_SERVICE, outcome: "success", processing_time_ms: duration });
    log("generation_completed", effectiveId, { duration_ms: duration });
    return Response.json(response, { headers: { ...(settlementHeader ? { "payment-response": settlementHeader } : {}), "cache-control": "no-store" } });
  } catch (error) {
    const timeout = error instanceof OpenAI.APIConnectionTimeoutError;
    const code = timeout ? "AI_TIMEOUT" : "GENERATION_FAILED"; const duration = Date.now() - startedAt;
    await updateAgentRequest(effectiveId, { status: "failed", error_code: code, processing_time_ms: duration, completed_at: new Date().toISOString() });
    await recordUsage({ request_id: effectiveId, service: AGENT_SERVICE, outcome: "failed", error_code: code, processing_time_ms: duration });
    log("request_failed", effectiveId, { error_name: error instanceof Error ? error.name : "UnknownError", duration_ms: duration });
    return agentError(code, timeout ? "SOP generation timed out. Retry with the same Idempotency-Key." : "SOP generation failed. Retry with the same Idempotency-Key.", timeout ? 504 : 502, effectiveId);
  } finally { release(); }
}

function log(event: string, requestId: string, data: Record<string, unknown> = {}) { securityLog(event, { request_id: requestId, route: "/api/agent/generate-sop", ...data }); }
