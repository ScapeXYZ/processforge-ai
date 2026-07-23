import "server-only";
import { OKXFacilitatorClient, x402Version } from "@okxweb3/x402-core";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader, encodePaymentResponseHeader } from "@okxweb3/x402-core/http";
import type { PaymentPayload, PaymentRequired, PaymentRequirements, SettleResponse } from "@okxweb3/x402-core/types";
import { stableHash } from "@/lib/agent/crypto";
import type { X402Config } from "@/lib/agent/config";

export function paymentRequirements(config: X402Config, resourceUrl: string, requestHash: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: config.network,
    asset: config.assetAddress,
    amount: config.price,
    payTo: config.payTo,
    maxTimeoutSeconds: config.timeoutSeconds,
    extra: { name: config.assetName, version: config.assetVersion, resource: resourceUrl, requestHash, assetSymbol: config.asset, assetDecimals: config.assetDecimals },
  };
}

export function paymentRequiredResponse(config: X402Config, resourceUrl: string, requestHash: string, requestId: string, mockToken?: string): Response {
  const required: PaymentRequired = { x402Version, resource: { url: resourceUrl, description: "Generate a ProcessForge SOP with deterministic analytics and compliance analysis", mimeType: "application/json" }, accepts: [paymentRequirements(config, resourceUrl, requestHash)] };
  return Response.json({ error: { code: "PAYMENT_REQUIRED", message: "Payment is required to generate this SOP.", request_id: requestId }, x402: required, ...(mockToken ? { mock_payment: { token: mockToken, header: "payment-signature" } } : {}) }, { status: 402, headers: { "payment-required": encodePaymentRequiredHeader(required), ...(mockToken ? { "x-mock-payment-token": mockToken } : {}), "cache-control": "no-store" } });
}

export function mockPaymentToken(idempotencyKey: string, requestHash: string, resourceUrl: string): string { return `mock_${stableHash({ idempotencyKey, requestHash, resourceUrl })}`; }

export function decodePayment(header: string): PaymentPayload { return decodePaymentSignatureHeader(header); }

export function assertPaymentMatches(payload: PaymentPayload, expected: PaymentRequirements, resourceUrl: string, requestHash: string): void {
  const accepted = payload.accepted;
  if (accepted.scheme !== expected.scheme || accepted.network !== expected.network || accepted.asset.toLowerCase() !== expected.asset.toLowerCase() || accepted.amount !== expected.amount || accepted.payTo.toLowerCase() !== expected.payTo.toLowerCase()) throw new Error("PAYMENT_REQUIREMENT_MISMATCH");
  if (payload.resource?.url && payload.resource.url !== resourceUrl) throw new Error("PAYMENT_RESOURCE_MISMATCH");
  if (accepted.extra?.resource !== resourceUrl || accepted.extra?.requestHash !== requestHash) throw new Error("PAYMENT_REQUEST_BINDING_MISMATCH");
}

export function paymentReference(payload: PaymentPayload): string { return stableHash(payload); }

export async function verifyAndSettle(config: X402Config, payload: PaymentPayload, requirements: PaymentRequirements): Promise<{ payer: string | null; settlement: SettleResponse }> {
  const facilitator = new OKXFacilitatorClient({ apiKey: config.apiKey, secretKey: config.secretKey, passphrase: config.passphrase, baseUrl: config.facilitatorUrl, syncSettle: true });
  const verified = await facilitator.verify(payload, requirements);
  if (!verified.isValid) throw new Error(`PAYMENT_INVALID:${verified.invalidReason ?? "verification_failed"}`);
  const settlement = await facilitator.settle(payload, requirements);
  if (!settlement.success || settlement.status !== "success") throw new Error(`PAYMENT_SETTLEMENT_FAILED:${settlement.errorReason ?? settlement.status ?? "settlement_failed"}`);
  return { payer: settlement.payer ?? verified.payer ?? null, settlement };
}

export function paymentResponseHeader(settlement: SettleResponse): string { return encodePaymentResponseHeader(settlement); }
