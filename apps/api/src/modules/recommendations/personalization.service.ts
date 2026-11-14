/**
 * Phase 9A — Personalized Student Intelligence
 * Phase 9B — Advanced Intelligence & Career Decision Support
 *
 * Deterministic, explainable personalization engine. Composes existing services
 * rather than duplicating their math:
 *
 *   - skill gap prioritization   → industry demand aggregation
 *   - training recommendations    → recommendTrainings (enrollment-aware)
 *   - mentor recommendations      → mentorship.service.recommendMentorsForStudent (Phase 8)
 *   - job/internship recs       → recommendations.service recommendJobs/Internships
 *   - career readiness          → skillProfile.service.buildSkillProfile (Phase 5B)
 *   - career insights / benchmark / progression (Phase 9B) →
 *                                  careerAnalysis.service
 *
 * No LLM, no external services, no new collections.
 */

import { Types } from 'mongoose';
import type {
  CareerAction,
  CareerBenchmark,
  CareerInsightStrength,
  CareerInsights,
  CareerReadinessSummary,
  PersonalizedOpportunitySummary,
  PersonalizedRecommendations,
  PersonalizedTraining,
  ReadinessLevel,
  ReadinessProgression,
  SkillGapPriority,
  SkillGapRecommendation,
} from '@aip/types';
import type { Proficiency } from '@aip/config';
import {
  Internship,
  Job,
  Skill,
  TrainingEnrollment,
  TrainingProgram,
  type TrainingProgramDoc,
} from '../../models';
import { recommendJobs, recommendInternships } from './recommendations.service';
import { recommendMentorsForStudent } from '../mentorship/mentorship.service';
import { buildSkillProfile } from '../skills/skillProfile.service';
import { idOf } from '../matching/skillGap';
import type { GapSkill } from '@aip/types';
import type { RecommendedJob, RecommendedInternship } from './recommendations.service';
import {
  buildCareerInsights,
  getCareerBenchmark,
  getReadinessProgression,
  buildGapClosingTrainings,
  loadAssessmentSignals,
} from './careerAnalysis.service';
import { StudentDataLoader } from './studentDataLoader';

/* ─── Tunables ──────────────────────────────────────────────────────── */

const MAX_PER_CATEGORY = 5;

const PRIORITY_THRESHOLDS = {
  CRITICAL: 5,
  HIGH: 3,
  MEDIUM: 1,
  LOW: 0,
} as const;

/* ─── Readiness helpers ─────────────────────────────────────────────── */

function readinessLevelFor(score: number): ReadinessLevel {
  if (score >= 80) return 'Career Ready';
  if (score >= 60) return 'Almost There';
  if (score >= 40) return 'In Progress';
  if (score >= 20) return 'Getting Started';
  return 'Not Ready';
}

function readinessDescription(level: ReadinessLevel): string {
  switch (level) {
    case 'Career Ready':
      return 'Your skills align strongly with industry demand. Apply with confidence.';
    case 'Almost There':
      return 'A few targeted improvements will move you into Career-Ready territory.';
    case 'In Progress':
      return 'You have a solid foundation. Focus on closing your top skill gaps.';
    case 'Getting Started':
      return 'Add a few more skills and consider an assessment to verify your proficiency.';
    case 'Not Ready':
      return 'Take the next step by adding skills or completing recommended training.';
  }
}

function buildReadinessSummary(readinessScore: number): CareerReadinessSummary {
  const level = readinessLevelFor(readinessScore);
  return { readinessScore, level, description: readinessDescription(level) };
}

/* ─── Priority helpers ──────────────────────────────────────────────── */

function priorityFor(demandScore: number): SkillGapPriority {
  if (demandScore >= PRIORITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (demandScore >= PRIORITY_THRESHOLDS.HIGH) return 'HIGH';
  if (demandScore >= PRIORITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

function gapReason(priority: SkillGapPriority, demand: number, name: string): string {
  switch (priority) {
    case 'CRITICAL':
      return `${name} is required by ${demand} open ${demand === 1 ? 'opportunity' : 'opportunities'}. Closing this gap is the highest-leverage move.`;
    case 'HIGH':
      return `${name} appears in ${demand} open ${demand === 1 ? 'opportunity' : 'opportunities'}. Building it broadens your options.`;
    case 'MEDIUM':
      return `${name} is requested by ${demand} ${demand === 1 ? 'opportunity' : 'opportunities'}. Adding it helps.`;
    case 'LOW':
      return `${name} is occasionally requested and may help you stand out.`;
  }
}

/* ─── Skill gap prioritization ─────────────────────────────────────── */

/**
 * Collects skill-gap ids by aggregating industry demand across all published
 * opportunities (jobs + internships), then resolves skill names/categories.
 * Returns gaps sorted by priority (CRITICAL → LOW) then demand desc.
 */
async function prioritizeSkillGaps(
  studentSkillIds: Set<string>,
  loader?: StudentDataLoader,
): Promise<
  Array<{
    id: string;
    name: string;
    category: string;
    demandScore: number;
    priority: SkillGapPriority;
    reason: string;
    trainingIds: string[];
  }>
> {
  // Aggregate industry demand: count how many published opportunities require each skill.
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

  // Combine counts from jobs and internships.
  const demand = new Map<string, number>();
  for (const row of [...jobDemand, ...internDemand]) {
    const id = String(row._id);
    demand.set(id, (demand.get(id) ?? 0) + (Number(row.count) || 1));
  }

  // Filter to skills the student does NOT yet have.
  const gapIds = Array.from(demand.entries())
    .filter(([id]) => !studentSkillIds.has(id))
    .sort((a, b) => b[1] - a[1]) // demand desc
    .map(([id]) => id);

  if (gapIds.length === 0) return [];

  // Load skill catalog rows.
  const skillRows = await Skill.find({
    _id: { $in: gapIds.map((id) => new Types.ObjectId(id)) },
  })
    .select('_id name category')
    .lean();

  // Map: skillId → ACTIVE training ids that cover it.
  const trainings = loader
    ? await loader.activeTrainings()
    : await TrainingProgram.find({ status: 'ACTIVE' }).select('_id skills').lean();
  const trainingMap = new Map<string, string[]>();
  for (const t of trainings as unknown as TrainingProgramDoc[]) {
    const tId = String(t._id);
    for (const s of (t.skills ?? []) as unknown as unknown[]) {
      const sid = idOf(s);
      if (!sid) continue;
      const arr = trainingMap.get(sid) ?? [];
      arr.push(tId);
      trainingMap.set(sid, arr);
    }
  }

  const order: Record<SkillGapPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return skillRows
    .map((s) => {
      const id = String(s._id);
      const demandScore = demand.get(id) ?? 0;
      const priority = priorityFor(demandScore);
      return {
        id,
        name: String(s.name),
        category: String(s.category),
        demandScore,
        priority,
        reason: gapReason(priority, demandScore, String(s.name)),
        trainingIds: trainingMap.get(id) ?? [],
      };
    })
    .sort((a, b) => {
      const po = order[a.priority] - order[b.priority];
      if (po !== 0) return po;
      return b.demandScore - a.demandScore;
    });
}

/* ─── Training recommendations (enrollment-aware) ────────────────────── */

/**
 * In-memory equivalent of `TrainingProgram.find({status:'ACTIVE', skills:{$in: gapIds}})
 * .populate('skills')`: membership is decided on the RAW skill ids (as the query
 * does, so a reference to a since-deleted skill still matches), and the populated
 * copy of each matching programme is returned, in natural order.
 */
async function activeTrainingsCovering(
  loader: StudentDataLoader,
  gapIds: string[],
): Promise<unknown[]> {
  const gapSet = new Set(gapIds);
  const [raw, populated] = await Promise.all([
    loader.activeTrainings(),
    loader.activeTrainingsWithSkills(),
  ]);
  const matching = new Set(
    raw
      .filter((t) => ((t.skills ?? []) as unknown[]).some((s) => gapSet.has(String(s))))
      .map((t) => String(t._id)),
  );
  return populated.filter((t) => matching.has(String(t._id)));
}

/**
 * Returns top trainings that cover the student's gap skills.
 * Excludes trainings the student has already COMPLETED.
 */
async function buildTrainings(
  studentProfileId: Types.ObjectId,
  gapIds: string[],
  loader?: StudentDataLoader,
): Promise<PersonalizedTraining[]> {
  if (gapIds.length === 0) return [];
  if (loader) await loader.assertProfile(studentProfileId);

  // Skip completed enrollments.
  const completed = loader
    ? await loader.completedEnrollments()
    : await TrainingEnrollment.find({
        student: studentProfileId,
        status: 'COMPLETED',
      })
        .select('training')
        .lean();
  const completedSet = new Set(completed.map((c) => String(c.training)));

  const trainings = loader
    ? await activeTrainingsCovering(loader, gapIds)
    : await TrainingProgram.find({
        status: 'ACTIVE',
        skills: { $in: gapIds.map((id) => new Types.ObjectId(id)) },
      })
        .populate({ path: 'skills', select: 'name category' })
        .lean();

  const gapSet = new Set(gapIds);
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
    .filter((t) => !completedSet.has(t.id))
    .sort((a, b) => {
      if (b.overlapCount !== a.overlapCount) return b.overlapCount - a.overlapCount;
      return a.title.localeCompare(b.title);
    })
    .slice(0, MAX_PER_CATEGORY);
}

/* ─── Opportunity summary helpers ─────────────────────────────────── */

function companyNameFromRef(company: unknown): string | undefined {
  if (!company || typeof company !== 'object') return undefined;
  const c = company as Record<string, unknown>;
  if (typeof c.name === 'string') return c.name;
  return undefined;
}

function summarizeJob(item: RecommendedJob): PersonalizedOpportunitySummary {
  return {
    id: item.job.id,
    title: item.job.title,
    type: 'JOB',
    matchScore: item.matchResult.score,
    eligible: item.eligible,
    matchSummary: item.insight.summary,
    topMissingSkills: item.insight.topMissingSkills,
    matchedSkillNames: item.matchedSkills.slice(0, 3).map((s) => s.name),
    careerInterestsMatch: item.insight.careerInterestsMatch,
    ...(companyNameFromRef(item.job.company)
      ? { companyName: companyNameFromRef(item.job.company) }
      : {}),
  };
}

function summarizeInternship(item: RecommendedInternship): PersonalizedOpportunitySummary {
  return {
    id: item.internship.id,
    title: item.internship.title,
    type: 'INTERNSHIP',
    matchScore: item.matchResult.score,
    eligible: item.eligible,
    matchSummary: item.insight.summary,
    topMissingSkills: item.insight.topMissingSkills,
    matchedSkillNames: item.matchedSkills.slice(0, 3).map((s) => s.name),
    careerInterestsMatch: item.insight.careerInterestsMatch,
    ...(companyNameFromRef(item.internship.company)
      ? { companyName: companyNameFromRef(item.internship.company) }
      : {}),
  };
}

/* ─── Main entry point ─────────────────────────────────────────────── */

/**
 * Unified personalized recommendations for a student.
 *
 * Runs in parallel where possible; gracefully degrades to empty results for
 * students with no profile, no skills, or no opportunities.
 * Resolves `studentUserId` server-side — never trusts the client.
 */
export async function getPersonalizedRecommendations(
  studentUserId: string,
): Promise<PersonalizedRecommendations> {
  // One loader per call: every sub-service below shares the student's profile,
  // skills, assessments, enrollments and the ACTIVE trainings through it instead
  // of re-querying them. Never stored outside this call (user isolation).
  const loader = new StudentDataLoader(studentUserId);
  const profile = await loader.profile();

  if (!profile) {
    // No profile → return a valid empty payload so the frontend renders cleanly.
    const emptyBenchmark: CareerBenchmark = {
      available: false,
      sampleSize: 0,
      unavailableReason: 'Benchmark unavailable due to insufficient data.',
    };
    const emptyProgression: ReadinessProgression = {
      currentScore: 0,
      previousScore: null,
      delta: 0,
      contributingFactors: [],
      fallbackReason: 'No previous readiness baseline available yet.',
    };
    return {
      readiness: buildReadinessSummary(0),
      skillGaps: [],
      trainings: [],
      mentors: [],
      jobs: [],
      internships: [],
      careerInsights: buildCareerInsights({
        readiness: buildReadinessSummary(0),
        topStrengths: [],
        topGaps: [],
        recommendedNextAction: null,
      }),
      benchmark: emptyBenchmark,
      progression: emptyProgression,
      generatedAt: new Date().toISOString(),
    };
  }

  // Load student skills.
  const studentSkills = await loader.studentSkills();
  const studentSkillIds = new Set(studentSkills.map((s) => String(s.skill)));

  // Fan out: everything that doesn't depend on gaps runs in parallel.
  // Phase 9B calls are wrapped in try-catch at the service level; a failing
  // benchmark or progression does not crash the unified recommendations response.
  const [skillProfile, jobRecs, internRecs, mentors] = await Promise.all([
    buildSkillProfile(studentUserId, loader).catch(() => null),
    recommendJobs(studentUserId, { page: 1, pageSize: MAX_PER_CATEGORY }, loader),
    recommendInternships(studentUserId, { page: 1, pageSize: MAX_PER_CATEGORY }, loader),
    recommendMentorsForStudent(studentUserId, MAX_PER_CATEGORY, loader),
  ]);

  // Phase 9B: these run sequentially after Phase 9A to avoid polluting the
  // critical-path Promise.all with failures that would prevent the main response.
  const [benchmarkResult, progressionResult, assessmentSignals] = await Promise.all([
    getCareerBenchmark(studentUserId, loader).catch((err) => {
      console.warn('[Phase 9B] Benchmark unavailable:', err instanceof Error ? err.message : err);
      return null;
    }),
    getReadinessProgression(
      { studentUserId, currentScore: skillProfile?.totals.readinessScore ?? 0 },
      loader,
    ).catch((err) => {
      console.warn('[Phase 9B] Progression unavailable:', err instanceof Error ? err.message : err);
      return null;
    }),
    loadAssessmentSignals(profile._id, loader).catch(() => new Map()),
  ]);

  const benchmark = benchmarkResult;
  const progression = progressionResult;

  // Gaps need the student skill set, so they run after.
  const gaps = await prioritizeSkillGaps(studentSkillIds, loader);
  const gapIds = gaps.map((g) => g.id);

  // Skill gap recommendations (top 5).
  const gapRecommendations: SkillGapRecommendation[] = gaps.slice(0, MAX_PER_CATEGORY).map((g) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    demandScore: g.demandScore,
    priority: g.priority,
    reason: g.reason,
    recommendedTrainingIds: g.trainingIds,
  }));

  // Trainings (enrollment-aware).
  const trainings = await buildTrainings(profile._id, gapIds, loader);

  // Sort mentors by Phase 8 score desc.
  const sortedMentors = [...mentors].sort((a, b) => b.score - a.score);

  // ─── Phase 9B — Build Career Insights + Progression ────────────────
  const readinessScore = skillProfile?.totals.readinessScore ?? 0;
  const readiness = buildReadinessSummary(readinessScore);

  // Top strengths: pick the highest-proficiency skills from the skill profile
  // (Phase 5B) so the strengths line up with what the student already sees.
  const topStrengths: CareerInsightStrength[] = (skillProfile?.strengths ?? [])
    .slice(0, 3)
    .map((s) => ({
      skillId: s.skill.id,
      name: s.skill.name,
      category: s.category,
      proficiency: (s.proficiency ?? 'INTERMEDIATE') as Proficiency,
    }));

  // Recommended next action: the top training that covers the most gaps,
  // unless assessment data points to a weak skill with no training yet.
  const recommendedNextAction = await pickNextAction({
    profileId: profile._id,
    gapIds,
    sortedMentors,
    assessmentSignals,
    loader,
  });

  const careerInsights: CareerInsights = buildCareerInsights({
    readiness,
    topStrengths,
    topGaps: gapRecommendations,
    recommendedNextAction,
  });

  return {
    readiness,
    skillGaps: gapRecommendations,
    trainings,
    mentors: sortedMentors,
    jobs: jobRecs.items.map(summarizeJob),
    internships: internRecs.items.map(summarizeInternship),
    careerInsights,
    benchmark: benchmark ?? {
      available: false,
      sampleSize: 0,
      unavailableReason: 'Benchmark unavailable due to insufficient data.',
    },
    progression: progression ?? {
      currentScore: readinessScore,
      previousScore: null,
      delta: 0,
      contributingFactors: [],
      fallbackReason: 'No previous readiness baseline available yet.',
    },
    generatedAt: new Date().toISOString(),
  };
}

/* ─── Phase 9B — Enrich existing payload without recomputing Phase 9A ─ */

/**
 * Returns only the new Phase 9B fields (careerInsights, benchmark,
 * progression) for an existing personalized recommendations response.
 * Lets a client refresh just the deep-insight surface without re-running
 * the heavier Phase 9A composition.
 */
export async function enrichPersonalizedRecommendations(
  studentUserId: string,
  currentScore: number,
  existing: Pick<PersonalizedRecommendations, 'readiness' | 'skillGaps' | 'trainings' | 'mentors'>,
): Promise<{
  careerInsights: CareerInsights;
  benchmark: CareerBenchmark;
  progression: ReadinessProgression;
}> {
  const [benchmark, progression] = await Promise.all([
    getCareerBenchmark(studentUserId),
    getReadinessProgression({ studentUserId, currentScore }),
  ]);

  const topStrengths: CareerInsightStrength[] = [];
  const topGaps = existing.skillGaps.slice(0, 3);

  // Use the strongest trainings and mentors for the recommended next action.
  const recommendedNextAction: CareerAction | null = await pickNextActionFromExisting(
    existing.trainings,
    existing.mentors,
  );

  const careerInsights: CareerInsights = buildCareerInsights({
    readiness: existing.readiness,
    topStrengths,
    topGaps,
    recommendedNextAction,
  });

  return { careerInsights, benchmark, progression };
}

/* ─── Phase 9B — pick the recommended next action ────────────────── */

async function pickNextAction(params: {
  profileId: Types.ObjectId;
  gapIds: string[];
  sortedMentors: PersonalizedRecommendations['mentors'];
  assessmentSignals: Map<string, { lastScore: number; weaknessScore: number; skillName: string }>;
  loader?: StudentDataLoader;
}): Promise<CareerAction | null> {
  const { profileId, gapIds, sortedMentors, assessmentSignals, loader } = params;
  if (gapIds.length === 0 && sortedMentors.length === 0) return null;

  // 1) Assessment-driven: when assessment signal exists, prefer a training
  //    that closes a weak skill.
  if (assessmentSignals.size > 0) {
    const weak = [...assessmentSignals.entries()].sort(
      (a, b) => b[1].weaknessScore - a[1].weaknessScore,
    )[0];
    if (weak) {
      const trainings = await buildGapClosingTrainings(
        profileId,
        [weak[1].skillName].map(() => ''),
        loader,
      );
      const top = trainings[0];
      if (top) {
        return {
          priority: 1,
          type: 'TRAINING',
          title: `Complete ${top.title}`,
          reason: `Assessment showed weakness here; this training covers the gap.`,
          entityId: top.id,
          ctaPath: top.registrationUrl || '/student/training',
          ctaLabel: 'Start training',
        };
      }
    }
  }

  // 2) Otherwise: the top gap-closing training.
  if (gapIds.length > 0) {
    const trainings = await buildGapClosingTrainings(profileId, gapIds.slice(0, 5), loader);
    const top = trainings[0];
    if (top) {
      return {
        priority: 1,
        type: 'TRAINING',
        title: `Complete ${top.title}`,
        reason: `Covers ${top.overlapCount} of your priority gaps.`,
        entityId: top.id,
        ctaPath: top.registrationUrl || '/student/training',
        ctaLabel: 'Start training',
      };
    }
  }

  // 3) Mentor fallback.
  const mentor = sortedMentors[0];
  if (mentor) {
    return {
      priority: 1,
      type: 'MENTOR',
      title: `Connect with ${mentor.fullName}`,
      reason: `Their expertise covers your gap areas.`,
      entityId: mentor.id,
      ctaPath: '/student/mentorship',
      ctaLabel: 'Find a mentor',
    };
  }

  return null;
}

async function pickNextActionFromExisting(
  trainings: PersonalizedTraining[],
  mentors: PersonalizedRecommendations['mentors'],
): Promise<CareerAction | null> {
  const top = trainings[0];
  if (top) {
    return {
      priority: 1,
      type: 'TRAINING',
      title: `Complete ${top.title}`,
      reason: `Covers ${top.overlapCount} of your priority gaps.`,
      entityId: top.id,
      ctaPath: top.registrationUrl || '/student/training',
      ctaLabel: 'Start training',
    };
  }
  const mentor = mentors[0];
  if (mentor) {
    return {
      priority: 1,
      type: 'MENTOR',
      title: `Connect with ${mentor.fullName}`,
      reason: `Their expertise covers your gap areas.`,
      entityId: mentor.id,
      ctaPath: '/student/mentorship',
      ctaLabel: 'Find a mentor',
    };
  }
  return null;
}

/* ─── Re-exports for tests ────────────────────────────────────────── */

export const __test = {
  buildReadinessSummary,
  readinessLevelFor,
  readinessDescription,
  priorityFor,
  gapReason,
  MAX_PER_CATEGORY,
  PRIORITY_THRESHOLDS,
};
