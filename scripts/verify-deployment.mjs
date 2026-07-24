const rawTarget = process.argv[2] || process.env.DEPLOYMENT_URL;
if (!rawTarget) throw new Error("Set DEPLOYMENT_URL or pass the deployment URL as the first argument.");
const target = new URL(rawTarget);
if (target.protocol !== "https:" && process.env.ALLOW_INSECURE_DEPLOYMENT_TEST !== "true") throw new Error("Deployment verification requires HTTPS.");
const baseUrl = target.origin;
const timeout = () => AbortSignal.timeout(20_000);
const request = async (path, init = {}) => { const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", signal: timeout(), ...init }); const text = await response.text(); let body; try { body = JSON.parse(text); } catch { body = text; } return { response, text, body }; };
const checks = [];
const assert = (condition, name, detail = "") => { if (!condition) throw new Error(`${name}: ${detail}`); checks.push({ name, status: "pass", detail }); };

for (const path of ["/", "/login", "/marketplace", "/privacy", "/terms"]) { const result = await request(path); assert(result.response.status === 200, `Public route ${path}`, `HTTP ${result.response.status}`); }
const appHealth = await request("/api/health"); assert(appHealth.response.status === 200, "Application health", `HTTP ${appHealth.response.status}`);
const metadata = await request("/api/agent"); assert(metadata.response.status === 200, "Agent metadata", `HTTP ${metadata.response.status}`);
const agentHealth = await request("/api/agent/health"); assert(agentHealth.response.status === 200, "Agent health", `HTTP ${agentHealth.response.status}`);
const publicPayload = `${metadata.text}\n${agentHealth.text}\n${appHealth.text}`;
const expectedOrigin = target.origin.toLowerCase();
for (const url of [metadata.body?.provider_url, metadata.body?.health_url, metadata.body?.documentation_url, metadata.body?.available_services?.[0]?.endpoint]) assert(typeof url === "string" && new URL(url).origin.toLowerCase() === expectedOrigin, "Metadata production origin", String(url));
assert(!/(localhost|127\.0\.0\.1|:\d{4,5}\b|\.vercel\.app)/i.test(publicPayload), "No development or temporary URLs", "none exposed");
const forbidden = ["openai_api_key", "service_role", "okx_x402_api_key", "okx_x402_secret_key", "okx_x402_passphrase", "authorization", "payment-signature"];
assert(forbidden.every((value) => !publicPayload.toLowerCase().includes(value)), "No secret fields", "none exposed");
const home = await request("/");
for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options", "strict-transport-security"]) assert(Boolean(home.response.headers.get(header)), `Security header ${header}`, "present");
const paidGet = await request("/api/agent/generate-sop"); assert(paidGet.response.status === 405, "Paid endpoint rejects GET", `HTTP ${paidGet.response.status}`);
const headers = { "content-type": "application/json", "idempotency-key": `deployment-${Date.now()}` };
const invalid = await request("/api/agent/generate-sop", { method: "POST", headers, body: "{}" });
if (metadata.body?.pricing?.enabled) { assert(invalid.response.status === 402, "Unpaid invalid request receives payment challenge", `HTTP ${invalid.response.status}`); assert(invalid.response.headers.get("payment-required"), "Unpaid invalid request challenge header", "present"); const payload = { title: "Deployment verification", description: "When a request arrives, Operations validates it, records evidence, and escalates exceptions.", industry: "Technology", department: "Operations", audience: "Operations team", output_format: "json" }; const unpaid = await request("/api/agent/generate-sop", { method: "POST", headers: { ...headers, "idempotency-key": `${headers["idempotency-key"]}-unpaid` }, body: JSON.stringify(payload) }); assert(unpaid.response.status === 402, "Unpaid production request", `HTTP ${unpaid.response.status}`); }
else { assert(invalid.response.status === 400, "Disabled invalid request validation", `HTTP ${invalid.response.status}`); checks.push({ name: "Unpaid production request", status: "skipped", detail: "Payments are disabled; no payment was attempted." }); }
for (const path of ["/dashboard", "/settings", "/workspaces"]) { const result = await request(path); assert([301, 302, 303, 307, 308, 401, 403].includes(result.response.status), `Protected route ${path}`, `HTTP ${result.response.status}`); }
console.log(JSON.stringify({ status: "pass", target: baseUrl, checks }, null, 2));
