import type { PublicInstitution } from '@aip/types';
import { Institution } from '../../models';
import { AppError } from '../../utils/AppError';

export interface InstitutionCodeVerification {
  valid: boolean;
  institution?: { id: string; name: string };
}

/**
 * Generates a unique, random institution code.
 * Format: 2 uppercase letters + 5 digits (e.g., AB12345)
 * Retries up to 5 times if a collision is found.
 */
export async function generateUniqueInstitutionCode(): Promise<string> {
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = `${randomLetter()}${randomLetter()}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;

    const existing = await Institution.findOne({ code }).select('_id').lean();
    if (!existing) {
      return code;
    }
  }

  function randomLetter(): string {
    return LETTERS[Math.floor(Math.random() * LETTERS.length)] ?? 'A';
  }

  throw new Error('Failed to generate a unique institution code after 5 attempts');
}

/**
 * Verifies an institution code and returns safe institution details if valid.
 * The code is normalized to uppercase before lookup.
 */
export async function verifyInstitutionCode(code: string): Promise<InstitutionCodeVerification> {
  if (!code || typeof code !== 'string') {
    return { valid: false };
  }

  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(normalized)) {
    return { valid: false };
  }

  const institution = await Institution.findOne({ code: normalized })
    .select('_id name verificationStatus')
    .lean();

  if (!institution) {
    return { valid: false };
  }

  return {
    valid: true,
    institution: {
      id: String(institution._id),
      name: institution.name as string,
    },
  };
}

/**
 * Validates that the provided institutionId and institutionCode match a real,
 * verified institution. Throws AppError on any mismatch.
 * This is the server-side anchor for the client-side code verification step.
 */
export async function assertInstitutionAndCode(
  institutionId: string,
  institutionCode: string,
): Promise<void> {
  const normalized = institutionCode.trim().toUpperCase();

  const institution = await Institution.findById(institutionId)
    .select('_id code verificationStatus')
    .lean();

  if (!institution) {
    throw AppError.badRequest('Institution not found');
  }

  if ((institution as Record<string, unknown>).code !== normalized) {
    throw AppError.badRequest('The institution code does not match the selected institution');
  }
}

export async function listVerifiedPublic(): Promise<PublicInstitution[]> {
  const rows = await Institution.find({ verificationStatus: 'VERIFIED' })
    .select('_id name code')
    .sort({ name: 1 })
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name as string,
    code: r.code as string,
  }));
}
