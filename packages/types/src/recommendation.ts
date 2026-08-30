/**
 * Phase 9A — Personalized Student Intelligence
 *
 * Shared types for the unified personalized recommendations endpoint.
 * Composes existing types (RecommendedJob, RecommendedInternship, RecommendedMentor,
 * RecommendedTraining, SkillGapItem) and adds Phase 9A-specific types.
 */

import type { RecommendedMentor } from './mentorProfile';

/* ─── Skill Gap ─────────────────────────────────────────────────────────── */

export type SkillGapPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SkillGapRecommendation {
  /** Skill id. */
  id: string;
  name: string;
  category: string;
  /** Industry demand score: how many published opportunities require this skill. */
  demandScore: number;
  /** Computed priority tier. */
  priority: SkillGapPriority;
  /** Human-readable reason for this recommendation. */
  reason: string;
  /** Training ids (of ACTIVE trainings) that cover this gap. */
  recommendedTrainingIds: string[];
}

/* ─── Training (enrollment-aware) ──────────────────────────────────────── */

export interface PersonalizedTraining {
  /** Reuses the same shape as the existing training recommendations. */
  id: string;
  title: string;
  description: string;
  provider: string;
  /** Skill ids (not populated docs) for compactness. */
  skills: string[];
  durationWeeks: number;
  registrationUrl: string;
  /** Number of the student's gap skills this training covers. */
  overlapCount: number;
  /** Ids of gap skills this training covers. */
  overlapSkillIds: string[];
}

/* ─── Readiness Summary ───────────────────────────────────────────────── */

export type ReadinessLevel =
  | 'Not Ready'
  | 'Getting Started'
  | 'In Progress'
  | 'Almost There'
  | 'Career Ready';

export interface CareerReadinessSummary {
  /** 0-100 score blending skill proficiency and industry demand alignment. */
  readinessScore: number;
  /** One-line label. */
  level: ReadinessLevel;
  /** Short descriptor. */
  description: string;
}

/* ─── Unified Response ───────────────────────────────────────────────── */

export interface PersonalizedOpportunitySummary {
  id: string;
  title: string;
  /** Type discriminator. */
  type: 'JOB' | 'INTERNSHIP';
  /** 0-100 match score. */
  matchScore: number;
  /** True if the student passes the eligibility check. */
  eligible: boolean;
  /** One-line summary, e.g. "3/5 skills matched". */
  matchSummary: string;
  /** Top up-to-2 missing skills, for warnings. */
  topMissingSkills: string[];
  /** Up to 3 matched skill names. */
  matchedSkillNames: string[];
  /** Career interests that overlapped with the opportunity's title. */
  careerInterestsMatch: string[];
  /** Company display name (if populated). */
  companyName?: string;
}

export interface PersonalizedRecommendations {
  /** Career readiness at a glance. */
  readiness: CareerReadinessSummary;
  /** Skill gaps sorted by priority (CRITICAL → LOW). */
  skillGaps: SkillGapRecommendation[];
  /** Top recommended trainings (excludes COMPLETED enrollments). */
  trainings: PersonalizedTraining[];
  /** Top recommended mentors (Phase 8 scoring). */
  mentors: RecommendedMentor[];
  /** Top recommended jobs. */
  jobs: PersonalizedOpportunitySummary[];
  /** Top recommended internships. */
  internships: PersonalizedOpportunitySummary[];
  /** Generated-at timestamp (ISO). */
  generatedAt: string;
}
