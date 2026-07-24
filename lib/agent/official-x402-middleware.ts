import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { x402ResourceServer } from "@okxweb3/x402-core/server";
import type { PaymentRequirements } from "@okxweb3/x402-core/types";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { paymentProxy } from "@okxweb3/x402-next";
import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/env/server";
import { getOfficialPaymentConfig } from "@/lib/agent/official-payment-config";
import { LoggedOKXFacilitatorClient } from "@/lib/agent/logged-okx-facilitator-client";
import {
  reserveVerifiedPaymentAtomic,
  updatePaymentSettlement,
  updateAgentRequest,
} from "@/lib/agent/payment-store";
import { buildSettledRequestHeaders } from "@/lib/agent/payment-internal";
import {
  paidProxyRequestInit,
  paidRequestBodyHash,
  preservePaidRequestBody,
} from "@/lib/agent/paid-request-body";
import { AGENT_SERVICE, PRODUCTION_ORIGIN } from "@/lib/agent/service";
import {
  extractVerifiedPaymentIdentity,
  safeVerificationShape,
} from "@/lib/agent/verified-payment-identity";
import { securityLog } from "@/lib/security/logger";

type PaymentRequestContext = {
  requestId: string | null;
  requestHash: string | null;
  paymentSignaturePresent: boolean;
  xPaymentHeaderPresent: boolean;
  middlewareResult: "challenge" | "verified" | "settled" | "rejected";
  officialErrorCode?: string;
  officialErrorMessage?: string;
  paymentReference?: string;
  verifiedPayer?: string;
  verifiedRequirements?: PaymentRequirements;
  replayDecision?: "new" | "completed" | "busy" | "resume" | "conflict";
  storedResponse?: Record<string, unknown> | null;
};

const PAYMENT_ROUTE = "/api/agent/generate-sop";
const requestContext = new AsyncLocalStorage<PaymentRequestContext>();
let cachedProxy: ((request: NextRequest) => Promise<NextResponse>) | undefined;

export async function runOfficialPaymentMiddleware(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "POST" || request.nextUrl.pathname !== "/api/agent/generate-sop") return null;
  const config = getOfficialPaymentConfig();
  if (config.requested && !config.ready) {
    return jsonError(503, "PAYMENT_CONFIGURATION_ERROR", "Official payment processing is unavailable.");
  }
  if (!config.enabled) return null;

  const paymentSignaturePresent = request.headers.has("payment-signature");
  const xPaymentHeaderPresent = request.headers.has("x-payment");
  const proxy = cachedProxy ??= createOfficialProxy();

  // Unpaid probes must reach the official x402 wrapper before any business-body
  // validation so every POST probe receives the standards-compliant 402 offer.
  // Proof-bearing retries are validated below before verification/settlement,
  // which prevents malformed requests from consuming a payment.
  if (!paymentSignaturePresent && !xPaymentHeaderPresent) {
    const challengeContext: PaymentRequestContext = {
      requestId: null,
      requestHash: null,
      paymentSignaturePresent,
      xPaymentHeaderPresent,
      middlewareResult: "challenge",
    };
    const response = await requestContext.run(challengeContext, () => proxy(request));
    logMiddlewareResult(challengeContext, response.status);
    return response;
  }

  const originalBody = await preservePaidRequestBody(request);
  const proxyRequest = new NextRequest(
    request.url,
    paidProxyRequestInit(request, originalBody),
  );
  const paidContext: PaymentRequestContext = {
    requestId: null,
    requestHash: paidRequestBodyHash(originalBody),
    paymentSignaturePresent,
    xPaymentHeaderPresent,
    middlewareResult: "challenge",
  };
  const response = await requestContext.run(paidContext, () => proxy(proxyRequest));

  if (paidContext.replayDecision === "completed" && paidContext.storedResponse) {
    logMiddlewareResult(paidContext, 200);
    return NextResponse.json(paidContext.storedResponse, {
      headers: { "cache-control": "no-store", "x-idempotent-replay": "true" },
    });
  }
  if (paidContext.replayDecision === "conflict") {
    return jsonError(
      409,
      "PAYMENT_REPLAY_CONFLICT",
      "This verified payment authorization is already associated with different request content.",
      paidContext.requestId,
    );
  }
  if (paidContext.replayDecision === "busy") {
    return jsonError(
      409,
      "REQUEST_IN_PROGRESS",
      "This verified payment is already settling or processing. Retry the same request later.",
      paidContext.requestId,
    );
  }
  if (
    paidContext.paymentReference
    && (paidContext.replayDecision === "resume" || paidContext.middlewareResult === "settled")
  ) {
    logMiddlewareResult(paidContext, 200);
    return continueWithVerifiedPayment(request, paidContext.paymentReference, response);
  }
  if (response.status === 402) {
    paidContext.middlewareResult = "rejected";
  }
  logMiddlewareResult(paidContext, response.status);
  return response;
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

  server.onAfterVerify(async ({ paymentPayload, requirements, result }) => {
    const context = requiredPaymentContext();
    const verificationShape = safeVerificationShape({ paymentPayload, result });
    securityLog("x402_verification_shape", {
      is_valid: verificationShape.isValid,
      invalid_reason: verificationShape.invalidReason,
      invalid_message: verificationShape.invalidMessage,
      payer_exists: verificationShape.payerExists,
      payload_signature_exists: verificationShape.payloadSignatureExists,
      authorization_exists: verificationShape.authorizationExists,
      authorization_signature_exists: verificationShape.authorizationSignatureExists,
      verification_keys: verificationShape.verificationKeys,
    });
    const identity = extractVerifiedPaymentIdentity({
      paymentPayload,
      requirements,
      result,
      resource: `${paymentResourceOrigin()}${PAYMENT_ROUTE}`,
    });
    if (!identity || !context.requestHash) {
      throw new Error("VERIFIED_PAYMENT_IDENTITY_MISSING");
    }
    const reservation = await reserveVerifiedPaymentAtomic({
      replay_key: identity.replayKey,
      request_hash: context.requestHash,
      service: AGENT_SERVICE,
      network: identity.network,
      price: identity.amount,
      asset: identity.asset,
      payer_address: identity.payer,
      recipient_address: identity.payTo,
      amount: identity.amount,
    });
    context.requestId = reservation.request_id;
    context.paymentReference = identity.replayKey;
    context.verifiedPayer = identity.payer;
    context.verifiedRequirements = requirements;
    context.middlewareResult = "verified";

    if (!reservation.hash_matches) {
      context.replayDecision = "conflict";
    } else if (reservation.is_new) {
      context.replayDecision = "new";
    } else if (reservation.request_status === "completed" && reservation.response_payload) {
      context.replayDecision = "completed";
      context.storedResponse = reservation.response_payload;
    } else if (
      reservation.settlement_status === "settled"
      && ["paid", "failed"].includes(reservation.request_status)
    ) {
      context.replayDecision = "resume";
    } else {
      context.replayDecision = "busy";
    }
  });
  server.onBeforeSettle(async () => {
    const context = requiredPaymentContext();
    if (context.replayDecision && context.replayDecision !== "new") {
      return {
        abort: true,
        reason: "PAYMENT_ALREADY_RESERVED",
        message: "This verified payment authorization is already reserved.",
      };
    }
  });
  server.onAfterSettle(async ({ result }) => {
    const context = requiredReservedContext();
    const requirements = context.verifiedRequirements;
    if (!context.paymentReference || !requirements) throw new Error("SETTLEMENT_CONTEXT_MISSING");
    const settlementStatus =
      result.status === "success" || (!result.status && result.success)
        ? "settled"
        : result.success === false && !["pending", "timeout"].includes(result.status ?? "")
          ? "failed"
          : "unknown";
    if (settlementStatus === "settled") {
      securityLog("settlement_success", {
        request_id: context.requestId,
        provider: config.provider,
        network: result.network,
        transaction_hash: result.transaction,
      });
    }
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
    if (context?.replayDecision && context.replayDecision !== "new") return;
    if (context?.requestId) {
      const safeError = safeOfficialError(error);
      context.middlewareResult = "rejected";
      context.officialErrorCode = safeError.code;
      context.officialErrorMessage = safeError.message;
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

  const resource = `${paymentResourceOrigin()}/api/agent/generate-sop`;
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

// The resource URL is embedded in the 402 challenge and used to build the
// replay-identity hash; it must match the domain OKX Agents actually sign
// against. getAppBaseUrl() reads the optional APP_BASE_URL env var and
// silently falls back to http://localhost:3000 if it's unset — a fallback
// that must never reach production. PRODUCTION_ORIGIN is the one
// already-declared source of truth for the real production domain, so it
// takes precedence whenever the app is actually running in production.
function paymentResourceOrigin(): string {
  if (process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;
  return getAppBaseUrl();
}

function requiredPaymentContext(): PaymentRequestContext {
  const context = requestContext.getStore();
  if (!context) throw new Error("PAYMENT_REQUEST_CONTEXT_MISSING");
  return context;
}

function requiredReservedContext(): PaymentRequestContext & { requestId: string; paymentReference: string } {
  const context = requiredPaymentContext();
  if (!context.requestId || !context.paymentReference) throw new Error("PAYMENT_RESERVATION_CONTEXT_MISSING");
  return { ...context, requestId: context.requestId, paymentReference: context.paymentReference };
}

function continueWithVerifiedPayment(
  request: NextRequest,
  replayKey: string,
  paymentResponse: NextResponse,
): NextResponse {
  const context = requiredReservedContext();
  const forwardedHeaders = buildSettledRequestHeaders(request.headers, {
    replayKey,
    requestId: context.requestId,
  });
  const next = NextResponse.next({
    request: {
      headers: forwardedHeaders,
    },
  });
  const settlementReceipt = paymentResponse.headers.get("payment-response");
  if (settlementReceipt) next.headers.set("payment-response", settlementReceipt);
  return next;
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
