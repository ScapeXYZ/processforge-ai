import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { agentSopRequestSchema } from "../lib/agent/contract.ts";

const middlewareSource = readFileSync(
  resolve("lib/agent/official-x402-middleware.ts"),
  "utf8",
);
const routeSource = readFileSync(
  resolve("app/api/agent/generate-sop/route.ts"),
  "utf8",
);

async function mockProxy({ paymentResult, route }) {
  if (paymentResult) return paymentResult;
  return route();
}

function createPaidEndpointHarness() {
  const completedPayments = new Map();
  let generationCount = 0;

  return {
    get generationCount() {
      return generationCount;
    },
    async request({ verifiedPaymentId, body }) {
      if (!verifiedPaymentId) {
        return Response.json(
          { error: { code: "PAYMENT_REQUIRED" } },
          { status: 402 },
        );
      }

      const parsed = agentSopRequestSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: { code: "INVALID_REQUEST" } },
          { status: 400 },
        );
      }

      const completedResponse = completedPayments.get(verifiedPaymentId);
      if (completedResponse) {
        return Response.json(completedResponse, {
          status: 200,
          headers: { "x-idempotent-replay": "true" },
        });
      }

      generationCount += 1;
      const response = {
        sop: {
          title: parsed.data.title,
          sections: [],
        },
      };
      completedPayments.set(verifiedPaymentId, response);
      return Response.json(response, { status: 200 });
    },
  };
}

const validRequestBody = {
  title: "Daily Restaurant Opening Procedure",
  description: "Create a short professional opening SOP",
  industry: "Restaurant",
  department: "Operations",
  audience: "Shift Manager and Opening Staff",
  requirements: ["Keep the SOP concise and professional."],
};

test("unpaid request is stopped by middleware before the route", async () => {
  let routeCalls = 0;
  const response = await mockProxy({
    paymentResult: Response.json(
      { error: { code: "PAYMENT_REQUIRED" } },
      { status: 402 },
    ),
    route: () => {
      routeCalls += 1;
      return Response.json({ sop: {} });
    },
  });

  assert.equal(response.status, 402);
  assert.equal(routeCalls, 0);
});

test("verified request reaches the route exactly once and returns HTTP 200", async () => {
  let routeCalls = 0;
  const response = await mockProxy({
    paymentResult: null,
    route: () => {
      routeCalls += 1;
      return Response.json({ sop: {} }, { status: 200 });
    },
  });

  assert.equal(response.status, 200);
  assert.equal(routeCalls, 1);
});

test("verified payment without Idempotency-Key returns HTTP 200", async () => {
  const endpoint = createPaidEndpointHarness();
  const response = await endpoint.request({
    verifiedPaymentId: "pay_verified_without_client_key",
    body: validRequestBody,
  });

  assert.equal(response.status, 200);
  assert.equal(endpoint.generationCount, 1);
});

test("duplicate replay uses the completed payment response without generating twice", async () => {
  const endpoint = createPaidEndpointHarness();
  const request = {
    verifiedPaymentId: "pay_duplicate_replay",
    body: validRequestBody,
  };

  const firstResponse = await endpoint.request(request);
  const replayResponse = await endpoint.request(request);

  assert.equal(firstResponse.status, 200);
  assert.equal(replayResponse.status, 200);
  assert.equal(replayResponse.headers.get("x-idempotent-replay"), "true");
  assert.equal(endpoint.generationCount, 1);
  assert.deepEqual(await replayResponse.json(), await firstResponse.json());
});

test("invalid request body returns HTTP 400 after payment verification", async () => {
  const endpoint = createPaidEndpointHarness();
  const response = await endpoint.request({
    verifiedPaymentId: "pay_invalid_body",
    body: { title: "Incomplete request" },
  });

  assert.equal(response.status, 400);
  assert.equal(endpoint.generationCount, 0);
});

test("middleware matches the exact paid route and route has no duplicate payment guard", () => {
  assert.match(
    middlewareSource,
    /request\.method !== "POST" \|\| request\.nextUrl\.pathname !== "\/api\/agent\/generate-sop"/,
  );
  assert.match(middlewareSource, /"POST \/api\/agent\/generate-sop"/);
  assert.doesNotMatch(
    routeSource,
    /A successfully settled payment is required|findAgentRequest|findAgentPayment|headers\.get\(["']idempotency-key["']\)/i,
  );
  assert.doesNotMatch(
    middlewareSource,
    /A valid Idempotency-Key header|headers\.get\(["']idempotency-key["']\)/i,
  );
  assert.match(middlewareSource, /verifiedPaymentReplayKey/);
  assert.match(
    middlewareSource,
    /const nonce = authorization\?\.nonce \?\? permit2Authorization\?\.nonce/,
  );
  assert.match(middlewareSource, /x-idempotent-replay/);
  assert.match(routeSource, /route_handler_entered/);
  assert.match(routeSource, /sop_response_status/);
});
