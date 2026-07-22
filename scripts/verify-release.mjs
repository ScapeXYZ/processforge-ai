import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const baseUrl = process.env.RELEASE_TEST_BASE_URL || process.env.AGENT_TEST_BASE_URL || "http://localhost:3000";
const expectedNetwork = "eip155:1952";
const results = [];
const pass = (name, detail = "") => results.push({ name, status: "pass", detail });
const assert = (condition, name, detail) => { if (!condition) throw new Error(`${name}: ${detail}`); pass(name, detail); };
const request = async (path, init) => { const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", ...init }); const text = await response.text(); let body = null; try { body = JSON.parse(text); } catch { body = text; } return { response, body, text }; };

const home = await request("/"); assert(home.response.status === 200, "Application responds", `HTTP ${home.response.status}`);
const metadata = await request("/api/agent"); assert(metadata.response.status === 200, "Agent metadata", `HTTP ${metadata.response.status}`);
const health = await request("/api/agent/health"); assert(health.response.status === 200, "Agent health", `HTTP ${health.response.status}`);
const getPaid = await request("/api/agent/generate-sop"); assert(getPaid.response.status === 405, "Paid endpoint method", `HTTP ${getPaid.response.status}`);
const baseHeaders = { "content-type": "application/json", "idempotency-key": `release-${Date.now()}` };
const invalid = await request("/api/agent/generate-sop", { method: "POST", headers: baseHeaders, body: "{}" }); assert(invalid.response.status === 400, "Invalid paid request", `HTTP ${invalid.response.status}`);
const payload = { title: "Supplier invoice approval", description: "When a supplier invoice arrives, Accounting validates it, records approval evidence within two business days, escalates exceptions, and schedules payment.", industry: "Finance", department: "Accounting", audience: "Accounts payable team", requirements: ["Define approval and exception evidence"], output_format: "json" };
const key = `${baseHeaders["idempotency-key"]}-mock`;
const unpaid = await request("/api/agent/generate-sop", { method: "POST", headers: { ...baseHeaders, "idempotency-key": key }, body: JSON.stringify(payload) });
assert(unpaid.response.status === 402, "Unpaid x402 response", `HTTP ${unpaid.response.status}`);
const network = unpaid.body?.x402?.accepts?.[0]?.network; assert(network === expectedNetwork, "Development network", String(network));
assert(Boolean(unpaid.response.headers.get("payment-required")), "Payment requirement header", "present");
const token = unpaid.response.headers.get("x-mock-payment-token") || unpaid.body?.mock_payment?.token;
assert(Boolean(token), "Mock payment challenge", "present");
const paid = await request("/api/agent/generate-sop", { method: "POST", headers: { ...baseHeaders, "idempotency-key": key, "payment-signature": token }, body: JSON.stringify(payload) });
assert(paid.response.status === 200 && paid.body?.status === "completed" && paid.body?.sop && paid.body?.analytics && paid.body?.compliance, "Mock paid retry", `HTTP ${paid.response.status}`);

const serializedPublic = `${metadata.text}\n${health.text}`.toLowerCase();
const forbiddenNames = ["openai_api_key", "supabase_service_role_key", "okx_x402_api_key", "okx_x402_secret_key", "okx_x402_passphrase", "authorization", "payment-signature"];
assert(forbiddenNames.every(name => !serializedPublic.includes(name)), "Public response secret fields", "none found");
const secretValues = [process.env.OPENAI_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.OKX_X402_API_KEY, process.env.OKX_X402_SECRET_KEY, process.env.OKX_X402_PASSPHRASE].filter(value => typeof value === "string" && value.length >= 8);
assert(secretValues.every(value => !metadata.text.includes(value) && !health.text.includes(value)), "Public response secret values", "none found");

const routeExpectations = [
  ["/marketplace", "public"], ["/login", "public"], ["/signup", "public"], ["/forgot-password", "public"], ["/agent-docs", "public"],
  ["/dashboard", "protected"], ["/create", "protected"], ["/history", "protected"], ["/versions", "protected"], ["/knowledge-base", "protected"], ["/analytics", "protected"], ["/compliance", "protected"], ["/workspaces", "protected"], ["/templates", "protected"], ["/settings", "protected"],
];
for (const [path, access] of routeExpectations) { const route = await request(path); assert(route.response.status !== 404, `Route ${path}`, `${access}; HTTP ${route.response.status}`); }

const envExample = readFileSync(resolve(".env.example"), "utf8");
const documentedEnv = ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL", "MARKETPLACE_AUTO_APPROVE", "OKX_X402_ENABLED", "OKX_X402_NETWORK", "OKX_X402_PAY_TO_ADDRESS", "OKX_X402_ASSET", "OKX_X402_PRICE", "OKX_X402_FACILITATOR_URL", "OKX_X402_API_KEY", "OKX_X402_SECRET_KEY", "OKX_X402_PASSPHRASE", "OKX_X402_TIMEOUT_SECONDS", "ENABLE_RELEASE_CHECK"];
assert(documentedEnv.every(name => new RegExp(`^${name}=`, "m").test(envExample)), "Environment documentation", `${documentedEnv.length} variables present`);
const migrations = ["202607210001_initial_cloud_schema.sql", "202607220001_team_collaboration.sql", "202607220007_sop_analytics.sql", "202607220008_compliance_audit_center.sql", "202607220009_public_template_marketplace.sql", "202607220010_repair_partial_marketplace_schema.sql", "202607220011_okx_x402_agent_service.sql"];
assert(migrations.every(file => existsSync(resolve("supabase/migrations", file))), "Required migrations", `${migrations.length} files present`);
assert(existsSync(resolve(".next/BUILD_ID")) || existsSync(resolve(".next/build-manifest.json")), "Production build artifact", "run npm run build before release verification");

console.log(JSON.stringify({ status: "pass", base_url: baseUrl, checks: results }, null, 2));
