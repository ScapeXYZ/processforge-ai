import { createHash, randomBytes } from "node:crypto";

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

export function paymentAuthorizationHash(request: Request): string | null {
  const authorization =
    request.headers.get("payment-signature")
    ?? request.headers.get("x-payment");
  return authorization
    ? createHash("sha256").update(authorization).digest("hex")
    : null;
}
