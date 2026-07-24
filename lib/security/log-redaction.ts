const sensitiveFieldName =
  /key|secret|authorization|cookie|token|signature|email|content|prompt|document|credential|wallet|address|nonce|payment.?payload/i;

const safeBooleanFields = new Set([
  "payment_signature_present",
  "x_payment_header_present",
]);

export function redactLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key, value]) =>
        !sensitiveFieldName.test(key)
        || (safeBooleanFields.has(key) && typeof value === "boolean")
        || isSafeStructuralDiagnostic(key, value))
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.slice(0, 160) : value,
      ]),
  );
}

function isSafeStructuralDiagnostic(key: string, value: unknown): boolean {
  if (key.endsWith("_exists")) return typeof value === "boolean";
  if (key.endsWith("_count")) return typeof value === "number" && Number.isFinite(value);
  if (key.endsWith("_keys")) {
    return Array.isArray(value)
      && value.length <= 64
      && value.every((entry) =>
        typeof entry === "string"
        && /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(entry));
  }
  if (key.endsWith("_kind") || key.endsWith("_status")) {
    return typeof value === "string"
      && /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(value);
  }
  return false;
}
