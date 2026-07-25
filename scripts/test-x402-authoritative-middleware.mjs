import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentSopRequestSchema } from "../lib/agent/contract.ts";
import {
  ensureRouteHandlerResponse,
  isNextContinuationResponse,
} from "../lib/http/route-handler-response.ts";

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
  let generationCount = 0;

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
    return {
      type: "verified",
      requestId: paymentId,
      replayKey: `replay:${bodyText}`,
    };
  }

  async function route({ paymentId, body, rawBody = JSON.stringify(body) }) {
    const request = new Request(
      "https://processforgeai.xyz/api/agent/generate-sop",
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

    const bodyText = await request.text();
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
  };
}

test("unpaid valid POST returns HTTP 402", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({ body: validRequestBody });

  assert.equal(result.response.status, 402);
  assert.equal(result.bodyReadCount, 1);
  assert.equal(endpoint.generationCount, 0);
});

test("valid paid POST returns HTTP 200 with SOP and reads body exactly once", async () => {
  const endpoint = createRouteHarness();
  const result = await endpoint.route({
    paymentId: "fresh-paid-proof",
    body: validRequestBody,
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.bodyReadCount, 1);
  assert.equal((await result.response.json()).sop.title, validRequestBody.title);
  assert.equal(endpoint.generationCount, 1);
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
  const request = {
    paymentId: "duplicate-paid-proof",
    body: validRequestBody,
  };
  const first = await endpoint.route(request);
  const replay = await endpoint.route(request);

  assert.equal(first.response.status, 200);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.response.headers.get("x-idempotent-replay"), "true");
  assert.equal(endpoint.generationCount, 1);
  assert.deepEqual(await replay.response.json(), await first.response.json());
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
  assert.match(routeSource, /runOfficialPaymentGate\(request, bodyText\)/);
  assert.match(routeSource, /ensureRouteHandlerResponse\(paymentResult\.response, fallbackRequestId\)/);
  assert.match(routeSource, /JSON\.parse\(bodyText\)/);
  assert.doesNotMatch(proxySource, /x402|runOfficialPayment/);
  assert.match(proxySource, /return updateSession\(request\)/);
  assert.match(supabaseMiddlewareSource, /NextResponse\.next/);
  assert.doesNotMatch(routeSource, /NextResponse\.next/);
});
