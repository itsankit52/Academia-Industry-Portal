import type { Request, Response } from 'express';
import { COOKIE_NAMES } from '@aip/config';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  GoogleAuthInput,
  GoogleLinkInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './auth.service';
import * as googleService from './auth.google.service';

/**
 * Request facts handed to services. `requestId` is pino-http's per-request id,
 * so service log lines can be correlated with the request log line.
 */
function authContext(req: Request) {
  const id = (req as unknown as { id?: unknown }).id;
  return {
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
    requestId: id === undefined || id === null ? undefined : String(id),
  };
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies;
  return cookies?.[name];
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.registerUser(req.body as RegisterInput, res, authContext(req));
  return created(res, { user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const user = await service.loginUser(req.body as LoginInput, res, authContext(req));
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
  await service.changePassword(
    req.user!.id,
    req.body as ChangePasswordInput,
    res,
    authContext(req),
  );
  return noContent(res);
});

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await googleService.handleGoogleAuth(
    req.body as GoogleAuthInput,
    res,
    authContext(req),
  );

  if (result.status === 'authenticated') {
    return ok(res, { user: result.user });
  }
  if (result.status === 'needs_role') {
    // No cookies set — the frontend must collect role + profile and re-POST.
    return ok(res, {
      requiresOnboarding: true,
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
  const user = await googleService.linkGoogleAccount(
    req.user!.id,
    req.body as GoogleLinkInput,
    authContext(req),
  );
  return ok(res, { user });
});
