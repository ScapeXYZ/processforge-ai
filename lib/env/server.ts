import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(), NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), OPENAI_API_KEY: z.string().min(1).optional(), APP_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"), RATE_LIMIT_STORE: z.string().default("memory"), ENABLE_RELEASE_CHECK: z.enum(["true", "false"]).default("false"),
  AGENT_PAID_GENERATION_ENABLED: z.enum(["true", "false"]).default("true"), DEPLOYMENT_VERSION: z.string().max(100).optional(), GIT_COMMIT_SHA: z.string().max(100).optional(),
  OKX_X402_ENABLED: z.enum(["true", "false"]).default("false"), OKX_X402_MOCK: z.enum(["true", "false"]).default("true"), OKX_X402_NETWORK: z.string().optional(),
  OKX_X402_PAY_TO_ADDRESS: z.string().optional(), OKX_X402_ASSET: z.string().optional(), OKX_X402_PRICE: z.string().optional(), OKX_X402_FACILITATOR_URL: z.string().url().optional(),
  OKX_X402_API_KEY: z.string().optional(), OKX_X402_SECRET_KEY: z.string().optional(), OKX_X402_PASSPHRASE: z.string().optional(),
});

export function inspectServerEnvironment(): { ready: boolean; errors: string[] } {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) return { ready: false, errors: parsed.error.issues.map((issue) => `Invalid environment variable: ${String(issue.path[0])}`) };
  const releaseChecksEnabled = parsed.data.NODE_ENV === "production" && parsed.data.ENABLE_RELEASE_CHECK === "true";
  if (!releaseChecksEnabled) return { ready: true, errors: [] };
  const errors: string[] = [];
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "APP_BASE_URL"] as const) if (!parsed.data[key]) errors.push(`Missing required environment variable: ${key}`);
  if (parsed.data.APP_BASE_URL) { const url = new URL(parsed.data.APP_BASE_URL); if (url.protocol !== "https:") errors.push("APP_BASE_URL must use HTTPS in production"); if (["localhost", "127.0.0.1"].includes(url.hostname) || url.hostname.endsWith(".vercel.app")) errors.push("APP_BASE_URL must use the supported production domain"); }
  if (parsed.data.OKX_X402_MOCK === "true") errors.push("OKX_X402_MOCK must be false in production");
  if (parsed.data.OKX_X402_ENABLED === "true") { if (parsed.data.OKX_X402_NETWORK !== "eip155:196") errors.push("Production x402 network must be eip155:196"); for (const key of ["OKX_X402_PAY_TO_ADDRESS", "OKX_X402_ASSET", "OKX_X402_PRICE", "OKX_X402_FACILITATOR_URL", "OKX_X402_API_KEY", "OKX_X402_SECRET_KEY", "OKX_X402_PASSPHRASE"] as const) if (!parsed.data[key]) errors.push(`Missing required x402 variable: ${key}`); }
  return { ready: errors.length === 0, errors };
}

export function getAppBaseUrl(): string {
  const value = process.env.APP_BASE_URL?.trim();
  if (value) return value.replace(/\/$/, "");

  // `next start` always runs with NODE_ENV=production, including local
  // production-build verification. Deployment readiness is enforced by
  // inspectServerEnvironment(); URL construction must retain the local origin.
  return "http://localhost:3000";
}
