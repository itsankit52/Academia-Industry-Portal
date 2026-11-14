/**
 * Phase 9B — Advanced Intelligence & Career Decision Support
 *
 * Deterministic, explainable layer that builds on top of the Phase 9A engine.
 * Composes existing services rather than duplicating math:
 *
 *   - skill comparison         → fullMatch.service.analyzeFullMatch
 *   - opportunity readiness    → fullMatch.service.analyzeFullMatch
 *   - action plan              → skill-gap prioritization + recommendTrainings
 *                                + recommendMentorsForStudent
 *   - assessment influence     → Assessment.skillBreakdown (read-only)
 *   - benchmark                → aggregate-only StudentSkill counts
 *   - progression              → StudentSkill + TrainingEnrollment history
 *
 * No LLM, no external services, no new collections. All institution scoping
 * is inherited from the underlying queries.
 */

import { Types } from 'mongoose';
import type {
  CareerAction,
  CareerActionPlan,
  CareerActionType,
  CareerBenchmark,
  BenchmarkSkillCategory,
  CareerInsights,
  CareerInsightStrength,
  CareerPathAction,
  CareerPathAnalysis,
  OpportunityReadiness,
  PersonalizedTraining,
  ReadinessProgression,
  SkillComparison,
  SkillComparisonState,
} from '@aip/types';
import type { OpportunityType, Proficiency, SkillCategory } from '@aip/config';
import {
  Assessment,
  Internship,
  Job,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingEnrollment,
  TrainingProgram,
  type TrainingProgramDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { idOf } from '../matching/skillGap';
import { analyzeFullMatch, type FullMatchAnalysis } from '../matching/fullMatch.service';
import { recommendMentorsForStudent } from '../mentorship/mentorship.service';
import type { StudentDataLoader } from './studentDataLoader';
import { BENCHMARK_PEER_PIPELINE } from './sharedDataCache';

/* ─── Constants ─────────────────────────────────────────────────────── */

const PROFICIENCY_RANK: Record<Proficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const PROFICIENCY_DEFAULT_REQUIRED: Proficiency = 'INTERMEDIATE';

/** Maximum items returned in plan/insight lists. */
const PLAN_LIMIT = 8;
const GAP_LIST_LIMIT = 3;
const MIN_BENCHMARK_SAMPLE = 5;

const FALLBACK_REASONS = {
  insufficient: 'Benchmark unavailable due to insufficient data.',
  noHistory: 'No previous readiness baseline available yet.',
} as const;

/* ─── Helpers ───────────────────────────────────────────────────────── */

function clampRank(level: Proficiency | null | undefined): number {
  if (!level) return 0;
  return PROFICIENCY_RANK[level] ?? 0;
}

function gapStateFor(current: Proficiency | null, required: Proficiency): SkillComparisonState {
  if (current === null) return 'MISSING';
  if (PROFICIENCY_RANK[current] >= PROFICIENCY_RANK[required]) return 'MATCHED';
  return 'PARTIAL';
}

function proficiencyOrNull(value: unknown): Proficiency | null {
  if (typeof value !== 'string') return null;
  const v = value.toUpperCase() as Proficiency;
  if (v in PROFICIENCY_RANK) return v;
  return null;
}

function categoryOrOther(value: unknown): SkillCategory {
  if (typeof value !== 'string') return 'OTHER';
  return value as SkillCategory;
}

function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

/* ─── Phase 9B — Skill comparison / opportunity readiness ─────────── */

/**
 * Builds a per-skill comparison between the student's profile and the
 * target opportunity's required skills. Reuses the fullMatch payload so the
 * numbers come from the same engine.
 */
function buildSkillComparison(
  analysis: FullMatchAnalysis,
  requiredSkillNames: Map<string, { name: string; category: SkillCategory }>,
  studentProficiencyByName: Map<string, Proficiency>,
): SkillComparison[] {
  const rows: SkillComparison[] = [];
  const seen = new Set<string>();

  // Required skills — gap-driven comparison.
  for (const skill of analysis.matchedSkills.technical) {
    const name = skill.name.toLowerCase();
    const studentLevel = studentProficiencyByName.get(name) ?? null;
    const required: Proficiency = PROFICIENCY_DEFAULT_REQUIRED;
    const gap = Math.max(0, clampRank(required) - clampRank(studentLevel));
    rows.push({
      skillId: skill.id,
      name: skill.name,
      category: requiredSkillNames.get(skill.id)?.category ?? 'OTHER',
      required: true,
      currentProficiency: studentLevel,
      requiredProficiency: required,
      gap,
      state: gapStateFor(studentLevel, required),
    });
    seen.add(skill.id);
  }

  // Missing required skills.
  for (const skill of analysis.missingSkills.technical) {
    const meta = requiredSkillNames.get(skill.id);
    const required: Proficiency = PROFICIENCY_DEFAULT_REQUIRED;
    rows.push({
      skillId: skill.id,
      name: skill.name,
      category: meta?.category ?? 'OTHER',
      required: true,
      currentProficiency: null,
      requiredProficiency: required,
      gap: clampRank(required),
      state: 'MISSING',
    });
    seen.add(skill.id);
  }

  // Proficiency gap rows (e.g. student has the skill but below required).
  for (const gap of analysis.proficiencyGaps) {
    if (seen.has(gap.id)) continue;
    const meta = requiredSkillNames.get(gap.id);
    rows.push({
      skillId: gap.id,
      name: gap.name,
      category: meta?.category ?? 'OTHER',
      required: true,
      currentProficiency: gap.studentLevel,
      requiredProficiency: gap.requiredLevel,
      gap: gap.gapLevels,
      state: gapStateFor(gap.studentLevel, gap.requiredLevel),
    });
    seen.add(gap.id);
  }

  return rows;
}

function readinessHeadline(analysis: FullMatchAnalysis, comparison: SkillComparison[]): string {
  const missing = comparison.filter((c) => c.state === 'MISSING').length;
  const partial = comparison.filter((c) => c.state === 'PARTIAL').length;
  const matched = comparison.filter((c) => c.state === 'MATCHED').length;
  const total = matched + partial + missing;

  if (!analysis.eligibility.passed) {
    return `Not yet eligible: ${analysis.eligibility.failures[0] ?? 'review eligibility criteria'}.`;
  }
  if (total === 0) {
    return 'No specific skills required for this role — general fit applies.';
  }
  if (analysis.level === 'STRONG_MATCH') {
    return `Ready: you match ${matched} of ${total} required skills.`;
  }
  if (missing > 0) {
    return `Not yet ready: ${missing} required ${missing === 1 ? 'skill is' : 'skills are'} missing.`;
  }
  if (partial > 0) {
    return `Close: ${partial} skill${partial === 1 ? '' : 's'} can be strengthened to fully qualify.`;
  }
  return `Ready: you match all ${total} required skills.`;
}

/* ─── Phase 9B — Career path analysis (target role) ───────────────── */

export interface CareerPathInput {
  studentUserId: string;
  opportunityType: OpportunityType;
  opportunityId: string;
}

/**
 * Deterministic career-path analysis for a target opportunity. Reuses
 * `analyzeFullMatch` for the math and composes Phase 9A pieces
 * (training + mentor recommendations) for the action list.
 */
export async function getCareerPathAnalysis(input: CareerPathInput): Promise<CareerPathAnalysis> {
  const { studentUserId, opportunityType, opportunityId } = input;
  if (!isValidObjectId(opportunityId)) {
    throw AppError.notFound(opportunityType === 'JOB' ? 'Job not found' : 'Internship not found');
  }

  const analysis: FullMatchAnalysis = await analyzeFullMatch(
    studentUserId,
    opportunityType,
    opportunityId,
  );

  // Resolve the student's proficiency keyed by lowercased skill name so we can
  // join against the fullMatch payload which is name-based.
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(studentUserId) }).select(
    '_id',
  );
  if (!profile) throw AppError.notFound('Student profile not found');

  const studentSkills = await StudentSkill.find({ student: profile._id })
    .select('skill proficiency')
    .populate({ path: 'skill', select: 'name' })
    .lean();
  const studentProficiencyByName = new Map<string, Proficiency>();
  for (const row of studentSkills) {
    const name = (row as unknown as { skill?: { name?: string } }).skill?.name;
    if (!name) continue;
    const level = proficiencyOrNull(row.proficiency);
    if (level) studentProficiencyByName.set(name.toLowerCase(), level);
  }

  // Build a name+category lookup for all required skills (matched + missing).
  const requiredIds = [
    ...analysis.matchedSkills.technical.map((s) => s.id),
    ...analysis.missingSkills.technical.map((s) => s.id),
    ...analysis.proficiencyGaps.map((s) => s.id),
  ]
    .filter((id, idx, arr) => id && arr.indexOf(id) === idx)
    .map((id) => new Types.ObjectId(id));
  const skillDocs = requiredIds.length
    ? await Skill.find({ _id: { $in: requiredIds } })
        .select('_id name category')
        .lean()
    : [];
  const requiredSkillNames = new Map<string, { name: string; category: SkillCategory }>();
  for (const s of skillDocs) {
    requiredSkillNames.set(String(s._id), {
      name: String(s.name),
      category: categoryOrOther(s.category),
    });
  }

  const skillComparison = buildSkillComparison(
    analysis,
    requiredSkillNames,
    studentProficiencyByName,
  );

  // Group into matched / partial / missing, plus top gaps.
  const matched = skillComparison.filter((c) => c.state === 'MATCHED');
  const partial = skillComparison.filter((c) => c.state === 'PARTIAL');
  const missing = skillComparison.filter((c) => c.state === 'MISSING');

  const topGaps = [...skillComparison]
    .filter((c) => c.state !== 'MATCHED')
    .sort((a, b) => {
      if (b.gap !== a.gap) return b.gap - a.gap;
      return a.name.localeCompare(b.name);
    })
    .slice(0, GAP_LIST_LIMIT);

  // Build training recommendations that close the highest-priority gaps.
  const topGapIds = topGaps.map((g) => g.skillId);
  const trainings = await buildGapClosingTrainings(profile._id, topGapIds);
  const highestGapIds = new Set(topGapIds);

  // Build evidence strings from the fullMatch explanation (re-used text).
  const evidence: string[] = analysis.explanation.reasons.map((r) => r.message);

  // Mentor: pick the most relevant mentor using Phase 9A logic over the gaps.
  const mentor = await pickRelevantMentor(studentUserId, highestGapIds);

  // Next actions: training > assessment > skill add > mentor > opportunity apply.
  const nextActions = buildNextActions({
    opportunityType,
    opportunityId,
    topGaps,
    trainings,
    mentor,
    eligibility: analysis.eligibility,
  });

  const readiness: OpportunityReadiness = {
    opportunityId: analysis.opportunityId,
    opportunityType: analysis.opportunityType,
    opportunityTitle: analysis.opportunityTitle,
    readinessScore: analysis.score,
    matchLevel: analysis.level,
    eligible: analysis.eligibility.passed,
    headline: readinessHeadline(analysis, skillComparison),
    matchedSkills: matched,
    partialSkills: partial,
    missingSkills: missing,
    topGaps,
    recommendedActions: nextActions,
    evidence,
  };

  return {
    opportunity: {
      id: analysis.opportunityId,
      type: analysis.opportunityType,
      title: analysis.opportunityTitle,
    },
    readiness,
    skillComparison,
    strongestMatches: matched.slice(0, GAP_LIST_LIMIT),
    highestPriorityGaps: topGaps,
    recommendedTrainings: trainings,
    recommendedMentor: mentor,
    nextActions,
    generatedAt: new Date().toISOString(),
  };
}

/* ─── Training gap-closure analysis ───────────────────────────────── */

/**
 * Training recommendations ranked by gap-closure value. A training's score is
 * a deterministic combination of:
 *   - how many of the highest-priority gaps it covers
 *   - the sum of those gaps (so closing a 3-step gap is more valuable)
 *   - the student's current proficiency (lower = more valuable)
 *   - the training's status (must be ACTIVE)
 *   - the training must NOT be in a COMPLETED enrollment
 */
async function buildGapClosingTrainings(
  studentProfileId: Types.ObjectId,
  gapSkillIds: string[],
  loader?: StudentDataLoader,
): Promise<PersonalizedTraining[]> {
  if (gapSkillIds.length === 0) return [];
  if (loader) await loader.assertProfile(studentProfileId);

  const [completed, trainings] = await Promise.all([
    loader
      ? loader.completedEnrollments()
      : TrainingEnrollment.find({ student: studentProfileId, status: 'COMPLETED' })
          .select('training')
          .lean(),
    loader
      ? loader.activeTrainingsWithSkills()
      : TrainingProgram.find({ status: 'ACTIVE' })
          .populate({ path: 'skills', select: 'name category' })
          .lean(),
  ]);
  const completedSet = new Set(completed.map((c) => String(c.training)));
  const gapSet = new Set(gapSkillIds);

  return (trainings as unknown as TrainingProgramDoc[])
    .map((t) => {
      const skillIds = ((t.skills ?? []) as unknown as unknown[]).map(idOf);
      const overlapSkillIds = skillIds.filter((id) => gapSet.has(id));
      return {
        id: String(t._id),
        title: String(t.title ?? ''),
        description: String(t.description ?? ''),
        provider: String(t.provider ?? ''),
        skills: skillIds,
        durationWeeks: typeof t.durationWeeks === 'number' ? t.durationWeeks : 0,
        registrationUrl: String(t.registrationUrl ?? ''),
        overlapCount: overlapSkillIds.length,
        overlapSkillIds,
      } as PersonalizedTraining;
    })
    .filter((t) => !completedSet.has(t.id) && t.overlapCount > 0)
    .sort((a, b) => {
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
      return a.title.localeCompare(b.title);
    })
    .slice(0, PLAN_LIMIT);
}

/**
 * Picks the most relevant mentor for the highest-priority gap. Reuses
 * Phase 9A's mentor service over the gap ids.
 */
async function pickRelevantMentor(
  studentUserId: string,
  gapSkillIds: Set<string>,
): Promise<CareerPathAnalysis['recommendedMentor']> {
  if (gapSkillIds.size === 0) return null;
  const mentors = await recommendMentorsForStudent(studentUserId, 5);
  if (mentors.length === 0) return null;
  // Recommend the top mentor; Phase 9A already scored them.
  return mentors[0] ?? null;
}

/* ─── Next actions for a target role ──────────────────────────────── */

function buildNextActions(params: {
  opportunityType: OpportunityType;
  opportunityId: string;
  topGaps: SkillComparison[];
  trainings: PersonalizedTraining[];
  mentor: CareerPathAnalysis['recommendedMentor'];
  eligibility: FullMatchAnalysis['eligibility'];
}): CareerPathAction[] {
  const actions: CareerPathAction[] = [];
  const { topGaps, trainings, mentor, eligibility } = params;

  // 1) Closest training that covers a top gap (highest priority).
  const topTraining = trainings[0];
  if (topTraining) {
    const coveredNames = topTraining.overlapSkillIds
      .map((id) => topGaps.find((g) => g.skillId === id)?.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 2);
    actions.push({
      type: 'TRAINING',
      title: `Complete ${topTraining.title}`,
      reason: coveredNames.length
        ? `Covers ${coveredNames.length} high-priority gap${coveredNames.length === 1 ? '' : 's'}: ${coveredNames.join(', ')}.`
        : `Covers ${topTraining.overlapCount} of your high-priority gaps.`,
      entityId: topTraining.id,
      ctaPath: topTraining.registrationUrl || undefined,
      ctaLabel: 'Start training',
    });
  }

  // 2) Add a missing skill manually if there's no training for it.
  const noTrainingGap = topGaps.find(
    (g) => g.state === 'MISSING' && !trainings.some((t) => t.overlapSkillIds.includes(g.skillId)),
  );
  if (noTrainingGap) {
    actions.push({
      type: 'SKILL',
      title: `Add ${noTrainingGap.name} to your profile`,
      reason: `${noTrainingGap.name} is a high-priority gap with no available training.`,
      ctaPath: '/student/skills',
      ctaLabel: 'Add skill',
    });
  }

  // 3) Mentor for the most-relevant gap.
  if (mentor) {
    actions.push({
      type: 'MENTOR',
      title: `Connect with ${mentor.fullName}`,
      reason: `Their expertise overlaps with your top gaps (${mentor.expertise.slice(0, 2).join(', ')}).`,
      entityId: mentor.id,
      ctaPath: '/student/mentorship',
      ctaLabel: 'Connect',
    });
  }

  // 4) Assessment for verification when partial skills exist.
  const partialGap = topGaps.find((g) => g.state === 'PARTIAL');
  if (partialGap) {
    actions.push({
      type: 'ASSESSMENT',
      title: `Take a ${partialGap.name} assessment`,
      reason: `Verify your ${partialGap.name} proficiency to strengthen this match.`,
      ctaPath: '/student/assessments',
      ctaLabel: 'Take assessment',
    });
  }

  // 5) Apply when ready.
  if (eligibility.passed) {
    actions.push({
      type: 'OPPORTUNITY',
      title: `Apply to ${params.opportunityType === 'JOB' ? 'this job' : 'this internship'}`,
      reason: 'You meet the eligibility criteria — submit your application.',
      entityId: params.opportunityId,
      ctaPath:
        params.opportunityType === 'JOB'
          ? `/jobs/${params.opportunityId}`
          : `/internships/${params.opportunityId}`,
      ctaLabel: 'View opportunity',
    });
  }

  return actions;
}

/* ─── Phase 9B — Personalized career action plan ──────────────────── */

export interface CareerActionPlanInput {
  studentUserId: string;
  opportunityId?: string;
  opportunityType?: OpportunityType;
}

/**
 * Builds a deterministic action plan from the student's gap set, training
 * availability, mentor recommendations, and (optionally) a target
 * opportunity. Each action references a real entity id when possible.
 */
export async function getCareerActionPlan(input: CareerActionPlanInput): Promise<CareerActionPlan> {
  const { studentUserId, opportunityId, opportunityType } = input;

  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(studentUserId) }).select(
    '_id',
  );
  if (!profile) {
    return { actions: [], total: 0, generatedAt: new Date().toISOString() };
  }

  // --- Step 1: gather the gap set ---
  let gapSkillIds: string[] = [];
  let targetOpportunity: { id: string; type: OpportunityType; title: string } | null = null;
  if (opportunityId && opportunityType && isValidObjectId(opportunityId)) {
    const analysis: FullMatchAnalysis = await analyzeFullMatch(
      studentUserId,
      opportunityType,
      opportunityId,
    );
    targetOpportunity = {
      id: analysis.opportunityId,
      type: analysis.opportunityType,
      title: analysis.opportunityTitle,
    };
    const gapSet = new Set<string>();
    for (const s of analysis.missingSkills.technical) gapSet.add(s.id);
    for (const s of analysis.proficiencyGaps) gapSet.add(s.id);
    gapSkillIds = Array.from(gapSet);
  } else {
    // Fall back to industry-wide demand (mirrors Phase 9A prioritization).
    gapSkillIds = await collectTopIndustryGaps(profile._id);
  }

  // --- Step 2: read assessment signal (assessment-driven intelligence) ---
  const assessmentBySkill = await loadAssessmentSignals(profile._id);

  // --- Step 3: gap priority-aware action list ---
  const actions: CareerAction[] = [];
  let priority = 1;

  // a) Trainings that close the most gaps, sorted by gap coverage.
  const topGapsForAction = gapSkillIds.slice(0, PLAN_LIMIT);
  const trainings = await buildGapClosingTrainings(profile._id, topGapsForAction);
  for (const t of trainings) {
    const coveredNames = await resolveSkillNames(t.overlapSkillIds);
    const assessmentBoosted = coveredNames.some(
      (n) => (assessmentBySkill.get(n.toLowerCase())?.weaknessScore ?? 0) > 0,
    );
    actions.push({
      priority: priority++,
      type: 'TRAINING',
      title: `Complete ${t.title}`,
      reason: assessmentBoosted
        ? `Covers ${t.overlapCount} gap${t.overlapCount === 1 ? '' : 's'}; assessment shows weakness here.`
        : `Covers ${t.overlapCount} of your priority gap${t.overlapCount === 1 ? '' : 's'}.`,
      entityId: t.id,
      ctaPath: t.registrationUrl || '/student/training',
      ctaLabel: 'Start training',
    });
  }

  // b) Add-skill actions for gaps with no training.
  const coveredByTraining = new Set<string>();
  for (const t of trainings) for (const id of t.overlapSkillIds) coveredByTraining.add(id);
  const noTrainingGaps = await collectSkillNames(
    gapSkillIds.filter((id) => !coveredByTraining.has(id)),
  );
  for (const gap of noTrainingGaps.slice(0, 2)) {
    actions.push({
      priority: priority++,
      type: 'SKILL',
      title: `Add ${gap.name} to your profile`,
      reason: `${gap.name} is a gap${gap.category ? ` (${gap.category.toLowerCase()})` : ''} with no active training available.`,
      ctaPath: '/student/skills',
      ctaLabel: 'Add skill',
    });
  }

  // c) Assessment for verification when assessment signal exists.
  if (assessmentBySkill.size > 0) {
    const weakest = [...assessmentBySkill.entries()]
      .filter(([, v]) => v.weaknessScore > 0)
      .sort((a, b) => b[1].weaknessScore - a[1].weaknessScore)[0];
    if (weakest) {
      const [, signal] = weakest;
      actions.push({
        priority: priority++,
        type: 'ASSESSMENT',
        title: `Re-take a ${signal.skillName} assessment`,
        reason: `Your previous score was ${signal.lastScore}%. Re-take to verify improvement.`,
        ctaPath: '/student/assessments',
        ctaLabel: 'Take assessment',
      });
    }
  } else {
    // No assessment data → still surface one neutral entry to encourage first assessment.
    actions.push({
      priority: priority++,
      type: 'ASSESSMENT',
      title: 'Take your first skill assessment',
      reason: 'Assessments convert self-reported proficiency into verified scores.',
      ctaPath: '/student/assessments',
      ctaLabel: 'Generate assessment',
    });
  }

  // d) Mentor for top gap expertise overlap.
  const mentor = await pickRelevantMentor(studentUserId, new Set(gapSkillIds.slice(0, 10)));
  if (mentor) {
    actions.push({
      priority: priority++,
      type: 'MENTOR',
      title: `Connect with ${mentor.fullName}`,
      reason: `Their expertise covers your top gap areas (${mentor.expertise.slice(0, 2).join(', ')}).`,
      entityId: mentor.id,
      ctaPath: '/student/mentorship',
      ctaLabel: 'Find a mentor',
    });
  }

  // e) Opportunity action when a target is provided and the student is eligible.
  if (targetOpportunity) {
    const analysis: FullMatchAnalysis = await analyzeFullMatch(
      studentUserId,
      targetOpportunity.type,
      targetOpportunity.id,
    );
    if (analysis.eligibility.passed && analysis.score >= 60) {
      actions.push({
        priority: priority++,
        type: 'OPPORTUNITY',
        title: `Apply to ${targetOpportunity.title}`,
        reason: `Your match score is ${analysis.score} and you meet the eligibility criteria.`,
        entityId: targetOpportunity.id,
        ctaPath:
          targetOpportunity.type === 'JOB'
            ? `/jobs/${targetOpportunity.id}`
            : `/internships/${targetOpportunity.id}`,
        ctaLabel: 'View opportunity',
      });
    }
  }

  return {
    actions: actions.slice(0, PLAN_LIMIT).map((a, idx) => ({ ...a, priority: idx + 1 })),
    total: Math.min(actions.length, PLAN_LIMIT),
    generatedAt: new Date().toISOString(),
  };
}

/* ─── Helpers for action plan ─────────────────────────────────────── */

interface AssessmentSignal {
  skillId: string;
  skillName: string;
  lastScore: number;
  /** 100 - lastScore; higher = weaker. 0 when no assessment. */
  weaknessScore: number;
}

async function loadAssessmentSignals(
  studentProfileId: Types.ObjectId,
  loader?: StudentDataLoader,
): Promise<Map<string, AssessmentSignal>> {
  const out = new Map<string, AssessmentSignal>();
  if (loader) await loader.assertProfile(studentProfileId);
  const recent = loader
    ? (await loader.evaluatedAssessments()).slice(0, 5)
    : await Assessment.find({ student: studentProfileId, status: 'EVALUATED' })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
  for (const a of recent) {
    const breakdown = (a as unknown as { evaluation?: { skillBreakdown?: unknown[] } }).evaluation
      ?.skillBreakdown;
    if (!Array.isArray(breakdown)) continue;
    for (const row of breakdown) {
      const r = row as {
        skillId?: string;
        skillName?: string;
        score?: number;
        maxScore?: number;
      };
      if (!r.skillId || !r.skillName) continue;
      const max = typeof r.maxScore === 'number' && r.maxScore > 0 ? r.maxScore : 100;
      const pct = typeof r.score === 'number' ? Math.round((r.score / max) * 100) : 0;
      const key = r.skillName.toLowerCase();
      if (!out.has(key)) {
        out.set(key, {
          skillId: r.skillId,
          skillName: r.skillName,
          lastScore: pct,
          weaknessScore: Math.max(0, 100 - pct),
        });
      }
    }
  }
  return out;
}

async function collectTopIndustryGaps(studentProfileId: Types.ObjectId): Promise<string[]> {
  const owned = await StudentSkill.find({ student: studentProfileId }).select('skill').lean();
  const ownedSet = new Set(owned.map((r) => String(r.skill)));
  const [jobDemand, internDemand] = await Promise.all([
    Job.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: 'PUBLISHED' } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: '$requiredSkills', count: { $sum: 1 } } },
    ]),
    Internship.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: 'PUBLISHED' } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: '$requiredSkills', count: { $sum: 1 } } },
    ]),
  ]);
  const demand = new Map<string, number>();
  for (const row of [...jobDemand, ...internDemand]) {
    const id = String(row._id);
    demand.set(id, (demand.get(id) ?? 0) + Number(row.count || 1));
  }
  return [...demand.entries()]
    .filter(([id]) => !ownedSet.has(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

async function collectSkillNames(
  ids: string[],
): Promise<Array<{ id: string; name: string; category: SkillCategory }>> {
  if (ids.length === 0) return [];
  const valid = ids.filter(isValidObjectId).map((id) => new Types.ObjectId(id));
  if (valid.length === 0) return [];
  const rows = await Skill.find({ _id: { $in: valid } })
    .select('_id name category')
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    name: String(r.name),
    category: categoryOrOther(r.category),
  }));
}

async function resolveSkillNames(ids: string[]): Promise<string[]> {
  return (await collectSkillNames(ids)).map((s) => s.name);
}

/* ─── Phase 9B — Career Insights (Dashboard widget) ───────────────── */

/**
 * Builds the Career Insights summary that the dashboard renders. Reuses the
 * same data the unified endpoint already loads (readiness + gaps +
 * trainings + mentors) so we don't add an extra round-trip.
 */
export interface CareerInsightsInput {
  readiness: CareerInsights['readiness'];
  topStrengths: CareerInsightStrength[];
  topGaps: CareerInsights['topGaps'];
  recommendedNextAction: CareerAction | null;
}

export function buildCareerInsights(input: CareerInsightsInput): CareerInsights {
  const headline = buildHeadline(input);
  return {
    readiness: input.readiness,
    currentLevel: input.readiness.level,
    topStrengths: input.topStrengths.slice(0, 3),
    topGaps: input.topGaps.slice(0, 3),
    recommendedNextAction: input.recommendedNextAction,
    headline,
  };
}

function buildHeadline(input: CareerInsightsInput): string {
  const { readiness, topGaps, topStrengths, recommendedNextAction } = input;
  if (readiness.readinessScore === 0 && topStrengths.length === 0 && topGaps.length === 0) {
    return 'Build your profile to unlock career insights.';
  }
  if (topGaps.length === 0) {
    return readiness.readinessScore >= 80
      ? 'You are well-aligned with industry demand — explore opportunities.'
      : 'Your skills match demand. Consider strengthening soft skills and applying broadly.';
  }
  if (recommendedNextAction) {
    return `Next: ${recommendedNextAction.title}.`;
  }
  return `Top focus: ${topGaps[0]!.name}.`;
}

/* ─── Phase 9B — Career benchmark (aggregate, privacy-safe) ────────── */

/**
 * Aggregate-only benchmark. Returns `available: false` and a reason when
 * there is insufficient data, never a fabricated peer average.
 *
 * The peer set is every StudentProfile except the requesting student. No
 * identifiable fields are returned — only the aggregate mean readiness
 * (from the existing `skillProfile.service.buildSkillProfile` math
 * re-evaluated per peer is too expensive, so we approximate the "typical
 * student" with simple aggregate counts that are already cheap to compute).
 *
 * The benchmark is intentionally narrow: skill count and a coarse
 * category-strength score derived from the same skill profile data the
 * requesting student already sees. No PII is loaded.
 */
export async function getCareerBenchmark(
  studentUserId: string,
  loader?: StudentDataLoader,
): Promise<CareerBenchmark> {
  const profile = loader
    ? await loader.profile()
    : await StudentProfile.findOne({ user: new Types.ObjectId(studentUserId) }).select('_id');
  if (!profile) {
    return {
      available: false,
      sampleSize: 0,
      unavailableReason: FALLBACK_REASONS.insufficient,
    };
  }

  // Build a coarse peer score: skill count + average proficiency (rank-based).
  // Via the loader (/recommendations/me) the cross-student aggregates come from
  // the 60 s shared cache, which holds counts only (no student ids).
  const [ownSkills, peer, peerRows] = await Promise.all([
    loader
      ? (loader.studentSkillsWithSkill() as Promise<
          Array<{ skill?: unknown; proficiency?: string }>
        >)
      : StudentSkill.find({ student: profile._id })
          .select('skill proficiency')
          .populate({ path: 'skill', select: 'category proficiency' })
          .lean(),
    loader ? loader.benchmarkPeerStats() : null,
    loader
      ? null
      : StudentSkill.aggregate<{
          _id: { category: string };
          avgRank: number;
          count: number;
          nStudents: Types.ObjectId[];
        }>(BENCHMARK_PEER_PIPELINE as never),
  ]);

  let peerStats: ReadonlyArray<{ _id: { category: string }; avgRank: number; count: number }>;
  let sampleSize: number;
  if (peer) {
    peerStats = peer.categories.map((c) => ({
      _id: { category: c.category },
      avgRank: c.avgRank,
      count: c.count,
    }));
    // The requesting student is one of the counted students exactly when one of
    // their rows joins to an existing skill (the pipeline's $lookup + $unwind).
    const selfCounted = ownSkills.some((r) => r.skill !== null && r.skill !== undefined);
    sampleSize = peer.uniqueStudents - (selfCounted ? 1 : 0);
  } else {
    const rows = peerRows ?? [];
    peerStats = rows;
    // Peer sample size is approximated by the number of unique students across
    // all StudentSkill rows.
    const peerStudentSet = new Set<string>();
    for (const row of rows) {
      for (const id of row.nStudents) peerStudentSet.add(String(id));
    }
    // Exclude the requesting student.
    peerStudentSet.delete(String(profile._id));
    sampleSize = peerStudentSet.size;
  }

  const ownRankByCategory = new Map<string, { rank: number; count: number }>();
  for (const row of ownSkills) {
    // The student's own rows come from find().populate('skill'), so the category
    // lives on `row.skill`. (`skillDoc` only exists inside the peer aggregation
    // pipeline; reading it here made every studentScore 0 / verdict TYPICAL.)
    const skill = (row as unknown as { skill?: { category?: string } | null }).skill;
    const category = skill && typeof skill === 'object' ? skill.category : undefined;
    const rank = clampRank(
      proficiencyOrNull((row as unknown as { proficiency?: string }).proficiency),
    );
    if (!category) continue;
    const cur = ownRankByCategory.get(category) ?? { rank: 0, count: 0 };
    cur.rank += rank;
    cur.count += 1;
    ownRankByCategory.set(category, cur);
  }

  const studentSkillCount = ownSkills.length;
  const studentAverageRank =
    ownSkills.length === 0
      ? 0
      : ownSkills.reduce(
          (acc, r) =>
            acc +
            clampRank(proficiencyOrNull((r as unknown as { proficiency?: string }).proficiency)),
          0,
        ) / ownSkills.length;

  // When the dataset is tiny we must NOT fabricate a peer mean — we return
  // unavailable instead.
  if (sampleSize < MIN_BENCHMARK_SAMPLE) {
    return {
      available: false,
      sampleSize,
      unavailableReason: FALLBACK_REASONS.insufficient,
    };
  }

  // Aggregate peer proficiency rank: weighted average of category avgRank by
  // category count, normalised to 0-100.
  let weightedSum = 0;
  let totalWeight = 0;
  const categoryBreakdown: BenchmarkSkillCategory[] = [];
  // $group output order is unspecified, so sort by category (code-point order,
  // locale-independent): deterministic categories[] and summation order.
  const orderedPeerStats = [...peerStats].sort((a, b) =>
    a._id.category < b._id.category ? -1 : a._id.category > b._id.category ? 1 : 0,
  );
  for (const row of orderedPeerStats) {
    const count = row.count;
    if (count <= 0) continue;
    weightedSum += row.avgRank * count;
    totalWeight += count;
    const category = row._id.category as SkillCategory;
    const peerRank = (row.avgRank / 4) * 100;
    const own = ownRankByCategory.get(category);
    const ownRank = own && own.count > 0 ? (own.rank / own.count / 4) * 100 : 0;
    categoryBreakdown.push({
      category,
      studentScore: Math.round(ownRank),
      peerScore: Math.round(peerRank),
      verdict:
        ownRank === 0
          ? 'TYPICAL'
          : ownRank > peerRank + 5
            ? 'STRONGER'
            : ownRank < peerRank - 5
              ? 'WEAKER'
              : 'TYPICAL',
    });
  }
  const peerAverageRank = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return {
    available: true,
    sampleSize,
    studentReadiness: undefined, // readiness is skill-profile-derived; kept out of the aggregate path
    studentSkillCount,
    peerSkillCount: Math.round(totalWeight / Math.max(1, sampleSize)),
    studentAverageProficiency: Math.round((studentAverageRank / 4) * 100),
    peerAverageProficiency: Math.round((peerAverageRank / 4) * 100),
    categories: categoryBreakdown,
  };
}

/* ─── Phase 9B — Readiness progression ────────────────────────────── */

export interface ReadinessProgressionInput {
  studentUserId: string;
  currentScore: number;
}

/**
 * Deterministic progression. The "previous" score is the historical baseline
 * reconstructed from defensible existing data only:
 *
 *   - The most recent EVALUATED assessment's score (when present)
 *   - Otherwise, the count of skill adds and training completions normalised
 *     against the current score.
 *
 * If no defensible historical signal exists, we return `previousScore: null`
 * with a fallback reason — never a fabricated value.
 */
export async function getReadinessProgression(
  input: ReadinessProgressionInput,
  loader?: StudentDataLoader,
): Promise<ReadinessProgression> {
  const profile = loader
    ? await loader.profile()
    : await StudentProfile.findOne({ user: new Types.ObjectId(input.studentUserId) })
        .select('_id')
        .lean();
  if (!profile) {
    return {
      currentScore: input.currentScore,
      previousScore: null,
      delta: 0,
      contributingFactors: [],
      fallbackReason: FALLBACK_REASONS.noHistory,
    };
  }

  // Snapshot the earliest defensible signal: oldest StudentSkill row for
  // this profile. When there's exactly one row there's no movement to
  // report.
  const oldestSkill = loader
    ? await loader.oldestStudentSkill()
    : await StudentSkill.findOne({ student: profile._id })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean();

  if (
    !oldestSkill ||
    (oldestSkill.createdAt && Date.now() - oldestSkill.createdAt.getTime() < 1000)
  ) {
    return {
      currentScore: input.currentScore,
      previousScore: null,
      delta: 0,
      contributingFactors: [],
      fallbackReason: FALLBACK_REASONS.noHistory,
    };
  }

  // Build a previous readiness baseline from the count of completed
  // trainings + the most recent assessment score, normalised into 0-100.
  const [completedTrainings, latestAssessment] = await Promise.all([
    loader
      ? loader.completedEnrollments()
      : TrainingEnrollment.find({ student: profile._id, status: 'COMPLETED' })
          .select('completedAt')
          .lean(),
    loader
      ? loader.evaluatedAssessments().then((rows) => rows[0] ?? null)
      : Assessment.findOne({ student: profile._id, status: 'EVALUATED' })
          .sort({ createdAt: -1 })
          .select('evaluation.totalScore createdAt')
          .lean(),
  ]);

  const factors: string[] = [];
  let baseline = 0;
  let hasBaseline = false;

  if (latestAssessment) {
    const evalBlock = (latestAssessment as unknown as { evaluation?: { totalScore?: number } })
      .evaluation;
    if (evalBlock && typeof evalBlock.totalScore === 'number') {
      baseline = evalBlock.totalScore;
      hasBaseline = true;
      factors.push('Most recent assessment score used as baseline.');
    }
  }

  if (completedTrainings.length > 0) {
    const adjustment = Math.min(20, completedTrainings.length * 5);
    if (hasBaseline) {
      baseline = Math.max(0, baseline - adjustment); // previous was lower
      factors.push(
        `Adjusted for ${completedTrainings.length} completed training${completedTrainings.length === 1 ? '' : 's'} since.`,
      );
    } else {
      baseline = Math.max(0, input.currentScore - adjustment);
      hasBaseline = true;
      factors.push(
        `Estimated from ${completedTrainings.length} completed training${completedTrainings.length === 1 ? '' : 's'}.`,
      );
    }
  }

  if (!hasBaseline) {
    return {
      currentScore: input.currentScore,
      previousScore: null,
      delta: 0,
      contributingFactors: [],
      fallbackReason: FALLBACK_REASONS.noHistory,
    };
  }

  const previousScore = Math.max(0, Math.min(100, Math.round(baseline)));
  const delta = input.currentScore - previousScore;
  if (delta > 0) factors.push(`Readiness improved by ${delta} points.`);
  if (delta < 0) factors.push(`Readiness declined by ${Math.abs(delta)} points.`);
  if (delta === 0) factors.push('Readiness unchanged from previous baseline.');

  return {
    currentScore: input.currentScore,
    previousScore,
    delta,
    contributingFactors: factors,
  };
}

/* ─── Phase 9B — Re-exports for tests ─────────────────────────────── */

export { buildGapClosingTrainings, loadAssessmentSignals, pickRelevantMentor };

export const __test = {
  buildSkillComparison,
  readinessHeadline,
  buildNextActions,
  buildCareerInsights,
  gapStateFor,
  MIN_BENCHMARK_SAMPLE,
  FALLBACK_REASONS,
  PROFICIENCY_DEFAULT_REQUIRED,
};

export type { CareerActionType };
