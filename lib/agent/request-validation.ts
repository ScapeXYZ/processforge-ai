import { createHash } from "node:crypto";
import { agentSopRequestSchema, type AgentSopRequest } from "@/lib/agent/contract";

const MAX_BODY_BYTES = 32_768;

export type ValidAgentRequest = {
  ok: true;
  input: AgentSopRequest;
  requestHash: string;
};

export type InvalidAgentRequest = {
  ok: false;
  status: number;
  code: "INVALID_JSON" | "INVALID_REQUEST" | "MISSING_REQUIRED_FIELDS";
  message: string;
  details?: Array<{ path: string; message: string }>;
};

export function validateAgentRequestBody(
  raw: string,
  declaredLength = 0,
): ValidAgentRequest | InvalidAgentRequest {
  if (declaredLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "INVALID_REQUEST", message: "Request body is too large." };
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "INVALID_REQUEST", message: "Request body is too large." };
  }
  const normalizedRaw = raw.trim().length === 0 ? "{}" : raw;
  let json: unknown;
  try {
    json = JSON.parse(normalizedRaw);
  } catch {
    return { ok: false, status: 400, code: "INVALID_JSON", message: "Request body contains malformed JSON." };
  }
  return validateAgentRequestPayload(normalizedRaw, json, declaredLength);
}

export function validateAgentRequestPayload(
  raw: string,
  json: unknown,
  declaredLength = 0,
): ValidAgentRequest | InvalidAgentRequest {
  if (declaredLength > MAX_BODY_BYTES || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "INVALID_REQUEST", message: "Request body is too large." };
  }
  const parsed = agentSopRequestSchema.safeParse(json);
  if (!parsed.success) {
    const requiredFields = ["title", "description", "industry", "department", "audience"];
    const missingFields = parsed.error.issues
      .filter((issue) =>
        issue.path.length === 1
        && requiredFields.includes(String(issue.path[0]))
        && issue.code === "invalid_type")
      .map((issue) => String(issue.path[0]));
    const uniqueMissingFields = [...new Set(missingFields)];
    return {
      ok: false,
      status: 400,
      code: uniqueMissingFields.length > 0 ? "MISSING_REQUIRED_FIELDS" : "INVALID_REQUEST",
      message: uniqueMissingFields.length > 0
        ? `Missing required SOP fields: ${uniqueMissingFields.join(", ")}.`
        : "Request validation failed.",
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  const requestHash = createHash("sha256").update(raw).digest("hex");
  return { ok: true, input: parsed.data, requestHash };
}

export async function validateAgentRequest(request: Request): Promise<ValidAgentRequest | InvalidAgentRequest> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, status: 400, code: "INVALID_REQUEST", message: "Request body could not be read." };
  }
  return validateAgentRequestBody(
    raw,
    Number(request.headers.get("content-length") || 0),
  );
}
