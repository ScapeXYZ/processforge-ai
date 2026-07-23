import "server-only";
const privateKey = /key|secret|authorization|cookie|token|signature|email|content|prompt|document/i;
const safeBooleanFields = new Set(["payment_signature_present", "x_payment_header_present"]);
export function securityLog(event: string, fields: Record<string, unknown> = {}): void { const safe = Object.fromEntries(Object.entries(fields).filter(([key, value]) => !privateKey.test(key) || (safeBooleanFields.has(key) && typeof value === "boolean")).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value])); console.info(JSON.stringify({ timestamp: new Date().toISOString(), event, environment: process.env.NODE_ENV ?? "development", ...safe })); }
