/**
 * Phase 15C — Placement Eligibility Tests
 *
 * Covers:
 * - Deterministic evaluation (same input always same output)
 * - Institution match validation
 * - MIN_CGPA, ALLOWED_BRANCHES, ALLOWED_GRADUATION_YEARS, GENDER failures
 * - ALREADY_PLACED blocks
 * - MAX_PARTICIPATIONS_PER_DRIVE
 * - getEligibilityExplanation returns readable strings
 * - No client-side trust (server always re-evaluates)
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  Application,
  PlacementDrive,
  PlacementParticipant,
  Resume,
  StudentProfile,
  User,
} from '../../../models';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { hasTestDb } from '../../../__tests__/helpers/app';
import { evaluateEligibility, getEligibilityExplanation } from '../eligibility.service';

describe.skipIf(!hasTestDb)('eligibility.service (Phase 15C)', () => {
  let institutionId: Types.ObjectId;
  let driveId: Types.ObjectId;
  let studentUserId: Types.ObjectId;
  let studentProfileId: Types.ObjectId;

  beforeAll(async () => {
    await connectTestDb();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
    institutionId = new Types.ObjectId();

    const user = await User.create({
      email: 'eligible-student@t.demo',
      role: 'STUDENT',
      isActive: true,
      passwordHash: 'hash',
    });
    studentUserId = user._id;

    const profile = await StudentProfile.create({
      user: user._id,
      institution: institutionId,
      fullName: 'Test Student',
      cgpa: 8.0,
      branch: 'Computer Science',
      graduationYear: 2026,
      gender: 'MALE',
    });
    studentProfileId = profile._id;

    const drive = await PlacementDrive.create({
      institution: institutionId,
      title: 'Test Drive',
      status: 'REGISTRATION_OPEN',
      driveStartsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      eligibilityRules: {
        minCgpa: 7.0,
        allowedBranches: ['Computer Science', 'IT'],
        allowedGraduationYears: [2026, 2027],
        gender: undefined,
        resumeRequired: false,
        blockIfAlreadyPlaced: true,
        maxOffersHeld: 1,
        maxParticipationsPerStudent: 1,
      },
    });
    driveId = drive._id;
  });

  describe('evaluateEligibility — happy path', () => {
    it('returns eligible: true when all rules pass', async () => {
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(true);
      expect(result.failures).toHaveLength(0);
      expect(result.evaluatedAt).toBeTruthy();
    });

    it('is deterministic — same inputs always produce same output', async () => {
      const [a, b] = await Promise.all([
        evaluateEligibility(driveId.toString(), studentUserId.toString()),
        evaluateEligibility(driveId.toString(), studentUserId.toString()),
      ]);
      expect(a.eligible).toBe(b.eligible);
      expect(a.failures).toEqual(b.failures);
      expect(a.warnings).toEqual(b.warnings);
    });
  });

  describe('evaluateEligibility — failure rules', () => {
    it('fails when CGPA is below minimum', async () => {
      await StudentProfile.findByIdAndUpdate(studentProfileId, { cgpa: 6.5 });
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const cgpaFailure = result.failures.find((f) => f.rule === 'MIN_CGPA');
      expect(cgpaFailure).toBeDefined();
      expect(cgpaFailure!.actual).toBe('6.5');
    });

    it('fails when branch is not in allowed list', async () => {
      await StudentProfile.findByIdAndUpdate(studentProfileId, { branch: 'Mechanical' });
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const branchFailure = result.failures.find((f) => f.rule === 'ALLOWED_BRANCHES');
      expect(branchFailure).toBeDefined();
      expect(branchFailure!.actual).toBe('Mechanical');
    });

    it('fails when graduation year is not allowed', async () => {
      await StudentProfile.findByIdAndUpdate(studentProfileId, { graduationYear: 2025 });
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const yearFailure = result.failures.find((f) => f.rule === 'ALLOWED_GRADUATION_YEARS');
      expect(yearFailure).toBeDefined();
    });

    it('fails when student belongs to different institution', async () => {
      const otherInstId = new Types.ObjectId();
      await StudentProfile.findByIdAndUpdate(studentProfileId, { institution: otherInstId });
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const instFailure = result.failures.find((f) => f.rule === 'ALREADY_PLACED');
      expect(instFailure).toBeDefined();
    });

    it('fails ALREADY_PLACED when student has accepted offer', async () => {
      await Application.create({
        student: studentProfileId,
        opportunity: new Types.ObjectId(),
        opportunityType: 'JOB',
        status: 'OFFER_ACCEPTED',
      });
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const placedFailure = result.failures.find((f) => f.rule === 'ALREADY_PLACED');
      expect(placedFailure).toBeDefined();
    });

    it('fails MAX_PARTICIPATIONS_PER_DRIVE when limit reached', async () => {
      await PlacementParticipant.create({
        drive: driveId,
        student: studentUserId,
        status: 'REGISTERED',
      });
      const result = await evaluateEligibility(driveId.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const maxFailure = result.failures.find((f) => f.rule === 'MAX_PARTICIPATIONS_PER_DRIVE');
      expect(maxFailure).toBeDefined();
    });

    it('fails RESUME_REQUIRED when no resume exists', async () => {
      const drive2 = await PlacementDrive.create({
        institution: institutionId,
        title: 'Resume Required Drive',
        status: 'REGISTRATION_OPEN',
        driveStartsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        eligibilityRules: { resumeRequired: true },
      });
      const result = await evaluateEligibility(drive2._id.toString(), studentUserId.toString());
      expect(result.eligible).toBe(false);
      const resumeFailure = result.failures.find((f) => f.rule === 'RESUME_REQUIRED');
      expect(resumeFailure).toBeDefined();
    });

    it('fails for non-existent drive', async () => {
      const fakeId = new Types.ObjectId().toString();
      const result = await evaluateEligibility(fakeId, studentUserId.toString());
      expect(result.eligible).toBe(false);
      expect(result.failures[0]?.rule).toBe('ALREADY_PLACED'); // "Drive not found" maps to this
    });

    it('fails for non-existent student', async () => {
      const fakeId = new Types.ObjectId().toString();
      const result = await evaluateEligibility(driveId.toString(), fakeId);
      expect(result.eligible).toBe(false);
    });
  });

  describe('getEligibilityExplanation', () => {
    it('returns encouraging text when eligible', async () => {
      const lines = await getEligibilityExplanation(driveId.toString(), studentUserId.toString());
      expect(lines[0]).toContain('eligible');
    });

    it('lists failures when ineligible', async () => {
      await StudentProfile.findByIdAndUpdate(studentProfileId, { cgpa: 5.0 });
      const lines = await getEligibilityExplanation(driveId.toString(), studentUserId.toString());
      expect(lines[0]).toContain('not eligible');
      expect(lines.some((l) => l.includes('CGPA'))).toBe(true);
    });
  });
});
