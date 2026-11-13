import type { Request, Response } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  GoogleAuthInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './auth.service';
import * as googleService from './auth.google.service';

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

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await googleService.handleGoogleAuth(req.body as GoogleAuthInput, res, {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });

  if (result.status === 'authenticated') {
    return ok(res, { user: result.user });
  }
  if (result.status === 'needs_role') {
    // No cookies set — the frontend must collect role + profile and re-POST.
    return ok(res, {
      requiresOnboarding: true,
      googleId: result.googleId,
      email: result.email,
      name: result.name,
      picture: result.picture,
    });
  }
  // email_conflict — a local account uses this email
  return ok(res, {
    emailConflict: true,
    email: result.email,
    message:
      'An account with this email already exists. Sign in with your password, then link Google from your account settings.',
  });
});

export const googleLink = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body as { idToken: string };
  const user = await googleService.linkGoogleAccount(req.user!.id, idToken, res, {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  return ok(res, { user });
});
