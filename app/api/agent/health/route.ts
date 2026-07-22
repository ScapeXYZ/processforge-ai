import { AGENT_VERSION, getX402Config } from "@/lib/agent/config";
import { inspectServerEnvironment } from "@/lib/env/server";

export const runtime = "nodejs";

export async function GET() {
  const config = getX402Config();
  const environment = inspectServerEnvironment();
  const paymentReady = config.mock || (config.ready && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL));
  const aiReady = Boolean(process.env.OPENAI_API_KEY);
  const unavailable = process.env.NODE_ENV === "production" && !environment.ready;
  return Response.json({ status: unavailable ? "unavailable" : paymentReady && (aiReady || config.mock) ? "healthy" : "degraded", version: AGENT_VERSION, payment_configuration: { status: paymentReady ? "ready" : "missing", provider: config.provider, network: config.network }, ai_provider: { status: aiReady ? "ready" : config.mock ? "mock" : "missing", provider: aiReady ? "openai" : config.mock ? "deterministic-mock" : null }, timestamp: new Date().toISOString() }, { status: unavailable ? 503 : 200, headers: { "cache-control": "no-store" } });
}
