import "server-only";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@okxweb3/x402-core/types";
import {
  normalizeOfficialVerificationResult,
  safeRawVerificationShape,
} from "@/lib/agent/verified-payment-identity";
import { securityLog } from "@/lib/security/logger";

type ErrorRecord = Record<string, unknown>;

export class LoggedOKXFacilitatorClient extends OKXFacilitatorClient {
  constructor(
    config: ConstructorParameters<typeof OKXFacilitatorClient>[0],
    private readonly getApplicationRequestId: () => string | null,
  ) {
    super(config);
  }

  override async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    const raw = await super.verify(payload, requirements) as unknown;
    const shape = safeRawVerificationShape(raw);
    securityLog("payment_verification_shape", {
      request_id: this.getApplicationRequestId(),
      response_kind: shape.responseKind,
      response_keys: shape.responseKeys,
      item_keys: shape.itemKeys,
      verification_keys: shape.verificationKeys,
      authorization_exists: shape.authorizationExists,
      authorization_from_exists: shape.authorizationFromExists,
      payer_exists: shape.payerExists,
      payment_id_exists: shape.paymentIdExists,
      nonce_exists: shape.nonceExists,
    });
    const normalized = normalizeOfficialVerificationResult(raw);
    if (!normalized) throw new Error("OKX_VERIFY_RESPONSE_MALFORMED");
    return normalized;
  }

  override async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      return await super.settle(payload, requirements);
    } catch (error) {
      const safe = safeSettlementError(error);
      securityLog("payment_settlement_failed", {
        request_id: this.getApplicationRequestId(),
        http_status: safe.httpStatus,
        okx_error_code: safe.code,
        okx_error_message: safe.message,
        settlement_reference: safe.settlementReference,
        transaction_hash: safe.transactionHash,
        stack: error instanceof Error && error.stack ? scrub(error.stack) : undefined,
      });
      throw error;
    }
  }
}

function safeSettlementError(error: unknown) {
  const root = asRecord(error);
  const response = asRecord(root.response);
  const data = asRecord(response.data);
  const errorMessage = error instanceof Error ? error.message : undefined;
  const httpStatus =
    safeNumber(root.status)
    ?? safeNumber(response.status)
    ?? statusFromMessage(errorMessage);
  return {
    httpStatus,
    code:
      safeText(data.code)
      ?? safeText(root.code)
      ?? (httpStatus ? `OKX_SETTLEMENT_HTTP_${httpStatus}` : "OKX_SETTLEMENT_ERROR"),
    message: scrub(
      safeText(data.msg)
        ?? safeText(data.message)
        ?? errorMessage
        ?? "The OKX facilitator settlement call failed.",
    ),
    settlementReference:
      safeReference(data.settlementReference)
      ?? safeReference(data.settlement_reference),
    transactionHash:
      safeReference(data.transactionHash)
      ?? safeReference(data.transaction_hash)
      ?? safeReference(data.txHash),
  };
}

function asRecord(value: unknown): ErrorRecord {
  return value && typeof value === "object" ? value as ErrorRecord : {};
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function statusFromMessage(value: string | undefined): number | undefined {
  const match = value?.match(/OKX settle failed:\s*(\d{3})/);
  return match ? Number(match[1]) : undefined;
}

function safeText(value: unknown): string | undefined {
  return typeof value === "string" ? scrub(value) : undefined;
}

function safeReference(value: unknown): string | undefined {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value)
    ? value
    : undefined;
}

function scrub(value: string): string {
  return value
    .replace(/0x[a-fA-F0-9]{64,}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{160,}/g, "[redacted]")
    .slice(0, 160);
}
