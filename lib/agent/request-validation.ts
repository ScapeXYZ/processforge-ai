import { createHash } from "node:crypto";
import { agentSopRequestSchema, type AgentSopRequest } from "@/lib/agent/contract";

const MAX_BODY_BYTES = 32_768;

export type ValidAgentRequest = {
  ok: true;
  input: AgentSopRequest;
  idempotencyKey: string;
  requestHash: string;
};

export type InvalidAgentRequest = {
  ok: false;
  status: number;
  code: "INVALID_REQUEST";
  message: string;
  details?: Array<{ path: string; message: string }>;
};

export async function validateAgentRequest(request: Request): Promise<ValidAgentRequest | InvalidAgentRequest> {
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "A valid Idempotency-Key header (8-200 characters) is required." };
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "INVALID_REQUEST", message: "Request body is too large." };
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "Request body could not be read." };
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "INVALID_REQUEST", message: "Request body is too large." };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "Request body must be valid JSON." };
  }
  const parsed = agentSopRequestSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_REQUEST",
      message: "Request validation failed.",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const requestHash = createHash("sha256").update(JSON.stringify(parsed.data)).digest("hex");
  return { ok: true, input: parsed.data, idempotencyKey, requestHash };
}
