import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const baseUrl = process.env.RELEASE_TEST_BASE_URL || process.env.AGENT_TEST_BASE_URL || "http://localhost:3000";
const configuredTimeout = Number(process.env.VERIFY_TIMEOUT_MS ?? 60_000);
const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 60_000;
const results = [];
const pass = (name, detail = "") => results.push({ name, status: "pass", detail });
const assert = (condition, name, detail) => { if (!condition) throw new Error(`${name}: ${detail}`); pass(name, detail); };
const request = async (path, init = {}, check = path) => { const url = `${baseUrl}${path}`; try { const response = await fetch(url, { redirect: "manual", ...init, signal: AbortSignal.timeout(timeoutMs) }); const text = await response.text(); let body = null; try { body = JSON.parse(text); } catch { body = text; } return { response, body, text }; } catch (error) { if (error instanceof DOMException && error.name === "TimeoutError") throw new Error(`Timed out after ${timeoutMs} ms while checking ${check}: ${url}`); throw new Error(`Request failed while checking ${check}: ${url}. ${error instanceof Error ? error.message : "Unknown network error."}`); } };

try {

const home = await request("/"); assert(home.response.status === 200, "Application responds", `HTTP ${home.response.status}`);
for (const header of ["content-security-policy", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options"]) assert(Boolean(home.response.headers.get(header)), `Security header ${header}`, "present");
const metadata = await request("/api/agent"); assert(metadata.response.status === 200, "Agent metadata", `HTTP ${metadata.response.status}`);
const health = await request("/api/agent/health"); assert(health.response.status === 200, "Agent health", `HTTP ${health.response.status}`);
assert(typeof metadata.body?.pricing?.enabled === "boolean", "Agent pricing state", String(metadata.body?.pricing?.enabled));
assert(["ready", "testnet-ready", "disabled"].includes(health.body?.payment_configuration?.status), "Agent payment status", String(health.body?.payment_configuration?.status));
const appHealth = await request("/api/health"); assert(appHealth.response.status === 200, "Application health", `HTTP ${appHealth.response.status}`);
const retiredInvitations = await request("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert(retiredInvitations.response.status === 410 && retiredInvitations.body?.error?.code === "INVITATIONS_NOT_AVAILABLE", "Retired invitation API", `HTTP ${retiredInvitations.response.status}`);
const retiredAcceptance = await request("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }); assert(retiredAcceptance.response.status === 410 && retiredAcceptance.body?.error?.code === "INVITATIONS_NOT_AVAILABLE", "Retired invitation acceptance API", `HTTP ${retiredAcceptance.response.status}`);
const removedAcceptancePage = await request("/invitations/accept"); assert(removedAcceptancePage.response.status === 404, "Removed invitation acceptance page", `HTTP ${removedAcceptancePage.response.status}`);
const getPaid = await request("/api/agent/generate-sop"); assert(getPaid.response.status === 405, "Paid endpoint method", `HTTP ${getPaid.response.status}`);
const baseHeaders = { "content-type": "application/json" };
const invalid = await request("/api/agent/generate-sop", { method: "POST", headers: baseHeaders, body: "{}" });
const payload = { title: "Supplier invoice approval", description: "When a supplier invoice arrives, Accounting validates it, records approval evidence within two business days, escalates exceptions, and schedules payment.", industry: "Finance", department: "Accounting", audience: "Accounts payable team", requirements: ["Define approval and exception evidence"], output_format: "json" };
const unpaid = await request("/api/agent/generate-sop", { method: "POST", headers: baseHeaders, body: JSON.stringify(payload) });
if (metadata.body?.pricing?.enabled) {
  assert(invalid.response.status === 400, "Invalid request rejected before payment", `HTTP ${invalid.response.status}`);
  assert(!invalid.response.headers.get("payment-required"), "Invalid request payment challenge", "absent");
  assert(unpaid.response.status === 402 && Boolean(unpaid.response.headers.get("payment-required")), "Official payment challenge", `HTTP ${unpaid.response.status}`);
} else {
  assert(invalid.response.status === 400, "Disabled invalid request validation", `HTTP ${invalid.response.status}`);
  assert(unpaid.response.status === 503 && unpaid.body?.error?.code === "SERVICE_BUSY", "Disabled paid endpoint", `HTTP ${unpaid.response.status}`);
  assert(!unpaid.response.headers.get("payment-required"), "No disabled payment challenge", "header absent");
}
assert(!unpaid.response.headers.get("x-mock-payment-token"), "No legacy mock challenge", "header absent");

const serializedPublic = `${metadata.text}\n${health.text}`.toLowerCase();
const forbiddenNames = ["openai_api_key", "supabase_service_role_key", "okx_x402_api_key", "okx_x402_secret_key", "okx_x402_passphrase", "authorization", "payment-signature"];
assert(forbiddenNames.every(name => !serializedPublic.includes(name)), "Public response secret fields", "none found");
const secretValues = [process.env.OPENAI_API_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.OKX_X402_API_KEY, process.env.OKX_X402_SECRET_KEY, process.env.OKX_X402_PASSPHRASE].filter(value => typeof value === "string" && value.length >= 8);
assert(secretValues.every(value => !metadata.text.includes(value) && !health.text.includes(value)), "Public response secret values", "none found");

const routeExpectations = [
  ["/marketplace", "public"], ["/login", "public"], ["/signup", "public"], ["/forgot-password", "public"], ["/agent-docs", "public"], ["/privacy", "public"], ["/terms", "public"], ["/acceptable-use", "public"], ["/ai-disclaimer", "public"], ["/data-handling", "public"],
  ["/dashboard", "protected"], ["/create", "protected"], ["/history", "protected"], ["/versions", "protected"], ["/knowledge-base", "protected"], ["/analytics", "protected"], ["/compliance", "protected"], ["/workspaces", "protected"], ["/templates", "protected"], ["/settings", "protected"],
];
for (const [path, access] of routeExpectations) { const route = await request(path); assert(route.response.status !== 404, `Route ${path}`, `${access}; HTTP ${route.response.status}`); }

const envExample = readFileSync(resolve(".env.example"), "utf8");
const documentedEnv = ["OPENAI_API_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "APP_BASE_URL", "MARKETPLACE_AUTO_APPROVE", "AGENT_PAID_GENERATION_ENABLED", "OKX_X402_ENABLED", "OKX_X402_NETWORK", "OKX_X402_PAY_TO_ADDRESS", "OKX_X402_ASSET", "OKX_X402_ASSET_ADDRESS", "OKX_X402_ASSET_DECIMALS", "OKX_X402_PRICE", "OKX_X402_FACILITATOR_URL", "OKX_X402_API_KEY", "OKX_X402_SECRET_KEY", "OKX_X402_PASSPHRASE", "OKX_X402_TIMEOUT_SECONDS", "OKX_X402_ALLOW_TESTNET_IN_PRODUCTION", "ENABLE_RELEASE_CHECK", "LOG_LEVEL", "RATE_LIMIT_STORE", "DEPLOYMENT_VERSION", "GIT_COMMIT_SHA"];
assert(documentedEnv.every(name => new RegExp(`^${name}=`, "m").test(envExample)), "Environment documentation", `${documentedEnv.length} variables present`);
assert(!/^NEXT_PUBLIC_(APP|SITE)_URL=/m.test(envExample), "Server-only application URL", "no public application URL variable");
for (const file of ["docs/PRODUCTION_DEPLOYMENT.md", "docs/PRODUCTION_CHECKLIST.md", "docs/CUSTOM_DOMAIN_CHECKLIST.md", ".env.production.example", ".github/workflows/ci.yml", "scripts/verify-deployment.mjs", "app/privacy/page.tsx", "app/terms/page.tsx", "app/acceptable-use/page.tsx", "app/ai-disclaimer/page.tsx", "app/data-handling/page.tsx"]) assert(existsSync(resolve(file)), `Required production artifact ${file}`, "present");
const officialMiddlewareSource = readFileSync(resolve("lib/agent/official-x402-middleware.ts"), "utf8");
assert(officialMiddlewareSource.includes("paymentProxy") && officialMiddlewareSource.includes("OKXFacilitatorClient"), "Official payment middleware", "OKX SDK wired");
const paymentStoreSource = readFileSync(resolve("lib/agent/payment-store.ts"), "utf8");
const packageSource = readFileSync(resolve("package.json"), "utf8");
assert(officialMiddlewareSource.includes("syncSettle: true"), "Synchronous x402 settlement", "enabled");
assert(officialMiddlewareSource.includes("reserveVerifiedPayment") && paymentStoreSource.includes("settlement_status"), "Pre-settlement replay reservation", "durable");
assert(officialMiddlewareSource.includes("PAYMENT_SETTLEMENT_PENDING") && officialMiddlewareSource.includes('"unknown"'), "Unknown settlement blocking", "enabled");
assert(packageSource.includes("reconcile:x402-settlements"), "Settlement reconciliation command", "present");
assert(existsSync(resolve("legacy/x402-custom/runtime/x402.ts")), "Legacy x402 isolation", "custom runtime moved");
const migrations = ["202607210001_initial_cloud_schema.sql", "202607220001_team_collaboration.sql", "202607220007_sop_analytics.sql", "202607220008_compliance_audit_center.sql", "202607220009_public_template_marketplace.sql", "202607220010_repair_partial_marketplace_schema.sql", "202607220011_okx_x402_agent_service.sql", "202607220012_retire_workspace_invitations.sql", "202607230001_harden_x402_payment_replay.sql", "202607230002_x402_unknown_settlement.sql", "202607240001_server_derived_x402_replay.sql", "202607240002_repair_x402_payment_reservation_schema.sql", "202607260001_x402_request_payload_replay.sql"];
assert(migrations.every(file => existsSync(resolve("supabase/migrations", file))), "Required migrations", `${migrations.length} files present`);
assert(existsSync(resolve(".next/BUILD_ID")) || existsSync(resolve(".next/build-manifest.json")), "Production build artifact", "run npm run build before release verification");

console.log(JSON.stringify({ status: "pass", base_url: baseUrl, checks: results }, null, 2));
} catch (error) {
  console.error(`Release verification failed: ${error instanceof Error ? error.message : "Unknown error."}`);
  process.exitCode = 1;
}
