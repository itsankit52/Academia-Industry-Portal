/**
 * Request-scoped loader for ONE student's data.
 *
 * `getPersonalizedRecommendations` fans out to ~10 sub-services that each used
 * to re-resolve the student from the user id, so a single /recommendations/me
 * call loaded the same profile 7 times, the same StudentSkill rows 6 times, the
 * ACTIVE trainings 5 times, etc. The loader memoises each of those reads for
 * the lifetime of one call.
 *
 * Isolation: a loader is created from the authenticated user id inside a single
 * request, is never stored in module state, and only ever queries by that
 * user's id / profile id. Sub-services that receive a profile id together with
 * a loader call `assertProfile()` so a mismatched pair fails loudly instead of
 * mixing two students' data.
 *
 * Every sub-service accepts the loader as an OPTIONAL argument; without it they
 * run exactly the queries they ran before, so standalone endpoints are
 * unchanged. Rows are returned with all fields (no `select`): every consumer
 * maps the fields it needs explicitly, so the superset never reaches a response.
 *
 * Per-student reads are memoised per loader (one request). Shared,
 * non-user-specific reads (postings, ACTIVE trainings, benchmark aggregates)
 * come from the 60 s process cache in sharedDataCache.ts.
 */
import { Types } from 'mongoose';
import {
  Assessment,
  StudentProfile,
  StudentSkill,
  TrainingEnrollment,
  type StudentProfileDoc,
} from '../../models';
import * as shared from './sharedDataCache';

/* eslint-disable @typescript-eslint/no-explicit-any -- lean rows are untyped records */
type LeanRow = Record<string, any>;

export class StudentDataLoader {
  private readonly memo = new Map<string, Promise<unknown>>();

  constructor(readonly userId: string) {
    if (!Types.ObjectId.isValid(userId)) throw new Error('StudentDataLoader: invalid user id');
  }

  private once<T>(key: string, load: () => Promise<T>): Promise<T> {
    let p = this.memo.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load();
      this.memo.set(key, p);
    }
    return p;
  }

  /** Full (hydrated) StudentProfile document, or null. */
  profile(): Promise<StudentProfileDoc | null> {
    return this.once('profile', async () => {
      const doc = await StudentProfile.findOne({ user: new Types.ObjectId(this.userId) });
      return (doc ?? null) as StudentProfileDoc | null;
    });
  }

  private async requireProfileId(): Promise<Types.ObjectId | null> {
    const p = await this.profile();
    return p ? (p._id as Types.ObjectId) : null;
  }

  /** Throws when `profileId` is not this loader's student (defensive isolation check). */
  async assertProfile(profileId: Types.ObjectId | string): Promise<void> {
    const own = await this.requireProfileId();
    if (!own || String(own) !== String(profileId)) {
      throw new Error('StudentDataLoader: profile id does not belong to this loader');
    }
  }

  /** All StudentSkill rows (lean, unpopulated, natural order). */
  studentSkills(): Promise<LeanRow[]> {
    return this.once('studentSkills', async () => {
      const id = await this.requireProfileId();
      if (!id) return [];
      return (await StudentSkill.find({ student: id }).lean()) as LeanRow[];
    });
  }

  /** StudentSkill rows with `skill` populated (name, category) — buildSkillProfile's query. */
  studentSkillsWithSkill(): Promise<LeanRow[]> {
    return this.once('studentSkillsWithSkill', async () => {
      const id = await this.requireProfileId();
      if (!id) return [];
      return (await StudentSkill.find({ student: id })
        .populate('skill', 'name category')
        .lean()) as LeanRow[];
    });
  }

  /**
   * Equivalent of `StudentSkill.findOne({student}).sort({createdAt: 1})`:
   * MongoDB sorts a missing createdAt before any date, so such a row wins.
   */
  async oldestStudentSkill(): Promise<{ createdAt?: Date } | null> {
    const rows = await this.studentSkills();
    if (rows.length === 0) return null;
    let oldest: LeanRow | null = null;
    for (const r of rows) {
      if (!(r.createdAt instanceof Date)) return { createdAt: undefined };
      if (!oldest || r.createdAt.getTime() < oldest.createdAt.getTime()) oldest = r;
    }
    return { createdAt: oldest!.createdAt };
  }

  /** EVALUATED assessments, newest first. */
  evaluatedAssessments(): Promise<LeanRow[]> {
    return this.once('evaluatedAssessments', async () => {
      const id = await this.requireProfileId();
      if (!id) return [];
      return (await Assessment.find({ student: id, status: 'EVALUATED' })
        .sort({ createdAt: -1 })
        .lean()) as LeanRow[];
    });
  }

  /** COMPLETED training enrollments. */
  completedEnrollments(): Promise<LeanRow[]> {
    return this.once('completedEnrollments', async () => {
      const id = await this.requireProfileId();
      if (!id) return [];
      return (await TrainingEnrollment.find({
        student: id,
        status: 'COMPLETED',
      }).lean()) as LeanRow[];
    });
  }

  /* ── Shared, non-user-specific data: served from the 60 s process cache
   *    (sharedDataCache.ts). Returned values are deep-frozen — read only. ── */

  /** ACTIVE training programmes, `skills` as raw ids (natural order). */
  activeTrainings(): Promise<readonly LeanRow[]> {
    return shared.activeTrainings();
  }

  /** ACTIVE training programmes with `skills` populated (name, category). */
  activeTrainingsWithSkills(): Promise<readonly LeanRow[]> {
    return shared.activeTrainingsWithSkills();
  }

  /** PUBLISHED jobs with company / required / preferred skills populated. */
  publishedJobs(): Promise<readonly LeanRow[]> {
    return shared.publishedJobs();
  }

  /** PUBLISHED internships with company / required / preferred skills populated. */
  publishedInternships(): Promise<readonly LeanRow[]> {
    return shared.publishedInternships();
  }

  /** Cross-student benchmark aggregates (no student ids). */
  benchmarkPeerStats(): Promise<shared.BenchmarkPeerStats> {
    return shared.benchmarkPeerStats();
  }
}
