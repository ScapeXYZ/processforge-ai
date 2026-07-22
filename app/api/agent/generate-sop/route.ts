import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { agentError, agentSopRequestSchema } from "@/lib/agent/contract";
import { AGENT_SCHEMA_VERSION, AGENT_SERVICE, getX402Config } from "@/lib/agent/config";
import { stableHash } from "@/lib/agent/crypto";
import { generateAgentSop } from "@/lib/agent/generate";
import { generateMockAgentSop } from "@/lib/agent/mock";
import { acquireGenerationSlot, checkAgentRateLimit } from "@/lib/agent/rate-limit";
import { createAgentRequest, findAgentRequest, recordUsage, reservePayment, updateAgentRequest, updatePayment } from "@/lib/agent/storage";
import { assertPaymentMatches, decodePayment, mockPaymentToken, paymentReference, paymentRequiredResponse, paymentRequirements, paymentResponseHeader, verifyAndSettle } from "@/lib/agent/x402";

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
  const hash = stableHash(parsed.data);
  const existing = await findAgentRequest(idempotencyKey);
  if (existing) {
    if (existing.request_hash !== hash) return agentError("IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used with different request content.", 409, String(existing.id));
    if (existing.status === "completed" && existing.response_payload) return Response.json(existing.response_payload, { headers: { "x-idempotent-replay": "true", "cache-control": "no-store" } });
    if (["processing", "settling"].includes(String(existing.status))) return agentError("REQUEST_IN_PROGRESS", "This request is already being processed.", 409, String(existing.id));
  }
  const effectiveId = existing ? String(existing.id) : requestId;
  const config = getX402Config();
  const resourceUrl = `${new URL(request.url).origin}/api/agent/generate-sop`;
  if (!existing) await createAgentRequest({ id: effectiveId, service: AGENT_SERVICE, idempotency_key: idempotencyKey, request_hash: hash, status: "payment_required", network: config.network, price: config.price, asset: config.asset });
  log("request_received", effectiveId, { duration_ms: Date.now() - startedAt });
  const paymentHeader = request.headers.get("payment-signature") || request.headers.get("x-payment");
  const expectedMockToken = config.mock ? mockPaymentToken(idempotencyKey, hash, resourceUrl) : undefined;
  if (!paymentHeader) { log("payment_required", effectiveId); return paymentRequiredResponse(config, resourceUrl, effectiveId, expectedMockToken); }
  let settlementHeader: string | undefined;
  if (existing?.status !== "paid") {
    try {
      if (!config.mock && (!config.ready || !process.env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error("PAYMENT_CONFIGURATION_ERROR");
      const payload = config.mock ? null : decodePayment(paymentHeader); const requirements = paymentRequirements(config, resourceUrl);
      if (config.mock && paymentHeader !== expectedMockToken) throw new Error("PAYMENT_INVALID");
      if (payload) assertPaymentMatches(payload, requirements, resourceUrl);
      const reference = payload ? paymentReference(payload) : stableHash(paymentHeader);
      const reserved = await reservePayment({ request_id: effectiveId, payment_reference: reference, recipient_address: config.payTo, network: config.network, asset: config.asset, amount: config.price, verification_status: "pending", settlement_status: "pending" });
      if (!reserved) { log("payment_rejected", effectiveId, { reason: "replay" }); return agentError("PAYMENT_REPLAYED", "This payment proof has already been used.", 409, effectiveId); }
      await updateAgentRequest(effectiveId, { status: "settling" });
      if (config.mock) {
        settlementHeader = Buffer.from(JSON.stringify({ success: true, status: "success", network: config.network, transaction: `mock-${reference.slice(0, 24)}` })).toString("base64");
        await updatePayment(reference, { payer_address: "mock-payer", verification_status: "verified", settlement_status: "settled", verified_at: new Date().toISOString(), settled_at: new Date().toISOString(), transaction_hash: `mock-${reference}` });
      } else if (payload) {
        const paid = await verifyAndSettle(config, payload, requirements);
        settlementHeader = paymentResponseHeader(paid.settlement);
        await updatePayment(reference, { payer_address: paid.payer, verification_status: "verified", settlement_status: paid.settlement.status === "pending" ? "pending" : "settled", verified_at: new Date().toISOString(), settled_at: paid.settlement.status === "success" ? new Date().toISOString() : null, transaction_hash: paid.settlement.transaction });
      }
      await updateAgentRequest(effectiveId, { status: "paid" }); log("payment_verified", effectiveId, { provider: config.provider }); log("settlement_completed", effectiveId, { settlement_status: "success", provider: config.provider });
    } catch (error) {
      log("payment_rejected", effectiveId, { reason: safeError(error) });
      await updateAgentRequest(effectiveId, { status: "payment_rejected", error_code: "PAYMENT_INVALID" });
      const message = error instanceof Error && error.message.startsWith("PAYMENT_SETTLEMENT_FAILED") ? "Payment settlement failed." : "Payment verification failed.";
      return agentError(message.startsWith("Payment settlement") ? "PAYMENT_SETTLEMENT_FAILED" : "PAYMENT_INVALID", message, 402, effectiveId);
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

function log(event: string, requestId: string, data: Record<string, unknown> = {}) { console.info(JSON.stringify({ event, request_id: requestId, ...data })); }
function safeError(error: unknown) { return error instanceof Error ? error.message.split(":")[0] : "UnknownError"; }
