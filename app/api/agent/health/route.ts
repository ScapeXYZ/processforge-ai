import { getAgentPaymentStatus } from "@/lib/agent/payment-status";
import { AGENT_VERSION } from "@/lib/agent/service";
import { inspectServerEnvironment } from "@/lib/env/server";

export const runtime = "nodejs";

export async function GET() {
  const payment = getAgentPaymentStatus();
  const environment = inspectServerEnvironment();
  const aiReady = Boolean(process.env.OPENAI_API_KEY);
  const unavailable = process.env.NODE_ENV === "production" && !environment.ready;
  return Response.json({ status: unavailable ? "unavailable" : aiReady ? "healthy" : "degraded", version: AGENT_VERSION, deployment_version: process.env.DEPLOYMENT_VERSION ?? process.env.GIT_COMMIT_SHA ?? null, payment_configuration: { status: payment.status, provider: payment.provider, network: payment.network, asset: "USD₮0", facilitator_authentication: payment.facilitatorAuthentication }, ai_provider: { status: aiReady ? "ready" : "missing", provider: aiReady ? "openai" : null }, timestamp: new Date().toISOString() }, { status: unavailable ? 503 : 200, headers: { "cache-control": "no-store" } });
}
