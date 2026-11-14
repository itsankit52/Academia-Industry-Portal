/**
 * 60-second shared cache for the NON-user-specific inputs of
 * /recommendations/me (used only through StudentDataLoader, i.e. only by
 * getPersonalizedRecommendations; standalone endpoints still query directly).
 *
 *   - PUBLISHED jobs / internships with company + skill details populated
 *   - ACTIVE training programmes (raw and with skills populated)
 *   - cross-student benchmark statistics (per-category aggregates + the
 *     number of distinct contributing students — NO student ids are kept)
 *
 * Staleness: a newly published / closed posting, a training status change or a
 * peer's new skills appear in /recommendations/me up to 60 s late. Per-student
 * data (profile, skills, applications, enrollments, assessments) is never
 * cached, so a student's own changes are reflected immediately.
 *
 * Per process: each API instance keeps its own copy (see utils/ttlCache.ts);
 * there is no Redis / distributed invalidation by design.
 */
import { Internship, Job, StudentSkill, TrainingProgram } from '../../models';
import { TtlCache } from '../../utils/ttlCache';

export const SHARED_DATA_TTL_MS = 60_000;

/* eslint-disable @typescript-eslint/no-explicit-any -- lean rows are untyped records */
type LeanRow = Record<string, any>;

export interface BenchmarkCategoryStat {
  category: string;
  avgRank: number;
  count: number;
}
export interface BenchmarkPeerStats {
  categories: BenchmarkCategoryStat[];
  /** Distinct students with at least one StudentSkill row joined to an existing skill. */
  uniqueStudents: number;
}

const rowsCache = new TtlCache<LeanRow[]>(SHARED_DATA_TTL_MS);
const statsCache = new TtlCache<BenchmarkPeerStats>(SHARED_DATA_TTL_MS);

const OPPORTUNITY_POPULATE = [
  { path: 'company', select: 'companyName logoUrl' },
  { path: 'requiredSkills', select: 'name category' },
  { path: 'preferredSkills', select: 'name category' },
];

export function publishedJobs(): Promise<readonly LeanRow[]> {
  return rowsCache.get(
    'jobs:published',
    async () =>
      (await Job.find({ status: 'PUBLISHED' })
        .populate(OPPORTUNITY_POPULATE[0]!)
        .populate(OPPORTUNITY_POPULATE[1]!)
        .populate(OPPORTUNITY_POPULATE[2]!)
        .lean()) as LeanRow[],
  );
}

export function publishedInternships(): Promise<readonly LeanRow[]> {
  return rowsCache.get(
    'internships:published',
    async () =>
      (await Internship.find({ status: 'PUBLISHED' })
        .populate(OPPORTUNITY_POPULATE[0]!)
        .populate(OPPORTUNITY_POPULATE[1]!)
        .populate(OPPORTUNITY_POPULATE[2]!)
        .lean()) as LeanRow[],
  );
}

export function activeTrainings(): Promise<readonly LeanRow[]> {
  return rowsCache.get(
    'trainings:active',
    async () => (await TrainingProgram.find({ status: 'ACTIVE' }).lean()) as LeanRow[],
  );
}

export function activeTrainingsWithSkills(): Promise<readonly LeanRow[]> {
  return rowsCache.get(
    'trainings:active:withSkills',
    async () =>
      (await TrainingProgram.find({ status: 'ACTIVE' })
        .populate({ path: 'skills', select: 'name category' })
        .lean()) as LeanRow[],
  );
}

/** Same aggregation as getCareerBenchmark, reduced to counts before caching. */
export const BENCHMARK_PEER_PIPELINE = [
  { $lookup: { from: 'skills', localField: 'skill', foreignField: '_id', as: 'skillDoc' } },
  { $unwind: '$skillDoc' },
  {
    $group: {
      _id: { category: '$skillDoc.category' },
      avgRank: {
        $avg: {
          $switch: {
            branches: [
              { case: { $eq: ['$proficiency', 'BEGINNER'] }, then: 1 },
              { case: { $eq: ['$proficiency', 'INTERMEDIATE'] }, then: 2 },
              { case: { $eq: ['$proficiency', 'ADVANCED'] }, then: 3 },
              { case: { $eq: ['$proficiency', 'EXPERT'] }, then: 4 },
            ],
            default: 0,
          },
        },
      },
      count: { $sum: 1 },
      nStudents: { $addToSet: '$student' },
    },
  },
];

export function benchmarkPeerStats(): Promise<BenchmarkPeerStats> {
  return statsCache.get('benchmark:peerStats', async () => {
    const rows = await StudentSkill.aggregate<{
      _id: { category: string };
      avgRank: number;
      count: number;
      nStudents: unknown[];
    }>(BENCHMARK_PEER_PIPELINE as never);
    const students = new Set<string>();
    for (const r of rows) for (const id of r.nStudents) students.add(String(id));
    // Student ids are only counted here and never leave this function.
    return {
      categories: rows.map((r) => ({
        category: r._id.category,
        avgRank: r.avgRank,
        count: r.count,
      })),
      uniqueStudents: students.size,
    };
  });
}
