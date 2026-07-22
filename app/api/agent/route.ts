import { AGENT_SCHEMA_VERSION, AGENT_SERVICE, AGENT_VERSION, getX402Config } from "@/lib/agent/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = getX402Config(); const origin = new URL(request.url).origin;
  return Response.json({
    name: "ProcessForge AI", description: "Paid machine-callable SOP generation with deterministic quality analytics and compliance analysis.", version: AGENT_VERSION, provider: "ProcessForge AI",
    available_services: [{ id: AGENT_SERVICE, method: "POST", endpoint: `${origin}/api/agent/generate-sop`, schema_version: AGENT_SCHEMA_VERSION }],
    request_schema: { required: ["title", "description", "industry", "department", "audience"], optional: ["company_context", "requirements", "compliance_frameworks", "knowledge_context", "output_format"] },
    response_schema: { fields: ["request_id", "service", "status", "sop", "analytics", "compliance", "assumptions", "warnings", "generated_at", "processing_time_ms", "schema_version"] },
    pricing: { enabled: config.enabled, scheme: "exact", amount: config.price || null, asset: config.asset || null, network: config.network },
    health_url: `${origin}/api/agent/health`, documentation_url: `${origin}/agent-docs`,
  }, { headers: { "cache-control": "public, max-age=60" } });
}
