import { createHash, randomBytes } from "node:crypto";
import { decodePaymentSignatureHeader } from "@okxweb3/x402-core/http";

export const REQUEST_REPLAY_QUERY_PARAM = "_pf_x402_replay";
export const REQUEST_REPLAY_TTL_MS = 10 * 60 * 1000;

const REPLAY_LOCATOR_PATTERN = /^[A-Za-z0-9_-]{32}$/;

export function createRequestReplayLocator(): string {
  return randomBytes(24).toString("base64url");
}

export function readRequestReplayLocator(url: string): string | null {
  const value = new URL(url).searchParams.get(REQUEST_REPLAY_QUERY_PARAM);
  return value && REPLAY_LOCATOR_PATTERN.test(value) ? value : null;
}

export function withRequestReplayLocator(url: string, locator: string | null): string {
  if (!locator) return url;
  const target = new URL(url);
  target.searchParams.set(REQUEST_REPLAY_QUERY_PARAM, locator);
  return target.toString();
}

export function deriveRequestReplayKey(locator: string): string {
  return createHash("sha256")
    .update(`processforge:x402-request:${locator}`)
    .digest("hex");
}

export function normalizedReplayLocatorFingerprint(locator: string | null): string | null {
  if (!locator || !REPLAY_LOCATOR_PATTERN.test(locator)) return null;
  return createHash("sha256")
    .update(`processforge:x402-locator-log:${locator}`)
    .digest("hex")
    .slice(0, 16);
}

export function paymentAuthorizationHash(request: Request): string | null {
  const authorization =
    request.headers.get("payment-signature")
    ?? request.headers.get("x-payment");
  return authorization
    ? createHash("sha256").update(authorization).digest("hex")
    : null;
}

export type PaidRequestCorrelation = {
  headerNames: string[];
  paymentHeaderKind: "payment-signature" | "x-payment" | null;
  paymentPayloadKeys: string[];
  paymentResourceUrl: string | null;
  paymentResourceLocator: string | null;
  payerAddress: string | null;
  decoded: boolean;
};

export function inspectPaidRequestCorrelation(request: Request): PaidRequestCorrelation {
  const paymentSignature = request.headers.get("payment-signature");
  const xPayment = request.headers.get("x-payment");
  const paymentHeaderKind = paymentSignature
    ? "payment-signature"
    : xPayment
      ? "x-payment"
      : null;
  const decoded = decodePaymentHeader(paymentSignature ?? xPayment);
  const resource = asRecord(decoded?.resource);
  const paymentResourceUrl = safeUrl(resource?.url);
  const paymentResourceLocator = paymentResourceUrl
    ? readRequestReplayLocator(paymentResourceUrl)
    : null;
  const payload = asRecord(decoded?.payload);
  const authorization =
    asRecord(payload?.authorization)
    ?? asRecord(payload?.permit2Authorization);

  return {
    headerNames: [...request.headers.keys()]
      .map((name) => name.toLowerCase())
      .filter((name) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(name))
      .sort()
      .slice(0, 64),
    paymentHeaderKind,
    paymentPayloadKeys: decoded ? Object.keys(decoded).sort().slice(0, 32) : [],
    paymentResourceUrl,
    paymentResourceLocator,
    payerAddress: evmAddress(authorization?.from) ?? evmAddress(decoded?.payer),
    decoded: decoded !== null,
  };
}

export function canonicalReplayEndpoint(url: string): string {
  const endpoint = new URL(url);
  endpoint.search = "";
  endpoint.hash = "";
  return endpoint.toString();
}

function decodePaymentHeader(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return asRecord(decodePaymentSignatureHeader(value));
  } catch {
    try {
      return asRecord(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    } catch {
      return null;
    }
  }
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function evmAddress(value: unknown): string | null {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)
    ? value.toLowerCase()
    : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}
