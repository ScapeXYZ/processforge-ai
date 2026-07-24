export const INTERNAL_PAYMENT_KEY_HEADER = "x-processforge-verified-payment-key";
export const INTERNAL_PAYMENT_REQUEST_ID_HEADER = "x-processforge-payment-request-id";

export type SettledPaymentHandoff = {
  replayKey: string;
  requestId: string;
};

export function createSettledPaymentHeaders(
  source: Headers,
  handoff: SettledPaymentHandoff,
): Headers {
  if (!handoff.replayKey.trim() || !handoff.requestId.trim()) {
    throw new Error("SETTLED_PAYMENT_HANDOFF_INCOMPLETE");
  }
  const headers = new Headers(source);
  headers.set(INTERNAL_PAYMENT_KEY_HEADER, handoff.replayKey);
  headers.set(INTERNAL_PAYMENT_REQUEST_ID_HEADER, handoff.requestId);
  return headers;
}

export function readSettledPaymentHandoff(headers: Headers): SettledPaymentHandoff | null {
  const replayKey = headers.get(INTERNAL_PAYMENT_KEY_HEADER)?.trim();
  const requestId = headers.get(INTERNAL_PAYMENT_REQUEST_ID_HEADER)?.trim();
  return replayKey && requestId ? { replayKey, requestId } : null;
}
