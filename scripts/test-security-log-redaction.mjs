import test from "node:test";
import assert from "node:assert/strict";
import { redactLogFields } from "../lib/security/log-redaction.ts";

test("structural diagnostic fields are retained", () => {
  const safe = redactLogFields({
    authorization_exists: true,
    authorization_signature_exists: false,
    verification_keys: ["isValid", "invalidReason", "payer", "extensions"],
    response_kind: "object",
    settlement_status: "settled",
    retry_count: 1,
  });

  assert.deepEqual(safe, {
    authorization_exists: true,
    authorization_signature_exists: false,
    verification_keys: ["isValid", "invalidReason", "payer", "extensions"],
    response_kind: "object",
    settlement_status: "settled",
    retry_count: 1,
  });
});

test("sensitive values remain redacted even when structural suffixes are misused", () => {
  const safe = redactLogFields({
    private_key: "0xprivate",
    payment_signature: "0xsignature",
    authorization: { from: "0xaddress" },
    cookie: "session=secret",
    access_token: "token-value",
    client_secret: "secret-value",
    wallet_address: "0xwallet",
    authorization_nonce: "0xnonce",
    payment_payload: { signature: "0xsignature" },
    private_key_exists: "0xprivate",
    authorization_keys: ["0x0123456789abcdef"],
  });

  assert.deepEqual(safe, {});
});
