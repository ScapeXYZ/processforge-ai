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

test("both internal handoff headers are readable by the route", () => {
  const headers = simulateSettledMiddleware(new Headers({
    "content-type": "application/json",
  }));
  assert.equal(headers.get(INTERNAL_PAYMENT_KEY_HEADER), "verified-replay-key");
  assert.equal(
    headers.get(INTERNAL_PAYMENT_REQUEST_ID_HEADER),
    "975ffbba-a537-4366-acf9-305851da3454",
  );
  assert.deepEqual(readSettledPaymentHandoff(headers), {
    replayKey: "verified-replay-key",
    requestId: "975ffbba-a537-4366-acf9-305851da3454",
  });
});

test("missing or partial optional handoff is absent", () => {
  assert.equal(readSettledPaymentHandoff(new Headers()), null);
  assert.equal(readSettledPaymentHandoff(new Headers({
    [INTERNAL_PAYMENT_KEY_HEADER]: "verified-replay-key",
  })), null);
});
