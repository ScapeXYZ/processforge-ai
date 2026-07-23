import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { x402ResourceServer } from "@okxweb3/x402-core/server";
import type { PaymentPayload, PaymentRequirements } from "@okxweb3/x402-core/types";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { paymentProxy } from "@okxweb3/x402-next";
import { NextResponse, type NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/env/server";
import { getOfficialPaymentConfig } from "@/lib/agent/official-payment-config";
import { LoggedOKXFacilitatorClient } from "@/lib/agent/logged-okx-facilitator-client";
import {
  createAgentRequest,
  findAgentPayment,
  findAgentRequest,
  paymentFingerprintExists,
  reserveVerifiedPayment,
  updatePaymentSettlement,
  updateAgentRequest,
  type AgentRequestRecord,
} from "@/lib/agent/payment-store";
import { validateAgentRequest, type ValidAgentRequest } from "@/lib/agent/request-validation";
import { AGENT_SERVICE } from "@/lib/agent/service";
import { securityLog } from "@/lib/security/logger";

type PaymentRequestContext = ValidAgentRequest & {
  requestId: string;
  record: AgentRequestRecord;
  paymentSignaturePresent: boolean;
  xPaymentHeaderPresent: boolean;
  middlewareResult: "challenge" | "verified" | "settled" | "rejected";
  officialErrorCode?: string;
  officialErrorMessage?: string;
  paymentReference?: string;
  verifiedPayer?: string;
  verifiedRequirements?: PaymentRequirements;
};

const PAYMENT_ROUTE = "/api/agent/generate-sop";
const requestContext = new AsyncLocalStorage<PaymentRequestContext>();
const pendingFingerprints = new Set<string>();
let cachedProxy: ((request: NextRequest) => Promise<NextResponse>) | undefined;

export async function runOfficialPaymentMiddleware(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/api/agent/generate-sop") return null;
  const config = getOfficialPaymentConfig();
  if (config.requested && !config.ready) {
    return jsonError(503, "PAYMENT_CONFIGURATION_ERROR", "Official payment processing is unavailable.");
  }
  if (!config.enabled) return null;

  const prepared = await prepareRequest(request, config);
  if (prepared instanceof NextResponse) return prepared;
  if (prepared.record.error_code === "PAYMENT_PERSISTENCE_FAILED") {
    return jsonError(503, "PAYMENT_CONFIGURATION_ERROR", "Payment settled, but durable evidence could not be recorded. No content was generated.", prepared.requestId);
  }
  const existingPayment = await findAgentPayment(prepared.requestId);
  if (existingPayment?.settlement_status === "settled") {
    await updateAgentRequest(prepared.requestId, { status: "paid", error_code: null });
    return null;
  }
  if (existingPayment && ["pending", "unknown"].includes(existingPayment.settlement_status)) {
    return jsonError(
      409,
      "PAYMENT_SETTLEMENT_PENDING",
      "A payment for this request is pending reconciliation. No new payment authorization will be issued.",
      prepared.requestId,
    );
  }
  if (prepared.record.status === "settling" || prepared.record.error_code === "PAYMENT_SETTLEMENT_UNKNOWN") {
    return jsonError(
      409,
      "PAYMENT_SETTLEMENT_PENDING",
      "Settlement status is unknown. Reconcile the existing payment before retrying.",
      prepared.requestId,
    );
  }
  if (["paid", "processing", "completed"].includes(prepared.record.status)) return null;
  const proxy = cachedProxy ??= createOfficialProxy();
  const response = await requestContext.run(prepared, () => proxy(request));
  if (response.status === 402 && (prepared.paymentSignaturePresent || prepared.xPaymentHeaderPresent)) {
    prepared.middlewareResult = "rejected";
  }
  logMiddlewareResult(prepared, response.status);
  return response;
}

async function prepareRequest(
  request: NextRequest,
  config: ReturnType<typeof getOfficialPaymentConfig>,
): Promise<PaymentRequestContext | NextResponse> {
  const validated = await validateAgentRequest(request.clone());
  if (!validated.ok) {
    return NextResponse.json({
      error: {
        code: validated.code,
        message: validated.message,
        ...(validated.details ? { details: validated.details } : {}),
        request_id: null,
      },
    }, { status: validated.status });
  }

  let record = await findAgentRequest(validated.idempotencyKey);
  if (record && record.request_hash !== validated.requestHash) {
    return jsonError(409, "IDEMPOTENCY_CONFLICT", "This Idempotency-Key was already used with different request content.", record.id);
  }
  if (!record) {
    const requestId = randomUUID();
    await createAgentRequest({
      id: requestId,
      service: AGENT_SERVICE,
      idempotency_key: validated.idempotencyKey,
      request_hash: validated.requestHash,
      status: "payment_required",
      network: config.network,
      price: config.amount,
      asset: config.assetAddress,
    });
    record = await findAgentRequest(validated.idempotencyKey);
    if (!record) throw new Error("AGENT_REQUEST_NOT_DURABLE");
  }
  return {
    ...validated,
    requestId: record.id,
    record,
    paymentSignaturePresent: request.headers.has("payment-signature"),
    xPaymentHeaderPresent: request.headers.has("x-payment"),
    middlewareResult: "challenge",
  };
}

function createOfficialProxy() {
  const config = getOfficialPaymentConfig();
  if (!config.ready) throw new Error("OFFICIAL_PAYMENT_NOT_READY");
  const facilitator = new LoggedOKXFacilitatorClient({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    passphrase: config.passphrase,
    baseUrl: config.facilitatorUrl,
    syncSettle: true,
  }, () => requestContext.getStore()?.requestId ?? null);
  const server = new x402ResourceServer(facilitator)
    .register(config.network, new ExactEvmScheme());

  server.onBeforeVerify(async ({ paymentPayload }) => {
    const context = requiredContext();
    const fingerprint = paymentFingerprint(paymentPayload);
    if (pendingFingerprints.has(fingerprint) || await paymentFingerprintExists(fingerprint)) {
      return { abort: true, reason: "PAYMENT_REPLAYED", message: "This payment proof has already been consumed." };
    }
    context.paymentReference = fingerprint;
  });
  server.onAfterVerify(async ({ paymentPayload, requirements, result }) => {
    const context = requiredContext();
    const reference = context.paymentReference ?? paymentFingerprint(paymentPayload);
    if (pendingFingerprints.has(reference)) throw new Error("PAYMENT_REPLAYED");
    pendingFingerprints.add(reference);
    context.paymentReference = reference;
    context.verifiedPayer = result.payer;
    context.verifiedRequirements = requirements;
    context.middlewareResult = "verified";
    try {
      await updateAgentRequest(context.requestId, { status: "settling", error_code: null });
      await reserveVerifiedPayment({
        request_id: context.requestId,
        payment_reference: reference,
        payer_address: result.payer ?? null,
        recipient_address: requirements.payTo,
        network: requirements.network,
        asset: requirements.asset,
        amount: requirements.amount,
        verification_status: "verified",
        settlement_status: "pending",
        verified_at: new Date().toISOString(),
        settled_at: null,
      });
    } catch (error) {
      pendingFingerprints.delete(reference);
      throw error;
    }
  });
  server.onAfterSettle(async ({ result }) => {
    const context = requiredContext();
    const requirements = context.verifiedRequirements;
    if (!context.paymentReference || !requirements) throw new Error("SETTLEMENT_CONTEXT_MISSING");
    const settlementStatus =
      result.status === "success" || (!result.status && result.success)
        ? "settled"
        : result.success === false && !["pending", "timeout"].includes(result.status ?? "")
          ? "failed"
          : "unknown";
    try {
      const settledAt = new Date().toISOString();
      await updatePaymentSettlement(context.requestId, {
        transaction_hash: result.transaction,
        settlement_reference: result.transaction,
        payer_address: result.payer ?? context.verifiedPayer ?? null,
        settlement_status: settlementStatus,
        settled_at: settlementStatus === "settled" ? settledAt : null,
      });
      await updateAgentRequest(context.requestId, {
        status: settlementStatus === "settled"
          ? "paid"
          : settlementStatus === "failed"
            ? "payment_rejected"
            : "settling",
        error_code: settlementStatus === "settled"
          ? null
          : settlementStatus === "failed"
            ? "PAYMENT_SETTLEMENT_FAILED"
            : "PAYMENT_SETTLEMENT_UNKNOWN",
      });
      context.middlewareResult = settlementStatus === "settled" ? "settled" : "verified";
      securityLog(settlementStatus === "settled" ? "settlement_completed" : "settlement_unknown", {
        request_id: context.requestId,
        provider: config.provider,
        network: result.network,
        settlement_reference: result.transaction,
        settlement_status: settlementStatus,
      });
    } catch (error) {
      securityLog("payment_persistence_failed", {
        request_id: context.requestId,
        provider: config.provider,
        error_name: error instanceof Error ? error.message.split("_").slice(0, 3).join("_") : "UnknownError",
      });
    } finally {
      pendingFingerprints.delete(context.paymentReference);
    }
  });
  server.onVerifyFailure(async ({ error }) => {
    const context = requestContext.getStore();
    if (context) {
      const safeError = safeOfficialError(error);
      context.middlewareResult = "rejected";
      context.officialErrorCode = safeError.code;
      context.officialErrorMessage = safeError.message;
    }
  });
  server.onSettleFailure(async ({ error }) => {
    const context = requestContext.getStore();
    if (context) {
      const safeError = safeOfficialError(error);
      context.middlewareResult = "rejected";
      context.officialErrorCode = safeError.code;
      context.officialErrorMessage = safeError.message;
      if (context.paymentReference) pendingFingerprints.delete(context.paymentReference);
      try {
        await updatePaymentSettlement(context.requestId, { settlement_status: "unknown" });
        await updateAgentRequest(context.requestId, {
          status: "settling",
          error_code: "PAYMENT_SETTLEMENT_UNKNOWN",
        });
      } catch {
        // The verified reservation remains pending and blocks a new authorization.
      }
      securityLog("settlement_unknown", { request_id: context.requestId, provider: config.provider });
    }
  });

  const resource = `${getAppBaseUrl()}/api/agent/generate-sop`;
  return paymentProxy({
    "POST /api/agent/generate-sop": {
      accepts: {
        scheme: "exact",
        network: config.network,
        payTo: config.payTo,
        price: {
          asset: config.assetAddress,
          amount: config.amount,
          extra: { name: config.assetName, version: config.assetVersion },
        },
        maxTimeoutSeconds: config.maxTimeoutSeconds,
      },
      resource,
      description: "Generate a ProcessForge SOP",
      mimeType: "application/json",
      unpaidResponseBody: () => ({
        contentType: "application/json",
        body: {
          error: {
            code: "PAYMENT_REQUIRED",
            message: "Payment is required to generate this SOP.",
            request_id: requestContext.getStore()?.requestId ?? null,
          },
        },
      }),
      settlementFailedResponseBody: () => ({
        contentType: "application/json",
        body: {
          error: {
            code: "PAYMENT_SETTLEMENT_FAILED",
            message: "Payment settlement failed.",
            request_id: requestContext.getStore()?.requestId ?? null,
          },
        },
      }),
    },
  }, server, undefined, undefined, true);
}

function paymentFingerprint(paymentPayload: PaymentPayload): string {
  return createHash("sha256").update(JSON.stringify(paymentPayload)).digest("hex");
}

function requiredContext(): PaymentRequestContext {
  const context = requestContext.getStore();
  if (!context) throw new Error("PAYMENT_REQUEST_CONTEXT_MISSING");
  return context;
}

function safeOfficialError(error: unknown): { code: string; message: string } {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    code: scrubOfficialText(typeof value.code === "string" ? value.code : "OFFICIAL_X402_ERROR"),
    message: scrubOfficialText(error instanceof Error ? error.message : "The official x402 middleware rejected the request."),
  };
}

function scrubOfficialText(value: string): string {
  return value
    .replace(/0x[a-fA-F0-9]{32,}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, "[redacted]")
    .slice(0, 160);
}

function logMiddlewareResult(context: PaymentRequestContext, status: number): void {
  securityLog("x402_middleware", {
    request_id: context.requestId,
    route: PAYMENT_ROUTE,
    payment_signature_present: context.paymentSignaturePresent,
    x_payment_header_present: context.xPaymentHeaderPresent,
    middleware_result: context.middlewareResult,
    official_error_code: context.officialErrorCode,
    official_error_message: context.officialErrorMessage,
    http_response_status: status,
  });
}

function jsonError(status: number, code: string, message: string, requestId: string | null = null) {
  return NextResponse.json({ error: { code, message, request_id: requestId } }, { status });
}
