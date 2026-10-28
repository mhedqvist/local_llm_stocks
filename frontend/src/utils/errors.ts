/**
 * Error types shared by the data layer.
 */

/**
 * Thrown when the data provider rate-limits a request (HTTP 429).
 * `retryAfterSeconds` is parsed from the `Retry-After` header when present
 * (HTTP-date or delta-seconds), otherwise a conservative default.
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/** Parses a `Retry-After` header value (delta-seconds or HTTP-date) into seconds. */
export function parseRetryAfterSeconds(header: string | null, defaultSeconds = 15): number {
  if (header) {
    const delta = Number(header);
    if (Number.isFinite(delta) && delta >= 0) return delta;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, (date - Date.now()) / 1000);
  }
  return defaultSeconds;
}
