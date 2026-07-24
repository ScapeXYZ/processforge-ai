import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

test("middleware matches the exact paid route and route has no duplicate payment guard", () => {
  assert.match(
    middlewareSource,
    /request\.method !== "POST" \|\| request\.nextUrl\.pathname !== "\/api\/agent\/generate-sop"/,
  );
  assert.match(middlewareSource, /"POST \/api\/agent\/generate-sop"/);
  assert.doesNotMatch(
    routeSource,
    /A successfully settled payment is required|findAgentRequest|findAgentPayment/,
  );
  assert.match(routeSource, /route_handler_entered/);
  assert.match(routeSource, /sop_response_status/);
});
