import type { CookieOptions, Response } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import { env } from '../config/env';

const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_PATH = '/api/v1/auth';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
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
