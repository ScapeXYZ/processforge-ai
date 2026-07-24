import { decodePaymentRequiredHeader } from "@okxweb3/x402-core/http";

const production = process.argv.includes("--production");
const target = new URL(
  process.env.DEPLOYMENT_URL
  || process.env.AGENT_TEST_BASE_URL
  || (production ? "https://processforgeai.xyz" : "http://localhost:3000"),
);
if (production && target.protocol !== "https:") {
  throw new Error("Production x402 verification requires HTTPS.");
}
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
assert(metadata.response.status === 200, `metadata: expected HTTP 200, received ${metadata.response.status}`);
const health = await request("/api/agent/health");
assert(health.response.status === 200, `health: expected HTTP 200, received ${health.response.status}`);
const method = await request("/api/agent/generate-sop");
assert(method.response.status === 405, `GET paid endpoint: expected HTTP 405, received ${method.response.status}`);

const headers = {
  "content-type": "application/json",
};
const invalid = await request("/api/agent/generate-sop", {
  method: "POST",
  headers,
  body: "{}",
});

const validBody = {
  title: "Official x402 verification",
  description: "Operations validates a request, records evidence, obtains approval, and escalates exceptions.",
  industry: "Technology",
  department: "Operations",
  audience: "Operations team",
  output_format: "json",
};
const unpaid = await request("/api/agent/generate-sop", {
  method: "POST",
  headers,
  body: JSON.stringify(validBody),
});

const pricing = metadata.body?.pricing;
const paymentStatus = health.body?.payment_configuration;
assert(!unpaid.response.headers.get("x-mock-payment-token"), "legacy mock payment header must never be returned");

let requirement = null;
if (pricing?.enabled === true) {
  assert(invalid.response.status === 402, `unpaid invalid POST: expected HTTP 402, received ${invalid.response.status}`);
  assert(invalid.response.headers.get("payment-required"), "unpaid invalid POST is missing payment-required");
  assert(paymentStatus?.status === "ready", `payment health: expected ready, received ${JSON.stringify(paymentStatus?.status)}`);
  assert(paymentStatus?.provider === "okx-official", `payment provider: expected okx-official, received ${JSON.stringify(paymentStatus?.provider)}`);
  assert(unpaid.response.status === 402, `unpaid POST: expected HTTP 402, received ${unpaid.response.status}`);
  const encoded = unpaid.response.headers.get("payment-required");
  assert(encoded, "official 402 response is missing payment-required");
  const challenge = decodePaymentRequiredHeader(encoded);
  requirement = challenge?.accepts?.[0];
  assert(challenge?.x402Version === 2, `x402Version: expected 2, received ${JSON.stringify(challenge?.x402Version)}`);
  assert(challenge?.resource?.url === new URL("/api/agent/generate-sop", target).href, `resource: expected ${new URL("/api/agent/generate-sop", target).href}, received ${JSON.stringify(challenge?.resource?.url)}`);
  assert(requirement?.scheme === "exact", `scheme: expected exact, received ${JSON.stringify(requirement?.scheme)}`);
  assert(requirement?.network === "eip155:196", `network: expected eip155:196, received ${JSON.stringify(requirement?.network)}`);
  assert(/^0x[a-fA-F0-9]{40}$/.test(requirement?.asset || ""), `asset: expected EVM contract, received ${JSON.stringify(requirement?.asset)}`);
  assert(requirement.asset.toLowerCase() === pricing.asset_address?.toLowerCase(), `asset: expected ${JSON.stringify(pricing.asset_address)}, received ${JSON.stringify(requirement.asset)}`);
  assert(String(requirement.amount) === String(pricing.amount), `amount: expected ${JSON.stringify(pricing.amount)}, received ${JSON.stringify(requirement.amount)}`);
  assert(/^0x[a-fA-F0-9]{40}$/.test(requirement?.payTo || ""), `payTo: expected EVM address, received ${JSON.stringify(requirement?.payTo)}`);
} else {
  assert(invalid.response.status === 400, `disabled invalid POST: expected HTTP 400, received ${invalid.response.status}`);
  assert(paymentStatus?.status === "disabled", `disabled payment health: expected disabled, received ${JSON.stringify(paymentStatus?.status)}`);
  assert(unpaid.response.status === 503, `disabled paid endpoint: expected HTTP 503, received ${unpaid.response.status}`);
  assert(!unpaid.response.headers.get("payment-required"), "disabled service must not emit a payment challenge");
}

const publicOutput = `${metadata.text}\n${health.text}\n${unpaid.text}`.toLowerCase();
for (const secretName of [
  "okx_x402_api_key",
  "okx_x402_secret_key",
  "okx_x402_passphrase",
  "supabase_service_role_key",
  "payment-signature",
]) {
  assert(!publicOutput.includes(secretName), `public response exposed forbidden field ${secretName}`);
}

console.log(JSON.stringify({
  status: "pass",
  mode: pricing?.enabled ? "official-payment-ready" : "payments-disabled",
  target: target.origin,
  unpaid_status: unpaid.response.status,
  provider: paymentStatus?.provider ?? null,
  network: requirement?.network ?? pricing?.network ?? null,
  real_payment: "not attempted",
}, null, 2));
