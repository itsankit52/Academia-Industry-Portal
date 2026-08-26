import { isValidObjectId } from 'mongoose';
import type { CreateJobInput, UpdateJobInput } from '@aip/validation';
import { JOB_STATUSES } from '@aip/config';
import type { JobStatus, Role } from '@aip/config';
import { AppError } from '../../utils/AppError';
import { Job, CompanyProfile } from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { normalizeCompanyOn } from '../../utils/normalizeCompany';
import { computeMatch } from '../matching/algorithm';
import { idOf, loadStudentSkillIds } from '../matching/skillGap';

export interface JobListFilters {
  search?: string;
  workMode?: string;
  employmentType?: string;
  location?: string;
  status?: string;
  skillIds?: string[];
  companyId?: string;
}

export interface MyJobListFilters {
  status?: string;
}

/**
 * Who is asking. Both fields are absent for anonymous callers, which is the
 * default assumption on the public endpoints.
 */
export interface JobViewer {
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

function parseStatus(value: string | undefined): JobStatus | undefined {
  if (value === undefined) return undefined;
  const candidate = value.trim().toUpperCase();
  const match = JOB_STATUSES.find((s) => s === candidate);
  if (!match) {
    throw AppError.badRequest(`Invalid status filter. Expected one of: ${JOB_STATUSES.join(', ')}`);
  }
  return match;
}

/**
 * Decides which status the public list is allowed to return.
 *
 * Anything other than PUBLISHED is company-private: a DRAFT is an unfinished
 * posting, and CLOSED/ARCHIVED rows are history. The status filter used to be
 * passed straight through, so `GET /jobs?status=DRAFT` let anyone read every
 * company's unpublished postings. Only an admin may widen it now; a company
 * reads its own postings through `/jobs/me/managed`, which is already
 * ownership-scoped. Returning `undefined` means "no status predicate", i.e.
 * every status, which is what the admin console wants by default.
 */
function resolveListStatus(requested: string | undefined, viewer: JobViewer): JobStatus | undefined {
  const status = parseStatus(requested);
  if (viewer.role === 'ADMIN') return status;
  if (status && status !== 'PUBLISHED') {
    throw AppError.forbidden('Only published jobs can be listed publicly');
  }
  return 'PUBLISHED';
}

/**
 * A non-published job is visible only to the company that owns it and to admins.
 * Everyone else gets 404 rather than 403 so the endpoint cannot be used to probe
 * whether an unpublished posting exists.
 */
async function assertCanViewJob(
  job: { status: string; company: unknown },
  viewer: JobViewer,
): Promise<void> {
  if (job.status === 'PUBLISHED') return;
  if (viewer.role === 'ADMIN') return;
  if (viewer.role === 'COMPANY' && viewer.userId) {
    const companyId = await getMyCompanyId(viewer.userId);
    if (companyIdOf(job.company) === companyId) return;
  }
  throw AppError.notFound('Job not found');
}

function requireObjectId(value: string, field: string): string {
  if (!isValidObjectId(value)) throw AppError.badRequest(`${field} must be a valid id`);
  return value;
}

const populateJob = [
  { path: 'company', select: 'companyName logoUrl' },
  { path: 'requiredSkills', select: 'name category' },
  { path: 'preferredSkills', select: 'name category' },
] as const;

/**
 * The skills to score a browsing student against, or `null` when no score should
 * be attached.
 *
 * `optionalAuth` on `GET /jobs` already tells us who is asking, so this is the
 * only piece the list was missing — `matchScore` was declared on the client
 * (`JobWithMatch`) and rendered by `MatchBadge`, but nothing ever computed it for
 * the list endpoint. Only `Application` carried a score, snapshotted at apply
 * time, so the badge could never appear on jobs a student had not yet applied to.
 *
 * `loadStudentSkillIds` is reused rather than re-queried so the definition of
 * "this student's skills" stays in one place, but its 404 is downgraded here:
 * browsing jobs has to keep working for a STUDENT account with no profile, where
 * its own profile-specific callers are right to fail.
 */
async function scoringSkillsFor(viewer: JobViewer): Promise<string[] | null> {
  if (viewer.role !== 'STUDENT' || !viewer.userId) return null;

  let owned: string[];
  try {
    owned = await loadStudentSkillIds(viewer.userId);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) return null;
    throw err;
  }

  // A student who has recorded no skills has no basis for a score at all.
  // Scoring them anyway would stamp "0% Low Match" on every posting, which reads
  // as a verdict rather than as missing input — and would be an invented number.
  return owned.length > 0 ? owned : null;
}

/**
 * Skill ids off a *hydrated* job document, populated or not. Read before
 * `toJSON()`, because that transform has already renamed `_id` to `id` and
 * `idOf` looks for `_id` — on a transformed object it would fall through to
 * `String(value)` and yield `"[object Object]"`.
 */
function skillIdsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.map(idOf) : [];
}

export async function listJobs(
  pag: PaginationInput,
  filters: JobListFilters,
  viewer: JobViewer = {},
) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const status = resolveListStatus(filters.status, viewer);
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (filters.workMode) where.workMode = filters.workMode;
  if (filters.employmentType) where.employmentType = filters.employmentType;
  if (filters.location) where.location = { $regex: filters.location, $options: 'i' };
  if (filters.companyId) where.company = requireObjectId(filters.companyId, 'companyId');
  if (filters.skillIds && filters.skillIds.length > 0) {
    where.requiredSkills = {
      $in: filters.skillIds.map((id) => requireObjectId(id, 'skillIds')),
    };
  }
  if (filters.search) where.$text = { $search: filters.search };

  const [rows, total] = await Promise.all([
    Job.find(where).sort(sort).skip(skip).limit(limit).populate(populateJob as never),
    Job.countDocuments(where),
  ]);

  const scoringSkills = await scoringSkillsFor(viewer);

  return buildPaginated(
    rows.map((r) => {
      const row = normalizeCompanyOn(r.toJSON());
      // Left absent, not zeroed, when there is nothing to score against — the
      // client gates the badge on `matchScore !== undefined`.
      if (!scoringSkills) return row;
      const { score } = computeMatch(
        scoringSkills,
        skillIdsOf(r.requiredSkills),
        skillIdsOf(r.preferredSkills),
      );
      return { ...row, matchScore: score };
    }),
    total,
    page,
    pageSize,
  );
}

export async function getJobById(id: string, viewer: JobViewer = {}) {
  const job = await Job.findById(id).populate(populateJob as never);
  if (!job) throw AppError.notFound('Job not found');
  await assertCanViewJob(job, viewer);
  return normalizeCompanyOn(job.toJSON());
}

export async function createJob(userId: string, input: CreateJobInput) {
  const companyId = await getMyCompanyId(userId);
  const job = await Job.create({ ...input, company: companyId });
  return job.toJSON();
}

export async function updateJob(userId: string, id: string, patch: UpdateJobInput) {
  const companyId = await getMyCompanyId(userId);
  const job = await Job.findById(id);
  if (!job) throw AppError.notFound('Job not found');
  if (String(job.company) !== companyId) throw AppError.forbidden('Not your job');
  Object.assign(job, patch);
  await job.save();
  await job.populate(populateJob as never);
  return normalizeCompanyOn(job.toJSON());
}

export async function closeJob(userId: string, id: string) {
  const companyId = await getMyCompanyId(userId);
  const job = await Job.findById(id);
  if (!job) throw AppError.notFound('Job not found');
  if (String(job.company) !== companyId) throw AppError.forbidden('Not your job');
  job.status = 'CLOSED';
  await job.save();
  return job.toJSON();
}

export async function deleteJob(userId: string, role: Role, id: string) {
  const job = await Job.findById(id);
  if (!job) throw AppError.notFound('Job not found');
  if (role !== 'ADMIN') {
    const companyId = await getMyCompanyId(userId);
    if (String(job.company) !== companyId) throw AppError.forbidden('Not your job');
  }
  await job.deleteOne();
}

export async function patchJob(
  userId: string,
  role: Role,
  id: string,
  patch: UpdateJobInput,
) {
  const job = await Job.findById(id);
  if (!job) throw AppError.notFound('Job not found');
  if (role !== 'ADMIN') {
    const companyId = await getMyCompanyId(userId);
    if (String(job.company) !== companyId) throw AppError.forbidden('Not your job');
  }
  Object.assign(job, patch);
  await job.save();
  await job.populate(populateJob as never);
  return normalizeCompanyOn(job.toJSON());
}

export async function listMyJobs(
  userId: string,
  pag: PaginationInput,
  filters: MyJobListFilters = {},
) {
  const companyId = await getMyCompanyId(userId);
  const status = parseStatus(filters.status);
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = { company: companyId };
  if (status) where.status = status;
  const [rows, total] = await Promise.all([
    Job.find(where)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate({ path: 'requiredSkills', select: 'name category' })
      .populate({ path: 'preferredSkills', select: 'name category' }),
    Job.countDocuments(where),
  ]);
  return buildPaginated(rows.map((r) => r.toJSON()), total, page, pageSize);
}
