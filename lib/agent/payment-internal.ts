export const INTERNAL_PAYMENT_KEY_HEADER = "x-processforge-verified-payment-key";
export const INTERNAL_PAYMENT_REQUEST_ID_HEADER = "x-processforge-payment-request-id";

export type SettledPaymentHandoff = {
  replayKey: string;
  requestId: string;
};

const SETTLED_REQUEST_HEADER_ALLOWLIST = [
  "content-type",
  "accept",
  "user-agent",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
] as const;

export function buildSettledRequestHeaders(
  source: Headers,
  handoff: SettledPaymentHandoff,
): Headers {
  const forwardedHeaders = new Headers();
  for (const name of SETTLED_REQUEST_HEADER_ALLOWLIST) {
    const value = source.get(name);
    if (value) forwardedHeaders.set(name, value);
  }
  setSettledPaymentHandoff(forwardedHeaders, handoff);
  return forwardedHeaders;
}

export function setSettledPaymentHandoff(
  headers: Headers,
  handoff: SettledPaymentHandoff,
): void {
  if (!handoff.replayKey.trim() || !handoff.requestId.trim()) {
    throw new Error("SETTLED_PAYMENT_HANDOFF_INCOMPLETE");
  }
  headers.set(INTERNAL_PAYMENT_KEY_HEADER, handoff.replayKey);
  headers.set(INTERNAL_PAYMENT_REQUEST_ID_HEADER, handoff.requestId);
}

export function readSettledPaymentHandoff(headers: Headers): SettledPaymentHandoff | null {
  const replayKey = headers.get(INTERNAL_PAYMENT_KEY_HEADER)?.trim();
  const requestId = headers.get(INTERNAL_PAYMENT_REQUEST_ID_HEADER)?.trim();
  return replayKey && requestId ? { replayKey, requestId } : null;
}
