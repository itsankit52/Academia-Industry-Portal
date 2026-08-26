import type { RequestHandler } from 'express';
import type { Role } from '@aip/config';
import { AppError } from '../utils/AppError';

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) return next(AppError.forbidden('Insufficient role'));
    next();
  };
}
