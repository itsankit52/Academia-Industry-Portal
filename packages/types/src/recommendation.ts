/**
 * Phase 9A — Personalized Student Intelligence
 * Phase 9B — Advanced Intelligence & Career Decision Support
 *
 * Shared types for the unified personalized recommendations endpoint plus the
 * deeper career analysis surface (career path, action plan, benchmark,
 * readiness progression). Composes existing types and reuses Phase 9A shapes
 * so there is a single source of truth.
 */

import type { RecommendedMentor } from './mentorProfile';
import type { Proficiency, SkillCategory, OpportunityType } from '@aip/config';

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
  /**
   * Phase 9B — Career Insights summary for the dashboard widget.
   * Derived from the same data above; included so the dashboard can render
   * its Career Insights section without a second round-trip.
   */
  careerInsights: CareerInsights;
  /** Phase 9B — Aggregate-only peer benchmark (or unavailable). */
  benchmark: CareerBenchmark;
  /** Phase 9B — Readiness progression (delta vs. previous defensible value). */
  progression: ReadinessProgression;
  /** Generated-at timestamp (ISO). */
  generatedAt: string;
}

/* ─── Phase 9B — Career Insights (Dashboard widget) ──────────────────── */

export interface CareerInsightStrength {
  skillId: string;
  name: string;
  category: SkillCategory;
  proficiency: Proficiency;
}

export interface CareerInsights {
  /** Re-export of readiness for the widget header. */
  readiness: CareerReadinessSummary;
  /** Verdict label the dashboard surfaces. */
  currentLevel: ReadinessLevel;
  /** Top 3 strengths ordered by proficiency desc. */
  topStrengths: CareerInsightStrength[];
  /** Top 3 skill gaps (Phase 9A priority order). */
  topGaps: SkillGapRecommendation[];
  /** Single most-relevant recommended action. */
  recommendedNextAction: CareerAction | null;
  /** Short headline that summarises the student's career state. */
  headline: string;
}

/* ─── Phase 9B — Career Path / Target Role Analysis ─────────────────── */

export type SkillComparisonState = 'MATCHED' | 'PARTIAL' | 'MISSING';

/** Per-skill comparison row between the student and a target role. */
export interface SkillComparison {
  skillId: string;
  name: string;
  category: SkillCategory;
  /** Whether the opportunity lists this skill as required. */
  required: boolean;
  /** The student's recorded proficiency (null if not added). */
  currentProficiency: Proficiency | null;
  /** The target proficiency if the role states one. INTERMEDIATE is the
   *  default when the role lists the skill as required but no level. */
  requiredProficiency: Proficiency;
  /** gapLevels (0 = MATCHED, >0 = PARTIAL/MISSING). */
  gap: number;
  state: SkillComparisonState;
}

export interface CareerPathAction {
  /** Discriminator for the action shape. */
  type: 'TRAINING' | 'SKILL' | 'ASSESSMENT' | 'MENTOR' | 'OPPORTUNITY';
  title: string;
  reason: string;
  /** Reference to a real entity when one exists. */
  entityId?: string;
  /** Optional CTA path (e.g. /student/training, /student/assessments). */
  ctaPath?: string;
  /** Optional CTA label so the UI doesn't have to hardcode verbs. */
  ctaLabel?: string;
}

/** Deterministic opportunity-readiness snapshot for a target role. */
export interface OpportunityReadiness {
  opportunityId: string;
  opportunityType: OpportunityType;
  opportunityTitle: string;
  /** 0-100 multi-dimensional score from the existing fullMatch engine. */
  readinessScore: number;
  /** Match level from the existing fullMatch engine. */
  matchLevel: string;
  /** True when the student passes all eligibility gates. */
  eligible: boolean;
  /** Plain-language reason explaining readiness state. */
  headline: string;
  matchedSkills: SkillComparison[];
  partialSkills: SkillComparison[];
  missingSkills: SkillComparison[];
  /** Highest-priority missing skills (sorted by gap desc, then by name). */
  topGaps: SkillComparison[];
  /** Recommended next steps to close the largest gaps. */
  recommendedActions: CareerPathAction[];
  /** Deterministic evidence from the fullMatch explanation. */
  evidence: string[];
}

/** Full career-path analysis for a target opportunity. */
export interface CareerPathAnalysis {
  opportunity: {
    id: string;
    type: OpportunityType;
    title: string;
  };
  /** Deterministic readiness snapshot (composes existing fullMatch). */
  readiness: OpportunityReadiness;
  /** Per-skill comparison in declaration order (required skills first). */
  skillComparison: SkillComparison[];
  /** Strongest matches the student already has. */
  strongestMatches: SkillComparison[];
  /** Highest-priority gaps to close. */
  highestPriorityGaps: SkillComparison[];
  /** Suggested trainings that cover at least one of the highest-priority gaps. */
  recommendedTrainings: PersonalizedTraining[];
  /** Suggested mentor for the most-relevant gap (or null). */
  recommendedMentor: RecommendedMentor | null;
  /** Ordered next-action list. */
  nextActions: CareerPathAction[];
  /** ISO timestamp. */
  generatedAt: string;
}

/* ─── Phase 9B — Action Plan ─────────────────────────────────────────── */

export type CareerActionType = 'SKILL' | 'TRAINING' | 'ASSESSMENT' | 'MENTOR' | 'OPPORTUNITY';

export interface CareerAction {
  /** Lower number = higher priority (1 = first action). */
  priority: number;
  type: CareerActionType;
  title: string;
  /** Human-readable explanation, sourced from real data. */
  reason: string;
  /** Real entity id when applicable. */
  entityId?: string;
  /** Optional navigation path for the action's CTA. */
  ctaPath?: string;
  /** Optional CTA label. */
  ctaLabel?: string;
}

export interface CareerActionPlan {
  actions: CareerAction[];
  /** Number of actions generated. */
  total: number;
  /** ISO timestamp. */
  generatedAt: string;
}

/* ─── Phase 9B — Benchmark / Peer Comparison ─────────────────────────── */

export type BenchmarkStrength = 'WEAKER' | 'TYPICAL' | 'STRONGER';

export interface BenchmarkSkillCategory {
  category: SkillCategory;
  /** Student's category strength in this category (0-100 scale). */
  studentScore: number;
  /** Aggregate score from peers (0-100 scale). */
  peerScore: number;
  verdict: BenchmarkStrength;
}

export interface CareerBenchmark {
  /** Always true so the UI can render a "unavailable" state. */
  available: boolean;
  /** Aggregate student count used for the benchmark. */
  sampleSize: number;
  /** Student's readiness score (0-100). */
  studentReadiness?: number;
  /** Mean readiness across peers (0-100). */
  peerReadiness?: number;
  /** Student's average proficiency (0-100). */
  studentAverageProficiency?: number;
  /** Mean average proficiency across peers (0-100). */
  peerAverageProficiency?: number;
  /** Student's skill count. */
  studentSkillCount?: number;
  /** Mean skill count across peers. */
  peerSkillCount?: number;
  /** Per-category breakdown. */
  categories?: BenchmarkSkillCategory[];
  /** Plain-language reason when unavailable. */
  unavailableReason?: string;
}

/* ─── Phase 9B — Readiness Progression ───────────────────────────────── */

export interface ReadinessProgression {
  /** Current readiness score (0-100). */
  currentScore: number;
  /** Previous defensible score. null when history is insufficient. */
  previousScore: number | null;
  /** currentScore - previousScore; 0 when previous is null. */
  delta: number;
  /** Deterministic factors that contributed to the delta. */
  contributingFactors: string[];
  /** When history is insufficient, this explains why. */
  fallbackReason?: string;
}
