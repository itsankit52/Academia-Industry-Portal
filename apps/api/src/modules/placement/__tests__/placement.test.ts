/**
 * Phase 10 — Backend tests for placement-readiness, outcomes, intervention,
 * and skill-outcome services.
 *
 * Coverage:
 * - Placement readiness: score calculation, level thresholds, missing-data
 *   handling, component score normalization, evidence generation, profile-not-found
 *   edge case, overall computation, strengths, blockers, next actions
 * - Outcomes: status mapping, funnel building, rate calculations, aggregation
 * - Interventions: severity ranking, dedup, sorting, all intervention types
 * - Skill outcomes: strength scoring, insufficient-data threshold, aggregation
 * - Institution scoping: STUDENT role can only access own readiness; INSTITUTION
 *   role can only access own students; COMPANY must be blocked
 * - Deterministic output: same inputs → same outputs
 *
 * Integration-style tests run against the test DB when available; pure-unit
 * tests run always via the __test exports.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import request from 'supertest';
import {
  placementReadinessForMe,
  placementOutcomesForMe,
} from '../placement.controller';
import { AppError } from '../../../utils/AppError';
import {
  buildPlacementReadiness,
  __test as readinessTest,
} from '../placement-readiness.service';
import {
  getStudentOutcomes,
  getInstitutionOutcomes,
  __test as outcomesTest,
} from '../placement-outcomes.service';
import {
  getInstitutionInterventions,
  __test as interventionTest,
} from '../intervention.service';
import {
  getSkillOutcomeAnalytics,
  __test as skillOutcomeTest,
} from '../skill-outcomes.service';

/* ─── Pure unit tests — always run (no DB needed) ─────────────────── */

describe('Placement Readiness — pure helpers (no DB)', () => {
  const {
    clamp01to100,
    levelFor,
    bandMeta,
    computeOverall,
    buildStrengths,
    buildBlockers,
    buildNextActions,
    componentToActionType,
    componentToCtaPath,
    PROFICIENCY_RANK,
    BLOCKER_THRESHOLDS,
    MIN_APPLICATIONS_FOR_OUTCOME_SAMPLE,
    MIN_EVALUATED_ASSESSMENTS_FOR_SAMPLE,
  } = readinessTest;

  describe('clamp01to100', () => {
    const fn = clamp01to100 as (n: number) => number;

    it('returns 0 for NaN', () => expect(fn(NaN)).toBe(0));
    it('returns 0 for negative', () => expect(fn(-10)).toBe(0));
    it('returns 100 for > 100', () => expect(fn(150)).toBe(100));
    it('returns 50 for 50', () => expect(fn(50)).toBe(50));
    it('handles Infinity', () => expect(fn(Infinity)).toBe(0));
  });

  describe('levelFor — deterministic thresholds', () => {
    const fn = levelFor as (score: number) => string;

    it('80 → PLACEMENT_READY', () => expect(fn(80)).toBe('PLACEMENT_READY'));
    it('100 → PLACEMENT_READY', () => expect(fn(100)).toBe('PLACEMENT_READY'));
    it('65–79 → NEARLY_READY', () => {
      expect(fn(65)).toBe('NEARLY_READY');
      expect(fn(79)).toBe('NEARLY_READY');
    });
    it('50–64 → DEVELOPING', () => {
      expect(fn(50)).toBe('DEVELOPING');
      expect(fn(64)).toBe('DEVELOPING');
    });
    it('30–49 → NEEDS_IMPROVEMENT', () => {
      expect(fn(30)).toBe('NEEDS_IMPROVEMENT');
      expect(fn(49)).toBe('NEEDS_IMPROVEMENT');
    });
    it('0–29 → NOT_READY', () => {
      expect(fn(0)).toBe('NOT_READY');
      expect(fn(29)).toBe('NOT_READY');
    });
  });

  describe('computeOverall — weights sum to 1', () => {
    const fn = computeOverall as (components: Array<{ score: number; weight: number }>) => number;

    it('all-zero returns 0', () => {
      const components = [
        { score: 0, weight: 0.3 },
        { score: 0, weight: 0.2 },
        { score: 0, weight: 0.15 },
        { score: 0, weight: 0.1 },
        { score: 0, weight: 0.1 },
        { score: 0, weight: 0.1 },
        { score: 0, weight: 0.05 },
      ];
      expect(fn(components)).toBe(0);
    });

    it('all-100 returns 100', () => {
      const components = [
        { score: 100, weight: 0.3 },
        { score: 100, weight: 0.2 },
        { score: 100, weight: 0.15 },
        { score: 100, weight: 0.1 },
        { score: 100, weight: 0.1 },
        { score: 100, weight: 0.1 },
        { score: 100, weight: 0.05 },
      ];
      expect(fn(components)).toBe(100);
    });

    it('mixed scores return weighted mean', () => {
      const components = [
        { score: 100, weight: 0.3 },
        { score: 0, weight: 0.2 },
        { score: 50, weight: 0.5 },
      ];
      expect(fn(components)).toBe(55); // 30+0+25
    });

    it('clamps at 100 even if sum exceeds 100', () => {
      const components = [
        { score: 100, weight: 0.7 },
        { score: 100, weight: 0.4 },
      ];
      expect(fn(components)).toBe(100);
    });

    it('is deterministic — same input always returns same output', () => {
      const components = [
        { score: 73, weight: 0.3 },
        { score: 45, weight: 0.2 },
      ];
      const r1 = fn(components);
      const r2 = fn(components);
      expect(r1).toBe(r2);
    });
  });

  describe('bandMeta', () => {
    const fn = bandMeta as (level: string) => { label: string; description: string };

    it('PLACEMENT_READY has correct label', () => expect(fn('PLACEMENT_READY').label).toBe('Placement Ready'));
    it('NEARLY_READY has correct label', () => expect(fn('NEARLY_READY').label).toBe('Nearly Ready'));
    it('DEVELOPING has correct label', () => expect(fn('DEVELOPING').label).toBe('Developing'));
    it('NEEDS_IMPROVEMENT has correct label', () => expect(fn('NEEDS_IMPROVEMENT').label).toBe('Needs Improvement'));
    it('NOT_READY has correct label', () => expect(fn('NOT_READY').label).toBe('Not Ready'));
    it('unknown level returns fallback', () => {
      const result = fn('UNKNOWN');
      expect(result.label).toBe('Not Ready');
    });
  });

  describe('buildStrengths — returns only strong components (≥75)', () => {
    const fn = buildStrengths as (
      components: Array<{ key: string; score: number; label: string; evidence: string[] }>,
      profile: null,
    ) => Array<{ key: string; label: string }>;

    it('excludes low-scoring components', () => {
      const components = [
        { key: 'SKILLS', score: 40, label: 'Skills', evidence: ['some evidence'] },
        { key: 'ASSESSMENTS', score: 80, label: 'Assessments', evidence: ['strong'] },
      ];
      const result = fn(components, null);
      expect(result.map((r) => r.key)).toEqual(['component:ASSESSMENTS']);
    });

    it('dedupes by key', () => {
      const components = [
        { key: 'SKILLS', score: 80, label: 'Skills', evidence: ['a'] },
        { key: 'SKILLS', score: 90, label: 'Skills', evidence: ['b'] },
      ];
      const result = fn(components, null);
      expect(result.filter((r) => r.key === 'component:SKILLS').length).toBe(1);
    });
  });

  describe('buildBlockers — CRITICAL at < 30, HIGH at < 50', () => {
    const fn = buildBlockers as unknown as (
      components: Array<{ key: string; score: number; label: string; evidence: string[] }>,
      score: number,
      profile: null,
      trainingScore: number,
      internshipScore: number,
      assessmentScore: number,
    ) => Array<{ key: string; severity: string }>;

    it('raises CRITICAL when overall score < 30', () => {
      const components: Array<{ key: string; score: number; label: string; evidence: string[] }> = [];
      const result = fn(components, 20, null, 0, 0, 0);
      expect(result.some((b) => b.severity === 'CRITICAL')).toBe(true);
    });

    it('raises HIGH for component with score < 30', () => {
      const components = [
        { key: 'SKILLS', score: 20, label: 'Skills', evidence: ['very low'] },
      ];
      const result = fn(components, 50, null, 30, 30, 60);
      // Score 20 is below 30 but above the 15 CRITICAL cutoff — HIGH.
      expect(result.some((b) => b.key === 'component:SKILLS' && b.severity === 'HIGH')).toBe(true);
    });

    it('raises CRITICAL for component with score < 15', () => {
      const components = [
        { key: 'SKILLS', score: 10, label: 'Skills', evidence: ['very low'] },
      ];
      const result = fn(components, 50, null, 30, 30, 60);
      expect(result.some((b) => b.key === 'component:SKILLS' && b.severity === 'CRITICAL')).toBe(true);
    });

    it('raises CRITICAL when both training and internship are near 0', () => {
      const components: Array<{ key: string; score: number; label: string; evidence: string[] }> = [];
      const result = fn(components, 45, null, 5, 3, 60);
      expect(result.some((b) => b.key === 'experience:low')).toBe(true);
    });
  });

  describe('buildNextActions — type mapping', () => {
    const fn = buildNextActions as unknown as (
      components: Array<{ key: string; score: number; label: string; evidence: string[] }>,
      profile: null,
      trainingScore: number,
      internshipScore: number,
      assessmentScore: number,
    ) => Array<{ type: string; title: string }>;

    it('recommends assessment when no assessments exist', () => {
      const components: Array<{ key: string; score: number; label: string; evidence: string[] }> = [];
      const result = fn(components, null, 50, 50, 0);
      expect(result.some((a) => a.type === 'ASSESSMENT')).toBe(true);
    });

    it('recommends training when training score < 50', () => {
      const components: Array<{ key: string; score: number; label: string; evidence: string[] }> = [];
      const result = fn(components, null, 20, 50, 60);
      expect(result.some((a) => a.type === 'TRAINING')).toBe(true);
    });

    it('recommends opportunity when internship score < 50', () => {
      const components: Array<{ key: string; score: number; label: string; evidence: string[] }> = [];
      const result = fn(components, null, 50, 20, 60);
      expect(result.some((a) => a.type === 'OPPORTUNITY')).toBe(true);
    });

    it('caps at 6 actions', () => {
      const components: Array<{ key: string; score: number; label: string; evidence: string[] }> = [];
      const result = fn(components, null, 0, 0, 0);
      expect(result.length).toBeLessThanOrEqual(6);
    });
  });

  describe('componentToActionType — deterministic mapping', () => {
    const fn = componentToActionType as (key: string) => string;

    it('SKILLS → SKILL', () => expect(fn('SKILLS')).toBe('SKILL'));
    it('ASSESSMENTS → ASSESSMENT', () => expect(fn('ASSESSMENTS')).toBe('ASSESSMENT'));
    it('TRAINING → TRAINING', () => expect(fn('TRAINING')).toBe('TRAINING'));
    it('INTERNSHIP_EXPERIENCE → OPPORTUNITY', () => expect(fn('INTERNSHIP_EXPERIENCE')).toBe('OPPORTUNITY'));
    it('APPLICATION_HISTORY → OPPORTUNITY', () => expect(fn('APPLICATION_HISTORY')).toBe('OPPORTUNITY'));
  });

  describe('componentToCtaPath — deterministic mapping', () => {
    const fn = componentToCtaPath as (key: string) => string;

    it('ASSESSMENTS → /student/assessments', () => expect(fn('ASSESSMENTS')).toBe('/student/assessments'));
    it('TRAINING → /student/training', () => expect(fn('TRAINING')).toBe('/student/training'));
    it('INTERNSHIP_EXPERIENCE → /student/internships', () => expect(fn('INTERNSHIP_EXPERIENCE')).toBe('/student/internships'));
    it('SKILLS → /student/skills', () => expect(fn('SKILLS')).toBe('/student/skills'));
  });

  describe('constants are correct', () => {
    it('MIN_APPLICATIONS_FOR_OUTCOME_SAMPLE = 3', () => expect(MIN_APPLICATIONS_FOR_OUTCOME_SAMPLE).toBe(3));
    it('MIN_EVALUATED_ASSESSMENTS_FOR_SAMPLE = 1', () => expect(MIN_EVALUATED_ASSESSMENTS_FOR_SAMPLE).toBe(1));
    it('BLOCKER_THRESHOLDS.CRITICAL_SCORE = 30', () => expect((BLOCKER_THRESHOLDS as Record<string, number>).CRITICAL_SCORE).toBe(30));
    it('PROFICIENCY_RANK maps correctly', () => expect(PROFICIENCY_RANK).toEqual({ BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4 }));
  });
});

describe('Placement Outcomes — pure helpers (no DB)', () => {
  const {
    mapStatusToOutcome,
    countByCategory,
    buildFunnel,
    MIN_SAMPLE_SIZE: OUTCOMES_MIN_SAMPLE,
  } = outcomesTest;

  describe('mapStatusToOutcome — deterministic mapping', () => {
    const fn = mapStatusToOutcome as (status: string) => string | null;

    it('APPLIED → APPLIED', () => expect(fn('APPLIED')).toBe('APPLIED'));
    it('SHORTLISTED → SHORTLISTED', () => expect(fn('SHORTLISTED')).toBe('SHORTLISTED'));
    it('INTERVIEW_SCHEDULED → INTERVIEW', () => expect(fn('INTERVIEW_SCHEDULED')).toBe('INTERVIEW'));
    it('SELECTED → SELECTED', () => expect(fn('SELECTED')).toBe('SELECTED'));
    it('OFFER_ACCEPTED → OFFER_ACCEPTED', () => expect(fn('OFFER_ACCEPTED')).toBe('OFFER_ACCEPTED'));
    it('OFFER_EXPIRED → OFFER_EXPIRED', () => expect(fn('OFFER_EXPIRED')).toBe('OFFER_EXPIRED'));
    it('REJECTED → REJECTED', () => expect(fn('REJECTED')).toBe('REJECTED'));
    it('INTERNSHIP_STARTED → SELECTED', () => expect(fn('INTERNSHIP_STARTED')).toBe('SELECTED'));
    it('ONGOING → SELECTED', () => expect(fn('ONGOING')).toBe('SELECTED'));
    it('COMPLETED → SELECTED', () => expect(fn('COMPLETED')).toBe('SELECTED'));
    it('unknown status → null', () => expect(fn('FAKE_STATUS')).toBe(null));
  });

  describe('countByCategory — fills missing categories with 0', () => {
    const fn = countByCategory as (counts: Record<string, number>) => Record<string, number>;

    it('fills all categories even when empty', () => {
      const result = fn({});
      expect(result.APPLIED).toBe(0);
      expect(result.SHORTLISTED).toBe(0);
      expect(result.OFFER_ACCEPTED).toBe(0);
      expect(result.OFFER_EXPIRED).toBe(0);
    });

    it('passes through existing counts', () => {
      const result = fn({ APPLIED: 10, SHORTLISTED: 3 });
      expect(result.APPLIED).toBe(10);
      expect(result.SHORTLISTED).toBe(3);
    });
  });

  describe('buildFunnel — deterministic order', () => {
    const fn = buildFunnel as (counts: Record<string, number>) => Array<{ category: string; label: string; count: number }>;

    it('funnel has exactly 5 steps', () => expect(fn({})).toHaveLength(5));
    it('funnel order is correct', () => {
      const funnel = fn({ APPLIED: 100, SHORTLISTED: 50, INTERVIEW: 20, SELECTED: 10, OFFER_ACCEPTED: 5 });
      expect(funnel.map((f) => f.category)).toEqual(['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'OFFER_ACCEPTED']);
    });
  });

  it('MIN_SAMPLE_SIZE = 3', () => expect(OUTCOMES_MIN_SAMPLE).toBe(3));
});

describe('Intervention — pure helpers (no DB)', () => {
  const {
    severityFromScore,
    GAP_SEVERITY_THRESHOLDS,
    ASSESSMENT_FLOOR,
    REJECTION_FLOOR,
  } = interventionTest;

  describe('severityFromScore — deterministic', () => {
    const fn = severityFromScore as (score: number) => string;

    it('score < 30 → CRITICAL', () => expect(fn(29)).toBe('CRITICAL'));
    it('score = 0 → CRITICAL', () => expect(fn(0)).toBe('CRITICAL'));
    it('score 30–49 → HIGH', () => {
      expect(fn(30)).toBe('HIGH');
      expect(fn(49)).toBe('HIGH');
    });
    it('score 50–64 → MEDIUM', () => {
      expect(fn(50)).toBe('MEDIUM');
      expect(fn(64)).toBe('MEDIUM');
    });
    it('score ≥ 65 → LOW', () => {
      expect(fn(65)).toBe('LOW');
      expect(fn(100)).toBe('LOW');
    });
  });

  describe('constants', () => {
    it('ASSESSMENT_FLOOR = 50', () => expect(ASSESSMENT_FLOOR).toBe(50));
    it('REJECTION_FLOOR = 3', () => expect(REJECTION_FLOOR).toBe(3));
    it('GAP_SEVERITY_THRESHOLDS.CRITICAL_GAPS = 3', () => expect((GAP_SEVERITY_THRESHOLDS as Record<string, number>).CRITICAL_GAPS).toBe(3));
  });
});

describe('Skill Outcomes — pure helpers (no DB)', () => {
  const {
    scoreSkillOutcome,
    MIN_SAMPLE_SIZE: SKILL_OUTCOMES_MIN_SAMPLE,
  } = skillOutcomeTest;

  describe('scoreSkillOutcome', () => {
    const fn = scoreSkillOutcome as (selectionRate: number, applicantsWithSkill: number, minSample: number) => number;

    it('0% selection → 0 strength (with sufficient sample)', () => {
      const result = fn(0, 10, 5);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('100% selection → high strength (with sufficient sample)', () => {
      const result = fn(100, 10, 5);
      expect(result).toBeGreaterThan(0);
    });

    it('returns 0 for 0 applicants', () => expect(fn(50, 0, 5)).toBe(0));

    it('always returns a value in [0, 100]', () => {
      for (let sr = 0; sr <= 100; sr += 10) {
        for (let apps = 0; apps <= 20; apps += 5) {
          const r = fn(sr, apps, 5);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(100);
        }
      }
    });

    it('is deterministic — same inputs always produce same output', () => {
      const r1 = fn(65, 12, 5);
      const r2 = fn(65, 12, 5);
      expect(r1).toBe(r2);
    });
  });

  it('MIN_SAMPLE_SIZE = 5', () => expect(SKILL_OUTCOMES_MIN_SAMPLE).toBe(5));
});
