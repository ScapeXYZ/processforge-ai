import { getAgentPaymentStatus, type AgentPaymentStatus } from "@/lib/agent/payment-status";
import { AGENT_SCHEMA_VERSION, AGENT_SERVICE, AGENT_VERSION } from "@/lib/agent/service";
import { getAppBaseUrl } from "@/lib/env/server";
import { checkRateLimit, requestClientKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const limited = checkRateLimit(requestClientKey(request, "agent-metadata"), 120, 60_000);
  if (!limited.allowed) return Response.json({ error: { code: "RATE_LIMITED", message: "Too many requests." } }, { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } });
  const payment = getAgentPaymentStatus(); const origin = getAppBaseUrl();
  return Response.json({
    name: "ProcessForge AI", description: "Paid machine-callable SOP generation with deterministic quality analytics and compliance analysis.", version: AGENT_VERSION, provider: "ProcessForge AI", provider_url: origin,
    available_services: [{ id: AGENT_SERVICE, method: "POST", endpoint: `${origin}/api/agent/generate-sop`, schema_version: AGENT_SCHEMA_VERSION }],
    request_schema: { required: ["title", "description", "industry", "department", "audience"], optional: ["company_context", "requirements", "compliance_frameworks", "knowledge_context", "output_format"] },
    response_schema: { fields: ["request_id", "service", "status", "sop", "analytics", "compliance", "assumptions", "warnings", "generated_at", "processing_time_ms", "schema_version"] },
    pricing: buildPricingMetadata(payment, origin),
    health_url: `${origin}/api/agent/health`, documentation_url: `${origin}/agent-docs`,
  }, { headers: { "cache-control": "public, max-age=60" } });
}

function buildPricingMetadata(payment: AgentPaymentStatus, origin: string) {
  return {
    enabled: payment.enabled,
    scheme: "exact",
    amount: payment.amount,
    amount_format: "atomic_units",
    asset: payment.asset,
    asset_address: payment.assetAddress,
    asset_decimals: payment.assetDecimals,
    network: payment.network,
    paid_endpoint: `${origin}/api/agent/generate-sop`,
  };
}
