import "server-only";
import { OKXFacilitatorClient, x402Version } from "@okxweb3/x402-core";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@okxweb3/x402-core/http";
import type { PaymentPayload, PaymentRequired, PaymentRequirements, SettleResponse, VerifyResponse } from "@okxweb3/x402-core/types";
import { stableHash } from "@/lib/agent/crypto";
import type { X402Config } from "@/lib/agent/config";
import { observeFacilitatorHttp } from "@/lib/agent/facilitator-diagnostics";

export function paymentRequirements(config: X402Config): PaymentRequirements {
  return {
    scheme: "exact",
    network: config.network,
    asset: config.assetAddress,
    amount: config.price,
    payTo: config.payTo,
    maxTimeoutSeconds: config.timeoutSeconds,
    extra: { name: config.assetName, version: config.assetVersion },
  };
}

export function paymentRequiredResponse(config: X402Config, resourceUrl: string, requestId: string, mockToken?: string): Response {
  const required: PaymentRequired = { x402Version, resource: { url: resourceUrl, description: "Generate a ProcessForge SOP with deterministic analytics and compliance analysis", mimeType: "application/json" }, accepts: [paymentRequirements(config)] };
  return Response.json({ error: { code: "PAYMENT_REQUIRED", message: "Payment is required to generate this SOP.", request_id: requestId }, x402: required, ...(mockToken ? { mock_payment: { token: mockToken, header: "payment-signature" } } : {}) }, { status: 402, headers: { "payment-required": encodePaymentRequiredHeader(required), ...(mockToken ? { "x-mock-payment-token": mockToken } : {}), "cache-control": "no-store" } });
}

export function mockPaymentToken(requestHash: string, resourceUrl: string): string { return `mock_${stableHash({ requestHash, resourceUrl })}`; }

export function decodePayment(header: string): PaymentPayload { return decodePaymentSignatureHeader(header); }

export function assertPaymentMatches(payload: PaymentPayload, expected: PaymentRequirements, resourceUrl: string): void {
  const accepted = payload.accepted;
  if (accepted.scheme !== expected.scheme || accepted.network !== expected.network || accepted.asset.toLowerCase() !== expected.asset.toLowerCase() || accepted.amount !== expected.amount || accepted.payTo.toLowerCase() !== expected.payTo.toLowerCase()) throw new X402ProviderError("verify", "payment_requirement_mismatch");
  if (payload.resource?.url && payload.resource.url !== resourceUrl) throw new X402ProviderError("verify", "resource_mismatch");
  if (accepted.extra?.name !== expected.extra?.name || accepted.extra?.version !== expected.extra?.version) throw new X402ProviderError("verify", "payment_requirement_mismatch");
}

export function paymentReference(payload: PaymentPayload): string { return stableHash(payload); }

export async function verifyPayment(config: X402Config, payload: PaymentPayload, requirements: PaymentRequirements): Promise<VerifyResponse> {
  const observed = await observeFacilitatorHttp(config.facilitatorUrl, () => facilitator(config).verify(payload, requirements));
  try {
    if (observed.error) throw observed.error;
    const verified = observed.value!;
    if (!verified.isValid) throw new X402ProviderError("verify", verified.invalidReason ?? "verification_failed", undefined, officialRequestId(verified.extensions));
    return verified;
  } catch (error) { throw normalizeProviderError("verify", error, observed.http); }
}

export async function settlePayment(config: X402Config, payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleResponse> {
  const observed = await observeFacilitatorHttp(config.facilitatorUrl, () => facilitator(config).settle(payload, requirements));
  try {
    if (observed.error) throw observed.error;
    const settlement = observed.value!;
    if (!settlement.success || settlement.status !== "success") throw new X402ProviderError("settle", settlement.errorReason ?? settlement.status ?? "settlement_failed", undefined, officialRequestId(settlement.extensions));
    return settlement;
  } catch (error) { throw normalizeProviderError("settle", error, observed.http); }
}

export function paymentResponseHeader(settlement: SettleResponse): string { return encodePaymentResponseHeader(settlement); }

function facilitator(config: X402Config) {
  return new OKXFacilitatorClient({ apiKey: config.apiKey, secretKey: config.secretKey, passphrase: config.passphrase, baseUrl: config.facilitatorUrl, syncSettle: true });
}

export class X402ProviderError extends Error {
  constructor(public readonly operation: "verify" | "settle", public readonly reason: string, public readonly httpStatus?: number, public readonly providerRequestId?: string, public readonly providerErrorCode?: string, public readonly providerErrorMessage?: string) { super(`X402_${operation.toUpperCase()}_FAILED`); this.name = "X402ProviderError"; }
}

export function safePaymentFailure(error: unknown) {
  const normalized = error instanceof X402ProviderError ? error : normalizeProviderError("verify", error);
  return { operation: normalized.operation, reason: safeReason(normalized.reason), reason_message: paymentReasonMessage(normalized.reason), ...(normalized.httpStatus ? { facilitator_http_status: normalized.httpStatus } : {}), ...(normalized.providerErrorCode ? { facilitator_error_code: normalized.providerErrorCode } : {}), ...(normalized.providerErrorMessage ? { facilitator_error_message: normalized.providerErrorMessage } : {}), ...(normalized.providerRequestId ? { facilitator_request_id: normalized.providerRequestId } : {}) };
}

function normalizeProviderError(operation: "verify" | "settle", error: unknown, http: { status?: number; code?: string; message?: string; requestId?: string } = {}): X402ProviderError {
  if (error instanceof X402ProviderError) return error;
  const candidate = error as { invalidReason?: unknown; errorReason?: unknown; statusCode?: unknown; message?: unknown };
  const statusFromMessage = typeof candidate?.message === "string" ? /OKX (?:verify|settle) failed: (\d{3})/.exec(candidate.message)?.[1] : undefined;
  const status = http.status ?? (typeof candidate?.statusCode === "number" ? candidate.statusCode : statusFromMessage ? Number(statusFromMessage) : undefined);
  const supplied = operation === "verify" ? candidate?.invalidReason : candidate?.errorReason;
  const reason = typeof supplied === "string" && supplied ? supplied : status ? `facilitator_http_${status}` : "facilitator_unavailable";
  return new X402ProviderError(operation, reason, status, http.requestId, http.code, http.message);
}

function officialRequestId(extensions?: Record<string, unknown>): string | undefined {
  const value = extensions?.requestId ?? extensions?.request_id ?? extensions?.traceId;
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined;
}

function safeReason(reason: string): string { return /^[a-zA-Z0-9 _.:/-]{1,160}$/.test(reason) ? reason : "verification_failed"; }
function paymentReasonMessage(reason: string): string {
  const key = reason.toLowerCase().replace(/[ -]+/g, "_");
  const messages: Record<string, string> = {
    insufficient_funds: "The buyer wallet has insufficient token funds.", nonce_already_used: "The payment authorization nonce was already used.", invalid_signature: "The payment signature is invalid.",
    resource_mismatch: "The signed resource does not match this endpoint.", no_matching_payment_option: "The buyer payload does not match an advertised payment option.", payer_blocked: "The facilitator blocked the payer.",
    risk_address: "The facilitator rejected the payer address for risk controls.", unsupported_chain: "The facilitator does not support the requested chain.", authorization_expired: "The payment authorization has expired.", authorization_not_yet_valid: "The payment authorization is not yet valid.",
    payment_requirement_mismatch: "The signed payment terms do not match the server requirement.",
  };
  return messages[key] ?? "The facilitator rejected the payment proof.";
}
