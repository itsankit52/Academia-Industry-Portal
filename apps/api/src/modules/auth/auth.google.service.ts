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
import { OAuth2Client } from 'google-auth-library';
import type { Role } from '@aip/config';
import type { GoogleAuthInput } from '@aip/validation';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { signAccessToken, signRefreshToken } from '../../utils/jwt';
import { setAuthCookies } from '../../utils/cookies';
import { logger } from '../../utils/logger';
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
}

/**
 * Verifies the Google ID token and returns the validated claims.
 * Throws AppError (400 / 401) on any verification failure.
 * Never throws the raw Google error so internals stay server-side.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleClaims> {
  if (!isGoogleAuthConfigured()) {
    throw AppError.serviceUnavailable('Google authentication is not configured');
  }

  try {
    const ticket = await getOAuthClient().verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Empty token payload');
    }

    // Reject tokens without a stable subject identifier.
    const sub = payload.sub;
    if (!sub) {
      throw new Error('Token missing sub claim');
    }

    // Reject unverified email addresses.
    if (!payload.email_verified) {
      throw AppError.badRequest(
        'Your Google account email is not verified. Please verify your Google email and try again.',
      );
    }

    return {
      sub,
      email: (payload.email ?? '').toLowerCase().trim(),
      email_verified: payload.email_verified ?? false,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (err) {
    // Re-throw AppErrors from our own checks.
    if (err instanceof AppError) throw err;

    // Map google-auth-library errors to safe client messages.
    const msg = String((err as Error)?.message ?? '');
    logger.warn({ err: msg }, 'Google ID token verification failed');

    if (/expired/i.test(msg)) {
      throw AppError.unauthorized('Google sign-in session has expired. Please sign in again.');
    }
    if (/audience/i.test(msg)) {
      throw AppError.unauthorized('Invalid Google token audience.');
    }
    throw AppError.unauthorized('Google sign-in failed. Please try again.');
  }
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

interface AuthContext {
  ip?: string;
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function publicUser(user: { toJSON: () => unknown }) {
  return user.toJSON();
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
  | { status: 'needs_role'; googleId: string; email: string; name?: string; picture?: string }
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
  const claims = await verifyGoogleIdToken(input.idToken);
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
    return { status: 'needs_role', googleId, email, name, picture };
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
  const { googleId, email, name, picture } = google;
  const role = input.role!;

  // Validate institution for roles that require it.
  if (role === 'STUDENT') {
    if (!input.institutionId) throw AppError.badRequest('institutionId is required for STUDENT');
    if (!input.institutionCode)
      throw AppError.badRequest('institutionCode is required for STUDENT');
    await assertInstitutionVerified(input.institutionId, input.institutionCode);
  } else if (role === 'FACULTY') {
    if (!input.institutionId) throw AppError.badRequest('institutionId is required for FACULTY');
    await assertInstitutionVerified(input.institutionId);
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
  try {
    if (role === 'STUDENT') {
      await StudentProfile.create({
        user: user._id,
        institution: input.institutionId,
        fullName: input.fullName ?? name ?? email.split('@')[0],
      });
    } else if (role === 'COMPANY') {
      await CompanyProfile.create({
        user: user._id,
        companyName: input.companyName ?? name ?? email.split('@')[0],
      });
    } else if (role === 'FACULTY') {
      await FacultyProfile.create({
        user: user._id,
        institution: input.institutionId,
        fullName: input.fullName ?? name ?? email.split('@')[0],
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
        domain: input.institutionDomain!.toLowerCase(),
        address: input.institutionAddress,
        city: input.institutionCity,
        state: input.institutionState,
        contactEmail: email,
        verificationStatus: 'PENDING',
      });
      user.institution = institution._id;
      await user.save();
    }
  } catch (err) {
    try {
      await User.deleteOne({ _id: user._id });
    } catch (cleanupErr) {
      logger.error(
        { err: cleanupErr, userId: String(user._id), email, role },
        'Google profile creation failed AND rollback of the user failed — orphaned account',
      );
    }
    logger.warn({ err, email, role }, 'Profile creation failed during Google sign-up; rolled back');
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
 * Links a Google identity to an existing local account.
 *
 * Requirements:
 * - The user must already be authenticated (req.user is set by requireAuth).
 * - The Google token must be valid and must not already be linked to another user.
 * - The token's email doesn't have to match (the user might have different emails).
 */
export async function linkGoogleAccount(
  userId: string,
  idToken: string,
  res: Response,
  ctx: AuthContext,
): Promise<unknown> {
  const claims = await verifyGoogleIdToken(idToken);
  const { sub: googleId } = claims;

  // Check the Google ID isn't already used by a different account.
  const existing = await User.findOne({ googleId }).select('+googleId');
  if (existing && String(existing._id) !== userId) {
    throw AppError.conflict('This Google account is already linked to a different AcadIn account.');
  }
  if (existing && String(existing._id) === userId) {
    // Already linked to this account — idempotent success.
    const user = await User.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    return publicUser(user);
  }

  // Link the Google identity.
  const user = await User.findById(userId).select('+googleId +refreshTokenVersion');
  if (!user) throw AppError.notFound('User not found');
  if (!user.isActive) throw AppError.unauthorized('Account is deactivated');

  user.set('googleId', googleId);
  user.set('authProvider', 'both');
  if (!user.get('googleAvatar') && claims.picture) {
    user.set('googleAvatar', claims.picture);
  }
  await user.save();

  await AuditLog.create({
    actor: user._id,
    actorEmail: user.email,
    role: user.role,
    action: 'USER_UPDATED',
    entity: 'User',
    entityId: String(user._id),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  logger.info({ userId, action: 'google_account_linked' }, 'Google account linked');
  return publicUser(user);
}
