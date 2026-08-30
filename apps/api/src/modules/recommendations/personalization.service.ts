/**
 * Phase 9A — Personalized Student Intelligence
 *
 * Deterministic, explainable personalization engine. Composes existing services
 * rather than duplicating their math:
 *
 *   - skill gap prioritization   → industry demand aggregation
 *   - training recommendations    → recommendTrainings (enrollment-aware)
 *   - mentor recommendations      → mentorship.service.recommendMentorsForStudent (Phase 8)
 *   - job/internship recs       → recommendations.service recommendJobs/Internships
 *   - career readiness          → skillProfile.service.buildSkillProfile (Phase 5B)
 *
 * No LLM, no external services, no new collections.
 */

import { Types } from 'mongoose';
import type {
  CareerReadinessSummary,
  PersonalizedOpportunitySummary,
  PersonalizedRecommendations,
  PersonalizedTraining,
  ReadinessLevel,
  SkillGapPriority,
  SkillGapRecommendation,
} from '@aip/types';
import {
  Internship,
  Job,
  Skill,
  StudentProfile,
  StudentSkill,
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
  const trainings = await TrainingProgram.find({ status: 'ACTIVE' })
    .select('_id skills')
    .lean();
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
 * Returns top trainings that cover the student's gap skills.
 * Excludes trainings the student has already COMPLETED.
 */
async function buildTrainings(
  studentProfileId: Types.ObjectId,
  gapIds: string[],
): Promise<PersonalizedTraining[]> {
  if (gapIds.length === 0) return [];

  // Skip completed enrollments.
  const completed = await TrainingEnrollment.find({
    student: studentProfileId,
    status: 'COMPLETED',
  })
    .select('training')
    .lean();
  const completedSet = new Set(completed.map((c) => String(c.training)));

  const trainings = await TrainingProgram.find({
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
    ...(item.job.company ? { companyName: item.job.company.name } : {}),
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
    ...(item.internship.company ? { companyName: item.internship.company.name } : {}),
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
  // Load student context once.
  const profile = await StudentProfile.findOne({
    user: new Types.ObjectId(studentUserId),
  }).select('_id');

  if (!profile) {
    // No profile → return a valid empty payload so the frontend renders cleanly.
    return {
      readiness: buildReadinessSummary(0),
      skillGaps: [],
      trainings: [],
      mentors: [],
      jobs: [],
      internships: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // Load student skills.
  const studentSkills = await StudentSkill.find({ student: profile._id })
    .select('skill')
    .lean();
  const studentSkillIds = new Set(studentSkills.map((s) => String(s.skill)));

  // Fan out: everything that doesn't depend on gaps runs in parallel.
  const [skillProfile, jobRecs, internRecs, mentors] = await Promise.all([
    buildSkillProfile(studentUserId).catch(() => null),
    recommendJobs(studentUserId, { page: 1, pageSize: MAX_PER_CATEGORY }),
    recommendInternships(studentUserId, { page: 1, pageSize: MAX_PER_CATEGORY }),
    recommendMentorsForStudent(studentUserId, MAX_PER_CATEGORY),
  ]);

  // Gaps need the student skill set, so they run after.
  const gaps = await prioritizeSkillGaps(studentSkillIds);
  const gapIds = gaps.map((g) => g.id);
  const gapMap = new Map(gaps.map((g) => [g.id, g]));

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
  const trainings = await buildTrainings(profile._id, gapIds);

  // Sort mentors by Phase 8 score desc.
  const sortedMentors = [...mentors].sort((a, b) => b.score - a.score);

  return {
    readiness: buildReadinessSummary(skillProfile?.totals.readinessScore ?? 0),
    skillGaps: gapRecommendations,
    trainings,
    mentors: sortedMentors,
    jobs: jobRecs.items.map(summarizeJob),
    internships: internRecs.items.map(summarizeInternship),
    generatedAt: new Date().toISOString(),
  };
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
