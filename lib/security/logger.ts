import "server-only";
import { redactLogFields } from "@/lib/security/log-redaction";

export function securityLog(event: string, fields: Record<string, unknown> = {}): void {
  const safe = redactLogFields(fields);
  console.info(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    environment: process.env.NODE_ENV ?? "development",
    ...safe,
  }));
}
