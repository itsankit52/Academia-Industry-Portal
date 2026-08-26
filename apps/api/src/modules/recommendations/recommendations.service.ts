import { Types } from 'mongoose';
import type { Paginated } from '@aip/types';
import type { MatchResult } from '@aip/types';
import {
  Application,
  Internship,
  Job,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
  type InternshipDoc,
  type JobDoc,
  type StudentProfileDoc,
  type TrainingProgramDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { normalizeCompanyOn } from '../../utils/normalizeCompany';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import { serializeLean } from '../../utils/serializeLean';
import { computeMatch } from '../matching/algorithm';
import { idOf, type GapSkill } from '../matching/skillGap';

interface StudentContext {
  profile: StudentProfileDoc;
  skillIds: string[];
}

async function loadStudentContext(userId: string): Promise<StudentContext> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw AppError.notFound('Student profile not found');
  const skills = await StudentSkill.find({ student: profile._id }).select('skill').lean();
  return {
    profile,
    skillIds: skills.map((s) => String(s.skill)),
  };
}

interface OpportunityLike {
  minCgpa?: number | null;
  eligibleBranches?: string[] | null;
  eligibleGradYears?: number[] | null;
}

function isEligible(profile: StudentProfileDoc, opp: OpportunityLike): boolean {
  if (typeof opp.minCgpa === 'number' && opp.minCgpa > 0) {
    if (typeof profile.cgpa !== 'number' || profile.cgpa < opp.minCgpa) return false;
  }
  if (opp.eligibleBranches && opp.eligibleBranches.length > 0) {
    if (!profile.branch || !opp.eligibleBranches.includes(profile.branch as string)) return false;
  }
  if (opp.eligibleGradYears && opp.eligibleGradYears.length > 0) {
    if (typeof profile.graduationYear !== 'number' || !opp.eligibleGradYears.includes(profile.graduationYear)) {
      return false;
    }
  }
  return true;
}

export interface RecommendedJob {
  job: JobDoc;
  matchResult: MatchResult;
  /** `matchResult` carries ids; these carry the names the UI actually renders. */
  matchedSkills: GapSkill[];
  missingSkills: GapSkill[];
  eligible: boolean;
}

export interface RecommendedInternship {
  internship: InternshipDoc;
  matchResult: MatchResult;
  matchedSkills: GapSkill[];
  missingSkills: GapSkill[];
  eligible: boolean;
}

/**
 * The matching algorithm compares skill ids, so `matchResult` can only report
 * ids. The postings are already queried with their skills populated, so the
 * names are in memory — collecting them here avoids a second round trip and
 * stops the client rendering a raw ObjectId inside a skill chip.
 */
function nameLookup(...groups: unknown[][]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const entry of group ?? []) {
      if (!entry || typeof entry !== 'object') continue;
      const id = idOf(entry);
      const name = (entry as { name?: unknown }).name;
      if (id && typeof name === 'string' && name.trim().length > 0) map.set(id, name);
    }
  }
  return map;
}

/**
 * A skill deleted from the catalogue after a posting referenced it has no name
 * left to show, so it is dropped rather than rendered as an id.
 */
function namedSkills(ids: string[], names: Map<string, string>): GapSkill[] {
  const out: GapSkill[] = [];
  for (const id of ids) {
    const name = names.get(id);
    if (name) out.push({ id, name });
  }
  return out;
}

/**
 * These queries read with `.lean()` so every published posting can be scored
 * before the page is sliced, which means the schema's `toJSON` transform never
 * ran: the row still carries `_id` and a raw CompanyProfile. Both are fixed up
 * here, because every client link and list key is written against `id` and the
 * cards read `company.name`.
 */
function serializeOpportunity<T>(row: T): T {
  return normalizeCompanyOn(serializeLean(row) as Record<string, unknown>) as T;
}

interface PageParams {
  page?: number;
  pageSize?: number;
}

export async function recommendJobs(
  userId: string,
  params: PageParams,
): Promise<Paginated<RecommendedJob>> {
  const { profile, skillIds } = await loadStudentContext(userId);
  const pg = applyPagination(params);

  const applied = await Application.find({
    student: profile._id,
    opportunityType: 'JOB',
  })
    .select('opportunity')
    .lean();
  const appliedIds = new Set(applied.map((a) => String(a.opportunity)));

  const jobs = await Job.find({ status: 'PUBLISHED' })
    .populate({ path: 'company', select: 'companyName logoUrl' })
    .populate({ path: 'requiredSkills', select: 'name category' })
    .populate({ path: 'preferredSkills', select: 'name category' })
    .lean();

  const enriched: RecommendedJob[] = (jobs as unknown as JobDoc[])
    .filter((job) => !appliedIds.has(String(job._id)))
    .map((job) => {
    const requiredDocs = (job.requiredSkills ?? []) as unknown as unknown[];
    const preferredDocs = (job.preferredSkills ?? []) as unknown as unknown[];
    const required = requiredDocs.map(idOf);
    const preferred = preferredDocs.map(idOf);
    const matchResult = computeMatch(skillIds, required, preferred);
    const names = nameLookup(requiredDocs, preferredDocs);
    return {
      // Serialized because the query used `.lean()` — see `serializeOpportunity`.
      job: serializeOpportunity(job),
      matchResult,
      matchedSkills: namedSkills(matchResult.matchedSkills, names),
      missingSkills: namedSkills(matchResult.missingSkills, names),
      eligible: isEligible(profile, job as unknown as OpportunityLike),
    };
  });

  enriched.sort((a, b) => b.matchResult.score - a.matchResult.score);
  const total = enriched.length;
  const paged = enriched.slice(pg.skip, pg.skip + pg.limit);

  return buildPaginated(paged, total, pg.page, pg.pageSize);
}

export async function recommendInternships(
  userId: string,
  params: PageParams,
): Promise<Paginated<RecommendedInternship>> {
  const { profile, skillIds } = await loadStudentContext(userId);
  const pg = applyPagination(params);

  const internships = await Internship.find({ status: 'PUBLISHED' })
    .populate({ path: 'company', select: 'companyName logoUrl' })
    .populate({ path: 'requiredSkills', select: 'name category' })
    .populate({ path: 'preferredSkills', select: 'name category' })
    .lean();

  const enriched: RecommendedInternship[] = (internships as unknown as InternshipDoc[]).map(
    (internship) => {
      const requiredDocs = (internship.requiredSkills ?? []) as unknown as unknown[];
      const preferredDocs = (internship.preferredSkills ?? []) as unknown as unknown[];
      const matchResult = computeMatch(skillIds, requiredDocs.map(idOf), preferredDocs.map(idOf));
      const names = nameLookup(requiredDocs, preferredDocs);
      return {
        internship: serializeOpportunity(internship),
        matchResult,
        matchedSkills: namedSkills(matchResult.matchedSkills, names),
        missingSkills: namedSkills(matchResult.missingSkills, names),
        eligible: isEligible(profile, internship as unknown as OpportunityLike),
      };
    },
  );

  enriched.sort((a, b) => b.matchResult.score - a.matchResult.score);
  const total = enriched.length;
  const paged = enriched.slice(pg.skip, pg.skip + pg.limit);

  return buildPaginated(paged, total, pg.page, pg.pageSize);
}

export interface RecommendedTrainingView {
  training: TrainingProgramDoc;
  overlapCount: number;
  overlapSkillIds: string[];
}

async function collectMissingSkillIds(
  userId: string,
  topN = 10,
): Promise<string[]> {
  const { profile, skillIds } = await loadStudentContext(userId);

  const [jobs, internships] = await Promise.all([
    Job.find({ status: 'PUBLISHED' }).select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears').lean(),
    Internship.find({ status: 'PUBLISHED' }).select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears').lean(),
  ]);

  interface Ranked {
    missing: string[];
    score: number;
  }
  const ranked: Ranked[] = [];

  for (const job of jobs) {
    const required = (job.requiredSkills ?? []).map((s) => String(s));
    const preferred = (job.preferredSkills ?? []).map((s) => String(s));
    const r = computeMatch(skillIds, required, preferred);
    if (isEligible(profile, job as unknown as OpportunityLike)) {
      ranked.push({ missing: r.missingSkills.map(String), score: r.score });
    }
  }
  for (const intern of internships) {
    const required = (intern.requiredSkills ?? []).map((s) => String(s));
    const preferred = (intern.preferredSkills ?? []).map((s) => String(s));
    const r = computeMatch(skillIds, required, preferred);
    if (isEligible(profile, intern as unknown as OpportunityLike)) {
      ranked.push({ missing: r.missingSkills.map(String), score: r.score });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, topN);
  const set = new Set<string>();
  for (const r of top) for (const m of r.missing) set.add(m);
  return Array.from(set);
}

export async function recommendTrainings(
  userId: string,
  params: PageParams,
): Promise<Paginated<RecommendedTrainingView>> {
  const pg = applyPagination(params);
  const missingIds = await collectMissingSkillIds(userId, 10);
  const missingSet = new Set(missingIds);

  const filter: Record<string, unknown> = { status: 'ACTIVE' };
  if (missingIds.length > 0) {
    filter.skills = { $in: missingIds.map((id) => new Types.ObjectId(id)) };
  }

  const trainings = await TrainingProgram.find(filter).populate('skills').lean();

  const ranked: RecommendedTrainingView[] = (trainings as unknown as TrainingProgramDoc[])
    .map((training) => {
      const skillIds = ((training.skills ?? []) as unknown as unknown[]).map(idOf);
      const overlapSkillIds = skillIds.filter((id) => missingSet.has(id));
      return {
        training: serializeLean(training),
        overlapCount: overlapSkillIds.length,
        overlapSkillIds,
      };
    })
    .sort((a, b) => b.overlapCount - a.overlapCount);

  const total = ranked.length;
  const paged = ranked.slice(pg.skip, pg.skip + pg.limit);
  return buildPaginated(paged, total, pg.page, pg.pageSize);
}

export interface SkillGapItem {
  id: string;
  name: string;
  category: string;
  count: number;
}

export async function computeSkillsGap(userId: string): Promise<{ missingSkills: SkillGapItem[] }> {
  const { profile, skillIds } = await loadStudentContext(userId);

  const jobs = await Job.find({ status: 'PUBLISHED' })
    .select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears')
    .lean();

  interface Ranked {
    missing: string[];
    score: number;
  }
  const ranked: Ranked[] = [];

  for (const job of jobs) {
    const required = (job.requiredSkills ?? []).map((s) => String(s));
    const preferred = (job.preferredSkills ?? []).map((s) => String(s));
    const r = computeMatch(skillIds, required, preferred);
    if (!isEligible(profile, job as unknown as OpportunityLike)) continue;
    ranked.push({ missing: r.missingSkills.map(String), score: r.score });
  }

  ranked.sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 10);
  const counts = new Map<string, number>();
  for (const r of top) {
    for (const m of r.missing) counts.set(m, (counts.get(m) ?? 0) + 1);
  }

  if (counts.size === 0) return { missingSkills: [] };

  const ids = Array.from(counts.keys()).map((id) => new Types.ObjectId(id));
  const skills = await Skill.find({ _id: { $in: ids } }).lean();

  const result: SkillGapItem[] = skills
    .map((s) => ({
      id: String(s._id),
      name: String(s.name),
      category: String(s.category),
      count: counts.get(String(s._id)) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { missingSkills: result };
}
