/** Retries transient failures (rate limits, timeouts, malformed JSON) with exponential backoff + jitter. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 1000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseMs * 2 ** i + Math.random() * 250));
    }
  }
  throw last;
}
