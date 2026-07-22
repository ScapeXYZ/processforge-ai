const baseUrl = process.env.AGENT_TEST_BASE_URL || "http://localhost:3000";
const expectedNetwork = process.env.OKX_X402_NETWORK || (process.env.NODE_ENV === "production" ? "eip155:196" : "eip155:1952");
const body = { title: "Invoice approval", description: "When an invoice arrives, accounting validates it, obtains approval within two days, records evidence, and schedules payment.", industry: "Finance", department: "Accounting", audience: "Accounts payable team", requirements: ["Define approval evidence"], output_format: "json" };
const headers = { "content-type": "application/json", "idempotency-key": `verify-${Date.now()}` };
const get = (url, init = {}) => fetch(url, { signal: AbortSignal.timeout(15_000), ...init });

const health = await get(`${baseUrl}/api/agent/health`);
const healthBody = await health.json();
if (health.status !== 200 || !healthBody || typeof healthBody.status !== "string" || !healthBody.payment_configuration || !healthBody.ai_provider || !healthBody.timestamp || !healthBody.version) throw new Error(`Health endpoint failed (${health.status}).`);

const metadata = await get(`${baseUrl}/api/agent`);
const metadataBody = await metadata.json();
if (metadata.status !== 200 || metadataBody?.name !== "ProcessForge AI") throw new Error(`Metadata endpoint failed (${metadata.status}).`);

const methodCheck = await get(`${baseUrl}/api/agent/generate-sop`);
if (methodCheck.status !== 405) throw new Error(`Expected GET to return 405, received ${methodCheck.status}.`);

const malformed = await get(`${baseUrl}/api/agent/generate-sop`, { method: "POST", headers, body: "{}" });
if (malformed.status !== 400) throw new Error(`Expected malformed request to return 400, received ${malformed.status}.`);

const paidIdempotencyKey = `${headers["idempotency-key"]}-mock`;
const unpaid = await get(`${baseUrl}/api/agent/generate-sop`, { method: "POST", headers: { ...headers, "idempotency-key": paidIdempotencyKey }, body: JSON.stringify(body) });
const unpaidBody = await unpaid.json();
if (unpaid.status !== 402) throw new Error(`Expected unpaid request to return 402, received ${unpaid.status}: ${JSON.stringify(unpaidBody)}`);
const network = unpaidBody?.x402?.accepts?.[0]?.network;
if (network !== expectedNetwork) throw new Error(`Expected network ${expectedNetwork}, received ${network}.`);
if (!unpaid.headers.get("payment-required")) throw new Error("Missing standards-compliant payment-required header.");
const mockToken = unpaid.headers.get("x-mock-payment-token") || unpaidBody?.mock_payment?.token;
if (!mockToken) throw new Error("Mock payment token was not advertised in development mode.");
const mockPaid = await get(`${baseUrl}/api/agent/generate-sop`, { method: "POST", headers: { ...headers, "idempotency-key": paidIdempotencyKey, "payment-signature": mockToken }, body: JSON.stringify(body) });
const mockResult = await mockPaid.json();
if (mockPaid.status !== 200 || mockResult?.status !== "completed" || !mockResult?.sop || !mockResult?.analytics || !mockResult?.compliance) throw new Error(`Mock paid retry failed (${mockPaid.status}): ${JSON.stringify(mockResult)}`);
console.log(JSON.stringify({ metadata: "pass", health: healthBody.status, method_check: "pass", invalid_request: "pass", unpaid_status: unpaid.status, mock_paid_status: mockPaid.status, advertised_network: network }, null, 2));

const proof = process.env.OKX_X402_PAYMENT_HEADER;
if (proof) {
  const paid = await get(`${baseUrl}/api/agent/generate-sop`, { method: "POST", headers: { ...headers, "idempotency-key": `${headers["idempotency-key"]}-paid`, "payment-signature": proof }, body: JSON.stringify(body) });
  const result = await paid.json();
  if (!paid.ok || result?.status !== "completed" || !result?.sop || !result?.analytics || !result?.compliance) throw new Error(`Paid response validation failed (${paid.status}).`);
  console.log(JSON.stringify({ paid_status: paid.status, request_id: result.request_id, schema_version: result.schema_version }, null, 2));
} else console.log("Official paid retry skipped; deterministic development mock flow passed.");
