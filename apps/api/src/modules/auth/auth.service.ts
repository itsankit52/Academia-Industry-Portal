import type { Response } from 'express';
import type { Role } from '@aip/config';
import type { RegisterInput, LoginInput, ChangePasswordInput } from '@aip/validation';
import { AppError } from '../../utils/AppError';
import { hashPassword, comparePassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { setAuthCookies, clearAuthCookies } from '../../utils/cookies';
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

interface AuthContext {
  ip?: string;
  userAgent?: string;
}

/**
 * A refresh token one version behind the stored one is still honoured. Without
 * this, two tabs (or a queued request racing the axios refresh interceptor)
 * that rotate at the same moment would make the slower one look like a replay,
 * and the user would be silently logged out mid-session.
 */
const REFRESH_REPLAY_GRACE = 1;

/**
 * Revocation has to jump *past* the grace window above, otherwise the token the
 * caller held a moment ago would still be inside it and logging out would not
 * actually end the session.
 */
const REVOKE_INCREMENT = REFRESH_REPLAY_GRACE + 1;

function publicUser(user: { toJSON: () => unknown }) {
  return user.toJSON();
}

/**
 * Validates that the institution exists and is VERIFIED before allowing a
 * student or faculty member to register against it.
 *
 * For STUDENT registration, also validates that the supplied institutionCode
 * matches the institution's code (case-insensitive).
 *
 * Defence-in-depth: the Zod schema already enforces that institutionId is
 * present for STUDENT/FACULTY, so this function is always called with a value.
 * The explicit guard here means the service is safe even if called directly
 * (e.g. from tests or future service-to-service calls) without the middleware.
 */
async function assertInstitutionVerified(
  institutionId: string,
  institutionCode?: string,
): Promise<void> {
  const inst = await Institution.findById(institutionId)
    .select('_id code verificationStatus')
    .lean();
  if (!inst) {
    throw AppError.badRequest('Institution not found');
  }
  if ((inst as Record<string, unknown>).verificationStatus !== 'VERIFIED') {
    throw AppError.badRequest(
      'The selected institution is pending verification and cannot accept registrations yet. ' +
        'Please contact your institution administrator.',
    );
  }
  // Code verification for STUDENT: must match exactly (case-insensitive).
  if (institutionCode !== undefined) {
    const expected = (inst as Record<string, unknown>).code as string;
    if (expected !== institutionCode.trim().toUpperCase()) {
      throw AppError.badRequest('The institution code does not match the selected institution');
    }
  }
}

export async function registerUser(input: RegisterInput, res: Response, ctx: AuthContext) {
  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw AppError.conflict('Email already registered');

  // Always validate institutionId for roles that require it — the Zod schema
  // enforces it is present, and this check confirms it resolves to a real,
  // verified institution. The guard is unconditional (no &&) so a missing
  // institutionId that slipped past schema validation is caught here too.
  if (input.role === 'STUDENT') {
    if (!input.institutionId) {
      throw AppError.badRequest('institutionId is required for STUDENT registration');
    }
    if (!input.institutionCode) {
      throw AppError.badRequest('institutionCode is required for STUDENT registration');
    }
    // The server re-validates that the supplied institutionId and institutionCode
    // belong to the same institution. Trusting the institutionId alone would let a
    // client pick Institution A from the catalogue but submit Institution B's code
    // and end up linked to A — defeating the whole point of the code gate.
    await assertInstitutionVerified(input.institutionId, input.institutionCode);
  } else if (input.role === 'FACULTY') {
    if (!input.institutionId) {
      throw AppError.badRequest('institutionId is required for FACULTY registration');
    }
    await assertInstitutionVerified(input.institutionId);
  }

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email,
    passwordHash,
    role: input.role,
    isActive: true,
    // Store the institution reference on the User record for both STUDENT and
    // FACULTY so institution-isolation middleware can gate requests without
    // fetching the profile document on every call.
    ...((input.role === 'STUDENT' || input.role === 'FACULTY') && input.institutionId
      ? { institution: input.institutionId }
      : {}),
  });

  // The User and its role profile have to land together or not at all. There is
  // no transaction here on purpose: requiring one would rule out a standalone
  // mongod in development, so the second write is compensated instead.
  //
  // Getting this wrong is not cosmetic. Every company route resolves the acting
  // company through `CompanyProfile.findOne({ user })`, so a COMPANY user with no
  // CompanyProfile would authenticate normally and then get
  // 'Company profile not found' from the dashboard, job/internship create,
  // publish, the managed lists and every ownership check — and could never
  // recover by signing up again, because the conflict check above would now
  // reject their own email.
  try {
    if (input.role === 'STUDENT') {
      await StudentProfile.create({
        user: user._id,
        institution: input.institutionId,
        fullName: input.fullName,
      });
    } else if (input.role === 'COMPANY') {
      await CompanyProfile.create({ user: user._id, companyName: input.companyName });
    } else if (input.role === 'FACULTY') {
      await FacultyProfile.create({
        user: user._id,
        institution: input.institutionId,
        fullName: input.fullName,
        designation: input.designation ?? 'Assistant Professor',
        department: input.department ?? 'General',
      });
    } else if (input.role === 'INSTITUTION') {
      // The institution account IS the institution — create the institution document
      // first, link it to the user, then update the user record with the ID.
      // The institution code is auto-generated server-side to guarantee uniqueness.
      // If the user supplied a custom code, honour it (after uniqueness check).
      let code: string;
      if (input.institutionCode) {
        const normalized = input.institutionCode.toUpperCase();
        const exists = await Institution.findOne({ code: normalized }).select('_id').lean();
        if (exists) {
          throw AppError.conflict('This institution code is already in use');
        }
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
      // Now we really do have an orphan, and it needs a human. Log loudly with
      // the id so it can be found, but still surface the original failure.
      logger.error(
        { err: cleanupErr, userId: String(user._id), email, role: input.role },
        'Profile creation failed AND rollback of the user failed — orphaned account left behind',
      );
    }
    logger.warn(
      { err, email, role: input.role },
      'Profile creation failed during registration; rolled back the user',
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

  const accessToken = signAccessToken({ sub: String(user._id), role: user.role as Role });
  const refreshToken = signRefreshToken({
    sub: String(user._id),
    tokenVersion: (user.refreshTokenVersion as number | undefined) ?? 0,
  });
  setAuthCookies(res, accessToken, refreshToken);
  return publicUser(user);
}

export async function loginUser(input: LoginInput, res: Response, ctx: AuthContext) {
  const email = input.email.toLowerCase();
  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenVersion');

  // The response is deliberately identical for all three failure modes so the
  // endpoint can't be used to enumerate accounts. The distinguishing reason is
  // recorded server-side only, because without it a support request like
  // "signup worked but login says invalid credentials" is undiagnosable.
  if (!user) {
    logger.warn({ email, ip: ctx.ip }, 'Login rejected: no account with that email');
    throw AppError.unauthorized('Invalid credentials');
  }
  if (!user.isActive) {
    logger.warn({ userId: String(user._id), ip: ctx.ip }, 'Login rejected: account is deactivated');
    throw AppError.unauthorized('Invalid credentials');
  }

  const match = await comparePassword(input.password, user.passwordHash as string);
  if (!match) {
    logger.warn({ userId: String(user._id), ip: ctx.ip }, 'Login rejected: password mismatch');
    throw AppError.unauthorized('Invalid credentials');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ sub: String(user._id), role: user.role as Role });
  const refreshToken = signRefreshToken({
    sub: String(user._id),
    tokenVersion: (user.refreshTokenVersion as number | undefined) ?? 0,
  });
  setAuthCookies(res, accessToken, refreshToken);

  await AuditLog.create({
    actor: user._id,
    actorEmail: user.email,
    role: user.role,
    action: 'USER_LOGIN',
    entity: 'User',
    entityId: String(user._id),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return publicUser(user);
}

/**
 * Logout stays unauthenticated on purpose — a caller whose access token has
 * already expired must still be able to end their session. The subject is
 * therefore taken from the refresh cookie, which is the credential that
 * actually needs revoking. Clearing cookies alone only removes the browser's
 * copy: the refresh token stays valid for its full lifetime until the stored
 * version moves, so `$inc` is the part that ends the session server-side.
 */
export async function logoutUser(refreshToken: string | undefined, res: Response) {
  const userId = subjectFromRefreshToken(refreshToken);
  if (userId) {
    await User.updateOne({ _id: userId }, { $inc: { refreshTokenVersion: REVOKE_INCREMENT } });
  }
  clearAuthCookies(res);
}

/**
 * Logout must succeed even when the refresh token is missing, expired or
 * malformed — there is nothing to revoke in that case, and the caller ends up
 * logged out regardless once the cookies are cleared.
 */
function subjectFromRefreshToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  try {
    return verifyRefreshToken(token).sub;
  } catch {
    return undefined;
  }
}

export async function refreshTokens(refreshToken: string | undefined, res: Response) {
  if (!refreshToken) throw AppError.unauthorized('Missing refresh token');
  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findById(payload.sub).select('+refreshTokenVersion');
  if (!user || !user.isActive) throw AppError.unauthorized('Invalid session');
  const currentVersion = (user.refreshTokenVersion as number | undefined) ?? 0;
  const oldestAccepted = currentVersion - REFRESH_REPLAY_GRACE;
  if (payload.tokenVersion > currentVersion || payload.tokenVersion < oldestAccepted) {
    logger.warn(
      { userId: String(user._id), presented: payload.tokenVersion, currentVersion },
      'Refresh rejected: token version outside the accepted window',
    );
    throw AppError.unauthorized('Refresh token reuse detected');
  }
  user.refreshTokenVersion = currentVersion + 1;
  await user.save();

  const accessToken = signAccessToken({ sub: String(user._id), role: user.role as Role });
  const newRefresh = signRefreshToken({
    sub: String(user._id),
    tokenVersion: user.refreshTokenVersion as number,
  });
  setAuthCookies(res, accessToken, newRefresh);
  return publicUser(user);
}

export async function getCurrentUser(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw AppError.notFound('User not found');
  const base = { user: user.toJSON() as Record<string, unknown> };
  if (user.role === 'STUDENT') {
    const studentProfile = await StudentProfile.findOne({ user: user._id });
    return { ...base, studentProfile: studentProfile ? studentProfile.toJSON() : null };
  }
  if (user.role === 'COMPANY') {
    const companyProfile = await CompanyProfile.findOne({ user: user._id });
    if (!companyProfile) {
      // Registration is now atomic, so this can only be a pre-existing account
      // from before that fix (or a manual DB edit). It is worth shouting about:
      // the user can sign in, but every company route resolves its company
      // through this document and will 404 until someone repairs the account.
      logger.error(
        { userId: String(user._id), email: user.email },
        'COMPANY user has no CompanyProfile — all company routes will fail for this account',
      );
    }
    return { ...base, companyProfile: companyProfile ? companyProfile.toJSON() : null };
  }
  if (user.role === 'FACULTY') {
    const facultyProfile = await FacultyProfile.findOne({ user: user._id });
    return { ...base, facultyProfile: facultyProfile ? facultyProfile.toJSON() : null };
  }
  if (user.role === 'INSTITUTION') {
    // For INSTITUTION users, user.institution holds the ID of the institution document.
    const institution = user.institution
      ? await Institution.findById(user.institution).lean()
      : null;
    return {
      ...base,
      institution: institution
        ? {
            id: String(institution._id),
            name: institution.name as string,
            code: institution.code as string,
            domain: institution.domain as string,
            address: institution.address as string,
            city: institution.city as string,
            state: institution.state as string,
            contactEmail: institution.contactEmail as string,
            contactPhone: (institution as Record<string, unknown>).contactPhone as
              string | undefined,
            website: (institution as Record<string, unknown>).website as string | undefined,
            verificationStatus: institution.verificationStatus as string,
            verifiedAt: institution.verifiedAt ? String(institution.verifiedAt) : undefined,
            createdAt: String((institution as Record<string, unknown>).createdAt),
            updatedAt: String((institution as Record<string, unknown>).updatedAt),
          }
        : null,
    };
  }
  return base;
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  res: Response,
  ctx: AuthContext,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash +refreshTokenVersion');
  if (!user) throw AppError.notFound('User not found');

  const match = await comparePassword(input.currentPassword, user.passwordHash as string);
  if (!match) throw AppError.unauthorized('Current password is incorrect');

  user.passwordHash = await hashPassword(input.newPassword);
  user.refreshTokenVersion =
    ((user.refreshTokenVersion as number | undefined) ?? 0) + REVOKE_INCREMENT;
  await user.save();

  clearAuthCookies(res);

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
}
