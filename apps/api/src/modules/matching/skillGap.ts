import { Types } from 'mongoose';
import type { OpportunityType } from '@aip/config';
import { Internship, Job, Skill, StudentProfile, StudentSkill } from '../../models';
import { AppError } from '../../utils/AppError';
import { logger } from '../../utils/logger';
import { scoreMatch } from './algorithm';

/**
 * A skill as it appears in a gap analysis: the canonical name students actually
 * read, plus the id so the UI can link back to the Skill record.
 */
export interface GapSkill {
  id: string;
  name: string;
}

/** A skill before normalisation — ids may be `ObjectId`s, populated docs or strings. */
export interface RawSkill {
  id?: unknown;
  name?: unknown;
}

export interface SkillGapMath {
  requiredSkills: GapSkill[];
  matchedSkills: GapSkill[];
  missingSkills: GapSkill[];
  preferredSkills: GapSkill[];
  preferredMatched: GapSkill[];
  studentSkillCount: number;
  /** matchedSkills / requiredSkills as a whole percentage, 0-100. */
  matchPercentage: number;
  /** Weighted 0-100 score that also credits preferred skills. */
  score: number;
  level: string;
  recommendation: string;
}

export interface SkillGapAnalysis extends SkillGapMath {
  opportunityId: string;
  opportunityType: OpportunityType;
  opportunityTitle: string;
}

/**
 * Skill ids arrive from three places that disagree about representation:
 * Mongoose gives `ObjectId`s, populated documents give `{_id}`, and the request
 * body gives strings. Comparing them unnormalised made a student's own skill
 * look "missing" purely because one side happened to be an object.
 */
export function idOf(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    return idOf((value as { _id: unknown })._id);
  }
  return String(value).trim();
}

/** Drops blanks and duplicates while preserving the order skills were listed in. */
export function normalizeIds(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const id = idOf(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * `Skill.name` is stored lowercased and trimmed by the schema, so names are the
 * safest thing to compare on — and comparing them case- and whitespace-
 * insensitively means "Node.js" and "node.js  " are one skill, not two.
 */
function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalises a raw list into unique `GapSkill`s, collapsing name duplicates. */
function toGapSkills(raw: RawSkill[]): GapSkill[] {
  const byName = new Map<string, GapSkill>();
  for (const entry of raw) {
    const name = String(entry?.name ?? '').trim();
    if (!name) continue;
    const key = nameKey(name);
    if (byName.has(key)) continue;
    byName.set(key, { id: idOf(entry?.id), name });
  }
  return [...byName.values()];
}

/**
 * The mathematical core of the feature — pure, synchronous and AI-free.
 *
 * `matchPercentage = matchedSkills / requiredSkills * 100`, where matched is the
 * intersection of the student's skills with the required set and missing is the
 * difference. Duplicates, casing and whitespace are normalised away first.
 */
export function analyzeSkillGap(
  studentSkills: RawSkill[],
  requiredSkills: RawSkill[],
  preferredSkills: RawSkill[] = [],
): SkillGapMath {
  const student = toGapSkills(studentSkills);
  const required = toGapSkills(requiredSkills);

  const requiredKeys = new Set(required.map((s) => nameKey(s.name)));
  // A skill listed as both required and preferred would otherwise be scored
  // twice, once in each weighted bucket.
  const preferred = toGapSkills(preferredSkills).filter((s) => !requiredKeys.has(nameKey(s.name)));

  const studentKeys = new Set(student.map((s) => nameKey(s.name)));
  const held = (s: GapSkill): boolean => studentKeys.has(nameKey(s.name));

  const matchedSkills = required.filter(held);
  const missingSkills = required.filter((s) => !held(s));
  const preferredMatched = preferred.filter(held);

  // A posting with no required skills sets no bar, so it counts as fully met
  // rather than a divide-by-zero or a 0% that reads as a total mismatch.
  const matchPercentage =
    required.length === 0 ? 100 : Math.round((matchedSkills.length / required.length) * 100);

  const { score, level, recommendation } = scoreMatch({
    requiredTotal: required.length,
    requiredMatched: matchedSkills.length,
    preferredTotal: preferred.length,
    preferredMatched: preferredMatched.length,
  });

  return {
    requiredSkills: required,
    matchedSkills,
    missingSkills,
    preferredSkills: preferred,
    preferredMatched,
    studentSkillCount: student.length,
    matchPercentage,
    score,
    level,
    recommendation,
  };
}

async function loadSkillNames(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const valid = ids.filter((id) => Types.ObjectId.isValid(id));
  if (valid.length === 0) return map;
  const rows = await Skill.find({ _id: { $in: valid.map((id) => new Types.ObjectId(id)) } })
    .select('_id name')
    .lean();
  for (const row of rows) map.set(idOf(row._id), String(row.name));
  return map;
}

function withNames(ids: string[], names: Map<string, string>): RawSkill[] {
  return ids.map((id) => ({ id, name: names.get(id) }));
}

export interface OpportunitySkills {
  title: string;
  required: string[];
  preferred: string[];
}

export async function loadOpportunitySkills(
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<OpportunitySkills> {
  const notFound = opportunityType === 'JOB' ? 'Job not found' : 'Internship not found';
  if (!Types.ObjectId.isValid(opportunityId)) throw AppError.notFound(notFound);

  const oid = new Types.ObjectId(opportunityId);
  const fields = 'title requiredSkills preferredSkills';
  // Job and Internship are separate models, so the query is branched rather than
  // selecting a model into a variable — a union of two model types isn't callable.
  const doc =
    opportunityType === 'JOB'
      ? await Job.findById(oid).select(fields).lean()
      : await Internship.findById(oid).select(fields).lean();
  if (!doc) throw AppError.notFound(notFound);

  return {
    title: String(doc.title ?? ''),
    required: normalizeIds(doc.requiredSkills ?? []),
    preferred: normalizeIds(doc.preferredSkills ?? []),
  };
}

/**
 * Reads the student's own skills from MongoDB.
 *
 * `requestedSkillIds` lets a caller narrow the analysis to a subset, but it is
 * intersected with the skills actually recorded against the profile — otherwise
 * the endpoint would report a perfect match for skills a client merely claimed
 * in the request body.
 */
export async function loadStudentSkillIds(
  userId: string,
  requestedSkillIds?: string[],
): Promise<string[]> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');

  const rows = await StudentSkill.find({ student: profile._id }).select('skill').lean();
  const owned = normalizeIds(rows.map((r) => r.skill));

  const requested = normalizeIds(requestedSkillIds ?? []);
  if (requested.length === 0) return owned;
  const ownedSet = new Set(owned);
  return requested.filter((id) => ownedSet.has(id));
}

/**
 * Loads both sides of the comparison from MongoDB and returns the deterministic
 * analysis. No AI is involved at any point.
 */
export async function computeSkillGap(
  userId: string,
  opportunityType: OpportunityType,
  opportunityId: string,
  requestedSkillIds?: string[],
): Promise<SkillGapAnalysis> {
  const [studentSkillIds, opportunity] = await Promise.all([
    loadStudentSkillIds(userId, requestedSkillIds),
    loadOpportunitySkills(opportunityType, opportunityId),
  ]);

  const names = await loadSkillNames([
    ...studentSkillIds,
    ...opportunity.required,
    ...opportunity.preferred,
  ]);

  // A skill removed from the catalogue after being attached to a posting has no
  // name left to show, so it is excluded from the comparison instead of being
  // rendered to the student as a raw ObjectId. That silently changes the
  // denominator, so it is worth a log line.
  const unresolved = opportunity.required.filter((id) => !names.has(id));
  if (unresolved.length > 0) {
    logger.warn(
      { opportunityType, opportunityId, unresolved },
      'Skill gap ignored required skills that no longer exist in the Skill catalogue',
    );
  }

  const math = analyzeSkillGap(
    withNames(studentSkillIds, names),
    withNames(opportunity.required, names),
    withNames(opportunity.preferred, names),
  );

  return {
    ...math,
    opportunityId,
    opportunityType,
    opportunityTitle: opportunity.title,
  };
}
