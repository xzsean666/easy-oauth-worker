import type { MiddlewareHandler } from 'hono';
import type { AppContext } from '../types/env';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

// Module-scoped LRU-like memory map (purged lazily)
const store = new Map<string, RateLimitRecord>();
const MAX_STORE_SIZE = 10000;

export function getClientIp(c: any): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/**
 * Increments and checks rate limit for a given key.
 * Completely in-memory, O(1), zero database cost.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Math.floor(Date.now() / 1000);

  // Lazy clean-up if map grows large
  if (store.size > MAX_STORE_SIZE) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt <= now) {
        store.delete(k);
      }
    }
  }

  const record = store.get(key);

  if (!record || record.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowSeconds });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowSeconds };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(1, record.resetAt - now),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetIn: Math.max(1, record.resetAt - now),
  };
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Hono middleware to rate limit requests.
 */
export function rateLimiter(options: {
  maxRequests: number;
  windowSeconds: number;
  prefix?: string;
  errorMessage?: string;
}): MiddlewareHandler<AppContext> {
  const { maxRequests, windowSeconds, prefix = 'rl', errorMessage = 'Too many requests, please try again later.' } = options;

  return async (c, next) => {
    const ip = getClientIp(c);
    const key = `${prefix}:${ip}`;
    const result = checkRateLimit(key, maxRequests, windowSeconds);

    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.resetIn));

    if (!result.allowed) {
      c.header('Retry-After', String(result.resetIn));
      const isApi =
        c.req.path.startsWith('/api/') ||
        c.req.path.startsWith('/oauth/') ||
        c.req.path.startsWith('/.well-known/');

      if (isApi) {
        return c.json({ error: 'rate_limited', message: errorMessage }, 429);
      }
      return c.text(errorMessage, 429);
    }

    await next();
  };
}
