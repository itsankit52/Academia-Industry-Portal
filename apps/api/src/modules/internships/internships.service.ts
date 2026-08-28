import { isValidObjectId } from 'mongoose';
import type { CreateInternshipInput, UpdateInternshipInput } from '@aip/validation';
import { INTERNSHIP_STATUSES } from '@aip/config';
import type { InternshipStatus, Role } from '@aip/config';
import { AppError } from '../../utils/AppError';
import { Internship, CompanyProfile } from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { normalizeCompanyOn } from '../../utils/normalizeCompany';
import { analyzeFullMatch } from '../matching/fullMatch.service';

export interface InternshipListFilters {
  search?: string;
  workMode?: string;
  location?: string;
  status?: string;
  skillIds?: string[];
  companyId?: string;
}

export interface MyInternshipListFilters {
  status?: string;
}

/**
 * Who is asking. Both fields are absent for anonymous callers, which is the
 * default assumption on the public endpoints.
 */
export interface InternshipViewer {
  userId?: string;
  role?: Role;
}

async function getMyCompanyId(userId: string): Promise<string> {
  const c = await CompanyProfile.findOne({ user: userId }).select('_id');
  if (!c) throw AppError.notFound('Company profile not found');
  return String(c._id);
}

/**
 * `company` arrives either as a raw ObjectId or as a populated CompanyProfile
 * depending on the query, and `String(doc)` on a populated document does not
 * yield its id — so read `_id` when it is there.
 */
function companyIdOf(company: unknown): string {
  if (company && typeof company === 'object' && '_id' in (company as Record<string, unknown>)) {
    return String((company as { _id: unknown })._id);
  }
  return String(company);
}

function parseStatus(value: string | undefined): InternshipStatus | undefined {
  if (value === undefined) return undefined;
  const candidate = value.trim().toUpperCase();
  const match = INTERNSHIP_STATUSES.find((s) => s === candidate);
  if (!match) {
    throw AppError.badRequest(
      `Invalid status filter. Expected one of: ${INTERNSHIP_STATUSES.join(', ')}`,
    );
  }
  return match;
}

/**
 * Decides which status the public list is allowed to return. Anything other than
 * PUBLISHED is company-private, so only an admin may widen the filter; a company
 * reads its own postings through `/internships/me/managed`, which is already
 * ownership-scoped. `undefined` means "no status predicate", i.e. every status.
 */
function resolveListStatus(
  requested: string | undefined,
  viewer: InternshipViewer,
): InternshipStatus | undefined {
  const status = parseStatus(requested);
  if (viewer.role === 'ADMIN') return status;
  if (status && status !== 'PUBLISHED') {
    throw AppError.forbidden('Only published internships can be listed publicly');
  }
  return 'PUBLISHED';
}

/**
 * A non-published internship is visible only to the company that owns it and to
 * admins. Everyone else gets 404 rather than 403 so the endpoint cannot be used
 * to probe whether an unpublished posting exists.
 */
async function assertCanViewInternship(
  it: { status: string; company: unknown },
  viewer: InternshipViewer,
): Promise<void> {
  if (it.status === 'PUBLISHED') return;
  if (viewer.role === 'ADMIN') return;
  if (viewer.role === 'COMPANY' && viewer.userId) {
    const companyId = await getMyCompanyId(viewer.userId);
    if (companyIdOf(it.company) === companyId) return;
  }
  throw AppError.notFound('Internship not found');
}

function requireObjectId(value: string, field: string): string {
  if (!isValidObjectId(value)) throw AppError.badRequest(`${field} must be a valid id`);
  return value;
}

const populateInternship = [
  { path: 'company', select: 'companyName logoUrl' },
  { path: 'requiredSkills', select: 'name category' },
  { path: 'preferredSkills', select: 'name category' },
] as const;

/**
 * Computes the full multi-dimensional match for a single internship against
 * a student viewer.  Returns `null` (and never throws) when the viewer has
 * no profile, so the list endpoint keeps working for students who have not
 * yet filled in their profile.
 */
async function safeFullMatch(
  viewer: InternshipViewer,
  internshipId: string,
): Promise<Awaited<ReturnType<typeof analyzeFullMatch>> | null> {
  if (viewer.role !== 'STUDENT' || !viewer.userId) return null;
  try {
    return await analyzeFullMatch(viewer.userId, 'INTERNSHIP', internshipId);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) return null;
    throw err;
  }
}

export async function listInternships(
  pag: PaginationInput,
  filters: InternshipListFilters,
  viewer: InternshipViewer = {},
) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const status = resolveListStatus(filters.status, viewer);
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (filters.workMode) where.workMode = filters.workMode;
  if (filters.location) where.location = { $regex: filters.location, $options: 'i' };
  if (filters.companyId) where.company = requireObjectId(filters.companyId, 'companyId');
  if (filters.skillIds && filters.skillIds.length > 0) {
    where.requiredSkills = {
      $in: filters.skillIds.map((id) => requireObjectId(id, 'skillIds')),
    };
  }
  if (filters.search) where.$text = { $search: filters.search };

  const [rows, total] = await Promise.all([
    Internship.find(where)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(populateInternship as never),
    Internship.countDocuments(where),
  ]);

  const isStudentViewer = viewer.role === 'STUDENT' && !!viewer.userId;
  const matchDetails = isStudentViewer
    ? await Promise.all(rows.map((r) => safeFullMatch(viewer, String(r._id))))
    : rows.map(() => null);

  return buildPaginated(
    rows.map((r, i) => {
      const row = normalizeCompanyOn(r.toJSON());
      const match = matchDetails[i];
      if (!match) return row;
      return {
        ...row,
        matchScore: match.score,
        matchDetails: {
          score: match.score,
          matchPercentage: match.matchPercentage,
          level: match.level,
          recommendation: match.recommendation,
          eligibility: match.eligibility,
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          preferredMatched: match.preferredMatched,
          careerInterestsMatch: match.careerInterestsMatch,
          breakdown: match.breakdown,
        },
      };
    }),
    total,
    page,
    pageSize,
  );
}

export async function getInternshipById(id: string, viewer: InternshipViewer = {}) {
  const it = await Internship.findById(id).populate(populateInternship as never);
  if (!it) throw AppError.notFound('Internship not found');
  await assertCanViewInternship(it, viewer);
  const row = normalizeCompanyOn(it.toJSON());
  const match = await safeFullMatch(viewer, String(it._id));
  if (!match) return row;
  return {
    ...row,
    matchScore: match.score,
    matchDetails: {
      score: match.score,
      matchPercentage: match.matchPercentage,
      level: match.level,
      recommendation: match.recommendation,
      eligibility: match.eligibility,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      preferredMatched: match.preferredMatched,
      careerInterestsMatch: match.careerInterestsMatch,
      breakdown: match.breakdown,
    },
  };
}

export async function createInternship(userId: string, input: CreateInternshipInput) {
  const companyId = await getMyCompanyId(userId);
  const it = await Internship.create({ ...input, company: companyId });
  return it.toJSON();
}

export async function updateInternship(userId: string, id: string, patch: UpdateInternshipInput) {
  const companyId = await getMyCompanyId(userId);
  const it = await Internship.findById(id);
  if (!it) throw AppError.notFound('Internship not found');
  if (String(it.company) !== companyId) throw AppError.forbidden('Not your internship');
  Object.assign(it, patch);
  await it.save();
  await it.populate(populateInternship as never);
  return normalizeCompanyOn(it.toJSON());
}

export async function closeInternship(userId: string, id: string) {
  const companyId = await getMyCompanyId(userId);
  const it = await Internship.findById(id);
  if (!it) throw AppError.notFound('Internship not found');
  if (String(it.company) !== companyId) throw AppError.forbidden('Not your internship');
  it.status = 'CLOSED';
  await it.save();
  return it.toJSON();
}

export async function deleteInternship(userId: string, role: Role, id: string) {
  const it = await Internship.findById(id);
  if (!it) throw AppError.notFound('Internship not found');
  if (role !== 'ADMIN') {
    const companyId = await getMyCompanyId(userId);
    if (String(it.company) !== companyId) throw AppError.forbidden('Not your internship');
  }
  await it.deleteOne();
}

export async function patchInternship(
  userId: string,
  role: Role,
  id: string,
  patch: UpdateInternshipInput,
) {
  const it = await Internship.findById(id);
  if (!it) throw AppError.notFound('Internship not found');
  if (role !== 'ADMIN') {
    const companyId = await getMyCompanyId(userId);
    if (String(it.company) !== companyId) throw AppError.forbidden('Not your internship');
  }
  Object.assign(it, patch);
  await it.save();
  await it.populate(populateInternship as never);
  return normalizeCompanyOn(it.toJSON());
}

export async function listMyInternships(
  userId: string,
  pag: PaginationInput,
  filters: MyInternshipListFilters = {},
) {
  const companyId = await getMyCompanyId(userId);
  const status = parseStatus(filters.status);
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = { company: companyId };
  if (status) where.status = status;
  const [rows, total] = await Promise.all([
    Internship.find(where)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'requiredSkills', select: 'name category' })
      .populate({ path: 'preferredSkills', select: 'name category' }),
    Internship.countDocuments(where),
  ]);
  return buildPaginated(
    rows.map((r) => r.toJSON()),
    total,
    page,
    pageSize,
  );
}
