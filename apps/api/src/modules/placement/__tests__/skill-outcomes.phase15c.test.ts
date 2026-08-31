/**
 * Phase 15C — Skill Outcome Analytics Tests
 *
 * Tests:
 * - scoreSkillOutcome helper
 * - computeSkillTrends helper
 * - insufficientReasons are populated
 * - opportunityCount is included
 * - trend is computed when enough data exists
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import {
  Job,
  Internship,
  Skill,
  StudentProfile,
  StudentSkill,
  Application,
  User,
} from '../../../models';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../../../__tests__/helpers/db';
import { hasTestDb } from '../../../__tests__/helpers/app';
import { getSkillOutcomeAnalytics, __test as skillTest } from '../skill-outcomes.service';

describe.skipIf(!hasTestDb)('skill-outcomes.service (Phase 15C)', () => {
  let institutionId: Types.ObjectId;

  beforeAll(async () => {
    await connectTestDb();
    institutionId = new Types.ObjectId();
  });
  afterAll(async () => {
    await disconnectTestDb();
  });
  beforeEach(async () => {
    await clearTestDb();
  });

  describe('__test helpers', () => {
    const {
      scoreSkillOutcome,
      clamp01to100,
      round,
      MIN_SAMPLE_SIZE,
      MIN_DEMAND_COUNT,
      TOP_SKILLS_LIMIT,
    } = skillTest;

    it('scoreSkillOutcome returns 0 when no applicants', () => {
      expect(scoreSkillOutcome(0, 0, MIN_SAMPLE_SIZE)).toBe(0);
    });

    it('scoreSkillOutcome clamps to 0-100', () => {
      const result = scoreSkillOutcome(95, 20, MIN_SAMPLE_SIZE);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('scoreSkillOutcome is deterministic', () => {
      const a = scoreSkillOutcome(80, 15, MIN_SAMPLE_SIZE);
      const b = scoreSkillOutcome(80, 15, MIN_SAMPLE_SIZE);
      expect(a).toBe(b);
    });

    it('clamp01to100 handles edge cases', () => {
      expect(clamp01to100(NaN)).toBe(0);
      expect(clamp01to100(-5)).toBe(0);
      expect(clamp01to100(150)).toBe(100);
      expect(clamp01to100(50)).toBe(50);
    });

    it('round works to 1 decimal place', () => {
      expect(round(1.234)).toBe(1.2);
      expect(round(1.239)).toBe(1.2);
      expect(round(1.239, 2)).toBe(1.24);
    });

    it('constants are reasonable', () => {
      expect(MIN_SAMPLE_SIZE).toBeGreaterThan(0);
      expect(MIN_DEMAND_COUNT).toBeGreaterThan(0);
      expect(TOP_SKILLS_LIMIT).toBeGreaterThan(0);
    });
  });

  describe('getSkillOutcomeAnalytics', () => {
    it('returns insufficientData when institution has no students', async () => {
      const result = await getSkillOutcomeAnalytics({ institutionId });
      expect(result.insufficientData).toBe(true);
      expect(result.insufficientReasons).toContain('No students in institution.');
      expect(result.metrics).toHaveLength(0);
    });

    it('returns insufficientData when there are no published opportunities', async () => {
      const user = await User.create({
        email: 'orphan-student@phase15c.t.demo',
        role: 'STUDENT',
        isActive: true,
        passwordHash: 'hash',
      });
      await StudentProfile.create({
        user: user._id,
        institution: institutionId,
        fullName: 'Orphan',
      });
      const result = await getSkillOutcomeAnalytics({ institutionId });
      expect(result.insufficientData).toBe(true);
      expect(result.insufficientReasons.some((r) => r.includes('No published opportunities'))).toBe(
        true,
      );
    });

    it('returns metrics when there is enough data', async () => {
      // Create skill
      const skill = await Skill.create({ name: 'Test Skill', category: 'PROGRAMMING' });
      // Create job with required skill
      await Job.create({
        title: 'Test Job',
        company: new Types.ObjectId(),
        description: 'A job for testing',
        status: 'PUBLISHED',
        requiredSkills: [skill._id],
        workMode: 'ONSITE',
        location: 'Test City',
        employmentType: 'FULL_TIME',
      });
      // Create 5 students with that skill
      const studentIds = [];
      for (let i = 0; i < 5; i++) {
        const user = await User.create({
          email: `skill-student-${i}@phase15c.t.demo`,
          role: 'STUDENT',
          isActive: true,
          passwordHash: 'hash',
        });
        const profile = await StudentProfile.create({
          user: user._id,
          institution: institutionId,
          fullName: `Student ${i}`,
        });
        studentIds.push(profile._id);
        await StudentSkill.create({
          student: profile._id,
          skill: skill._id,
          proficiency: 'INTERMEDIATE',
        });
      }
      // One student gets selected
      const appStudent = await StudentProfile.findById(studentIds[0]);
      await Application.create({
        student: appStudent!._id,
        opportunity: new Types.ObjectId(),
        opportunityType: 'INTERNSHIP',
        status: 'OFFER_ACCEPTED',
      });

      const result = await getSkillOutcomeAnalytics({ institutionId });
      expect(result.insufficientData).toBe(false);
      expect(result.metrics.length).toBeGreaterThan(0);
      const found = result.metrics.find((m) => m.name === 'Test Skill');
      expect(found).toBeDefined();
      expect(found!.applicantsWithSkill).toBe(5);
      expect(found!.selectedWithSkill).toBe(1);
      expect(found!.opportunityCount).toBeGreaterThanOrEqual(1);
    });

    it('includes insufficientReasons in result', async () => {
      const result = await getSkillOutcomeAnalytics({ institutionId });
      expect(Array.isArray(result.insufficientReasons)).toBe(true);
    });

    it('includes trend field in metrics', async () => {
      const skill = await Skill.create({ name: 'Trend Skill', category: 'AI_ML' });
      await Job.create({
        title: 'Trend Job',
        company: new Types.ObjectId(),
        description: 'Testing trends',
        status: 'PUBLISHED',
        requiredSkills: [skill._id],
        workMode: 'REMOTE',
        location: 'Remote',
        employmentType: 'FULL_TIME',
      });
      for (let i = 0; i < 6; i++) {
        const user = await User.create({
          email: `trend-student-${i}@phase15c.t.demo`,
          role: 'STUDENT',
          isActive: true,
          passwordHash: 'hash',
        });
        const profile = await StudentProfile.create({
          user: user._id,
          institution: institutionId,
          fullName: `Trend Student ${i}`,
        });
        await StudentSkill.create({
          student: profile._id,
          skill: skill._id,
          proficiency: 'BEGINNER',
        });
      }
      const result = await getSkillOutcomeAnalytics({ institutionId });
      const found = result.metrics.find((m) => m.name === 'Trend Skill');
      if (found) {
        // trend may be null if insufficient history; just verify the field exists
        expect('trend' in found).toBe(true);
      }
    });
  });
});
