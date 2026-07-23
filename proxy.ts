import type { NextRequest } from "next/server";
import { runOfficialPaymentMiddleware } from "@/lib/agent/official-x402-middleware";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const paymentResponse = await runOfficialPaymentMiddleware(request);
  if (paymentResponse) return paymentResponse;
  return updateSession(request);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
