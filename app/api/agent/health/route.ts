import { AGENT_VERSION, getX402Config } from "@/lib/agent/config";

export const runtime = "nodejs";

export async function GET() {
  const config = getX402Config();
  const paymentReady = config.mock || (config.ready && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL));
  const aiReady = Boolean(process.env.OPENAI_API_KEY);
  return Response.json({ status: paymentReady && (aiReady || config.mock) ? "ok" : "degraded", version: AGENT_VERSION, payment_configuration: { status: paymentReady ? "ready" : "missing", provider: config.provider, network: config.network }, ai_provider: { status: aiReady ? "ready" : config.mock ? "mock" : "missing", provider: aiReady ? "openai" : config.mock ? "deterministic-mock" : null }, timestamp: new Date().toISOString() }, { status: 200, headers: { "cache-control": "no-store" } });
}
