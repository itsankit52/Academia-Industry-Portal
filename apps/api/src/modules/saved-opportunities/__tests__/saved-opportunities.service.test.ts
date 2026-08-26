import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  StudentProfile: { findOne: vi.fn() },
  SavedOpportunity: { find: vi.fn(), countDocuments: vi.fn(), create: vi.fn(), findOne: vi.fn() },
  Job: { find: vi.fn(), exists: vi.fn() },
  Internship: { find: vi.fn(), exists: vi.fn() },
}));

import { Internship, Job, SavedOpportunity, StudentProfile } from '../../../models';
import { listSaved, listSavedGrouped, saveOpportunity } from '../saved-opportunities.service';

interface Chain<T> {
  populate: () => Chain<T>;
  select: () => Chain<T>;
  sort: () => Chain<T>;
  skip: () => Chain<T>;
  limit: () => Chain<T>;
  lean: () => Promise<T>;
  then: <R>(onF: (v: T) => R, onR?: (r: unknown) => R) => Promise<R>;
}

/** Mimics a mongoose query builder: every step chains, `lean()`/`await` resolves. */
function query<T>(result: T): Chain<T> {
  const q = {} as Chain<T>;
  q.populate = () => q;
  q.select = () => q;
  q.sort = () => q;
  q.skip = () => q;
  q.limit = () => q;
  q.lean = () => Promise.resolve(result);
  q.then = (onF, onR) => Promise.resolve(result).then(onF, onR);
  return q;
}

const studentId = new Types.ObjectId();
/** `studentIdForUser` builds an ObjectId from this, so it has to be a real one. */
const userId = new Types.ObjectId().toHexString();

/**
 * A populated `.lean()` row: real ObjectIds (so `serializeLean` has something to
 * convert) and `companyName` rather than `name` (so `normalizeCompanyOn` has
 * something to map).
 */
function leanJob(title: string) {
  return {
    _id: new Types.ObjectId(),
    title,
    status: 'PUBLISHED',
    company: { _id: new Types.ObjectId(), companyName: 'Acme Corp', logoUrl: '/acme.png' },
    requiredSkills: [{ _id: new Types.ObjectId(), name: 'TypeScript' }],
    preferredSkills: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function savedRow(opportunity: Types.ObjectId, opportunityType: 'JOB' | 'INTERNSHIP') {
  return {
    _id: new Types.ObjectId(),
    student: studentId,
    opportunityType,
    opportunity,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(StudentProfile.findOne).mockReturnValue(query({ _id: studentId }) as never);
  vi.mocked(Job.find).mockReturnValue(query([]) as never);
  vi.mocked(Internship.find).mockReturnValue(query([]) as never);
  vi.mocked(SavedOpportunity.countDocuments).mockResolvedValue(0 as never);
});

describe('listSavedGrouped', () => {
  it('only reads PUBLISHED postings', async () => {
    const job = leanJob('Backend Engineer');
    const internshipId = new Types.ObjectId();
    vi.mocked(SavedOpportunity.find).mockReturnValue(
      query([savedRow(job._id, 'JOB'), savedRow(internshipId, 'INTERNSHIP')]) as never,
    );
    vi.mocked(Job.find).mockReturnValue(query([job]) as never);

    await listSavedGrouped(userId);

    expect(Job.find).toHaveBeenCalledWith({
      _id: { $in: [job._id] },
      status: 'PUBLISHED',
    });
    expect(Internship.find).toHaveBeenCalledWith({
      _id: { $in: [internshipId] },
      status: 'PUBLISHED',
    });
  });

  it('drops a saved posting the company has unpublished', async () => {
    const stillLive = leanJob('Backend Engineer');
    const unpublished = leanJob('Withdrawn Role');
    vi.mocked(SavedOpportunity.find).mockReturnValue(
      query([savedRow(stillLive._id, 'JOB'), savedRow(unpublished._id, 'JOB')]) as never,
    );
    // The status filter means the database never returns the unpublished one.
    vi.mocked(Job.find).mockReturnValue(query([stillLive]) as never);

    const result = await listSavedGrouped(userId);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({ title: 'Backend Engineer' });
  });

  it('returns `id`, not `_id`, so the page can key and link off it', async () => {
    const job = leanJob('Backend Engineer');
    vi.mocked(SavedOpportunity.find).mockReturnValue(query([savedRow(job._id, 'JOB')]) as never);
    vi.mocked(Job.find).mockReturnValue(query([job]) as never);

    const result = await listSavedGrouped(userId);
    const row = result.jobs[0] as Record<string, unknown>;

    expect(row.id).toBe(job._id.toHexString());
    expect(row).not.toHaveProperty('_id');
    // Nested populated refs are rewritten too — the cards read skill ids.
    expect((row.requiredSkills as Array<Record<string, unknown>>)[0]).not.toHaveProperty('_id');
  });

  it('exposes the company as `name`, which is what the cards read', async () => {
    const job = leanJob('Backend Engineer');
    vi.mocked(SavedOpportunity.find).mockReturnValue(query([savedRow(job._id, 'JOB')]) as never);
    vi.mocked(Job.find).mockReturnValue(query([job]) as never);

    const result = await listSavedGrouped(userId);
    const company = (result.jobs[0] as Record<string, unknown>).company as Record<string, unknown>;

    expect(company.name).toBe('Acme Corp');
    expect(company.id).toBe(job.company._id.toHexString());
    expect(company.logoUrl).toBe('/acme.png');
  });

  it('preserves most-recently-saved-first order rather than index order', async () => {
    const first = leanJob('Saved First');
    const second = leanJob('Saved Second');
    // `rows` is sorted createdAt desc, so `second` was saved most recently.
    vi.mocked(SavedOpportunity.find).mockReturnValue(
      query([savedRow(second._id, 'JOB'), savedRow(first._id, 'JOB')]) as never,
    );
    // `$in` hands rows back in index order, which is the opposite here.
    vi.mocked(Job.find).mockReturnValue(query([first, second]) as never);

    const result = await listSavedGrouped(userId);

    expect((result.jobs as Array<{ title: string }>).map((j) => j.title)).toEqual([
      'Saved Second',
      'Saved First',
    ]);
  });

  it('skips the opportunity queries entirely when nothing is saved', async () => {
    vi.mocked(SavedOpportunity.find).mockReturnValue(query([]) as never);

    const result = await listSavedGrouped(userId);

    expect(result).toEqual({ jobs: [], internships: [] });
    expect(Job.find).not.toHaveBeenCalled();
    expect(Internship.find).not.toHaveBeenCalled();
  });
});

describe('listSaved', () => {
  it('filters the paginated read to PUBLISHED as well', async () => {
    const job = leanJob('Backend Engineer');
    vi.mocked(SavedOpportunity.find).mockReturnValue(query([savedRow(job._id, 'JOB')]) as never);
    vi.mocked(SavedOpportunity.countDocuments).mockResolvedValue(1 as never);
    vi.mocked(Job.find).mockReturnValue(query([job]) as never);

    const result = await listSaved({ userId });

    expect(Job.find).toHaveBeenCalledWith({ _id: { $in: [job._id] }, status: 'PUBLISHED' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.opportunity).toMatchObject({ title: 'Backend Engineer' });
  });

  it('keeps the saved row but nulls the opportunity once it is no longer visible', async () => {
    const unpublished = leanJob('Withdrawn Role');
    const row = savedRow(unpublished._id, 'JOB');
    vi.mocked(SavedOpportunity.find).mockReturnValue(query([row]) as never);
    vi.mocked(SavedOpportunity.countDocuments).mockResolvedValue(1 as never);
    vi.mocked(Job.find).mockReturnValue(query([]) as never);

    const result = await listSaved({ userId });

    // The row survives so the page length still agrees with `total`.
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.opportunity).toBeNull();
    expect(result.items[0]?.opportunityId).toBe(unpublished._id.toHexString());
  });
});

describe('saveOpportunity', () => {
  it('refuses to bookmark a posting that is not published', async () => {
    vi.mocked(Job.exists).mockResolvedValue(null as never);
    const id = new Types.ObjectId().toHexString();

    await expect(saveOpportunity(userId, 'JOB', id)).rejects.toThrow('Opportunity not found');
    expect(SavedOpportunity.create).not.toHaveBeenCalled();
  });

  it('checks the status, not just existence', async () => {
    const id = new Types.ObjectId();
    vi.mocked(Internship.exists).mockResolvedValue({ _id: id } as never);
    vi.mocked(SavedOpportunity.create).mockResolvedValue({ _id: new Types.ObjectId() } as never);

    await saveOpportunity(userId, 'INTERNSHIP', id.toHexString());

    expect(Internship.exists).toHaveBeenCalledWith({ _id: id, status: 'PUBLISHED' });
    expect(SavedOpportunity.create).toHaveBeenCalledWith({
      student: studentId,
      opportunityType: 'INTERNSHIP',
      opportunity: id,
    });
  });
});
