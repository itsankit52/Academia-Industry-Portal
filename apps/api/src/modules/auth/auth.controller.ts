import type { Request, Response } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import type { RegisterInput, LoginInput, ChangePasswordInput } from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './auth.service';

function readCookie(req: Request, name: string): string | undefined {
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  return cookies?.[name];
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.registerUser(req.body as RegisterInput, res, {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  return created(res, { user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.loginUser(req.body as LoginInput, res, {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  return ok(res, { user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await service.logoutUser(readCookie(req, COOKIE_NAMES.REFRESH), res);
  return noContent(res);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = readCookie(req, COOKIE_NAMES.REFRESH);
  const user = await service.refreshTokens(token, res);
  return ok(res, { user });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCurrentUser(req.user!.id);
  return ok(res, data);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await service.changePassword(req.user!.id, req.body as ChangePasswordInput, res, {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  return noContent(res);
});
