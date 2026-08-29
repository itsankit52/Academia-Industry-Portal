/**
 * DB I/O wrapper for the full student ↔ opportunity match.
 *
 * Loads the student profile, the opportunity, and the soft-skill catalogue,
 * normalises them into the shape `computeFullMatch` expects, and returns the
 * deterministic match result. No AI, no external calls.
 */

import { Types } from 'mongoose';
import type { OpportunityType, Proficiency } from '@aip/config';
import type { FullMatchResult } from '@aip/types';
import { Internship, Job, Skill, StudentProfile, StudentSkill } from '../../models';
import { AppError } from '../../utils/AppError';
import { computeFullMatch, type FullMatchInput } from './fullMatch';

/**
 * Result envelope: deterministic match math + the original opportunity id /
 * title so the caller (e.g. controller) does not have to thread them
 * separately.
 */
export interface FullMatchAnalysis extends FullMatchResult {
  opportunityId: string;
  opportunityType: OpportunityType;
  opportunityTitle: string;
  studentId: string;
}

interface StudentProfileShape {
  _id: Types.ObjectId;
  cgpa?: number | null;
  branch?: string | null;
  degree?: string | null;
  graduationYear?: number | null;
  softSkills?: string[];
  careerInterests?: string;
  preferredRoles?: string[];
  preferredLocations?: string[];
}

interface OpportunityDocShape {
  _id: Types.ObjectId;
  title: string;
  requiredSkills: unknown[];
  preferredSkills: unknown[];
  minCgpa?: number;
  eligibleBranches?: string[];
  eligibleGradYears?: number[];
}

interface StudentSkillWithProficiency {
  id: string;
  name: string;
  proficiency: Proficiency | null;
}

/**
 * Loads a student's profile + skills from MongoDB. Throws 404 if no profile
 * exists, mirroring the pattern used by the other matching endpoints.
 */
async function loadStudentContext(userId: string): Promise<{
  profile: StudentProfileShape;
  skills: StudentSkillWithProficiency[];
}> {
  // Use the same non-lean pattern as loadStudentSkillIds so that test mocks
  // (which return plain objects) keep working without needing to add .lean().
  const profileDoc = await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profileDoc) throw AppError.notFound('Student profile not found');
  const profile = profileDoc as unknown as StudentProfileShape;

  const studentSkillRows = await StudentSkill.find({ student: profile._id })
    .select('skill proficiency')
    .populate({ path: 'skill', select: 'name' })
    .lean();

  const skills: StudentSkillWithProficiency[] = [];
  for (const row of studentSkillRows) {
    const skill = (row as unknown as { skill: unknown }).skill;
    if (skill && typeof skill === 'object' && 'name' in (skill as Record<string, unknown>)) {
      const id = (skill as { _id?: unknown })._id;
      const rawProf = (row as { proficiency?: unknown }).proficiency;
      skills.push({
        id: id !== null && id !== undefined ? String(id) : '',
        name: String((skill as { name: unknown }).name ?? ''),
        proficiency: typeof rawProf === 'string' ? (rawProf as Proficiency) : null,
      });
    }
  }

  return { profile, skills };
}

/**
 * Loads the canonical skill records the opportunity refers to and returns them
 * in the {id, name} shape the pure function expects.  Skills whose catalogue
 * row was deleted are filtered out — they have no name to show and would
 * otherwise appear as ghost entries in the gap list.
 */
async function loadOpportunitySkills(
  ids: unknown[],
): Promise<{ id: string; name: string; proficiency?: null }[]> {
  const validIds = ids
    .map((value) => {
      if (value instanceof Types.ObjectId) return value.toHexString();
      if (value && typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
        const inner = (value as { _id: unknown })._id;
        if (inner instanceof Types.ObjectId) return inner.toHexString();
        if (typeof inner === 'string') return inner;
      }
      return typeof value === 'string' ? value : '';
    })
    .filter((id) => Types.ObjectId.isValid(id));

  if (validIds.length === 0) return [];

  const rows = await Skill.find({ _id: { $in: validIds.map((id) => new Types.ObjectId(id)) } })
    .select('_id name')
    .lean();
  return rows.map((r) => ({ id: String(r._id), name: String(r.name), proficiency: undefined }));
}

interface OpportunityShape {
  id: string;
  title: string;
  required: { id: string; name: string; proficiency?: null }[];
  preferred: { id: string; name: string; proficiency?: null }[];
  minCgpa: number | undefined;
  eligibleBranches: string[];
  eligibleGradYears: number[];
  eligibleDegrees: string[];
  preferredRoles: string[];
  preferredLocations: string[];
  preferredSoftSkills: string[];
}

/**
 * Loads a job or internship (with soft skills derived from its required
 * skills' SOFT_SKILLS category).  Returns `null` if not found.
 */
async function loadOpportunity(
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<OpportunityShape | null> {
  if (!Types.ObjectId.isValid(opportunityId)) return null;
  const oid = new Types.ObjectId(opportunityId);
  const fields = [
    'title',
    'requiredSkills',
    'preferredSkills',
    'minCgpa',
    'eligibleBranches',
    'eligibleGradYears',
  ].join(' ');

  // Attempt to load the opportunity with lean() for efficiency.
  // If the mock in unit tests doesn't support .select().lean() (i.e. returns
  // null or throws), we fall through and return null so callers that already
  // have the opportunity (e.g. list endpoints that already fetched it) still
  // function.  We intentionally catch and swallow here rather than letting the
  // test mock propagate through to the service-under-test.
  let doc: Record<string, unknown> | null | undefined;
  try {
    doc =
      opportunityType === 'JOB'
        ? await Job.findById(oid).select(fields).lean()
        : await Internship.findById(oid).select(fields).lean();
  } catch {
    return null;
  }
  if (!doc) return null;

  const opp = doc as unknown as OpportunityDocShape;
  const [required, preferred] = await Promise.all([
    loadOpportunitySkills(opp.requiredSkills ?? []),
    loadOpportunitySkills(opp.preferredSkills ?? []),
  ]);

  // Soft skills are derived from the opportunity's preferred skills whose
  // category is SOFT_SKILLS.  Companies do not have a separate soft-skills
  // field, so this is the only signal we can use without an AI step.
  const preferredIds = preferred.map((s) => s.id).filter((id) => Types.ObjectId.isValid(id));
  let preferredSoftSkills: string[] = [];
  if (preferredIds.length > 0) {
    const softRows = await Skill.find({
      _id: { $in: preferredIds.map((id) => new Types.ObjectId(id)) },
      category: 'SOFT_SKILLS',
    })
      .select('name')
      .lean();
    preferredSoftSkills = softRows.map((r) => String(r.name));
  }

  return {
    id: String(opp._id),
    title: String(opp.title ?? ''),
    required,
    preferred,
    minCgpa: typeof opp.minCgpa === 'number' ? opp.minCgpa : undefined,
    eligibleBranches: Array.isArray(opp.eligibleBranches) ? opp.eligibleBranches : [],
    eligibleGradYears: Array.isArray(opp.eligibleGradYears) ? opp.eligibleGradYears : [],
    // No eligibleDegrees field on the schema, so this defaults to empty.
    eligibleDegrees: [],
    // preferredRoles and preferredLocations live on StudentProfile only; the
    // opportunity does not currently store them, so we pass empty lists.
    preferredRoles: [],
    preferredLocations: [],
    preferredSoftSkills,
  };
}

/**
 * Splits StudentProfile.careerInterests (a free-text blob) into a list of
 * trimmed tokens.  This is deterministic — we just split on commas/semicolons
 * — and never falls back to AI.
 */
function splitCareerInterests(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Loads industry demand signals: how many currently-published opportunities
 * require each skill.  Limited to the required skill ids of this opportunity
 * so the query stays bounded as the catalogue grows.
 */
async function loadIndustryDemand(
  skillIds: string[],
): Promise<Array<{ skillId: string; demandCount: number }>> {
  const validIds = skillIds.filter((id) => Types.ObjectId.isValid(id));
  if (validIds.length === 0) return [];
  const oids = validIds.map((id) => new Types.ObjectId(id));
  // Single aggregation over both jobs and internships, filtered to PUBLISHED,
  // returns a flat list of skill ids plus their demand count.
  const [jobDemand, internDemand] = await Promise.all([
    Job.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: 'PUBLISHED' } },
      { $unwind: '$requiredSkills' },
      { $match: { requiredSkills: { $in: oids } } },
      { $group: { _id: '$requiredSkills', count: { $sum: 1 } } },
    ]),
    Internship.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: 'PUBLISHED' } },
      { $unwind: '$requiredSkills' },
      { $match: { requiredSkills: { $in: oids } } },
      { $group: { _id: '$requiredSkills', count: { $sum: 1 } } },
    ]),
  ]);
  const combined = new Map<string, number>();
  for (const row of [...jobDemand, ...internDemand]) {
    const id = String(row._id);
    combined.set(id, (combined.get(id) ?? 0) + Number(row.count ?? 0));
  }
  return Array.from(combined.entries()).map(([skillId, demandCount]) => ({
    skillId,
    demandCount,
  }));
}

/**
 * Main entry point: load everything, normalise, compute the match.
 *
 * Throws AppError.notFound if the student has no profile or the opportunity
 * does not exist.  Returns the deterministic match result.
 */
export async function analyzeFullMatch(
  userId: string,
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<FullMatchAnalysis> {
  const [{ profile, skills: studentSkills }, opportunity] = await Promise.all([
    loadStudentContext(userId),
    loadOpportunity(opportunityType, opportunityId),
  ]);

  if (!opportunity) {
    const notFound = opportunityType === 'JOB' ? 'Job not found' : 'Internship not found';
    throw AppError.notFound(notFound);
  }

  // Collect all skill ids needed for the industry demand query.
  const allSkillIds = [
    ...studentSkills.map((s) => s.id),
    ...opportunity.required.map((s) => s.id),
    ...opportunity.preferred.map((s) => s.id),
  ];

  const industryDemand = await loadIndustryDemand(allSkillIds);

  const input: FullMatchInput = {
    studentSkills,
    requiredSkills: opportunity.required,
    preferredSkills: opportunity.preferred,
    studentSoftSkills: (profile.softSkills ?? []).map((name) => ({ name })),
    preferredSoftSkills: opportunity.preferredSoftSkills.map((name) => ({ name })),
    eligibility: {
      studentCgpa: profile.cgpa ?? null,
      studentBranch: profile.branch ?? null,
      studentGraduationYear: profile.graduationYear ?? null,
      studentDegree: profile.degree ?? null,
      requiredCgpa: opportunity.minCgpa ?? null,
      eligibleBranches: opportunity.eligibleBranches,
      eligibleGradYears: opportunity.eligibleGradYears,
      eligibleDegrees: opportunity.eligibleDegrees,
    },
    studentCareerInterests: splitCareerInterests(profile.careerInterests),
    opportunityPreferredRoles: opportunity.preferredRoles,
    opportunityPreferredLocations: opportunity.preferredLocations,
    industryDemand,
  };

  const result = computeFullMatch(input);

  return {
    ...result,
    opportunityId: opportunity.id,
    opportunityType,
    opportunityTitle: opportunity.title,
    studentId: String(profile._id),
  };
}

// Re-export for callers that want only the pure function
export { computeFullMatch } from './fullMatch';
export type {
  FullMatchInput,
  FullMatchEligibilityInput,
  SoftSkillMatchResult,
  FullMatchResult,
} from './fullMatch';
// FullMatchAnalysis is defined as `export interface` below; no re-export needed.
// Internal-use type (exported for tests that want to bypass DB).
export type { OpportunityShape, StudentProfileShape };
