import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
const supabaseOrigin = (() => { try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ""; } catch { return ""; } })();
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https:", "font-src 'self' data:", `connect-src 'self' ${supabaseOrigin} https://*.supabase.co https://*.okx.com`.trim(), "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", ...(production ? ["upgrade-insecure-requests"] : [])].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  turbopack: { root: process.cwd() },
  async headers() {
    const headers = [{ key: "Content-Security-Policy", value: csp }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }, { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" }, { key: "X-Frame-Options", value: "DENY" }];
    if (production) headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
