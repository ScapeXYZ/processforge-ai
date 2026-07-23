import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { x402ResourceServer } from "@okxweb3/x402-core/server";
import type { PaymentPayload } from "@okxweb3/x402-core/types";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { paymentProxy } from "@okxweb3/x402-next";
import { NextResponse, type NextRequest } from "next/server";
import { getAppBaseUrl } from "@/lib/env/server";
import { getOfficialPaymentConfig } from "@/lib/agent/official-payment-config";
import {
  createAgentRequest,
  findAgentRequest,
  paymentFingerprintExists,
  persistSettlement,
  persistVerifiedPayment,
  updateAgentRequest,
  type AgentRequestRecord,
} from "@/lib/agent/payment-store";
import { validateAgentRequest, type ValidAgentRequest } from "@/lib/agent/request-validation";
import { AGENT_SERVICE } from "@/lib/agent/service";
import { securityLog } from "@/lib/security/logger";

type PaymentRequestContext = ValidAgentRequest & {
  requestId: string;
  record: AgentRequestRecord;
  paymentReference?: string;
};

const requestContext = new AsyncLocalStorage<PaymentRequestContext>();
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
  if (["paid", "processing", "completed"].includes(prepared.record.status)) return null;
  const proxy = cachedProxy ??= createOfficialProxy();
  return requestContext.run(prepared, () => proxy(request));
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
  return { ...validated, requestId: record.id, record };
}

function createOfficialProxy() {
  const config = getOfficialPaymentConfig();
  if (!config.ready) throw new Error("OFFICIAL_PAYMENT_NOT_READY");
  const facilitator = new OKXFacilitatorClient({
    apiKey: config.apiKey,
    secretKey: config.secretKey,
    passphrase: config.passphrase,
    baseUrl: config.facilitatorUrl,
    syncSettle: true,
  });
  const server = new x402ResourceServer(facilitator)
    .register(config.network, new ExactEvmScheme());

  server.onBeforeVerify(async ({ paymentPayload }) => {
    const context = requiredContext();
    const fingerprint = paymentFingerprint(paymentPayload);
    if (await paymentFingerprintExists(fingerprint)) {
      return { abort: true, reason: "PAYMENT_REPLAYED", message: "This payment proof has already been consumed." };
    }
    context.paymentReference = fingerprint;
  });
  server.onAfterVerify(async ({ paymentPayload, requirements, result }) => {
    const context = requiredContext();
    const reference = context.paymentReference ?? paymentFingerprint(paymentPayload);
    await persistVerifiedPayment({
      request_id: context.requestId,
      payment_reference: reference,
      replay_fingerprint: reference,
      recipient_address: requirements.payTo,
      network: requirements.network,
      asset: requirements.asset,
      amount: requirements.amount,
      payer_address: result.payer ?? null,
      verification_status: "verified",
      settlement_status: "pending",
      verified_at: new Date().toISOString(),
    });
    await updateAgentRequest(context.requestId, { status: "settling" });
    securityLog("payment_verified", {
      request_id: context.requestId,
      provider: config.provider,
      network: requirements.network,
    });
  });
  server.onAfterSettle(async ({ result }) => {
    const context = requiredContext();
    if (!context.paymentReference || !result.transaction || (result.status && result.status !== "success")) {
      throw new Error("SETTLEMENT_NOT_FINAL");
    }
    await persistSettlement(context.paymentReference, result.transaction, {
      transaction_hash: result.transaction,
      payer_address: result.payer ?? null,
      settlement_status: "settled",
      settled_at: new Date().toISOString(),
    });
    await updateAgentRequest(context.requestId, { status: "paid" });
    securityLog("settlement_completed", {
      request_id: context.requestId,
      provider: config.provider,
      network: result.network,
      settlement_reference: result.transaction,
    });
  });
  server.onSettleFailure(async () => {
    const context = requestContext.getStore();
    if (context) {
      await updateAgentRequest(context.requestId, {
        status: "payment_rejected",
        error_code: "PAYMENT_SETTLEMENT_FAILED",
      });
      securityLog("settlement_failed", { request_id: context.requestId, provider: config.provider });
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
          extra: { name: "USD₮0", version: "1" },
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

function jsonError(status: number, code: string, message: string, requestId: string | null = null) {
  return NextResponse.json({ error: { code, message, request_id: requestId } }, { status });
}
