import { OKXFacilitatorClient } from "@okxweb3/x402-core";

const REQUIRED_ENV = [
  "OKX_X402_API_KEY",
  "OKX_X402_SECRET_KEY",
  "OKX_X402_PASSPHRASE",
  "OKX_X402_FACILITATOR_URL",
];
const SUPPORTED_PATH = "/api/v6/pay/x402/supported";
const EXPECTED_SCHEME = "exact";
const EXPECTED_NETWORK = "eip155:196";

let observed = {
  status: null,
  code: null,
  message: null,
};

function safeText(value, maxLength = 240) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\r\n\t]+/g, " ").trim();
  return normalized && /^[\x20-\x7E\u00A0-\uFFFF]+$/u.test(normalized)
    ? normalized.slice(0, maxLength)
    : null;
}

function safeErrorBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { code: null, message: null };
  }
  const code = safeText(
    typeof body.code === "number" ? String(body.code) : body.code ?? body.errorCode,
    80,
  );
  const message = safeText(body.msg ?? body.message ?? body.errorMessage);
  return { code, message };
}

function printResult(authenticated, supported) {
  console.log(JSON.stringify({
    http_status: observed.status,
    okx_response_code: observed.code,
    message: observed.message,
    supports_eip155_196_exact: authenticated && supported,
  }, null, 2));
}

try {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    observed = {
      status: null,
      code: "MISSING_CONFIGURATION",
      message: `Missing required environment variables: ${missing.join(", ")}`,
    };
    printResult(false, false);
    process.exitCode = 1;
  } else {
    const configuredUrl = new URL(process.env.OKX_X402_FACILITATOR_URL);
    if (configuredUrl.protocol !== "https:" || configuredUrl.username || configuredUrl.password) {
      throw new Error("OKX_X402_FACILITATOR_URL must be an HTTPS origin.");
    }
    const baseUrl = configuredUrl.origin;
    const supportedUrl = `${baseUrl}${SUPPORTED_PATH}`;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const requestUrl = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
      if (requestUrl === supportedUrl) {
        observed.status = response.status;
        try {
          const body = await response.clone().json();
          const safe = safeErrorBody(body);
          observed.code = safe.code;
          observed.message = safe.message;
        } catch {
          // A non-JSON response is intentionally not echoed.
        }
      }
      return response;
    };

    try {
      const client = new OKXFacilitatorClient({
        apiKey: process.env.OKX_X402_API_KEY,
        secretKey: process.env.OKX_X402_SECRET_KEY,
        passphrase: process.env.OKX_X402_PASSPHRASE,
        baseUrl,
      });
      const response = await client.getSupported();
      const supported = Array.isArray(response?.kinds)
        && response.kinds.some(
          (kind) => kind?.scheme === EXPECTED_SCHEME
            && kind?.network === EXPECTED_NETWORK,
        );
      if (!observed.message) {
        observed.message = supported
          ? "Authentication succeeded and the required payment kind is supported."
          : "Authentication succeeded, but the required payment kind is not supported.";
      }
      printResult(true, supported);
      if (observed.status !== 200 || !supported) process.exitCode = 1;
    } catch {
      if (!observed.message) {
        observed.message = observed.status
          ? "OKX rejected the authenticated supported-payment request."
          : "The OKX facilitator request could not be completed.";
      }
      printResult(false, false);
      process.exitCode = 1;
    } finally {
      globalThis.fetch = originalFetch;
    }
  }
} catch {
  observed = {
    status: null,
    code: "INVALID_CONFIGURATION",
    message: "The facilitator URL configuration is invalid.",
  };
  printResult(false, false);
  process.exitCode = 1;
}
