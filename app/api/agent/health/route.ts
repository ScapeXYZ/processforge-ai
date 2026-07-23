import { AGENT_VERSION, getX402Config } from "@/lib/agent/config";
import { inspectServerEnvironment } from "@/lib/env/server";

export const runtime = "nodejs";

export async function GET() {
  const config = getX402Config();
  const environment = inspectServerEnvironment();
  const paymentReady = config.serviceEnabled && config.ready;
  const aiReady = Boolean(process.env.OPENAI_API_KEY);
  const unavailable = process.env.NODE_ENV === "production" && !environment.ready;
  return Response.json({ status: unavailable ? "unavailable" : paymentReady && (aiReady || config.mock) ? "healthy" : "degraded", version: AGENT_VERSION, deployment_version: process.env.DEPLOYMENT_VERSION ?? process.env.GIT_COMMIT_SHA ?? null, payment_configuration: { status: paymentReady ? "ready" : config.serviceEnabled ? "missing" : "disabled", provider: config.provider, network: config.network, asset: config.asset || null }, ai_provider: { status: aiReady ? "ready" : config.mock ? "mock" : "missing", provider: aiReady ? "openai" : config.mock ? "deterministic-mock" : null }, timestamp: new Date().toISOString() }, { status: unavailable ? 503 : 200, headers: { "cache-control": "no-store" } });
}
