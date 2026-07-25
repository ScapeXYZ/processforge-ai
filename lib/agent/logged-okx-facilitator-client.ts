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
  safeVerificationShape,
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
    let raw: unknown;
    try {
      raw = await super.verify(payload, requirements) as unknown;
    } catch (error) {
      securityLog("payment_verification_threw", {
        error_name: error instanceof Error ? error.name : "UnknownError",
        error_message: scrubDiagnosticText(
          error instanceof Error
            ? error.message
            : "The OKX facilitator verification call failed.",
        ),
      });
      throw error;
    }
    const shape = safeRawVerificationShape(raw);
    const normalized = normalizeOfficialVerificationResult(raw);
    if (!normalized) {
      securityLog("payment_verification_malformed", {
        response_kind: shape.responseKind,
        response_keys: shape.responseKeys,
      });
      throw new Error("OKX_VERIFY_RESPONSE_MALFORMED");
    }
    const diagnostics = safeVerificationShape({
      paymentPayload: payload,
      result: normalized,
    });
    securityLog("payment_verification_shape", {
      is_valid: diagnostics.isValid,
      invalid_reason: diagnostics.invalidReason,
      invalid_message: diagnostics.invalidMessage,
      payer_exists: diagnostics.payerExists,
      payload_signature_exists: diagnostics.payloadSignatureExists,
      authorization_exists: diagnostics.authorizationExists,
      authorization_signature_exists: diagnostics.authorizationSignatureExists,
      verification_keys: shape.verificationKeys,
    });
    return normalized;
  }

  override async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      const result = await super.settle(payload, requirements);
      const shape = asRecord(result);
      securityLog("payment_settlement_shape", {
        result_keys: Object.keys(shape).sort().slice(0, 32),
        success: result.success,
        status_value: result.status ?? null,
        transaction_exists: typeof result.transaction === "string" && result.transaction.length > 0,
        network_exists: typeof result.network === "string" && result.network.length > 0,
        payer_exists: typeof result.payer === "string" && result.payer.length > 0,
      });
      return result;
    } catch (error) {
      const safe = safeSettlementError(error);
      securityLog("payment_settlement_failed", {
        request_id: this.getApplicationRequestId(),
        http_status: safe.httpStatus,
        okx_error_code: safe.code,
        okx_error_message: safe.message,
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

function scrub(value: string): string {
  return value
    .replace(/0x[a-fA-F0-9]{64,}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{160,}/g, "[redacted]")
    .slice(0, 160);
}

function scrubDiagnosticText(value: string): string {
  return scrub(value);
}
