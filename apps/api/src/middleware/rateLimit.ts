import rateLimit from 'express-rate-limit';
import type { ApiError } from '@aip/types';
import { env } from '../config/env';

const tooManyBody: ApiError = {
  success: false,
  error: {
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later',
  },
};

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyBody,
});

export const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count towards the budget. Counting successes too meant
  // a signup plus a couple of logins from one IP hit the cap and returned 429,
  // which is indistinguishable from "login is broken" to the person using it —
  // and shared/NAT'd networks tripped it constantly. Brute-force protection is
  // unchanged, since a guessing attacker only ever produces failures.
  skipSuccessfulRequests: true,
  // The limiter is per-IP and its counters live for the whole process, so an
  // integration suite exercising auth from one address would otherwise start
  // returning 429 partway through and fail for reasons unrelated to the code
  // under test. Only the throttle is lifted — authentication itself still runs.
  skip: () => env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many failed authentication attempts, please try again in 2 minutes',
    },
  } satisfies ApiError,
});
