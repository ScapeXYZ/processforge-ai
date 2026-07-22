import "server-only";
const privateKey = /key|secret|authorization|cookie|token|signature|email|content|prompt|document/i;
export function securityLog(event: string, fields: Record<string, unknown> = {}): void { const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => !privateKey.test(key)).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value])); console.info(JSON.stringify({ timestamp: new Date().toISOString(), event, environment: process.env.NODE_ENV ?? "development", ...safe })); }
