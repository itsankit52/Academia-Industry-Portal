import type { RequestHandler } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Populates `req.user` when the caller happens to be signed in, but lets
 * anonymous requests through untouched.
 *
 * Public endpoints use this to widen what a privileged caller may see — an
 * admin listing drafts, a company opening its own unpublished posting — without
 * turning the endpoint itself into a login-required route. Unlike `requireAuth`,
 * a missing, expired or malformed token is treated as "anonymous" rather than an
 * error, so a stale cookie can never break a page that anyone is meant to read.
 *
 * This grants nothing on its own: every caller still arrives with whatever role
 * their token proves, and the services decide what that role is allowed to see.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[
    COOKIE_NAMES.ACCESS
  ];
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
  const token = cookieToken || bearer;

  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, role: payload.role };
    } catch {
      // Intentionally ignored — the caller is simply treated as anonymous.
    }
  }
  next();
};
