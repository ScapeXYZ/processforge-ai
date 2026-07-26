import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);

export const agentSopRequestSchema = z.object({
  title: text(160),
  description: text(8_000),
  industry: text(120),
  department: text(120),
  audience: text(500),
  company_context: z.string().trim().max(4_000).default(""),
  requirements: z.array(text(500)).max(20).default([]),
  compliance_frameworks: z.array(text(120)).max(10).default([]),
  knowledge_context: z.string().trim().max(12_000).default(""),
  output_format: z.literal("json").default("json"),
}).strict();

export type AgentSopRequest = z.infer<typeof agentSopRequestSchema>;

export type AgentErrorCode =
  | "INVALID_REQUEST" | "METHOD_NOT_ALLOWED" | "PAYMENT_REQUIRED"
  | "PAYMENT_CONFIGURATION_ERROR" | "PAYMENT_INVALID" | "PAYMENT_REPLAYED"
  | "PAYMENT_SETTLEMENT_FAILED" | "PAYMENT_SETTLEMENT_PENDING"
  | "PAYMENT_REPLAY_CONFLICT" | "REQUEST_IN_PROGRESS"
  | "REPLAY_PAYLOAD_UNAVAILABLE"
  | "RATE_LIMITED" | "SERVICE_BUSY" | "AI_TIMEOUT" | "GENERATION_FAILED";

export function agentError(code: AgentErrorCode, message: string, status: number, requestId?: string, diagnostics?: { reason?: string; reason_message?: string }) {
  return Response.json({ error: { code, message, ...(diagnostics?.reason ? { reason: diagnostics.reason } : {}), ...(diagnostics?.reason_message ? { reason_message: diagnostics.reason_message } : {}), request_id: requestId ?? null } }, { status });
}
