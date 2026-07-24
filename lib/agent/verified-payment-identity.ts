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
} {
  const root = Array.isArray(value) ? null : asRecord(value);
  const data = root?.data;
  const item =
    Array.isArray(value) ? asRecord(value[0])
      : Array.isArray(data) ? asRecord(data[0])
        : null;
  return {
    responseKind: Array.isArray(value) ? "array" : root ? "object" : "other",
    responseKeys: safeKeys(root),
    itemKeys: safeKeys(item),
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
  nonce: string;
};

export function extractVerifiedPaymentIdentity(input: {
  paymentPayload: PaymentPayload;
  requirements: PaymentRequirements;
  result: VerifyResponse;
  resource: string;
}): VerifiedPaymentIdentity | null {
  const { paymentPayload, requirements, result, resource } = input;
  if (result.isValid !== true) return null;

  const authorization = paymentAuthorization(paymentPayload);
  const authorizationPayer = nonEmptyString(authorization?.from);
  const resultPayer = nonEmptyString(result.payer);
  const nonce = nonEmptyString(authorization?.nonce);
  if (!authorizationPayer || !nonce) return null;
  if (resultPayer && normalizeAddress(resultPayer) !== normalizeAddress(authorizationPayer)) {
    return null;
  }

  const network = nonEmptyString(requirements.network);
  const asset = nonEmptyString(requirements.asset);
  const amount = nonEmptyString(requirements.amount);
  const payTo = nonEmptyString(requirements.payTo);
  if (!network || !asset || !amount || !payTo || !resource) return null;

  const payer = resultPayer ?? authorizationPayer;
  const identity = {
    x402Version: paymentPayload.x402Version,
    scheme: requirements.scheme,
    network,
    asset: normalizeAddress(asset),
    amount,
    payTo: normalizeAddress(payTo),
    payer: normalizeAddress(payer),
    resource,
    nonce,
  };

  return {
    replayKey: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    payer,
    network,
    asset,
    amount,
    payTo,
    resource,
    nonce,
  };
}

export function safeVerificationShape(input: {
  paymentPayload: PaymentPayload;
  result: VerifyResponse;
}): {
  resultKeys: string[];
  resultExtensionKeys: string[];
  paymentPayloadKeys: string[];
  payloadKeys: string[];
  authorizationKeys: string[];
} {
  const result = asRecord(input.result);
  const paymentPayload = asRecord(input.paymentPayload);
  const payload = asRecord(paymentPayload?.payload);
  const authorization = paymentAuthorization(input.paymentPayload);
  return {
    resultKeys: safeKeys(result),
    resultExtensionKeys: safeKeys(asRecord((result as VerificationShape | null)?.extensions)),
    paymentPayloadKeys: safeKeys(paymentPayload),
    payloadKeys: safeKeys(payload),
    authorizationKeys: safeKeys(authorization),
  };
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
