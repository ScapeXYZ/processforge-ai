import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSettledRequestHeaders,
  INTERNAL_PAYMENT_KEY_HEADER,
  INTERNAL_PAYMENT_REQUEST_ID_HEADER,
  readSettledPaymentHandoff,
} from "../lib/agent/payment-internal.ts";

function simulateSettledMiddleware(incoming) {
  return buildSettledRequestHeaders(incoming, {
    replayKey: "verified-replay-key",
    requestId: "975ffbba-a537-4366-acf9-305851da3454",
  });
}

function simulateRoute(headers) {
  const handoff = readSettledPaymentHandoff(headers);
  return new Response(JSON.stringify(handoff ? { sop: {} } : {
    error: { code: "PAYMENT_REQUIRED" },
  }), {
    status: handoff ? 200 : 402,
    headers: { "content-type": "application/json" },
  });
}

test("settled middleware forwards only allowlisted and internal headers", () => {
  const incoming = new Headers({
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": "test-client",
    "x-forwarded-for": "203.0.113.10",
    "x-forwarded-proto": "https",
    "x-forwarded-host": "processforge-ai.onrender.com",
    "payment-signature": "sensitive-payment-proof",
    "x-payment": "legacy-sensitive-proof",
    authorization: "Bearer sensitive",
    cookie: "session=sensitive",
    "x-unnecessary-header": "drop-me",
  });
  const headers = simulateSettledMiddleware(incoming);

  assert.deepEqual(readSettledPaymentHandoff(headers), {
    replayKey: "verified-replay-key",
    requestId: "975ffbba-a537-4366-acf9-305851da3454",
  });
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("accept"), "application/json");
  assert.equal(headers.get("user-agent"), "test-client");
  assert.equal(headers.get("payment-signature"), null);
  assert.equal(headers.get("x-payment"), null);
  assert.equal(headers.get("authorization"), null);
  assert.equal(headers.get("cookie"), null);
  assert.equal(headers.get("x-unnecessary-header"), null);
});

test("both internal handoff headers reach the settled route", async () => {
  const headers = simulateSettledMiddleware(new Headers({
    "content-type": "application/json",
  }));
  assert.equal(headers.get(INTERNAL_PAYMENT_KEY_HEADER), "verified-replay-key");
  assert.equal(
    headers.get(INTERNAL_PAYMENT_REQUEST_ID_HEADER),
    "975ffbba-a537-4366-acf9-305851da3454",
  );
  const response = simulateRoute(headers);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sop: {} });
});

test("missing or partial settled handoff remains HTTP 402", async () => {
  const missing = simulateRoute(new Headers());
  assert.equal(missing.status, 402);
  assert.equal((await missing.json()).error.code, "PAYMENT_REQUIRED");

  const partial = simulateRoute(new Headers({
    [INTERNAL_PAYMENT_KEY_HEADER]: "verified-replay-key",
  }));
  assert.equal(partial.status, 402);
});
