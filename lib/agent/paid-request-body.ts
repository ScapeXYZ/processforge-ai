import { createHash } from "node:crypto";

export async function preservePaidRequestBody(request: Request): Promise<string> {
  return request.clone().text();
}

export function paidProxyRequestInit(
  request: Request,
  preservedBody: string,
): Pick<RequestInit, "method" | "headers" | "body"> {
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return {
    method: request.method,
    headers,
    body: preservedBody,
  };
}

export function paidRequestBodyHash(preservedBody: string): string {
  return createHash("sha256").update(preservedBody).digest("hex");
}
