import type { CookieOptions, Response } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import { env } from '../config/env';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_PATH = '/api/v1/auth';

function baseOptions(): CookieOptions {
  const sameSite = env.COOKIE_SAMESITE;
  return {
    httpOnly: true,
    sameSite,
    // Browsers reject `SameSite=None` outright unless the cookie is also
    // `Secure`, and they do it silently — no cookie, no console error, just a
    // login that appears to succeed and then 401s. Deriving it here means the
    // cross-site case cannot be half-configured.
    secure: env.COOKIE_SECURE || sameSite === 'none',
    // Only send `Domain` when one is actually configured. Omitting it yields a
    // host-only cookie, which is what a deployed API on a shared suffix domain
    // (e.g. *.onrender.com) needs; passing a domain that is not a parent of the
    // request host gets the cookie discarded.
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, {
    ...baseOptions(),
    path: '/',
    maxAge: ACCESS_MAX_AGE_MS,
  });
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, {
    ...baseOptions(),
    path: REFRESH_PATH,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS, { ...baseOptions(), path: '/' });
  res.clearCookie(COOKIE_NAMES.REFRESH, { ...baseOptions(), path: REFRESH_PATH });
}
