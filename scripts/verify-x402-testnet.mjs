import { decodePaymentRequiredHeader } from "@okxweb3/x402-core/http";

const NETWORK = "eip155:1952";
const ASSET = "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c";
const AMOUNT = "10000";
const target = new URL(
  process.env.TESTNET_DEPLOYMENT_URL
  || process.env.DEPLOYMENT_URL
  || "http://localhost:3000",
);
const request = async (path, init = {}) => {
  const response = await fetch(new URL(path, target), {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body, text };
};
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const metadata = await request("/api/agent");
assert(metadata.response.status === 200, `metadata HTTP status: expected 200, received ${metadata.response.status}`);
const health = await request("/api/agent/health");
assert(health.response.status === 200, `health HTTP status: expected 200, received ${health.response.status}`);
assert(health.body?.status === "healthy", `health status: expected healthy, received ${JSON.stringify(health.body?.status)}`);
const pricing = metadata.body?.pricing;
const payment = health.body?.payment_configuration;
assert(pricing?.enabled === true, `pricing.enabled: expected true, received ${JSON.stringify(pricing?.enabled)}`);
assert(pricing?.network === NETWORK, `pricing.network: expected ${NETWORK}, received ${JSON.stringify(pricing?.network)}`);
assert(pricing?.asset === "USDT", `pricing.asset: expected USDT, received ${JSON.stringify(pricing?.asset)}`);
assert(pricing?.asset_address?.toLowerCase() === ASSET, `pricing.asset_address: expected ${ASSET}, received ${JSON.stringify(pricing?.asset_address)}`);
assert(pricing?.asset_decimals === 6, `pricing.asset_decimals: expected 6, received ${JSON.stringify(pricing?.asset_decimals)}`);
assert(String(pricing?.amount) === AMOUNT, `pricing.amount: expected ${AMOUNT}, received ${JSON.stringify(pricing?.amount)}`);
assert(/^0x[a-fA-F0-9]{40}$/.test(pricing?.pay_to || ""), `pricing.pay_to: expected an EVM address, received ${JSON.stringify(pricing?.pay_to)}`);
assert(payment?.status === "testnet-ready", `payment status: expected testnet-ready, received ${JSON.stringify(payment?.status)}`);
assert(payment?.provider === "okx-official", `provider: expected okx-official, received ${JSON.stringify(payment?.provider)}`);
assert(payment?.network === NETWORK, `health network: expected ${NETWORK}, received ${JSON.stringify(payment?.network)}`);
assert(payment?.facilitator_authentication === "configured", `facilitator authentication: expected configured, received ${JSON.stringify(payment?.facilitator_authentication)}`);

const get = await request("/api/agent/generate-sop");
assert(get.response.status === 405, `GET paid endpoint: expected 405, received ${get.response.status}`);
const headers = {
  "content-type": "application/json",
  "idempotency-key": `testnet-verify-${crypto.randomUUID()}`,
};
const invalid = await request("/api/agent/generate-sop", { method: "POST", headers, body: "{}" });
assert(invalid.response.status === 402, `unpaid invalid POST: expected 402, received ${invalid.response.status}`);
assert(invalid.response.headers.get("payment-required"), "unpaid invalid POST is missing payment-required");
const body = {
  title: "X Layer testnet verification",
  description: "Operations validates a request, records evidence, obtains approval, and escalates exceptions.",
  industry: "Technology",
  department: "Operations",
  audience: "Operations team",
  output_format: "json",
};
const unpaid = await request("/api/agent/generate-sop", {
  method: "POST",
  headers: { ...headers, "idempotency-key": `${headers["idempotency-key"]}-unpaid` },
  body: JSON.stringify(body),
});
assert(unpaid.response.status === 402, `valid unpaid POST: expected 402, received ${unpaid.response.status}: ${unpaid.text}`);
const encoded = unpaid.response.headers.get("payment-required");
assert(encoded, "valid unpaid POST did not include payment-required");
const challenge = decodePaymentRequiredHeader(encoded);
const requirement = challenge?.accepts?.[0];
const expectedResource = new URL("/api/agent/generate-sop", target).href;
assert(challenge?.x402Version === 2, `x402Version: expected 2, received ${JSON.stringify(challenge?.x402Version)}`);
assert(challenge?.resource?.url === expectedResource, `resource: expected ${expectedResource}, received ${JSON.stringify(challenge?.resource?.url)}`);
assert(requirement?.scheme === "exact", `scheme: expected exact, received ${JSON.stringify(requirement?.scheme)}`);
assert(requirement?.network === NETWORK, `network: expected ${NETWORK}, received ${JSON.stringify(requirement?.network)}`);
assert(requirement?.asset?.toLowerCase() === ASSET, `asset: expected ${ASSET}, received ${JSON.stringify(requirement?.asset)}`);
assert(String(requirement?.amount) === AMOUNT, `amount: expected ${AMOUNT}, received ${JSON.stringify(requirement?.amount)}`);
assert(requirement?.payTo?.toLowerCase() === pricing.pay_to.toLowerCase(), `recipient: expected ${pricing.pay_to}, received ${JSON.stringify(requirement?.payTo)}`);
assert(requirement?.extra?.name === "USD₮0", `EIP-712 name: expected USD₮0, received ${JSON.stringify(requirement?.extra?.name)}`);
assert(requirement?.extra?.version === "1", `EIP-712 version: expected 1, received ${JSON.stringify(requirement?.extra?.version)}`);

const publicText = `${metadata.text}\n${health.text}\n${unpaid.text}`.toLowerCase();
for (const forbidden of [
  "okx_x402_api_key",
  "okx_x402_secret_key",
  "okx_x402_passphrase",
  "supabase_service_role_key",
  "private_key",
  "payment-signature",
]) {
  assert(!publicText.includes(forbidden), `public response exposed forbidden field ${forbidden}`);
}

console.log(JSON.stringify({
  status: "pass",
  target: target.origin,
  network: requirement.network,
  asset: requirement.asset,
  amount_atomic: requirement.amount,
  recipient: requirement.payTo,
  resource: challenge.resource.url,
  payment: "not attempted",
}, null, 2));
