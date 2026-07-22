const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();
let active = 0;

export function checkAgentRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now(); const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + WINDOW_MS }); return { allowed: true, retryAfter: 0 }; }
  current.count += 1;
  return { allowed: current.count <= MAX_REQUESTS, retryAfter: Math.ceil((current.resetAt - now) / 1000) };
}

export function acquireGenerationSlot(max = 3): (() => void) | null {
  if (active >= max) return null;
  active += 1; let released = false;
  return () => { if (!released) { released = true; active = Math.max(0, active - 1); } };
}
