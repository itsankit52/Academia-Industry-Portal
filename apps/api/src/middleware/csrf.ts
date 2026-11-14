import type { Request, RequestHandler } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

/**
 * CSRF defences for cookie-authenticated requests.
 *
 * The SPA and the API are deployed on different sites, so session cookies are
 * `SameSite=None` and the browser attaches them to cross-site requests —
 * including a plain HTML `<form method="POST">` on an attacker's page, which
 * needs no CORS preflight. CORS only stops the attacker *reading* the
 * response; the side effect has already happened. These guards stop the
 * request from being processed at all.
 *
 * The trusted origin is the exact `scheme://host[:port]` of FRONTEND_URL
 * (validated as a URL by env.ts). Comparison is strict string equality — no
 * wildcard, prefix or substring matching.
 */
const TRUSTED_ORIGIN = new URL(env.FRONTEND_URL).origin;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isTrustedOrigin(origin: string | undefined): boolean {
  return typeof origin === 'string' && origin === TRUSTED_ORIGIN;
}

function hasSessionCookie(req: Request): boolean {
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  return Boolean(cookies?.[COOKIE_NAMES.ACCESS] || cookies?.[COOKIE_NAMES.REFRESH]);
}

/**
 * Global guard: an unsafe-method request that carries an AcadIn session cookie
 * and comes from a browser context other than the SPA is rejected.
 *
 * Browsers always send `Origin` on cross-origin POST/PUT/PATCH/DELETE (an
 * opaque or privacy-stripped context sends the literal `null`, which is
 * rejected here). A request with no `Origin` header at all is not a browser
 * cross-site request, so it is let through to keep server-to-server callers
 * and the test suite working; endpoints that must be browser-only use
 * `requireTrustedOrigin` instead, which also rejects a missing header.
 */
export const csrfOriginGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || !hasSessionCookie(req)) return next();
  const origin = req.get('origin');
  if (origin === undefined) return next();
  if (!isTrustedOrigin(origin)) {
    return next(AppError.forbidden('Cross-origin request rejected'));
  }
  return next();
};

/** Strict variant for browser-only, high-impact endpoints: Origin must be present and exact. */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (!origin) return next(AppError.forbidden('Origin header is required'));
  if (!isTrustedOrigin(origin)) return next(AppError.forbidden('Cross-origin request rejected'));
  return next();
};

/**
 * Only `application/json` bodies are accepted. HTML forms can only produce
 * urlencoded, multipart or text/plain bodies, and a cross-site JSON request
 * forces a CORS preflight that the API's CORS policy refuses.
 */
export const requireJsonBody: RequestHandler = (req, _res, next) => {
  if (!req.is('application/json')) {
    return next(AppError.unsupportedMediaType('Content-Type must be application/json'));
  }
  return next();
};
