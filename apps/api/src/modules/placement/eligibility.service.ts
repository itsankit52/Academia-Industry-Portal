/**
 * Phase 11 — Eligibility Service
 *
 * Deterministic, explainable eligibility evaluation for placement drives.
 * NEVER trusts client-provided results — always recalculates server-side.
 */
import { Types } from 'mongoose';
import {
  PlacementDrive,
  PlacementParticipant,
  StudentProfile,
  Application,
  Resume,
} from '../../models';
import type { PlacementDriveDoc } from '../../models/placement/PlacementDrive';
import type {
  EligibilityResult,
  EligibilityFailure,
  EligibilityWarning,
  EligibilityRules,
} from '@aip/types';
import { type Proficiency } from '@aip/config';

/* ─── Constants ─────────────────────────────────────────────────────── */

const PROFICIENCY_ORDER: Proficiency[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

/* ─── Helpers ───────────────────────────────────────────────────────── */

function clamp01to100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * Evaluate whether a student is eligible for a placement drive.
 * Returns a deterministic EligibilityResult with explainable failures.
 */
export async function evaluateEligibility(
  driveId: string,
  studentUserId: string,
): Promise<EligibilityResult> {
  const drive = await PlacementDrive.findById(driveId);
  if (!drive) {
    return {
      eligible: false,
      failures: [{ rule: 'ALREADY_PLACED', message: 'Drive not found' }],
      warnings: [],
      evaluatedAt: new Date().toISOString(),
    };
  }

  const studentProfile = await StudentProfile.findOne({ user: new Types.ObjectId(studentUserId) });
  if (!studentProfile) {
    return {
      eligible: false,
      failures: [{ rule: 'ALREADY_PLACED', message: 'Student profile not found' }],
      warnings: [],
      evaluatedAt: new Date().toISOString(),
    };
  }

  // Cast Mongoose subdocument to the shared rules shape; both share the same
  // field names so this is safe at runtime.
  const rules = (
    drive.eligibilityRules ? JSON.parse(JSON.stringify(drive.eligibilityRules)) : {}
  ) as EligibilityRules;
  const failures: EligibilityFailure[] = [];
  const warnings: EligibilityWarning[] = [];

  // Institution match
  if (String(studentProfile.institution) !== String(drive.institution)) {
    failures.push({
      rule: 'ALREADY_PLACED',
      message: 'Student does not belong to the institution hosting this drive',
      expected: String(drive.institution),
      actual: String(studentProfile.institution),
    });
  }

  // MIN_CGPA
  if (
    rules.minCgpa !== undefined &&
    studentProfile.cgpa !== null &&
    studentProfile.cgpa !== undefined
  ) {
    const cgpa = studentProfile.cgpa as number;
    if (cgpa < rules.minCgpa) {
      failures.push({
        rule: 'MIN_CGPA',
        message: `CGPA ${cgpa} is below the required minimum of ${rules.minCgpa}`,
        expected: `>= ${rules.minCgpa}`,
        actual: String(cgpa),
      });
    }
  }

  // ALLOWED_BRANCHES
  if (rules.allowedBranches && rules.allowedBranches.length > 0) {
    const studentBranch = (studentProfile.branch ?? '').toString();
    if (!rules.allowedBranches.includes(studentBranch)) {
      failures.push({
        rule: 'ALLOWED_BRANCHES',
        message: `Your branch (${studentBranch || 'not set'}) is not eligible for this drive`,
        expected: rules.allowedBranches.join(', '),
        actual: studentBranch || 'not set',
      });
    }
  }

  // ALLOWED_GRADUATION_YEARS
  if (rules.allowedGraduationYears && rules.allowedGraduationYears.length > 0) {
    const gradYear = studentProfile.graduationYear as number | undefined | null;
    if (!gradYear || !rules.allowedGraduationYears.includes(gradYear)) {
      failures.push({
        rule: 'ALLOWED_GRADUATION_YEARS',
        message: `Your graduation year (${gradYear ?? 'not set'}) is not eligible`,
        expected: rules.allowedGraduationYears.join(', '),
        actual: gradYear?.toString() ?? 'not set',
      });
    }
  }

  // GENDER
  if (rules.gender && studentProfile.gender && studentProfile.gender !== rules.gender) {
    failures.push({
      rule: 'GENDER',
      message: `This drive is only open to ${rules.gender} candidates`,
      expected: rules.gender,
      actual: studentProfile.gender,
    });
  }

  // RESUME_REQUIRED
  if (rules.resumeRequired) {
    const hasResume = await Resume.exists({ student: studentProfile.user });
    if (!hasResume) {
      failures.push({
        rule: 'RESUME_REQUIRED',
        message: 'A resume is required to apply for this drive',
      });
    }
  }

  // ALREADY_PLACED — block if student already has OFFER_ACCEPTED placement
  if (rules.blockIfAlreadyPlaced) {
    const alreadyPlaced = await Application.exists({
      student: studentProfile._id,
      status: 'OFFER_ACCEPTED',
    });
    if (alreadyPlaced) {
      failures.push({
        rule: 'ALREADY_PLACED',
        message: 'Students who have already accepted a placement are not eligible',
      });
    }
  }

  // MAX_OFFERS_HELD
  if (rules.maxOffersHeld !== undefined && rules.maxOffersHeld > 0) {
    const acceptedOffers = await Application.countDocuments({
      student: studentProfile._id,
      status: 'OFFER_ACCEPTED',
    });
    if (acceptedOffers >= rules.maxOffersHeld) {
      failures.push({
        rule: 'MAX_OFFERS_HELD',
        message: `You already hold the maximum allowed offers (${rules.maxOffersHeld})`,
        expected: `< ${rules.maxOffersHeld}`,
        actual: String(acceptedOffers),
      });
    }
  }

  // MIN_READINESS_SCORE — placeholder: integrate with placement-readiness.service when available
  if (rules.minReadinessScore !== undefined) {
    warnings.push({
      rule: 'MIN_READINESS_SCORE',
      message: `Your placement readiness should be above ${rules.minReadinessScore} for best results`,
    });
  }

  // MIN_SKILL_PROFICIENCY
  if (rules.minSkillProficiency && rules.minSkillProficiency.length > 0) {
    for (const req of rules.minSkillProficiency) {
      const reqLevelIdx = PROFICIENCY_ORDER.indexOf(req.minProficiency as Proficiency);
      void reqLevelIdx; // StudentSkill integration deferred — add as warning
      warnings.push({
        rule: 'MIN_SKILL_PROFICIENCY',
        message: `Skill proficiency requirement: ${req.minProficiency} or higher`,
      });
    }
  }

  // MAX_PARTICIPATIONS_PER_DRIVE
  if (drive.maxParticipationsPerStudent > 0) {
    const existing = await PlacementParticipant.countDocuments({
      drive: drive._id,
      student: studentProfile.user,
      status: { $nin: ['WITHDRAWN'] },
    });
    if (existing >= drive.maxParticipationsPerStudent) {
      failures.push({
        rule: 'MAX_PARTICIPATIONS_PER_DRIVE',
        message: `Maximum participations (${drive.maxParticipationsPerStudent}) reached for this drive`,
        expected: `< ${drive.maxParticipationsPerStudent}`,
        actual: String(existing),
      });
    }
  }

  return {
    eligible: failures.length === 0,
    failures,
    warnings,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Get a human-readable explanation of why a student is eligible/ineligible.
 */
export async function getEligibilityExplanation(
  driveId: string,
  studentUserId: string,
): Promise<string[]> {
  const result = await evaluateEligibility(driveId, studentUserId);
  const lines: string[] = [];

  if (result.eligible) {
    lines.push('You are eligible for this placement drive.');
    if (result.warnings.length > 0) {
      lines.push('Notes:');
      for (const w of result.warnings) {
        lines.push(`  - ${w.message}`);
      }
    }
  } else {
    lines.push('You are not eligible for this placement drive:');
    for (const f of result.failures) {
      lines.push(`  - ${f.message}`);
    }
  }

  return lines;
}

/**
 * Get eligible students for a drive (institution-facing cohort view).
 */
export async function getEligibleStudentsForDrive(
  driveId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{
  students: Array<{ profile: Record<string, unknown>; eligibility: EligibilityResult }>;
  total: number;
}> {
  const drive = await PlacementDrive.findById(driveId);
  if (!drive) throw new Error('Drive not found');

  // Get all students from the institution (capped at 500 for performance)
  const students = await StudentProfile.find({ institution: drive.institution })
    .select('user fullName branch graduationYear cgpa gender')
    .limit(500)
    .lean();

  const page = Math.max(1, options.page || 1);
  const limit = clamp01to100(options.limit || 20);

  const results = await Promise.all(
    students.map(async (s) => {
      const eligibility = await evaluateEligibility(driveId, String(s.user));
      return { profile: s, eligibility };
    }),
  );

  const eligible = results.filter((r) => r.eligibility.eligible);
  const paginated = eligible.slice((page - 1) * limit, page * limit);

  return { students: paginated, total: eligible.length };
}

/* ─── Service class (class-based facade) ───────────────────────────── */

/**
 * Class-based facade matching the controller's `EligibilityService.X` usage.
 * The actual logic lives in the exported functions above.
 */
export class EligibilityService {
  static evaluate(driveId: string, studentUserId: string): Promise<EligibilityResult> {
    return evaluateEligibility(driveId, studentUserId);
  }

  static getExplanation(driveId: string, studentUserId: string): Promise<string[]> {
    return getEligibilityExplanation(driveId, studentUserId);
  }

  static getEligibleStudents(
    driveId: string,
    options: { page?: number; limit?: number } = {},
  ): ReturnType<typeof getEligibleStudentsForDrive> {
    return getEligibleStudentsForDrive(driveId, options);
  }
}

/* ─── Test-only exports ─────────────────────────────────────────────── */

export const __test = {
  PROFICIENCY_ORDER,
  clamp01to100,
};
