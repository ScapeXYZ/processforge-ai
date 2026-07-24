import test from "node:test";
import assert from "node:assert/strict";
import {
  createSettledPaymentHeaders,
  INTERNAL_PAYMENT_KEY_HEADER,
  INTERNAL_PAYMENT_REQUEST_ID_HEADER,
  readSettledPaymentHandoff,
} from "../lib/agent/payment-internal.ts";

test("settled middleware handoff overwrites untrusted values and reaches the route", () => {
  const incoming = new Headers({
    [INTERNAL_PAYMENT_KEY_HEADER]: "untrusted-key",
    [INTERNAL_PAYMENT_REQUEST_ID_HEADER]: "untrusted-request",
  });
  const headers = createSettledPaymentHeaders(incoming, {
    replayKey: "verified-replay-key",
    requestId: "975ffbba-a537-4366-acf9-305851da3454",
  });

  assert.deepEqual(readSettledPaymentHandoff(headers), {
    replayKey: "verified-replay-key",
    requestId: "975ffbba-a537-4366-acf9-305851da3454",
  });
});

test("missing or partial settled handoff remains unpaid", () => {
  assert.equal(readSettledPaymentHandoff(new Headers()), null);
  assert.equal(readSettledPaymentHandoff(new Headers({
    [INTERNAL_PAYMENT_KEY_HEADER]: "verified-replay-key",
  })), null);
});
