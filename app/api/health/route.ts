import { AGENT_VERSION } from "@/lib/agent/config";
import { inspectServerEnvironment } from "@/lib/env/server";

export const runtime = "nodejs";

export async function GET() {
  const environment = inspectServerEnvironment();
  const unavailable = process.env.NODE_ENV === "production" && !environment.ready;
  return Response.json({ status: unavailable ? "unavailable" : environment.ready ? "healthy" : "degraded", version: AGENT_VERSION, deployment_version: process.env.DEPLOYMENT_VERSION ?? process.env.GIT_COMMIT_SHA ?? null, environment: process.env.NODE_ENV ?? "development", timestamp: new Date().toISOString() }, { status: unavailable ? 503 : 200, headers: { "cache-control": "no-store" } });
}
