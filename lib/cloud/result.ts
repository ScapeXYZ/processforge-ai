export type CloudErrorCode = "auth" | "conflict" | "offline" | "validation" | "provider";
export type CloudResult<T> = { ok: true; data: T } | { ok: false; error: { code: CloudErrorCode; message: string } };
export const cloudFailure = (message: string, code: CloudErrorCode = "provider"): CloudResult<never> => ({ ok: false, error: { code, message } });

