import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentSopRequestSchema } from "../lib/agent/contract.ts";
import {
  ensureRouteHandlerResponse,
  isNextContinuationResponse,
} from "../lib/http/route-handler-response.ts";
import { encodePaymentSignatureHeader } from "@okxweb3/x402-core/http";
import {
  inspectPaidRequestCorrelation,
  REQUEST_REPLAY_QUERY_PARAM,
} from "../lib/agent/request-payload-replay.ts";

const paymentGateSource = readFileSync(
  resolve("lib/agent/official-x402-middleware.ts"),
  "utf8",
);
const routeSource = readFileSync(
  resolve("app/api/agent/generate-sop/route.ts"),
  "utf8",
);
const proxySource = readFileSync(resolve("proxy.ts"), "utf8");
const supabaseMiddlewareSource = readFileSync(
  resolve("lib/supabase/middleware.ts"),
  "utf8",
);
const identitySource = readFileSync(
  resolve("lib/agent/verified-payment-identity.ts"),
  "utf8",
);

const validRequestBody = {
  title: "Daily Restaurant Opening Procedure",
  description: "Create a short professional opening SOP",
  industry: "Restaurant",
  department: "Operations",
  audience: "Shift Manager and Opening Staff",
  requirements: ["Keep the SOP concise and professional."],
};

function createRouteHarness() {
  const completedPayments = new Map();
  const requestPayloads = new Map();
  let generationCount = 0;
  let settlementCount = 0;
  let replaySequence = 0;
  let now = Date.now();

  async function paymentGate(request, bodyText) {
    const paymentId = request.headers.get("payment-signature");
    if (!paymentId) {
      return {
        type: "response",
        response: Response.json(
          { error: { code: "PAYMENT_REQUIRED" } },
          { status: 402 },
        ),
      };
    }
    const stored = completedPayments.get(paymentId);
    if (stored) {
      return {
        type: "response",
        response: Response.json(stored, {
          status: 200,
          headers: { "x-idempotent-replay": "true" },
        }),
      };
    }
    settlementCount += 1;
    return {
      type: "verified",
      requestId: paymentId,
      replayKey: `replay:${bodyText}`,
    };
  }

  async function route({
    paymentId,
    body,
    rawBody = JSON.stringify(body),
    replayLocator = null,
    paymentResourceLocator = null,
    payer = null,
    initialPayer = null,
  }) {
    const url = new URL("https://processforgeai.xyz/api/agent/generate-sop");
    if (replayLocator) url.searchParams.set("_pf_x402_replay", replayLocator);
    const request = new Request(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(paymentId ? { "payment-signature": paymentId } : {}),
        },
        body: rawBody,
      },
    );
    const nativeText = request.text.bind(request);
    let bodyReadCount = 0;
    request.text = async () => {
      bodyReadCount += 1;
      return nativeText();
    };

    let bodyText = await request.text();
    if (paymentId && bodyText.length === 0) {
      const effectiveLocator = replayLocator ?? paymentResourceLocator;
      let candidates = effectiveLocator
        ? [requestPayloads.get(effectiveLocator)].filter(Boolean)
        : [...requestPayloads.values()].filter((candidate) =>
          candidate.endpoint === "https://processforgeai.xyz/api/agent/generate-sop"
          && candidate.createdAt >= now - 10 * 60 * 1000
          && candidate.expiresAt > now
          && (!candidate.consumedBy || candidate.consumedBy === paymentId));
      if (!effectiveLocator && payer) {
        const payerMatches = candidates.filter((candidate) => candidate.payer === payer);
        if (payerMatches.length > 0) candidates = payerMatches;
      }
      if (candidates.length > 1) {
        return {
          response: Response.json(
            {
              error: {
                code: "REPLAY_PAYLOAD_AMBIGUOUS",
                message: "The paid request body was empty and multiple recent payloads matched. No payment was settled.",
              },
            },
            { status: 409 },
          ),
          bodyReadCount,
        };
      }
      const stored = candidates[0] ?? null;
      if (
        !stored
        || stored.expiresAt <= now
        || (stored.consumedBy && stored.consumedBy !== paymentId)
      ) {
        return {
          response: Response.json(
            {
              error: {
                code: "REPLAY_PAYLOAD_UNAVAILABLE",
                message: "The paid request body was empty and its temporary replay payload is unavailable or expired.",
              },
            },
            { status: 500 },
          ),
          bodyReadCount,
        };
      }
      stored.consumedBy ??= paymentId;
      bodyText = stored.bodyText;
    }
    let payload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return {
        response: Response.json(
          { error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." } },
          { status: 400 },
        ),
        bodyReadCount,
      };
    }
    const validated = agentSopRequestSchema.safeParse(payload);
    if (!validated.success) {
      return {
        response: Response.json(
          { error: { code: "INVALID_REQUEST", message: "Request validation failed." } },
          { status: 400 },
        ),
        bodyReadCount,
      };
    }

    if (!paymentId) {
      const locator = `test-replay-locator-${String(++replaySequence).padStart(11, "0")}`;
      requestPayloads.set(locator, {
        locator,
        endpoint: "https://processforgeai.xyz/api/agent/generate-sop",
        bodyText,
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000,
        consumedBy: null,
        payer: initialPayer,
      });
      return {
        response: Response.json(
          { error: { code: "PAYMENT_REQUIRED" } },
          {
            status: 402,
            headers: {
              "x-test-replay-url":
                `https://processforgeai.xyz/api/agent/generate-sop?_pf_x402_replay=${locator}`,
            },
          },
        ),
        bodyReadCount,
        replayLocator: locator,
      };
    }

    const payment = await paymentGate(request, bodyText);
    if (payment.type === "response") {
      return {
        response: ensureRouteHandlerResponse(payment.response, "fallback-request-id"),
        bodyReadCount,
      };
    }

    generationCount += 1;
    const responseBody = {
      request_id: payment.requestId,
      status: "completed",
      sop: { title: validated.data.title, sections: [] },
    };
    completedPayments.set(paymentId, responseBody);
    return {
      response: Response.json(responseBody, { status: 200 }),
      bodyReadCount,
    };
  }

  return {
    route,
    get generationCount() {
      return generationCount;
    },
    get settlementCount() {
      return settlementCount;
    },
    expirePayloads() {
      now += 10 * 60 * 1000 + 1;
    },
  };
}

test("unpaid request with body returns HTTP 402 and stores replay payload", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({ body: validRequestBody });

  assert.equal(result.response.status, 402);
  assert.equal(result.bodyReadCount, 1);
  assert.ok(result.replayLocator);
  assert.match(result.response.headers.get("x-test-replay-url"), /_pf_x402_replay=/);
  assert.equal(endpoint.generationCount, 0);
});

test("paid retry without a custom replay locator restores exactly one recent payload", async () => {
  const endpoint = createRouteHarness();
  await endpoint.route({ body: validRequestBody });
  const result = await endpoint.route({
    paymentId: "fresh-paid-proof",
    body: null,
    rawBody: "",
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.bodyReadCount, 1);
  const body = await result.response.json();
  assert.equal(body.sop.title, validRequestBody.title);
  assert.notDeepEqual(body, { payment_verified: true });
  assert.equal(endpoint.generationCount, 1);
  assert.equal(endpoint.settlementCount, 1);
});

test("paid retry uses the signed payment resource locator when the HTTP URL omits it", async () => {
  const endpoint = createRouteHarness();
  const unpaid = await endpoint.route({ body: validRequestBody });
  const result = await endpoint.route({
    paymentId: "resource-locator-proof",
    body: null,
    rawBody: "",
    paymentResourceLocator: unpaid.replayLocator,
  });

  assert.equal(result.response.status, 200);
  assert.equal((await result.response.json()).sop.title, validRequestBody.title);
  assert.equal(endpoint.settlementCount, 1);
});

test("paid retry prefers the unique recent payload matching the payer", async () => {
  const endpoint = createRouteHarness();
  await endpoint.route({
    body: { ...validRequestBody, title: "Payer A request" },
    initialPayer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  await endpoint.route({
    body: { ...validRequestBody, title: "Payer B request" },
    initialPayer: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  const result = await endpoint.route({
    paymentId: "payer-a-proof",
    body: null,
    rawBody: "",
    payer: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });

  assert.equal(result.response.status, 200);
  assert.equal((await result.response.json()).sop.title, "Payer A request");
  assert.equal(endpoint.settlementCount, 1);
});

test("paid retry with no recent payload fails before settlement", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({
    paymentId: "missing-paid-proof",
    body: null,
    rawBody: "",
  });

  assert.equal(result.response.status, 500);
  assert.equal((await result.response.json()).error.code, "REPLAY_PAYLOAD_UNAVAILABLE");
  assert.equal(endpoint.generationCount, 0);
  assert.equal(endpoint.settlementCount, 0);
});

test("paid retry with multiple recent payloads is ambiguous and never settles", async () => {
  const endpoint = createRouteHarness();
  await endpoint.route({ body: validRequestBody });
  await endpoint.route({
    body: { ...validRequestBody, title: "Second pending request" },
  });
  const result = await endpoint.route({
    paymentId: "ambiguous-paid-proof",
    body: null,
    rawBody: "",
  });

  assert.equal(result.response.status, 409);
  assert.equal((await result.response.json()).error.code, "REPLAY_PAYLOAD_AMBIGUOUS");
  assert.equal(endpoint.generationCount, 0);
  assert.equal(endpoint.settlementCount, 0);
});

test("paid request with body returns HTTP 200", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({
    paymentId: "paid-proof-with-body",
    body: validRequestBody,
  });

  assert.equal(result.response.status, 200);
  assert.equal(endpoint.generationCount, 1);
});

test("expired or missing replay payload returns a controlled error", async () => {
  const endpoint = createRouteHarness();
  const unpaid = await endpoint.route({ body: validRequestBody });
  endpoint.expirePayloads();
  const result = await endpoint.route({
    paymentId: "expired-paid-proof",
    body: null,
    rawBody: "",
    replayLocator: unpaid.replayLocator,
  });

  assert.equal(result.response.status, 500);
  assert.equal((await result.response.json()).error.code, "REPLAY_PAYLOAD_UNAVAILABLE");
  assert.equal(endpoint.generationCount, 0);
  assert.equal(endpoint.settlementCount, 0);
});

test("malformed JSON returns HTTP 400 before payment", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({
    paymentId: "unused-malformed-proof",
    body: null,
    rawBody: "{malformed",
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.bodyReadCount, 1);
  assert.equal(endpoint.generationCount, 0);
});

test("schema-invalid JSON returns HTTP 400 before payment", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({
    paymentId: "unused-schema-invalid-proof",
    body: { title: "Incomplete request" },
  });

  assert.equal(result.response.status, 400);
  assert.equal(result.bodyReadCount, 1);
  assert.equal(endpoint.generationCount, 0);
});

test("duplicate paid replay returns stored HTTP 200 and generates once", async () => {
  const endpoint = createRouteHarness();
  const unpaid = await endpoint.route({ body: validRequestBody });
  const request = {
    paymentId: "duplicate-paid-proof",
    body: null,
    rawBody: "",
    replayLocator: unpaid.replayLocator,
  };
  const first = await endpoint.route(request);
  const replay = await endpoint.route(request);

  assert.equal(first.response.status, 200);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.response.headers.get("x-idempotent-replay"), "true");
  assert.equal(endpoint.generationCount, 1);
  assert.equal(endpoint.settlementCount, 1);
  assert.deepEqual(await replay.response.json(), await first.response.json());
});

test("paid header correlation extracts only the shared resource locator and payer metadata", () => {
  const locator = "abcdefghijklmnopqrstuvwxyzABCDEF";
  const resourceUrl =
    `https://processforgeai.xyz/api/agent/generate-sop?${REQUEST_REPLAY_QUERY_PARAM}=${locator}`;
  const header = encodePaymentSignatureHeader({
    x402Version: 2,
    resource: {
      url: resourceUrl,
      description: "Generate a ProcessForge SOP",
      mimeType: "application/json",
    },
    accepted: {
      scheme: "exact",
      network: "eip155:196",
      asset: "0x1111111111111111111111111111111111111111",
      amount: "10000",
      payTo: "0x2222222222222222222222222222222222222222",
      maxTimeoutSeconds: 300,
      extra: {},
    },
    payload: {
      signature: "not-logged",
      authorization: {
        from: "0x3333333333333333333333333333333333333333",
      },
    },
  });
  const request = new Request(
    "https://processforgeai.xyz/api/agent/generate-sop",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "payment-signature": header,
        "x-correlation-test": "present",
      },
    },
  );

  const correlation = inspectPaidRequestCorrelation(request);
  assert.equal(correlation.decoded, true);
  assert.equal(correlation.paymentResourceUrl, resourceUrl);
  assert.equal(correlation.paymentResourceLocator, locator);
  assert.equal(
    correlation.payerAddress,
    "0x3333333333333333333333333333333333333333",
  );
  assert.deepEqual(correlation.paymentPayloadKeys, [
    "accepted",
    "payload",
    "resource",
    "x402Version",
  ]);
  assert.ok(correlation.headerNames.includes("payment-signature"));
  assert.ok(!JSON.stringify(correlation).includes("not-logged"));
});

test("route handler rejects middleware continuation responses", async () => {
  const continuation = new Response(null, {
    status: 200,
    headers: { "x-middleware-next": "1" },
  });

  assert.equal(isNextContinuationResponse(continuation), true);
  const response = ensureRouteHandlerResponse(continuation, "continuation-test");
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("x-middleware-next"), null);
  assert.deepEqual(await response.json(), {
    error: {
      code: "INVALID_ROUTE_CONTINUATION",
      message: "The request could not be completed.",
      request_id: "continuation-test",
    },
  });
});

test("payment gate remains official, synchronous, reserved, and production-bound", () => {
  assert.match(paymentGateSource, /runOfficialPaymentGate/);
  assert.match(paymentGateSource, /withX402/);
  assert.doesNotMatch(paymentGateSource, /paymentProxy/);
  assert.doesNotMatch(paymentGateSource, /NextResponse\.next/);
  assert.doesNotMatch(paymentGateSource, /payment_verified/);
  assert.match(paymentGateSource, /async \(\) => new NextResponse\(null, \{ status: 204 \}\)/);
  assert.match(
    paymentGateSource,
    /return context as PaymentRequestContext & \{ requestId: string; paymentReference: string \}/,
  );
  assert.match(paymentGateSource, /paidContext\.replayDecision === "new"/);
  assert.match(paymentGateSource, /paidContext\.middlewareResult === "settled"/);
  assert.match(paymentGateSource, /PAYMENT_SETTLEMENT_INCOMPLETE/);
  assert.equal(
    (paymentGateSource.match(/ensureRouteHandlerResponse\(gateResponse,/g) ?? []).length,
    2,
  );
  assert.match(paymentGateSource, /syncSettle: true/);
  assert.match(paymentGateSource, /reserveVerifiedPaymentAtomic/);
  assert.match(paymentGateSource, /extractVerifiedPaymentIdentity/);
  assert.match(paymentGateSource, /createHash\("sha256"\)\.update\(bodyText\)/);
  assert.match(paymentGateSource, /PRODUCTION_ORIGIN/);
  assert.match(paymentGateSource, /x-idempotent-replay/);
  assert.match(
    identitySource,
    /const paymentSignatureHash = createHash\("sha256"\)\.update\(signature\)\.digest\("hex"\)/,
  );
});

test("route owns one body read and proxy only refreshes Supabase session", () => {
  assert.equal((routeSource.match(/await request\.text\(\)/g) ?? []).length, 1);
  assert.match(routeSource, /runOfficialPaymentGate\(/);
  assert.match(routeSource, /resolveAgentRequestPayload/);
  assert.ok(
    routeSource.indexOf("resolveAgentRequestPayload")
      < routeSource.indexOf("runOfficialPaymentGate("),
  );
  assert.match(paymentGateSource, /claimAgentRequestPayload/);
  assert.ok(
    paymentGateSource.indexOf("claimAgentRequestPayload({")
      < paymentGateSource.indexOf("reserveVerifiedPaymentAtomic({"),
  );
  assert.match(routeSource, /ensureRouteHandlerResponse\(paymentResult\.response, fallbackRequestId\)/);
  assert.match(routeSource, /JSON\.parse\(bodyText\)/);
  assert.doesNotMatch(proxySource, /x402|runOfficialPayment/);
  assert.match(proxySource, /return updateSession\(request\)/);
  assert.match(supabaseMiddlewareSource, /NextResponse\.next/);
  assert.doesNotMatch(routeSource, /NextResponse\.next/);
  for (const event of [
    "replay_key_created",
    "request_payload_stored",
    "empty_paid_body_detected",
    "request_payload_restored",
    "replay_payload_missing",
    "replay_payload_ambiguous",
    "x402_request_shape",
  ]) {
    assert.match(routeSource, new RegExp(`securityLog\\("${event}"`));
  }
  assert.match(paymentGateSource, /securityLog\("request_payload_consumed"/);
});
