/**
 * Google OAuth authentication service.
 *
 * Security model:
 * - The Google ID token is verified server-side using the official google-auth-library.
 * - Token signature, audience (our client ID), issuer, and expiry are all validated
 *   by `verifyIdToken` before any user data is trusted.
 * - Only the claims from the VERIFIED token payload are used — nothing from the
 *   frontend request body is trusted for identity or email.
 * - A matching-email local account is NOT automatically merged with a Google account.
 *   The user must pass the explicit account-linking flow.
 * - googleId is stored with select: false and never echoed in API responses.
 */

import type { Response } from 'express';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import type { Role } from '@aip/config';
import {
  ROLE_FIELD_MESSAGES,
  ROLE_REQUIRED_FIELDS,
  type GoogleAuthInput,
  type GoogleLinkInput,
} from '@aip/validation';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { comparePassword } from '../../utils/password';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { setAuthCookies } from '../../utils/cookies';
import { logger } from '../../utils/logger';
import { classifyGoogleTokenError, type GoogleTokenFailureReason } from './googleTokenErrors';
import { generateUniqueInstitutionCode } from '../institutions/institutions.service';
import {
  User,
  StudentProfile,
  CompanyProfile,
  FacultyProfile,
  Institution,
  AuditLog,
} from '../../models';

// ---------------------------------------------------------------------------
// Module-level singleton — reuse the OAuth client across requests.
// ---------------------------------------------------------------------------

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (!oauthClient) {
    oauthClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return oauthClient;
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID);
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

export interface GoogleClaims {
  sub: string; // Google's permanent user identifier — use this as googleId
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  /** Issued-at (seconds since epoch), from the verified token. */
  iat?: number;
}

/**
 * Builds the client-facing error for a rejected token and records it.
 *
 * Only the reason code, the request correlation id and the error's class/code
 * are logged — never the library message, which can contain the raw token or
 * the decoded identity payload (email, name, sub).
 */
function rejectGoogleToken(
  reason: GoogleTokenFailureReason,
  ctx: LogContext,
  cause?: unknown,
): AppError {
  const errCode = (cause as { code?: unknown } | null)?.code;
  const entry = {
    event: 'google_token_rejected',
    reason,
    requestId: ctx.requestId,
    ...(cause instanceof Error ? { errName: cause.name } : {}),
    ...(typeof errCode === 'string' && /^[A-Z0-9_]{1,40}$/.test(errCode) ? { errCode } : {}),
  };
  // Verifier outages and unrecognised failures need a developer's attention;
  // the rest are ordinary client-side rejections.
  if (reason === 'verifier_unavailable' || reason === 'unknown') {
    logger.error(entry, 'Google ID token rejected');
  } else {
    logger.warn(entry, 'Google ID token rejected');
  }

  if (reason === 'expired') {
    return AppError.unauthorized('Google sign-in session has expired. Please sign in again.');
  }
  if (reason === 'wrong_audience') {
    return AppError.unauthorized('Invalid Google token audience.');
  }
  return AppError.unauthorized('Google sign-in failed. Please try again.');
}

/**
 * Verifies the Google ID token and returns the validated claims.
 * Throws AppError (400 / 401) on any verification failure.
 * Never throws or logs the raw Google error so token contents stay private.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  ctx: LogContext = {},
): Promise<GoogleClaims> {
  if (!isGoogleAuthConfigured()) {
    throw AppError.serviceUnavailable('Google authentication is not configured');
  }

  let payload: TokenPayload | undefined;
  try {
    const ticket = await getOAuthClient().verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw rejectGoogleToken(classifyGoogleTokenError(err), ctx, err);
  }

  if (!payload) throw rejectGoogleToken('malformed', ctx);
  // Reject tokens without a stable subject identifier.
  if (!payload.sub) throw rejectGoogleToken('missing_subject', ctx);

  // Reject unverified email addresses.
  if (!payload.email_verified) {
    logger.warn(
      { event: 'google_token_rejected', reason: 'email_unverified', requestId: ctx.requestId },
      'Google ID token rejected',
    );
    throw AppError.badRequest(
      'Your Google account email is not verified. Please verify your Google email and try again.',
    );
  }

  return {
    sub: payload.sub,
    email: (payload.email ?? '').toLowerCase().trim(),
    email_verified: payload.email_verified ?? false,
    name: payload.name,
    picture: payload.picture,
    iat: payload.iat,
  };
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

/** What may be attached to log lines: a correlation id, nothing personal. */
interface LogContext {
  requestId?: string;
}

interface AuthContext extends LogContext {
  ip?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function publicUser(user: { toJSON: () => unknown }) {
  return user.toJSON();
}

/**
 * Loggable facts about an error without its message: class name, a symbolic
 * or numeric code, and — for duplicate keys — the field names only.
 */
function safeErrorFields(err: unknown): Record<string, unknown> {
  const e = err as { name?: unknown; code?: unknown; keyValue?: unknown } | null;
  return {
    ...(typeof e?.name === 'string' ? { errName: e.name } : {}),
    ...(typeof e?.code === 'string' || typeof e?.code === 'number' ? { errCode: e.code } : {}),
    ...(e?.keyValue && typeof e.keyValue === 'object'
      ? { duplicateFields: Object.keys(e.keyValue) }
      : {}),
    ...(err instanceof AppError ? { status: err.statusCode } : {}),
  };
}

function issueSession(res: Response, userId: string, role: Role, tokenVersion: number) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, tokenVersion });
  setAuthCookies(res, accessToken, refreshToken);
}

/** Institution lookup shared with registerUser — validates existence + verification status. */
async function assertInstitutionVerified(
  institutionId: string,
  institutionCode?: string,
): Promise<void> {
  const inst = await Institution.findById(institutionId)
    .select('_id code verificationStatus')
    .lean();
  if (!inst) throw AppError.badRequest('Institution not found');
  if ((inst as Record<string, unknown>).verificationStatus !== 'VERIFIED') {
    throw AppError.badRequest(
      'The selected institution is pending verification and cannot accept registrations yet.',
    );
  }
  if (institutionCode !== undefined) {
    const expected = (inst as Record<string, unknown>).code as string;
    if (expected !== institutionCode.trim().toUpperCase()) {
      throw AppError.badRequest('The institution code does not match the selected institution');
    }
  }
}

// ---------------------------------------------------------------------------
// Core Google auth flow
// ---------------------------------------------------------------------------

export type GoogleAuthResult =
  | { status: 'authenticated'; user: unknown }
  | { status: 'needs_role'; email: string; name?: string; picture?: string }
  | { status: 'email_conflict'; email: string };

/**
 * Main entry point for `POST /auth/google`.
 *
 * Returns one of three outcomes:
 *   authenticated  — cookies were set, user is logged in.
 *   needs_role     — new Google user; frontend should collect role + profile.
 *   email_conflict — a local account uses this email; frontend shows link UI.
 */
export async function handleGoogleAuth(
  input: GoogleAuthInput,
  res: Response,
  ctx: AuthContext,
): Promise<GoogleAuthResult> {
  const claims = await verifyGoogleIdToken(input.idToken, ctx);
  const { sub: googleId, email, name, picture } = claims;

  // ── Path 1: Existing Google account ──────────────────────────────────────
  const existingGoogle = await User.findOne({ googleId }).select('+googleId +refreshTokenVersion');
  if (existingGoogle) {
    if (!existingGoogle.isActive) {
      throw AppError.unauthorized('This account has been deactivated.');
    }
    existingGoogle.lastLoginAt = new Date();
    await existingGoogle.save();

    issueSession(
      res,
      String(existingGoogle._id),
      existingGoogle.role as Role,
      (existingGoogle.refreshTokenVersion as number | undefined) ?? 0,
    );

    await AuditLog.create({
      actor: existingGoogle._id,
      actorEmail: existingGoogle.email,
      role: existingGoogle.role,
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: String(existingGoogle._id),
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { status: 'authenticated', user: publicUser(existingGoogle) };
  }

  // ── Path 2: Email belongs to a local-only account ────────────────────────
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    if (!existingEmail.isActive) {
      throw AppError.unauthorized('This account has been deactivated.');
    }
    // We do NOT auto-link. The frontend must present the account-linking UI.
    return { status: 'email_conflict', email };
  }

  // ── Path 3a: Brand-new Google user — no role yet ─────────────────────────
  if (!input.role) {
    return { status: 'needs_role', email, name, picture };
  }

  // ── Path 3b: New Google user with role — create the account ──────────────
  return createGoogleAccount({ googleId, email, name, picture }, input, res, ctx);
}

// ---------------------------------------------------------------------------
// Account creation
// ---------------------------------------------------------------------------

async function createGoogleAccount(
  google: { googleId: string; email: string; name?: string; picture?: string },
  input: GoogleAuthInput,
  res: Response,
  ctx: AuthContext,
): Promise<GoogleAuthResult> {
  const { googleId, email, picture } = google;
  const role = input.role;
  if (!role) throw AppError.unprocessable('role is required to create an account');

  // googleAuthSchema already enforces ROLE_REQUIRED_FIELDS. This re-check runs
  // before any write so that, even if the route were wired without that
  // schema, a missing field is a 422 rather than a crash mid-signup.
  const missing = ROLE_REQUIRED_FIELDS[role].filter((field) => !input[field]);
  if (missing.length > 0) {
    throw AppError.unprocessable(
      ROLE_FIELD_MESSAGES[missing[0]!],
      missing.map((path) => ({ path, message: ROLE_FIELD_MESSAGES[path] })),
    );
  }

  // Validate institution for roles that require it.
  if (role === 'STUDENT') {
    await assertInstitutionVerified(input.institutionId as string, input.institutionCode);
  } else if (role === 'FACULTY') {
    await assertInstitutionVerified(input.institutionId as string);
  }

  // Create the User.
  const user = await User.create({
    email,
    // Google-only accounts have no passwordHash — the field is now optional in
    // the schema. Existing local accounts remain untouched.
    googleId,
    authProvider: 'google',
    googleAvatar: picture ?? undefined,
    role,
    isActive: true,
    lastLoginAt: new Date(),
    ...((role === 'STUDENT' || role === 'FACULTY') && input.institutionId
      ? { institution: input.institutionId }
      : {}),
  });

  // Create the role profile — same compensation pattern as local registration.
  // Anything created here is undone in the catch block, so a failure part-way
  // through leaves neither a User nor an Institution behind.
  let createdInstitutionId: unknown;
  try {
    if (role === 'STUDENT') {
      await StudentProfile.create({
        user: user._id,
        institution: input.institutionId,
        fullName: input.fullName,
      });
    } else if (role === 'COMPANY') {
      await CompanyProfile.create({
        user: user._id,
        companyName: input.companyName,
      });
    } else if (role === 'FACULTY') {
      await FacultyProfile.create({
        user: user._id,
        institution: input.institutionId,
        fullName: input.fullName,
        designation: input.designation ?? 'Assistant Professor',
        department: input.department ?? 'General',
      });
    } else if (role === 'INSTITUTION') {
      let code: string;
      if (input.institutionCode) {
        const normalized = input.institutionCode.toUpperCase();
        const exists = await Institution.findOne({ code: normalized }).select('_id').lean();
        if (exists) throw AppError.conflict('This institution code is already in use');
        code = normalized;
      } else {
        code = await generateUniqueInstitutionCode();
      }
      const institution = await Institution.create({
        name: input.institutionName,
        code,
        domain: String(input.institutionDomain).toLowerCase(),
        address: input.institutionAddress,
        city: input.institutionCity,
        state: input.institutionState,
        contactEmail: email,
        verificationStatus: 'PENDING',
      });
      createdInstitutionId = institution._id;
      user.institution = institution._id;
      await user.save();
    }
  } catch (err) {
    try {
      if (createdInstitutionId) await Institution.deleteOne({ _id: createdInstitutionId });
      await User.deleteOne({ _id: user._id });
    } catch (cleanupErr) {
      logger.error(
        {
          event: 'google_signup_rollback_failed',
          userId: String(user._id),
          role,
          requestId: ctx.requestId,
          ...safeErrorFields(cleanupErr),
        },
        'Google profile creation failed AND rollback of the user failed — orphaned account',
      );
    }
    // No email and no raw error: a duplicate-key error's message and keyValue
    // carry the conflicting value (an email or domain).
    logger.warn(
      {
        event: 'google_signup_rolled_back',
        userId: String(user._id),
        role,
        requestId: ctx.requestId,
        ...safeErrorFields(err),
      },
      'Profile creation failed during Google sign-up; rolled back',
    );
    throw err;
  }

  await AuditLog.create({
    actor: user._id,
    actorEmail: user.email,
    role: user.role,
    action: 'USER_REGISTERED',
    entity: 'User',
    entityId: String(user._id),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  issueSession(
    res,
    String(user._id),
    user.role as Role,
    (user.refreshTokenVersion as number | undefined) ?? 0,
  );

  return { status: 'authenticated', user: publicUser(user) };
}

// ---------------------------------------------------------------------------
// Account linking
// ---------------------------------------------------------------------------

/**
 * A Google ID token is accepted as proof of ownership for linking only if it
 * was minted recently. GIS issues a new token on every sign-in, so a genuine
 * link attempt is always well inside this window; an older (but unexpired)
 * token that was captured or replayed is refused.
 */
const LINK_TOKEN_MAX_AGE_SECONDS = 10 * 60;

const GOOGLE_OWNED_BY_OTHER =
  'This Google account is already linked to a different AcadIn account.';
const ACCOUNT_LINKED_TO_OTHER =
  'Your AcadIn account is already linked to a different Google account.';

function isDuplicateKeyError(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === 11000;
}

/**
 * Links a Google identity to the authenticated AcadIn account.
 *
 * Route-level guards (auth.routes.ts) have already enforced: exact SPA Origin,
 * JSON body, and a valid session. This function then requires:
 * - a valid Google ID token issued within LINK_TOKEN_MAX_AGE_SECONDS;
 * - the account's current password, whenever the account has one;
 * - that the account is not linked to a *different* Google identity (409 —
 *   an existing googleId is never overwritten), and that the Google identity
 *   is not owned by another account (409).
 * The write itself is a conditional update on `googleId: null`, so two
 * concurrent requests cannot both succeed, and the unique sparse index on
 * googleId turns a cross-account race into a duplicate-key error → 409.
 */
export async function linkGoogleAccount(
  userId: string,
  input: GoogleLinkInput,
  ctx: AuthContext,
): Promise<unknown> {
  const claims = await verifyGoogleIdToken(input.idToken, ctx);
  const { sub: googleId } = claims;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!claims.iat || nowSeconds - claims.iat > LINK_TOKEN_MAX_AGE_SECONDS) {
    throw AppError.unauthorized(
      'Your Google sign-in is too old to confirm ownership. Please sign in with Google again.',
    );
  }

  const user = await User.findById(userId).select('+googleId +passwordHash');
  if (!user || !user.isActive) throw AppError.unauthorized('Invalid session');

  // Re-authenticate the AcadIn account. A stolen or ridden session alone must
  // not be enough to attach a new login method.
  const passwordHash = user.get('passwordHash') as string | undefined;
  if (passwordHash) {
    if (!input.currentPassword) {
      throw AppError.badRequest('currentPassword is required to link a Google account');
    }
    const matches = await comparePassword(input.currentPassword, passwordHash);
    if (!matches) throw AppError.forbidden('Password confirmation failed');
  }

  const currentGoogleId = user.get('googleId') as string | undefined;
  if (currentGoogleId) {
    // Same identity: idempotent, nothing to write.
    if (currentGoogleId === googleId) return publicUser(user);
    throw AppError.conflict(ACCOUNT_LINKED_TO_OTHER);
  }

  // Only accounts with a password can reach here (a Google-only account always
  // has a googleId), so the password check above has run.
  if (!passwordHash) {
    throw AppError.forbidden('This account cannot be linked to Google.');
  }

  if (await User.exists({ googleId, _id: { $ne: user._id } })) {
    throw AppError.conflict(GOOGLE_OWNED_BY_OTHER);
  }

  let linked;
  try {
    linked = await User.findOneAndUpdate(
      // `googleId: null` matches only an account with no Google identity, so a
      // concurrent request that linked first makes this a no-op, never an overwrite.
      { _id: user._id, isActive: true, googleId: null },
      { $set: { googleId, authProvider: 'both' } },
      { new: true },
    ).select('+googleId');
  } catch (err) {
    if (isDuplicateKeyError(err)) throw AppError.conflict(GOOGLE_OWNED_BY_OTHER);
    throw err;
  }

  if (!linked) {
    // Lost a race with another link request for this same account.
    const fresh = await User.findById(user._id).select('+googleId');
    const nowLinked = fresh?.get('googleId') as string | undefined;
    if (fresh && nowLinked === googleId) return publicUser(fresh);
    if (nowLinked) throw AppError.conflict(ACCOUNT_LINKED_TO_OTHER);
    throw AppError.unauthorized('Invalid session');
  }

  if (!linked.get('googleAvatar') && claims.picture) {
    linked.set('googleAvatar', claims.picture);
    await linked.save();
  }

  await AuditLog.create({
    actor: linked._id,
    actorEmail: linked.email,
    role: linked.role,
    action: 'USER_UPDATED',
    entity: 'User',
    entityId: String(linked._id),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  logger.info({ userId, action: 'google_account_linked' }, 'Google account linked');
  return publicUser(linked);
}
