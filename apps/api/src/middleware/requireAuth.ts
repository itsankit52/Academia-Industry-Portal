import type { RequestHandler } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwt';

export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const cookieToken = (req as unknown as { cookies?: Record<string, string> }).cookies?.[COOKIE_NAMES.ACCESS];
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : undefined;
    const token = cookieToken || bearer;

    if (!token) throw AppError.unauthorized('Authentication required');

    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(err);
  }
};
