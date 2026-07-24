import { createHash } from "node:crypto";
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
} from "@okxweb3/x402-core/types";

type VerificationShape = VerifyResponse & Record<string, unknown>;

export function normalizeOfficialVerificationResult(value: unknown): VerifyResponse | null {
  const root = asRecord(value);
  const data = root?.data;
  const candidate =
    Array.isArray(value) ? asRecord(value[0])
      : Array.isArray(data) ? asRecord(data[0])
        : root;
  if (!candidate || typeof candidate.isValid !== "boolean") return null;
  return {
    isValid: candidate.isValid,
    ...(nonEmptyString(candidate.invalidReason) ? { invalidReason: candidate.invalidReason as string } : {}),
    ...(nonEmptyString(candidate.invalidMessage) ? { invalidMessage: candidate.invalidMessage as string } : {}),
    ...(nonEmptyString(candidate.payer) ? { payer: candidate.payer as string } : {}),
    ...(asRecord(candidate.extensions) ? { extensions: candidate.extensions as Record<string, unknown> } : {}),
  };
}

export function safeRawVerificationShape(value: unknown): {
  responseKind: "array" | "object" | "other";
  responseKeys: string[];
  itemKeys: string[];
  verificationKeys: string[];
  authorizationExists: boolean;
  authorizationFromExists: boolean;
  payerExists: boolean;
  paymentIdExists: boolean;
  nonceExists: boolean;
} {
  const root = Array.isArray(value) ? null : asRecord(value);
  const data = root?.data;
  const item =
    Array.isArray(value) ? asRecord(value[0])
      : Array.isArray(data) ? asRecord(data[0])
        : null;
  const verification = item ?? root;
  const authorization = asRecord(verification?.authorization);
  return {
    responseKind: Array.isArray(value) ? "array" : root ? "object" : "other",
    responseKeys: safeKeys(root),
    itemKeys: safeKeys(item),
    verificationKeys: safeKeys(verification),
    authorizationExists: authorization !== null,
    authorizationFromExists: Object.hasOwn(authorization ?? {}, "from"),
    payerExists: Object.hasOwn(verification ?? {}, "payer"),
    paymentIdExists:
      Object.hasOwn(verification ?? {}, "paymentId")
      || Object.hasOwn(verification ?? {}, "payment_id"),
    nonceExists:
      Object.hasOwn(verification ?? {}, "nonce")
      || Object.hasOwn(authorization ?? {}, "nonce"),
  };
}

export type VerifiedPaymentIdentity = {
  replayKey: string;
  payer: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  resource: string;
};

export function extractVerifiedPaymentIdentity(input: {
  paymentPayload: PaymentPayload;
  requirements: PaymentRequirements;
  result: VerifyResponse;
  resource: string;
}): VerifiedPaymentIdentity | null {
  const { paymentPayload, requirements, result, resource } = input;
  if (result.isValid !== true) return null;

  const payer = nonEmptyString(result.payer);
  const payload = asRecord(paymentPayload.payload);
  const signature =
    nonEmptyString(payload?.signature)
    ?? nonEmptyString(paymentAuthorization(paymentPayload)?.signature);
  if (!payer || !signature) return null;
  const paymentSignatureHash = createHash("sha256").update(signature).digest("hex");

  const network = nonEmptyString(requirements.network);
  const asset = nonEmptyString(requirements.asset);
  const amount = nonEmptyString(requirements.amount);
  const payTo = nonEmptyString(requirements.payTo);
  if (!network || !asset || !amount || !payTo || !resource) return null;

  const identity = {
    x402Version: paymentPayload.x402Version,
    scheme: requirements.scheme,
    network,
    asset: normalizeAddress(asset),
    amount,
    payTo: normalizeAddress(payTo),
    payer: normalizeAddress(payer),
    resource,
    paymentSignatureHash,
  };

  return {
    replayKey: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    payer,
    network,
    asset,
    amount,
    payTo,
    resource,
  };
}

export function safeVerificationShape(input: {
  paymentPayload: PaymentPayload;
  result: VerifyResponse;
}): {
  isValid: boolean;
  invalidReason: string | null;
  invalidMessage: string | null;
  payerExists: boolean;
  payloadSignatureExists: boolean;
  authorizationExists: boolean;
  authorizationSignatureExists: boolean;
  verificationKeys: string[];
} {
  const result = asRecord(input.result);
  const paymentPayload = asRecord(input.paymentPayload);
  const payload = asRecord(paymentPayload?.payload);
  const authorization = paymentAuthorization(input.paymentPayload);
  return {
    isValid: input.result.isValid === true,
    invalidReason: scrubDiagnosticText(input.result.invalidReason),
    invalidMessage: scrubDiagnosticText(input.result.invalidMessage),
    payerExists: nonEmptyString(input.result.payer) !== null,
    payloadSignatureExists: nonEmptyString(payload?.signature) !== null,
    authorizationExists: authorization !== null,
    authorizationSignatureExists: nonEmptyString(authorization?.signature) !== null,
    verificationKeys: safeKeys(result as VerificationShape | null),
  };
}

function scrubDiagnosticText(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value
    .replace(/0x[a-fA-F0-9]{8,}/g, "[redacted]")
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, "[redacted]")
    .slice(0, 160);
}

function paymentAuthorization(paymentPayload: PaymentPayload): Record<string, unknown> | null {
  const payload = asRecord(paymentPayload.payload);
  return asRecord(payload?.authorization) ?? asRecord(payload?.permit2Authorization);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function safeKeys(value: Record<string, unknown> | null): string[] {
  return value ? Object.keys(value).sort().slice(0, 32) : [];
}
