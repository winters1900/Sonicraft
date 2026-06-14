import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function parseAllowedOrigins(raw = ''): string[] {
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  if (!origin || !allowed.length) return true;
  return allowed.includes(origin);
}

export function createRateLimiter(options: RateLimitOptions) {
  const now = options.now ?? Date.now;
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const current = buckets.get(key);
      if (!current || t >= current.resetAt) {
        buckets.set(key, { count: 1, resetAt: t + options.windowMs });
        return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
      }
      current.count += 1;
      return {
        allowed: current.count <= options.max,
        remaining: Math.max(0, options.max - current.count),
        retryAfterMs: Math.max(0, current.resetAt - t),
      };
    },
  };
}

export function rateLimitMiddleware(limiter = createRateLimiter({
  max: Number(process.env.RATE_LIMIT_MAX ?? 120),
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
})): RequestHandler {
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const result = limiter.check(key);
    if (result.allowed) {
      next();
      return;
    }
    res.setHeader('Retry-After', Math.ceil(result.retryAfterMs / 1000));
    res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  };
}
