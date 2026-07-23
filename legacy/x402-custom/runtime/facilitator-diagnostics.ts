import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type SafeFacilitatorHttpError = {
  status?: number;
  code?: string;
  message?: string;
  requestId?: string;
};

const context = new AsyncLocalStorage<{ origin: string; result: SafeFacilitatorHttpError }>();
const nativeFetch = globalThis.fetch.bind(globalThis);
let installed = false;

export async function observeFacilitatorHttp<T>(baseUrl: string, operation: () => Promise<T>): Promise<{ value?: T; error?: unknown; http: SafeFacilitatorHttpError }> {
  installObserver();
  const state = { origin: new URL(baseUrl).origin, result: {} as SafeFacilitatorHttpError };
  try { return { value: await context.run(state, operation), http: state.result }; }
  catch (error) { return { error, http: state.result }; }
}

function installObserver() {
  if (installed) return;
  installed = true;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await nativeFetch(input, init);
    const state = context.getStore();
    if (!state || response.ok || new URL(requestUrl(input)).origin !== state.origin) return response;
    state.result.status = response.status;
    state.result.requestId = safeIdentifier(response.headers.get("x-request-id") ?? response.headers.get("ok-request-id") ?? response.headers.get("x-trace-id"));
    try {
      const text = (await response.clone().text()).slice(0, 2_000);
      const body = JSON.parse(text) as Record<string, unknown>;
      state.result.code = safeIdentifier(stringValue(body.code ?? body.errorCode ?? body.error));
      state.result.message = safeMessage(stringValue(body.msg ?? body.message ?? body.errorMessage));
    } catch { /* The official response was empty or non-JSON; status remains available. */ }
    return response;
  };
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}
function stringValue(value: unknown): string | null { return typeof value === "string" ? value : null; }
function safeIdentifier(value: string | null): string | undefined { return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined; }
function safeMessage(value: string | null): string | undefined { return value && /^[a-zA-Z0-9 .,;:_()/'-]{1,240}$/.test(value) ? value : undefined; }
