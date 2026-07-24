import test from "node:test";
import assert from "node:assert/strict";
import {
  extractVerifiedPaymentIdentity,
  normalizeOfficialVerificationResult,
  safeRawVerificationShape,
  safeVerificationShape,
} from "../lib/agent/verified-payment-identity.ts";

const payer = "0x420aaab19b165b80e19bf4c712216f7fc04c60fb";
const payTo = "0x309fec7f0baf95f377924be4be3fc423dea7aa88";
const resource = "https://processforgeai.xyz/api/agent/generate-sop";
const nonce = `0x${"12".repeat(32)}`;
const requirements = {
  scheme: "exact",
  network: "eip155:196",
  asset: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
  amount: "10000",
  payTo,
  maxTimeoutSeconds: 300,
  resource,
};
const paymentPayload = {
  x402Version: 2,
  accepted: requirements,
  payload: {
    signature: `0x${"34".repeat(65)}`,
    authorization: {
      from: payer,
      to: payTo,
      value: "10000",
      validAfter: "0",
      validBefore: "9999999999",
      nonce,
    },
  },
};

test("official verification result without a top-level payer derives the payer from authorization", () => {
  const identity = extractVerifiedPaymentIdentity({
    paymentPayload,
    requirements,
    result: { isValid: true },
    resource,
  });

  assert.ok(identity);
  assert.equal(identity.payer, payer);
  assert.equal(identity.nonce, nonce);
  assert.equal(identity.network, "eip155:196");
  assert.equal(identity.amount, "10000");
});

test("official array and object verification response shapes normalize identically", () => {
  const objectResponse = { isValid: true, payer };
  const arrayResponse = [{ isValid: true, payer }];

  assert.deepEqual(
    normalizeOfficialVerificationResult(arrayResponse),
    normalizeOfficialVerificationResult(objectResponse),
  );
  assert.deepEqual(safeRawVerificationShape(arrayResponse), {
    responseKind: "array",
    responseKeys: [],
    itemKeys: ["isValid", "payer"],
  });
});

test("identity is stable across supported verification results with and without payer", () => {
  const withoutPayer = extractVerifiedPaymentIdentity({
    paymentPayload,
    requirements,
    result: { isValid: true },
    resource,
  });
  const withPayer = extractVerifiedPaymentIdentity({
    paymentPayload,
    requirements,
    result: { isValid: true, payer: payer.toUpperCase() },
    resource,
  });

  assert.ok(withoutPayer);
  assert.ok(withPayer);
  assert.equal(withPayer.replayKey, withoutPayer.replayKey);
});

test("safe verification logging exposes keys but no signature or authorization values", () => {
  const shape = safeVerificationShape({
    paymentPayload,
    result: { isValid: true },
  });
  const serialized = JSON.stringify(shape);

  assert.deepEqual(shape.resultKeys, ["isValid"]);
  assert.deepEqual(shape.payloadKeys, ["authorization", "signature"]);
  assert.ok(shape.authorizationKeys.includes("nonce"));
  assert.doesNotMatch(serialized, new RegExp(nonce, "i"));
  assert.doesNotMatch(serialized, new RegExp(payer, "i"));
});

test("malformed verification result is rejected", () => {
  assert.equal(
    extractVerifiedPaymentIdentity({
      paymentPayload: {
        ...paymentPayload,
        payload: { signature: paymentPayload.payload.signature, authorization: {} },
      },
      requirements,
      result: { isValid: true },
      resource,
    }),
    null,
  );
  assert.equal(
    extractVerifiedPaymentIdentity({
      paymentPayload,
      requirements,
      result: { isValid: false },
      resource,
    }),
    null,
  );
});

test("valid verified replay reaches settlement", async () => {
  let settlementCalls = 0;
  const result = normalizeOfficialVerificationResult([{ isValid: true }]);
  assert.ok(result);
  const identity = extractVerifiedPaymentIdentity({
    paymentPayload,
    requirements,
    result,
    resource,
  });

  if (identity) settlementCalls += 1;

  assert.ok(identity);
  assert.equal(settlementCalls, 1);
});
