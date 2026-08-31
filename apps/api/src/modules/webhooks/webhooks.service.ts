import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { DocumentModel, Institution, StudentProfile, User } from '../../models';
import { AppError } from '../../utils/AppError';
import { hashPassword } from '../../utils/password';
import { logger } from '../../utils/logger';

export interface LmsCertificatePayload {
  studentEmail: string;
  courseName: string;
  provider: string;
  certificateUrl: string;
  completionDate: string;
  verificationCode: string;
}

export interface ErpStudentEntry {
  email: string;
  fullName: string;
  degree?: string;
  branch?: string;
  semester?: number;
  graduationYear?: number;
  cgpa?: number;
}

export interface ErpStudentSyncPayload {
  institutionCode: string;
  students: ErpStudentEntry[];
}

export interface ErpSyncSummary {
  created: number;
  updated: number;
  skipped: number;
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw AppError.badRequest(`Field '${field}' is required`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function parseLmsCertificatePayload(raw: unknown): LmsCertificatePayload {
  if (!raw || typeof raw !== 'object') throw AppError.badRequest('Invalid payload');
  const obj = raw as Record<string, unknown>;
  return {
    studentEmail: asString(obj.studentEmail, 'studentEmail').toLowerCase(),
    courseName: asString(obj.courseName, 'courseName'),
    provider: asString(obj.provider, 'provider'),
    certificateUrl: asString(obj.certificateUrl, 'certificateUrl'),
    completionDate: asString(obj.completionDate, 'completionDate'),
    verificationCode: asString(obj.verificationCode, 'verificationCode'),
  };
}

export function parseErpStudentSyncPayload(raw: unknown): ErpStudentSyncPayload {
  if (!raw || typeof raw !== 'object') throw AppError.badRequest('Invalid payload');
  const obj = raw as Record<string, unknown>;
  const institutionCode = asString(obj.institutionCode, 'institutionCode');
  if (!Array.isArray(obj.students)) {
    throw AppError.badRequest("Field 'students' must be an array");
  }
  const students: ErpStudentEntry[] = obj.students.map((s, i) => {
    if (!s || typeof s !== 'object') {
      throw AppError.badRequest(`students[${i}] must be an object`);
    }
    const row = s as Record<string, unknown>;
    return {
      email: asString(row.email, `students[${i}].email`).toLowerCase(),
      fullName: asString(row.fullName, `students[${i}].fullName`),
      ...(optionalString(row.degree) ? { degree: optionalString(row.degree) } : {}),
      ...(optionalString(row.branch) ? { branch: optionalString(row.branch) } : {}),
      ...(optionalNumber(row.semester) !== undefined
        ? { semester: optionalNumber(row.semester) }
        : {}),
      ...(optionalNumber(row.graduationYear) !== undefined
        ? { graduationYear: optionalNumber(row.graduationYear) }
        : {}),
      ...(optionalNumber(row.cgpa) !== undefined ? { cgpa: optionalNumber(row.cgpa) } : {}),
    };
  });
  return { institutionCode, students };
}

export async function handleLmsCertificate(payload: LmsCertificatePayload): Promise<{
  documentId: string;
  isDuplicate: boolean;
}> {
  // Idempotency check: if we've already processed this exact certificate, return the existing one
  const key = getLmsIdempotencyKey(payload.studentEmail, payload.verificationCode);
  cleanExpiredEntries(processedLmsCertificates, LMS_IDEMPOTENCY_TTL_MS);

  const existing = processedLmsCertificates.get(key);
  if (existing) {
    logger.info(
      { key, documentId: existing.documentId },
      'LMS certificate already processed, returning existing',
    );
    return { documentId: existing.documentId, isDuplicate: true };
  }

  const user = await User.findOne({ email: payload.studentEmail, role: 'STUDENT' }).select('_id');
  if (!user) throw AppError.notFound('Student user not found for provided email');

  const profile = await StudentProfile.findOne({ user: user._id }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');

  // Also check if a certificate with the same verification code already exists
  const existingCert = await DocumentModel.findOne({
    title: payload.courseName,
    issuer: payload.provider,
    verificationStatus: 'VERIFIED',
  }).select('_id');
  if (existingCert) {
    // Store in idempotency map and return existing
    processedLmsCertificates.set(key, {
      documentId: String(existingCert._id),
      processedAt: new Date(),
    });
    return { documentId: String(existingCert._id), isDuplicate: true };
  }

  const bodyBuffer = Buffer.from(JSON.stringify(payload), 'utf-8');
  const filename = `${payload.courseName.replace(/[^a-zA-Z0-9]+/g, '_')}_${payload.verificationCode}.json`;

  const doc = await DocumentModel.create({
    user: user._id,
    documentType: 'CERTIFICATE',
    filename,
    data: bodyBuffer,
    mimeType: 'application/json',
    sizeBytes: bodyBuffer.byteLength,
    title: payload.courseName,
    issuer: payload.provider,
    issuedDate: new Date(payload.completionDate),
    verificationStatus: 'VERIFIED',
    verifiedAt: new Date(),
  });

  // Store in idempotency map
  processedLmsCertificates.set(key, { documentId: String(doc._id), processedAt: new Date() });

  return { documentId: String(doc._id), isDuplicate: false };
}

/**
 * An ERP-imported account exists before its owner has ever chosen a password, so
 * it needs a placeholder hash. It must be unique per account: hashing one secret
 * for the whole batch would give every imported student the same password, and
 * recovering that single plaintext would unlock all of them. `Math.random()` is
 * not a cryptographic RNG and `Date.now()` is guessable, so neither is used —
 * these 32 bytes come from the CSPRNG, are never returned, logged or stored in
 * plaintext, and are discarded immediately after hashing. The result is a hash
 * nobody can produce a password for, which is the intent.
 *
 * Note that this API has no password-reset or self-serve activation endpoint, and
 * the admin `activateUser` route only flips `isActive` without setting a
 * password. An imported student therefore cannot log in by any route yet; the
 * import populates their profile data ahead of a credential flow that still has
 * to be built. Failing closed is the right posture in the meantime, but do not
 * read this placeholder as a working handoff to the student.
 */
function unusablePlaceholderSecret(): string {
  return `erp-import:${randomBytes(32).toString('base64url')}`;
}

// ---------------------------------------------------------------------------
// Idempotency helpers
// ---------------------------------------------------------------------------

/**
 * LMS webhook idempotency: stores processed verification codes to prevent
 * duplicate certificate creation. Uses an in-memory Map for simplicity;
 * in production this would be a Redis cache or database table.
 */
const processedLmsCertificates = new Map<string, { documentId: string; processedAt: Date }>();
const LMS_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * ERP webhook idempotency: stores processed email+institution combinations.
 */
const processedErpEntries = new Map<string, { processedAt: Date }>();
const ERP_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanExpiredEntries<K>(map: Map<K, { processedAt: Date }>, ttl: number): void {
  const now = Date.now();
  for (const [key, value] of map.entries()) {
    if (now - value.processedAt.getTime() > ttl) {
      map.delete(key);
    }
  }
}

function getLmsIdempotencyKey(email: string, verificationCode: string): string {
  return `${email.toLowerCase()}:${verificationCode}`;
}

export async function handleErpStudentSync(
  payload: ErpStudentSyncPayload,
): Promise<ErpSyncSummary> {
  const institution = await Institution.findOne({ code: payload.institutionCode });
  if (!institution) throw AppError.notFound('Institution not found for provided code');

  // Clean expired idempotency entries
  cleanExpiredEntries(processedErpEntries, ERP_IDEMPOTENCY_TTL_MS);

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let duplicateCount = 0;

  for (const entry of payload.students) {
    // Idempotency check: skip if already processed
    const ikey = `${institution._id}:${entry.email.toLowerCase()}`;
    if (processedErpEntries.has(ikey)) {
      duplicateCount += 1;
      continue;
    }

    try {
      let user = await User.findOne({ email: entry.email });
      let isNewUser = false;
      if (!user) {
        user = await User.create({
          email: entry.email,
          // Hashed per student, inside the loop — never shared across the batch.
          passwordHash: await hashPassword(unusablePlaceholderSecret()),
          role: 'STUDENT',
          isActive: false,
          institution: institution._id,
        });
        isNewUser = true;
      }

      const profileUpdate: Record<string, unknown> = {
        user: user._id,
        institution: institution._id,
        fullName: entry.fullName,
      };
      if (entry.degree !== undefined) profileUpdate.degree = entry.degree;
      if (entry.branch !== undefined) profileUpdate.branch = entry.branch;
      if (entry.semester !== undefined) profileUpdate.semester = entry.semester;
      if (entry.graduationYear !== undefined) profileUpdate.graduationYear = entry.graduationYear;
      if (entry.cgpa !== undefined) profileUpdate.cgpa = entry.cgpa;

      const existingProfile = await StudentProfile.findOne({ user: user._id });
      if (existingProfile) {
        await StudentProfile.updateOne({ _id: existingProfile._id }, { $set: profileUpdate });
        updatedCount += 1;
      } else {
        await StudentProfile.create(profileUpdate);
        createdCount += 1;
      }

      // Mark as processed for idempotency
      processedErpEntries.set(ikey, { processedAt: new Date() });

      if (isNewUser && !existingProfile) {
        continue;
      }
    } catch (err) {
      logger.warn({ err, email: entry.email }, 'ERP sync failed for student entry');
      skippedCount += 1;
    }
  }

  return { created: createdCount, updated: updatedCount, skipped: skippedCount + duplicateCount };
}

export function institutionExistsByCode(code: string): Promise<{ _id: Types.ObjectId } | null> {
  return Institution.findOne({ code }).select('_id').lean() as unknown as Promise<{
    _id: Types.ObjectId;
  } | null>;
}
