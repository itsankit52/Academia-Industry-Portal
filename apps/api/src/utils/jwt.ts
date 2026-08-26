import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@aip/config';
import { env } from '../config/env';
import { AppError } from './AppError';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const opts: SignOptions = { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === 'string') throw AppError.unauthorized('Invalid token');
    const { sub, role } = decoded as { sub?: string; role?: Role };
    if (!sub || !role) throw AppError.unauthorized('Invalid token payload');
    return { sub, role };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw err;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (typeof decoded === 'string') throw AppError.unauthorized('Invalid refresh token');
    const { sub, tokenVersion } = decoded as { sub?: string; tokenVersion?: number };
    if (!sub || typeof tokenVersion !== 'number') {
      throw AppError.unauthorized('Invalid refresh token payload');
    }
    return { sub, tokenVersion };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw err;
  }
}
