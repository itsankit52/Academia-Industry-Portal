import { Types } from 'mongoose';
import type { Paginated } from '@aip/types';
import type { MatchResult, GapSkill } from '@aip/types';
import type { OpportunityType } from '@aip/config';
import type { Proficiency } from '@aip/config';
import {
  Application,
  CollaborationEvent,
  Internship,
  Job,
  MentorProfile,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
  type CollaborationEventDoc,
  type InternshipDoc,
  type JobDoc,
  type MentorProfileDoc,
  type StudentProfileDoc,
  type TrainingProgramDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { normalizeCompanyOn } from '../../utils/normalizeCompany';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import { serializeLean } from '../../utils/serializeLean';
import { computeMatch } from '../matching/algorithm';
import { idOf } from '../matching/skillGap';
import type { StudentDataLoader } from './studentDataLoader';

interface StudentContext {
  profile: StudentProfileDoc;
  skillIds: string[];
  /** Parsed career interests from profile.careerInterests */
  careerInterests: string[];
  /** Phase 4: skill id -> student's proficiency (null = added but no level recorded). */
  proficiencyById: Map<string, Proficiency | null>;
}

async function loadStudentContext(
  userId: string,
  loader?: StudentDataLoader,
): Promise<StudentContext> {
  const profile = loader
    ? await loader.profile()
    : await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw AppError.notFound('Student profile not found');
  const skills = loader
    ? ((await loader.studentSkills()) as Array<{ skill: unknown; proficiency?: unknown }>)
    : await StudentSkill.find({ student: profile._id }).select('skill proficiency').lean();
  // Parse career interests from the free-text field
  const careerInterests = profile.careerInterests
    ? profile.careerInterests
        .split(/[,;\n]/)
        .map((s: string) => s.trim().toLowerCase())
        .filter((s: string) => s.length > 0)
    : [];
  const proficiencyById = new Map<string, Proficiency | null>();
  for (const row of skills) {
    proficiencyById.set(String(row.skill), (row.proficiency ?? null) as Proficiency | null);
  }
  return {
    profile,
    skillIds: skills.map((s) => String(s.skill)),
    careerInterests,
    proficiencyById,
  };
}

/**
 * Phase 4: Same numeric ranking used by the full-match engine, kept in one
 * place so the recommendation card and the per-opportunity analysis stay in
 * lock-step. 0 = unranked.
 */
const PROFICIENCY_RANK: Record<Proficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

/**
 * Computes proficiency gaps for the skills the opportunity requires. A gap is
 * reported when (a) the student has the skill but at a lower level than the
 * opportunity's required level, or (b) the student doesn't have the skill at
 * all and the opportunity states a required level. The opportunity's
 * `requiredSkills` documents are expected to be populated (with name) — the
 * catalogue's proficiency is not currently carried per required-skill doc, so
 * we treat "required" as "Intermediate" by default, matching the prevailing
 * hiring signal. When the catalogue row has no level, we still record the
 * skill as "missing" so the UI can surface it as an add-this-skill action.
 */
function computeProficiencyGaps(
  requiredDocs: unknown[],
  proficiencyById: Map<string, Proficiency | null>,
  names: Map<string, string>,
): ProficiencyGapItem[] {
  const gaps: ProficiencyGapItem[] = [];
  const seen = new Set<string>();
  for (const doc of requiredDocs ?? []) {
    const id = idOf(doc);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = names.get(id);
    if (!name) continue;
    const studentLevel = proficiencyById.get(id) ?? null;
    if (studentLevel === null) {
      // Student doesn't have this skill — surface as a missing gap.
      gaps.push({
        id,
        name,
        requiredLevel: 'INTERMEDIATE',
        studentLevel: null,
        gapLevels: 2,
        missing: true,
      });
      continue;
    }
    // Required level defaults to "above the student's current level" — this
    // mirrors the recruiter's intent without inventing a per-opportunity
    // proficiency catalogue row.
    const requiredLevel: Proficiency =
      PROFICIENCY_RANK[studentLevel] < PROFICIENCY_RANK.ADVANCED ? 'ADVANCED' : 'EXPERT';
    if (PROFICIENCY_RANK[studentLevel] < PROFICIENCY_RANK[requiredLevel]) {
      gaps.push({
        id,
        name,
        requiredLevel,
        studentLevel,
        gapLevels: PROFICIENCY_RANK[requiredLevel] - PROFICIENCY_RANK[studentLevel],
        missing: false,
      });
    }
  }
  return gaps;
}

/** Phase 4: per-skill proficiency gap surfaced on recommendation cards. */
export interface ProficiencyGapItem {
  id: string;
  name: string;
  requiredLevel: Proficiency;
  studentLevel: Proficiency | null;
  /** Number of proficiency steps below the required level (1-3). */
  gapLevels: number;
  /** True if the student hasn't added this skill at all. */
  missing: boolean;
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
    if (
      typeof profile.graduationYear !== 'number' ||
      !opp.eligibleGradYears.includes(profile.graduationYear)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the student's career interests that overlap with the opportunity's
 * title (case-insensitive). The opportunity does not currently store explicit
 * preferred roles/locations, so we mine the title for tokens that look like
 * career interests — this gives a meaningful "matches your interest" signal
 * without inventing data.
 */
function computeCareerInterestsMatch(title: string, studentInterests: string[]): string[] {
  if (studentInterests.length === 0) return [];
  const titleLower = title.toLowerCase();
  const matched: string[] = [];
  const seen = new Set<string>();
  for (const interest of studentInterests) {
    // Match if the interest is a whole word in the title, or vice versa.
    if (titleLower.includes(interest) || interest.includes(titleLower.split(' ')[0] ?? '')) {
      if (!seen.has(interest)) {
        matched.push(interest);
        seen.add(interest);
      }
    }
  }
  return matched.slice(0, 3);
}

/**
 * Builds the deterministic "Why this matches you" insight from real match data.
 * No AI, no fabricated content.
 */
function buildMatchInsight(
  title: string,
  matchedSkills: GapSkill[],
  missingSkills: GapSkill[],
  studentInterests: string[],
): OpportunityMatchInsight {
  const careerInterestsMatch = computeCareerInterestsMatch(title, studentInterests);
  const topMissingSkills = missingSkills.slice(0, 2).map((s) => s.name);

  // Build a one-line summary using real numbers.
  const parts: string[] = [];
  const total = matchedSkills.length + missingSkills.length;
  if (total > 0) {
    parts.push(`${matchedSkills.length}/${total} skills matched`);
  } else {
    parts.push('No specific skills required');
  }
  if (careerInterestsMatch.length > 0) {
    parts.push(`Matches your interest: ${careerInterestsMatch[0]}`);
  }

  return {
    careerInterestsMatch,
    topMissingSkills,
    summary: parts.join(' · '),
  };
}

/**
 * Deterministic insight explaining WHY this opportunity matches the student.
 * Built from real data, never from AI.
 */
export interface OpportunityMatchInsight {
  /** Matched career interests (role/location overlap with student interests). */
  careerInterestsMatch: string[];
  /** Top missing skills for display as warnings. */
  topMissingSkills: string[];
  /**
   * One-line deterministic summary.
   * Format: "X/Y skills matched" or "X/Y skills matched · Matches your interest"
   */
  summary: string;
}

export interface RecommendedJob {
  job: JobDoc;
  matchResult: MatchResult;
  /** `matchResult` carries ids; these carry the names the UI actually renders. */
  matchedSkills: GapSkill[];
  missingSkills: GapSkill[];
  eligible: boolean;
  /** Deterministic insight: why this job matches. */
  insight: OpportunityMatchInsight;
  /** Phase 4: per-skill proficiency gaps (student has the skill but below the
   *  required level, or hasn't added the skill at all). */
  proficiencyGaps: ProficiencyGapItem[];
}

export interface RecommendedInternship {
  internship: InternshipDoc;
  matchResult: MatchResult;
  matchedSkills: GapSkill[];
  missingSkills: GapSkill[];
  eligible: boolean;
  /** Deterministic insight: why this internship matches. */
  insight: OpportunityMatchInsight;
  /** Phase 4: per-skill proficiency gaps. */
  proficiencyGaps: ProficiencyGapItem[];
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
  loader?: StudentDataLoader,
): Promise<Paginated<RecommendedJob>> {
  const studentContext = await loadStudentContext(userId, loader);
  const { profile, skillIds, careerInterests, proficiencyById } = studentContext;
  const pg = applyPagination(params);

  const applied = await Application.find({
    student: profile._id,
    opportunityType: 'JOB',
  })
    .select('opportunity')
    .lean();
  const appliedIds = new Set(applied.map((a) => String(a.opportunity)));

  // Via the loader (/recommendations/me) the postings come from the 60 s shared
  // cache; they are frozen and only read here (serialization copies them).
  const jobs = loader
    ? await loader.publishedJobs()
    : await Job.find({ status: 'PUBLISHED' })
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
      const matchedNamed = namedSkills(matchResult.matchedSkills, names);
      const missingNamed = namedSkills(matchResult.missingSkills, names);
      const insight = buildMatchInsight(
        job.title,
        matchedNamed,
        missingNamed,
        studentContext.careerInterests,
      );
      const proficiencyGaps = computeProficiencyGaps(requiredDocs, proficiencyById, names);
      return {
        job, // raw lean row; serialized below for the returned page only
        matchResult,
        matchedSkills: matchedNamed,
        missingSkills: missingNamed,
        eligible: isEligible(profile, job as unknown as OpportunityLike),
        insight,
        proficiencyGaps,
      };
    });

  // Stable sort on the score only, so serializing after the slice returns the
  // same items in the same order while converting just one page of rows.
  enriched.sort((a, b) => b.matchResult.score - a.matchResult.score);
  const total = enriched.length;
  const paged = enriched
    .slice(pg.skip, pg.skip + pg.limit)
    // Serialized because the query used `.lean()` — see `serializeOpportunity`.
    .map((item) => ({ ...item, job: serializeOpportunity(item.job) }));

  return buildPaginated(paged, total, pg.page, pg.pageSize);
}

export async function recommendInternships(
  userId: string,
  params: PageParams,
  loader?: StudentDataLoader,
): Promise<Paginated<RecommendedInternship>> {
  const studentContext = await loadStudentContext(userId, loader);
  const { profile, skillIds, careerInterests, proficiencyById } = studentContext;
  const pg = applyPagination(params);

  const internships = loader
    ? await loader.publishedInternships()
    : await Internship.find({ status: 'PUBLISHED' })
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
      const matchedNamed = namedSkills(matchResult.matchedSkills, names);
      const missingNamed = namedSkills(matchResult.missingSkills, names);
      const insight = buildMatchInsight(
        internship.title,
        matchedNamed,
        missingNamed,
        careerInterests,
      );
      const proficiencyGaps = computeProficiencyGaps(requiredDocs, proficiencyById, names);
      return {
        internship, // raw lean row; serialized below for the returned page only
        matchResult,
        matchedSkills: matchedNamed,
        missingSkills: missingNamed,
        eligible: isEligible(profile, internship as unknown as OpportunityLike),
        insight,
        proficiencyGaps,
      };
    },
  );

  enriched.sort((a, b) => b.matchResult.score - a.matchResult.score);
  const total = enriched.length;
  const paged = enriched
    .slice(pg.skip, pg.skip + pg.limit)
    .map((item) => ({ ...item, internship: serializeOpportunity(item.internship) }));

  return buildPaginated(paged, total, pg.page, pg.pageSize);
}

export interface RecommendedTrainingView {
  training: TrainingProgramDoc;
  overlapCount: number;
  overlapSkillIds: string[];
}

async function collectMissingSkillIds(userId: string, topN = 10): Promise<string[]> {
  const { profile, skillIds } = await loadStudentContext(userId);

  const [jobs, internships] = await Promise.all([
    Job.find({ status: 'PUBLISHED' })
      .select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears')
      .lean(),
    Internship.find({ status: 'PUBLISHED' })
      .select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears')
      .lean(),
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

// ---------------------------------------------------------------------------
// Learning Recommendations
// ---------------------------------------------------------------------------

export interface RecommendedMentor {
  mentor: MentorProfileDoc;
  expertiseMatch: string[];
  expertiseMatchCount: number;
}

export interface RecommendedWorkshop {
  event: CollaborationEventDoc;
  tagMatch: string[];
  tagMatchCount: number;
}

export interface RecommendedLearningResource {
  trainings: RecommendedTrainingView[];
  mentors: RecommendedMentor[];
  workshops: RecommendedWorkshop[];
  missingSkills: SkillGapItem[];
  targetOpportunityId?: string;
  targetOpportunityType?: OpportunityType;
}

export interface LearningRecommendationsParams extends PageParams {
  targetOpportunityId?: string;
  targetOpportunityType?: OpportunityType;
}

/** Collects missing skill ids for a target opportunity or all published opportunities. */
async function collectMissingForTarget(
  userId: string,
  targetOpportunityId?: string,
  targetOpportunityType?: OpportunityType,
): Promise<string[]> {
  const { profile, skillIds } = await loadStudentContext(userId);

  if (targetOpportunityId && targetOpportunityType) {
    const fields = 'requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears';
    const opp =
      targetOpportunityType === 'JOB'
        ? await Job.findById(targetOpportunityId).select(fields).lean()
        : await Internship.findById(targetOpportunityId).select(fields).lean();

    if (opp) {
      const required = (
        (opp as unknown as { requiredSkills?: unknown[] }).requiredSkills ?? []
      ).map((s) => String(s));
      const preferred = (
        (opp as unknown as { preferredSkills?: unknown[] }).preferredSkills ?? []
      ).map((s) => String(s));
      const r = computeMatch(skillIds, required, preferred);
      return r.missingSkills.map(String);
    }
  }

  // Fall back to all published opportunities
  const [jobs, internships] = await Promise.all([
    Job.find({ status: 'PUBLISHED' })
      .select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears')
      .lean(),
    Internship.find({ status: 'PUBLISHED' })
      .select('requiredSkills preferredSkills minCgpa eligibleBranches eligibleGradYears')
      .lean(),
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
  const top = ranked.slice(0, 10);
  const set = new Set<string>();
  for (const r of top) for (const m of r.missing) set.add(m);
  return Array.from(set);
}

/**
 * Recommends mentors whose expertise overlaps with the student's missing skills.
 * Excludes mentors whose userId matches the requesting student.
 */
export async function recommendMentors(
  userId: string,
  missingSkillIds: string[],
  limit = 10,
): Promise<RecommendedMentor[]> {
  if (missingSkillIds.length === 0) return [];

  // Resolve missing skill ids to names for string comparison with expertise
  const skillRows = await Skill.find({
    _id: { $in: missingSkillIds.map((id) => new Types.ObjectId(id)) },
  })
    .select('name')
    .lean();
  const missingNames = new Set(skillRows.map((s) => String(s.name).toLowerCase().trim()));

  // Load all available mentors (exclude the requesting student)
  const mentors = await MentorProfile.find({
    availability: 'AVAILABLE',
    user: { $ne: new Types.ObjectId(userId) },
  }).lean();

  const ranked = (mentors as unknown as MentorProfileDoc[])
    .map((mentor) => {
      const expertise = (mentor.expertise ?? []).map((e) => String(e).toLowerCase().trim());
      const expertiseMatch = expertise.filter((e) => missingNames.has(e));
      return { mentor, expertiseMatch, expertiseMatchCount: expertiseMatch.length };
    })
    .filter((item) => item.expertiseMatchCount > 0)
    .sort((a, b) => b.expertiseMatchCount - a.expertiseMatchCount)
    .slice(0, limit);

  return ranked;
}

/**
 * Recommends workshops and certification events whose tags overlap with the student's
 * missing skills. Only includes PUBLISHED events with a future start date.
 */
export async function recommendWorkshops(
  userId: string,
  missingSkillIds: string[],
  limit = 10,
): Promise<RecommendedWorkshop[]> {
  if (missingSkillIds.length === 0) return [];

  // Resolve missing skill ids to names for string comparison with tags
  const skillRows = await Skill.find({
    _id: { $in: missingSkillIds.map((id) => new Types.ObjectId(id)) },
  })
    .select('name')
    .lean();
  const missingNames = new Set(skillRows.map((s) => String(s.name).toLowerCase().trim()));

  const now = new Date();
  const events = await CollaborationEvent.find({
    status: 'PUBLISHED',
    startAt: { $gte: now },
  }).lean();

  const ranked = (events as unknown as CollaborationEventDoc[])
    .map((event) => {
      const tags = (event.tags ?? []).map((t) => String(t).toLowerCase().trim());
      const tagMatch = tags.filter((t) => missingNames.has(t));
      return { event, tagMatch, tagMatchCount: tagMatch.length };
    })
    .filter((item) => item.tagMatchCount > 0)
    .sort((a, b) => b.tagMatchCount - a.tagMatchCount)
    .slice(0, limit);

  return ranked;
}

/**
 * Unified learning recommendations: training programmes, mentors, and workshops/certifications
 * aligned with the student's skill gaps and (optionally) a target opportunity.
 */
export async function recommendLearning(
  userId: string,
  params: LearningRecommendationsParams,
): Promise<RecommendedLearningResource> {
  const missingIds = await collectMissingForTarget(
    userId,
    params.targetOpportunityId,
    params.targetOpportunityType,
  );
  const missingSet = new Set(missingIds);

  // --- Trainings ---
  const filter: Record<string, unknown> = { status: 'ACTIVE' };
  if (missingIds.length > 0) {
    filter.skills = { $in: missingIds.map((id) => new Types.ObjectId(id)) };
  }
  const trainings = await TrainingProgram.find(filter).populate('skills').lean();
  const trainingsRanked: RecommendedTrainingView[] = (trainings as unknown as TrainingProgramDoc[])
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

  // --- Mentors ---
  const mentors = await recommendMentors(userId, missingIds, 10);

  // --- Workshops ---
  const workshops = await recommendWorkshops(userId, missingIds, 10);

  // --- Missing skills for display ---
  const skillGapItems: SkillGapItem[] = [];
  if (missingIds.length > 0) {
    const counts = new Map<string, number>();
    for (const id of missingIds) counts.set(id, 1);
    const skillRows = await Skill.find({
      _id: { $in: missingIds.map((id) => new Types.ObjectId(id)) },
    }).lean();
    for (const s of skillRows) {
      skillGapItems.push({
        id: String(s._id),
        name: String(s.name),
        category: String(s.category),
        count: counts.get(String(s._id)) ?? 0,
      });
    }
  }

  return {
    trainings: trainingsRanked,
    mentors,
    workshops,
    missingSkills: skillGapItems,
    targetOpportunityId: params.targetOpportunityId,
    targetOpportunityType: params.targetOpportunityType,
  };
}
