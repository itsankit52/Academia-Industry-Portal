import { Types } from 'mongoose';
import type { OpportunityType } from '@aip/config';
import type { Paginated } from '@aip/types';
import {
  Internship,
  Job,
  SavedOpportunity,
  StudentProfile,
  type SavedOpportunityDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { normalizeCompanyOn } from '../../utils/normalizeCompany';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import { serializeLean } from '../../utils/serializeLean';

async function studentIdForUser(userId: string): Promise<Types.ObjectId> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id;
}

/**
 * A student can only ever see a PUBLISHED posting: `getJobById` and
 * `getInternshipById` both answer 404 for DRAFT, CLOSED and ARCHIVED unless the
 * viewer is an admin or the owning company. The saved list did not filter at
 * all, so once a company unpublished a posting back to DRAFT (or archived it)
 * the card stayed on the student's saved page — linking to a detail route that
 * 404s and offering an Apply button that cannot succeed.
 */
const STUDENT_VISIBLE_STATUS = 'PUBLISHED';

const populateOpportunity = [
  { path: 'company', select: 'companyName logoUrl' },
  { path: 'requiredSkills', select: 'name category' },
  { path: 'preferredSkills', select: 'name category' },
] as const;

/**
 * Loads the still-visible postings behind a set of saved rows. Both list
 * endpoints go through here so the status filter cannot drift apart again.
 *
 * `.lean()` skips the schema's `toJSON` transform, so rows are pushed through
 * `serializeLean` (`_id` -> `id`) and then `normalizeCompanyOn`
 * (`companyName` -> `name`) to match what every other opportunity endpoint
 * returns. The saved page keys off `id`, builds its detail links and its
 * save/unsave payloads from `id`, and reads `company.name`.
 */
async function fetchVisibleOpportunities(
  jobIds: Types.ObjectId[],
  internshipIds: Types.ObjectId[],
): Promise<{ jobs: Record<string, unknown>[]; internships: Record<string, unknown>[] }> {
  const [jobs, internships] = await Promise.all([
    jobIds.length > 0
      ? Job.find({ _id: { $in: jobIds }, status: STUDENT_VISIBLE_STATUS })
          .populate(populateOpportunity as never)
          .lean()
      : Promise.resolve([]),
    internshipIds.length > 0
      ? Internship.find({ _id: { $in: internshipIds }, status: STUDENT_VISIBLE_STATUS })
          .populate(populateOpportunity as never)
          .lean()
      : Promise.resolve([]),
  ]);

  const toPublicShape = (row: unknown): Record<string, unknown> =>
    normalizeCompanyOn(serializeLean(row as Record<string, unknown>));

  return {
    jobs: (jobs as unknown[]).map(toPublicShape),
    internships: (internships as unknown[]).map(toPublicShape),
  };
}

export interface ListSavedInput {
  userId: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  opportunityType?: OpportunityType;
}

export interface SavedOpportunityView {
  id: string;
  opportunityType: OpportunityType;
  opportunityId: string;
  createdAt: Date;
  opportunity: unknown;
}

export async function listSaved(input: ListSavedInput): Promise<Paginated<SavedOpportunityView>> {
  const studentId = await studentIdForUser(input.userId);
  const pg = applyPagination(input);
  const filter: Record<string, unknown> = { student: studentId };
  if (input.opportunityType) filter.opportunityType = input.opportunityType;

  const [items, total] = await Promise.all([
    SavedOpportunity.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit).lean(),
    SavedOpportunity.countDocuments(filter),
  ]);

  const jobIds = items
    .filter((i) => i.opportunityType === 'JOB')
    .map((i) => i.opportunity);
  const internshipIds = items
    .filter((i) => i.opportunityType === 'INTERNSHIP')
    .map((i) => i.opportunity);

  const { jobs, internships } = await fetchVisibleOpportunities(jobIds, internshipIds);

  const jobMap = new Map(jobs.map((j) => [String(j.id), j]));
  const internshipMap = new Map(internships.map((i) => [String(i.id), i]));

  // A saved row whose posting is no longer visible is kept with a null
  // opportunity, so the page length still agrees with `total` above.
  const views: SavedOpportunityView[] = items.map((item) => {
    const opportunity =
      item.opportunityType === 'JOB'
        ? jobMap.get(String(item.opportunity))
        : internshipMap.get(String(item.opportunity));
    return {
      id: String(item._id),
      opportunityType: item.opportunityType as OpportunityType,
      opportunityId: String(item.opportunity),
      createdAt: item.createdAt as Date,
      opportunity: opportunity ?? null,
    };
  });

  return buildPaginated(views, total, pg.page, pg.pageSize);
}

/**
 * A student may only bookmark a posting they are actually allowed to see, so the
 * status is checked here too — otherwise a guessed id would let a DRAFT be saved
 * and then sit on the list forever. The message deliberately matches the plain
 * not-found case so it cannot be used to probe for unpublished postings.
 */
async function verifyOpportunityIsVisible(
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<void> {
  const where = { _id: new Types.ObjectId(opportunityId), status: STUDENT_VISIBLE_STATUS };
  const found =
    opportunityType === 'JOB' ? await Job.exists(where) : await Internship.exists(where);
  if (!found) throw AppError.notFound('Opportunity not found');
}

export async function saveOpportunity(
  userId: string,
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<SavedOpportunityDoc> {
  await verifyOpportunityIsVisible(opportunityType, opportunityId);
  const studentId = await studentIdForUser(userId);

  try {
    return await SavedOpportunity.create({
      student: studentId,
      opportunityType,
      opportunity: new Types.ObjectId(opportunityId),
    });
  } catch (err) {
    const e = err as { code?: number };
    if (e.code === 11000) {
      const existing = await SavedOpportunity.findOne({
        student: studentId,
        opportunityType,
        opportunity: new Types.ObjectId(opportunityId),
      });
      if (existing) return existing;
      throw AppError.conflict('Already saved');
    }
    throw err;
  }
}

export async function deleteSaved(userId: string, id: string): Promise<void> {
  const studentId = await studentIdForUser(userId);
  const doc = await SavedOpportunity.findById(id);
  if (!doc) throw AppError.notFound('Saved opportunity not found');
  if (String(doc.student) !== String(studentId)) throw AppError.forbidden('Not the owner');
  await doc.deleteOne();
}

export async function deleteSavedByOpportunity(
  userId: string,
  opportunityType: OpportunityType,
  opportunityId: string,
): Promise<{ deleted: boolean }> {
  const studentId = await studentIdForUser(userId);
  const result = await SavedOpportunity.deleteOne({
    student: studentId,
    opportunityType,
    opportunity: new Types.ObjectId(opportunityId),
  });
  return { deleted: (result.deletedCount ?? 0) > 0 };
}

export interface SavedGroupedResult {
  jobs: unknown[];
  internships: unknown[];
}

export async function listSavedGrouped(userId: string): Promise<SavedGroupedResult> {
  const studentId = await studentIdForUser(userId);
  const rows = await SavedOpportunity.find({ student: studentId })
    .sort({ createdAt: -1 })
    .lean();

  const jobIds = rows.filter((r) => r.opportunityType === 'JOB').map((r) => r.opportunity);
  const internshipIds = rows
    .filter((r) => r.opportunityType === 'INTERNSHIP')
    .map((r) => r.opportunity);

  const { jobs, internships } = await fetchVisibleOpportunities(jobIds, internshipIds);

  // `$in` returns index order, so restore the most-recently-saved-first order the
  // `rows` query asked for. Postings filtered out by the status check drop away.
  const orderOf = new Map(rows.map((r, index) => [String(r.opportunity), index]));
  const bySavedOrder = (a: Record<string, unknown>, b: Record<string, unknown>): number =>
    (orderOf.get(String(a.id)) ?? 0) - (orderOf.get(String(b.id)) ?? 0);

  return {
    jobs: jobs.sort(bySavedOrder),
    internships: internships.sort(bySavedOrder),
  };
}
