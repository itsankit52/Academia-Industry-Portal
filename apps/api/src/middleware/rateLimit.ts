import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import type { Request } from 'express';
import type { ApiError } from '@aip/types';
import { COOKIE_NAMES } from '@aip/config';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Rate-limiting policy
 * --------------------
 * Every limiter here keys off `req.ip`, never off a raw header. `req.ip` is
 * resolved by Express from `trust proxy` (set to 1 in app.ts): Render's edge
 * appends the real client address as the last X-Forwarded-For hop, so a
 * client-supplied X-Forwarded-For value cannot change which bucket it lands in.
 *
 * Counters live in the default in-process MemoryStore. That is correct for the
 * current deployment (one Render instance). Counters reset when the process
 * restarts (deploys, free-tier spin-down). If the API is ever scaled to more
 * than one instance, each instance counts independently and a shared store
 * (e.g. rate-limit-redis) becomes necessary.
 *
 *   globalLimiter  all /api/v1 routes except the health check
 *                  - signed-in callers: per user id   (RATE_LIMIT_USER_MAX_REQUESTS)
 *                  - anonymous callers: per client IP (RATE_LIMIT_MAX_REQUESTS)
 *                  Keying signed-in traffic by user keeps a campus behind one
 *                  NAT address from sharing a single budget.
 *   authLimiter    login / register / google / change-password, per IP,
 *                  failed attempts only (brute-force protection).
 *   aiLimiter      Gemini-backed /ai routes, per user (RATE_LIMIT_AI_MAX_REQUESTS).
 */

export function tooManyRequestsBody(message: string): ApiError {
  return { success: false, error: { code: 'TOO_MANY_REQUESTS', message } };
}

const DEFAULT_MESSAGE = 'Too many requests, please try again later';

function clientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

/** The user id proven by a valid access token, or null for anonymous callers. */
const identityCache = new WeakMap<Request, string | null>();
export function authenticatedUserId(req: Request): string | null {
  if (req.user?.id) return req.user.id;
  if (identityCache.has(req)) return identityCache.get(req) ?? null;

  const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[
    COOKIE_NAMES.ACCESS
  ];
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  const token = cookieToken || bearer;

  let userId: string | null = null;
  if (token) {
    try {
      userId = verifyAccessToken(token).sub;
    } catch {
      // Invalid / expired / forged token: treated as anonymous (keyed by IP).
      userId = null;
    }
  }
  identityCache.set(req, userId);
  return userId;
}

/** `user:<id>` for a verified session, otherwise `ip:<req.ip>`. */
export function clientKey(req: Request): string {
  const userId = authenticatedUserId(req);
  return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
}

/** Health probes (Render's healthCheckPath, uptime monitors) are never throttled. */
export function isHealthCheck(req: Request): boolean {
  return (req.method === 'GET' || req.method === 'HEAD') && /^\/health\/?$/.test(req.path);
}

const common = { standardHeaders: true, legacyHeaders: false } as const;

export interface GlobalLimiterOptions {
  windowMs: number;
  anonymousMax: number;
  authenticatedMax: number;
}

export function createGlobalLimiter(o: GlobalLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    ...common,
    windowMs: o.windowMs,
    limit: (req) => (authenticatedUserId(req) ? o.authenticatedMax : o.anonymousMax),
    keyGenerator: clientKey,
    skip: isHealthCheck,
    message: tooManyRequestsBody(DEFAULT_MESSAGE),
  });
}

export interface AuthLimiterOptions {
  windowMs: number;
  max: number;
  skip?: () => boolean;
}

export function createAuthLimiter(o: AuthLimiterOptions): RateLimitRequestHandler {
  const minutes = Math.max(1, Math.round(o.windowMs / 60_000));
  return rateLimit({
    ...common,
    windowMs: o.windowMs,
    limit: o.max,
    // Always per IP: the caller is not authenticated yet (or, for
    // change-password, is proving a password) so the user id is not a safe key.
    keyGenerator: (req) => `ip:${clientIp(req)}`,
    // Only failed attempts count towards the budget. Counting successes too meant
    // a signup plus a couple of logins from one IP hit the cap and returned 429,
    // and shared/NAT'd networks tripped it constantly. Brute-force protection is
    // unchanged, since a guessing attacker only ever produces failures.
    skipSuccessfulRequests: true,
    skip: o.skip,
    message: tooManyRequestsBody(
      `Too many failed authentication attempts, please try again in ${minutes} minute${minutes === 1 ? '' : 's'}`,
    ),
  });
}

export interface UserLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * Per-user budget for expensive endpoints. Must be mounted after `requireAuth`;
 * falls back to the client IP if it is not.
 */
export function createUserLimiter(o: UserLimiterOptions): RateLimitRequestHandler {
  return rateLimit({
    ...common,
    windowMs: o.windowMs,
    limit: o.max,
    keyGenerator: clientKey,
    message: tooManyRequestsBody(o.message ?? DEFAULT_MESSAGE),
  });
}

export const globalLimiter = createGlobalLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  anonymousMax: env.RATE_LIMIT_MAX_REQUESTS,
  authenticatedMax: env.RATE_LIMIT_USER_MAX_REQUESTS,
});

export const authLimiter = createAuthLimiter({
  windowMs: 2 * 60 * 1000,
  max: 5,
  // The limiter is per-IP and its counters live for the whole process, so an
  // integration suite exercising auth from one address would otherwise start
  // returning 429 partway through and fail for reasons unrelated to the code
  // under test. Only the throttle is lifted — authentication itself still runs.
  // The limiter's behaviour is covered by rateLimit.test.ts via the factory.
  skip: () => env.NODE_ENV === 'test',
});

export const aiLimiter = createUserLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_AI_MAX_REQUESTS,
  message: 'Too many AI requests, please try again later',
});
