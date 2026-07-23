import "server-only";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from "@okxweb3/x402-core/types";
import { securityLog } from "@/lib/security/logger";

type ErrorRecord = Record<string, unknown>;

export class LoggedOKXFacilitatorClient extends OKXFacilitatorClient {
  constructor(
    config: ConstructorParameters<typeof OKXFacilitatorClient>[0],
    private readonly getApplicationRequestId: () => string | null,
  ) {
    super(config);
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
