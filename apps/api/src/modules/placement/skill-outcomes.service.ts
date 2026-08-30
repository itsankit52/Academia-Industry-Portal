/**
 * Phase 10 Part I — Industry Skill Outcome Intelligence
 *
 * Correlates skill demand (from published opportunities) with actual placement
 * outcomes (from applications). This is an *association* analysis — we never
 * claim causation.
 *
 * Methodology:
 *   1. Collect all skill ids required by published jobs + internships (demand).
 *   2. For each skill: count how many students have it and how many of those
 *      students were selected (SELECTED or OFFER_ACCEPTED).
 *   3. Compute selectionRate = selected / applicants (0 when no applicants).
 *   4. skillOutcomeStrength = weighted composite of selection rate and sample size.
 *   5. Return "insufficient data" when sample size < MIN_SAMPLE_SIZE.
 *
 * Institution scoping: only students linked to the requesting institution are
 * included in the applicant counts.
 */

import { Types } from 'mongoose';
import type {
  SkillOutcomeAnalytics,
  SkillOutcomeMetric,
} from '@aip/types';
import { Application, Internship, Job, Skill, StudentProfile, StudentSkill } from '../../models';

/* ─── Constants ─────────────────────────────────────────────────────── */

const MIN_SAMPLE_SIZE = 5;          // minimum applicants with a skill for a valid metric
const MIN_DEMAND_COUNT = 2;         // minimum opportunities requiring the skill
const TOP_SKILLS_LIMIT = 30;        // return top N skills by demand
const STRENGTH_WEIGHT = 0.7;        // selection rate weight in outcome strength
const SAMPLE_WEIGHT = 0.3;          // sample size weight in outcome strength

/* ─── Helpers ─────────────────────────────────────────────────────── */

function clamp01to100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function round(n: number, places = 1): number {
  const m = Math.pow(10, places);
  return Math.round(n * m) / m;
}

function scoreSkillOutcome(
  selectionRate: number,
  applicantsWithSkill: number,
  minSample: number,
): number {
  // Zero applicants: no data — return 0 per the spec.
  if (applicantsWithSkill === 0) return 0;
  // We normalise the sample size into [0, 1] with a floor at minSample.
  const sampleScore = Math.min(1, applicantsWithSkill / (minSample * 2));
  const rawStrength = selectionRate * STRENGTH_WEIGHT + sampleScore * SAMPLE_WEIGHT * 100;
  return round(clamp01to100(rawStrength));
}

/* ─── Institution-level analytics ─────────────────────────────────────── */

export interface GetSkillOutcomeAnalyticsOptions {
  institutionId: Types.ObjectId;
}

/**
 * Returns skill-outcome analytics scoped to the institution. When insufficient
 * data exists, returns insufficientData=true and an empty metrics array.
 */
export async function getSkillOutcomeAnalytics(
  input: GetSkillOutcomeAnalyticsOptions,
): Promise<SkillOutcomeAnalytics> {
  // 1) Collect institution's student ids.
  const studentIds = (await StudentProfile.distinct('_id', {
    institution: input.institutionId,
  })) as Types.ObjectId[];

  if (studentIds.length === 0) {
    return {
      institutionId: String(input.institutionId),
      metrics: [],
      insufficientData: true,
      minimumSampleSize: MIN_SAMPLE_SIZE,
      generatedAt: new Date().toISOString(),
    };
  }

  // 2) Collect skill demand from published jobs + internships.
  const [jobDemand, internDemand] = await Promise.all([
    Job.aggregate<{ _id: string; count: number }>([
      { $match: { status: 'PUBLISHED' } },
      { $project: { skills: { $ifNull: ['$requiredSkills', []] } } },
      { $unwind: '$skills' },
      { $group: { _id: { $toString: '$skills' }, count: { $sum: 1 } } },
    ]),
    Internship.aggregate<{ _id: string; count: number }>([
      { $match: { status: 'PUBLISHED' } },
      { $project: { skills: { $ifNull: ['$requiredSkills', []] } } },
      { $unwind: '$skills' },
      { $group: { _id: { $toString: '$skills' }, count: { $sum: 1 } } },
    ]),
  ]);

  // Merge demand counts.
  const demandMap = new Map<string, number>();
  for (const row of [...jobDemand, ...internDemand]) {
    demandMap.set(row._id, (demandMap.get(row._id) ?? 0) + row.count);
  }

  // Filter to skills that appear in at least MIN_DEMAND_COUNT opportunities.
  const demandEntries = [...demandEntriesFilter(demandMap)];

  // 3) Collect which students have which skills (within the institution).
  const studentSkillRows = await StudentSkill.find({
    student: { $in: studentIds },
  })
    .populate({ path: 'skill', select: '_id name category' })
    .lean();

  // Build: skillId → Set of studentIds who have it.
  const skillToStudents = new Map<string, Set<string>>();
  for (const row of studentSkillRows) {
    const skillId = String((row as unknown as { skill?: { _id?: { toString?: () => string } } }).skill?._id);
    const studentId = String(row.student);
    if (!skillId || !studentId) continue;
    if (!skillToStudents.has(skillId)) skillToStudents.set(skillId, new Set());
    skillToStudents.get(skillId)!.add(studentId);
  }

  // 4) Collect which students were selected (for any opportunity).
  const selectedStudentIds = new Set<string>(
    (
      await Application.distinct('student', {
        student: { $in: studentIds },
        status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] },
      })
    ).map(String),
  );

  // 5) Build per-skill metrics.
  const metrics: SkillOutcomeMetric[] = [];

  for (const [skillId, demandCount] of demandEntries) {
    const studentsWithSkill = skillToStudents.get(skillId);
    const applicantsWithSkill = studentsWithSkill?.size ?? 0;
    let selectedWithSkill = 0;
    if (studentsWithSkill) {
      for (const sid of studentsWithSkill) {
        if (selectedStudentIds.has(sid)) selectedWithSkill += 1;
      }
    }

    const selectionRate =
      applicantsWithSkill > 0 ? (selectedWithSkill / applicantsWithSkill) * 100 : 0;

    // Only compute a metric when we have meaningful demand AND enough applicants.
    if (applicantsWithSkill < MIN_SAMPLE_SIZE) {
      // Insufficient data for this skill — skip but note it.
      continue;
    }

    const skillOutcomeStrength = scoreSkillOutcome(
      selectionRate,
      applicantsWithSkill,
      MIN_SAMPLE_SIZE,
    );

    metrics.push({
      skillId,
      name: 'Unknown', // populated below from the lookup
      category: undefined,
      skillDemandCount: demandCount,
      applicantsWithSkill,
      selectedWithSkill,
      selectionRate: round(selectionRate),
      skillOutcomeStrength,
    });
  }

  // 6) Enrich with skill names from the database.
  if (metrics.length > 0) {
    const skillIds = metrics.map((m) => new Types.ObjectId(m.skillId));
    const skillDocs = await Skill.find({ _id: { $in: skillIds } })
      .select('name category')
      .lean();
    const nameMap = new Map(skillDocs.map((s) => [String(s._id), s]));
    for (const m of metrics) {
      const doc = nameMap.get(m.skillId);
      if (doc) {
        m.name = doc.name ?? 'Unknown';
        m.category = typeof doc.category === 'string' ? doc.category : undefined;
      }
    }
  }

  // Sort by demand desc (most-in-demand skills first).
  metrics.sort((a, b) => b.skillDemandCount - a.skillDemandCount);

  const insufficientData =
    metrics.length === 0 ||
    metrics.every((m) => m.applicantsWithSkill < MIN_SAMPLE_SIZE);

  return {
    institutionId: String(input.institutionId),
    metrics: metrics.slice(0, TOP_SKILLS_LIMIT),
    insufficientData,
    minimumSampleSize: MIN_SAMPLE_SIZE,
    generatedAt: new Date().toISOString(),
  };
}

function* demandEntriesFilter(
  demandMap: Map<string, number>,
): Generator<[string, number]> {
  for (const [skillId, count] of demandMap.entries()) {
    if (count >= MIN_DEMAND_COUNT) {
      yield [skillId, count];
    }
  }
}

/* ─── Test-only exports ─────────────────────────────────────────────── */

export const __test = {
  scoreSkillOutcome,
  clamp01to100,
  round,
  MIN_SAMPLE_SIZE,
  MIN_DEMAND_COUNT,
  TOP_SKILLS_LIMIT,
};
