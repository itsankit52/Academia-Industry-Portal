import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Job: {
    create: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  CompanyProfile: { findOne: vi.fn() },
  // `listJobs` scores a browsing student via `matching/skillGap`, which reads
  // both of these from this same module.
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn() },
  Internship: { find: vi.fn() },
  Skill: { find: vi.fn() },
}));

import { CompanyProfile, Job, StudentProfile, StudentSkill } from '../../../models';
import { computeMatch } from '../../matching/algorithm';
import { createJob, getJobById, listJobs, listMyJobs, patchJob } from '../jobs.service';

/**
 * Ownership and visibility for the job module, with the models mocked.
 *
 * `requireAuth`/`requireRole` only establish *that* the caller is some company —
 * they cannot know *which* one. Everything that keeps Company A out of Company
 * B's postings lives in this service, in `getMyCompanyId` plus the
 * `String(job.company) !== companyId` checks, so it is worth asserting directly
 * rather than only through an HTTP test that needs a database.
 */

/** The signed-in company, and a second one that must never reach its data. */
const OWNER_USER = new Types.ObjectId().toHexString();
const OWNER_COMPANY = new Types.ObjectId();
const OTHER_USER = new Types.ObjectId().toHexString();
const OTHER_COMPANY = new Types.ObjectId();

const COMPANIES = new Map<string, Types.ObjectId>([
  [OWNER_USER, OWNER_COMPANY],
  [OTHER_USER, OTHER_COMPANY],
]);

/** Mirrors `CompanyProfile.findOne({ user }).select('_id')`. */
function companyProfileFor(filter: unknown) {
  const user = String((filter as { user: unknown }).user);
  const id = COMPANIES.get(user);
  return { select: () => Promise.resolve(id ? { _id: id } : null) };
}

/** A saveable stand-in for a hydrated Job document. */
function jobDoc(overrides: Record<string, unknown> = {}) {
  const doc = {
    _id: new Types.ObjectId(),
    title: 'Backend Engineer',
    status: 'DRAFT',
    company: OWNER_COMPANY,
    save: vi.fn(() => Promise.resolve()),
    populate: vi.fn(() => Promise.resolve()),
    toJSON(): Record<string, unknown> {
      return {
        id: String(doc._id),
        title: doc.title,
        status: doc.status,
        company: doc.company,
      };
    },
    ...overrides,
  };
  return doc;
}

/** Mirrors `Job.find(where).sort().skip().limit().populate().populate()`. */
function findChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ['sort', 'skip', 'limit', 'populate']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

/**
 * The filter a query mock was called with. Mongoose declares a zero-argument
 * overload for `find`, so `vi.mocked(Job.find).mock.calls` narrows to `[][]` and
 * TypeScript refuses to read an argument out of it.
 */
function filterOf(mock: { mock: { calls: unknown[][] } }): unknown {
  return mock.mock.calls[0]?.[0];
}

/**
 * The `id` that the schema's `toJSON` transform adds. The transform runs at
 * runtime only, so the service's return type still describes the raw document.
 */
function idOf(row: unknown): unknown {
  return (row as { id?: unknown }).id;
}

/** Mirrors `StudentSkill.find(...).select('skill').populate().lean()`. */
function studentSkillChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'populate', 'lean']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

/**
 * A hydrated, populated Job as `listJobs` sees it. The skill arrays deliberately
 * hold populated documents with `_id` — that is what `.populate()` returns, and
 * reading ids off the *transformed* output instead would silently produce
 * `"[object Object]"`.
 */
function listRow(required: Types.ObjectId[], preferred: Types.ObjectId[] = []) {
  const _id = new Types.ObjectId();
  return {
    _id,
    status: 'PUBLISHED',
    requiredSkills: required.map((id) => ({ _id: id, name: 'skill' })),
    preferredSkills: preferred.map((id) => ({ _id: id, name: 'skill' })),
    toJSON: () => ({ id: String(_id), status: 'PUBLISHED' }),
  };
}

/** Points the student lookups at a profile owning `skillIds`. */
function studentWithSkills(skillIds: Types.ObjectId[]) {
  const profileId = new Types.ObjectId();
  vi.mocked(StudentProfile.findOne).mockReturnValue({
    select: () => Promise.resolve({ _id: profileId }),
  } as never);
  vi.mocked(StudentSkill.find).mockReturnValue(
    studentSkillChain(skillIds.map((id) => ({ skill: id }))) as never,
  );
}

function scoreOf(row: unknown): unknown {
  return (row as { matchScore?: unknown }).matchScore;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockImplementation(companyProfileFor as never);
  vi.mocked(Job.countDocuments).mockResolvedValue(0 as never);
  vi.mocked(Job.find).mockImplementation((() => findChain([])) as never);
  // No student profile unless a test opts in, so the default viewer is scoreless.
  vi.mocked(StudentProfile.findOne).mockReturnValue({
    select: () => Promise.resolve(null),
  } as never);
  vi.mocked(StudentSkill.find).mockReturnValue(studentSkillChain([]) as never);
});

const input = {
  title: 'Backend Engineer',
  description: 'A description long enough to satisfy the schema minimum length.',
  location: 'Bengaluru, India',
  workMode: 'HYBRID',
  employmentType: 'FULL_TIME',
  requiredSkills: [new Types.ObjectId().toHexString()],
  openings: 1,
} as never;

describe('createJob', () => {
  it('stamps the job with the company resolved from the caller', async () => {
    vi.mocked(Job.create).mockImplementation(((doc: Record<string, unknown>) =>
      Promise.resolve({ toJSON: () => doc })) as never);

    await createJob(OWNER_USER, input);

    // The lookup key is the *User* id — every company module resolves ownership
    // this way, which is why a missing CompanyProfile breaks all of them at once.
    expect(vi.mocked(CompanyProfile.findOne).mock.calls[0]![0]).toEqual({ user: OWNER_USER });
    const created = vi.mocked(Job.create).mock.calls[0]![0] as { company: string };
    expect(created.company).toBe(String(OWNER_COMPANY));
  });

  it('ignores a company id supplied in the request body', async () => {
    vi.mocked(Job.create).mockImplementation(((doc: Record<string, unknown>) =>
      Promise.resolve({ toJSON: () => doc })) as never);

    // A company that posts someone else's id must still get its own posting.
    await createJob(OWNER_USER, { ...(input as object), company: String(OTHER_COMPANY) } as never);

    const created = vi.mocked(Job.create).mock.calls[0]![0] as { company: string };
    expect(created.company).toBe(String(OWNER_COMPANY));
  });

  it('refuses a COMPANY user who has no CompanyProfile', async () => {
    // This is exactly what an account created before the atomic-signup fix looks
    // like: authentication succeeds, then every company feature 404s.
    await expect(createJob(new Types.ObjectId().toHexString(), input)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Company profile not found',
    });
    expect(Job.create).not.toHaveBeenCalled();
  });
});

describe('patchJob — publishing', () => {
  it('lets the owning company publish its own draft', async () => {
    const doc = jobDoc();
    vi.mocked(Job.findById).mockResolvedValue(doc as never);

    const result = await patchJob(OWNER_USER, 'COMPANY', String(doc._id), {
      status: 'PUBLISHED',
    } as never);

    expect(doc.status).toBe('PUBLISHED');
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('PUBLISHED');
  });

  it('refuses another company and does not save', async () => {
    const doc = jobDoc();
    vi.mocked(Job.findById).mockResolvedValue(doc as never);

    await expect(
      patchJob(OTHER_USER, 'COMPANY', String(doc._id), { status: 'PUBLISHED' } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your job' });

    expect(doc.status).toBe('DRAFT');
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('lets an ADMIN through without an ownership lookup', async () => {
    const doc = jobDoc();
    vi.mocked(Job.findById).mockResolvedValue(doc as never);

    await patchJob(OTHER_USER, 'ADMIN', String(doc._id), { status: 'CLOSED' } as never);

    expect(doc.status).toBe('CLOSED');
    expect(CompanyProfile.findOne).not.toHaveBeenCalled();
  });

  it('404s on a job that does not exist, before any ownership check', async () => {
    vi.mocked(Job.findById).mockResolvedValue(null as never);
    await expect(
      patchJob(OWNER_USER, 'COMPANY', new Types.ObjectId().toHexString(), {} as never),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('listMyJobs', () => {
  it('scopes the query to the caller’s own company', async () => {
    await listMyJobs(OWNER_USER, {});
    expect(filterOf(vi.mocked(Job.find))).toEqual({ company: String(OWNER_COMPANY) });
  });

  it('adds the status filter when one is given', async () => {
    await listMyJobs(OWNER_USER, {}, { status: 'draft' });
    expect(filterOf(vi.mocked(Job.find))).toEqual({
      company: String(OWNER_COMPANY),
      status: 'DRAFT',
    });
  });

  it('rejects a status that is not a real job status', async () => {
    await expect(listMyJobs(OWNER_USER, {}, { status: 'PENDING' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('listJobs visibility', () => {
  it('forces PUBLISHED for an anonymous caller', async () => {
    await listJobs({}, {});
    expect(filterOf(vi.mocked(Job.find))).toMatchObject({ status: 'PUBLISHED' });
  });

  it('refuses to list drafts publicly', async () => {
    await expect(listJobs({}, { status: 'DRAFT' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      listJobs({}, { status: 'DRAFT' }, { role: 'COMPANY', userId: OWNER_USER }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('lets an ADMIN ask for any status', async () => {
    await listJobs({}, { status: 'DRAFT' }, { role: 'ADMIN' });
    expect(filterOf(vi.mocked(Job.find))).toMatchObject({ status: 'DRAFT' });
  });
});

describe('getJobById visibility', () => {
  function draft() {
    const doc = jobDoc();
    vi.mocked(Job.findById).mockReturnValue({
      populate: () => Promise.resolve(doc),
    } as never);
    return doc;
  }

  it('hides an unpublished job from the public as a 404, not a 403', async () => {
    const doc = draft();
    // 403 would confirm the posting exists; 404 leaves an id unprobeable.
    await expect(getJobById(String(doc._id))).rejects.toMatchObject({
      statusCode: 404,
      message: 'Job not found',
    });
  });

  it('hides it from a different company too', async () => {
    const doc = draft();
    await expect(
      getJobById(String(doc._id), { role: 'COMPANY', userId: OTHER_USER }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('shows it to the company that owns it', async () => {
    const doc = draft();
    const result = await getJobById(String(doc._id), { role: 'COMPANY', userId: OWNER_USER });
    expect(idOf(result)).toBe(String(doc._id));
  });

  it('shows it to an ADMIN', async () => {
    const doc = draft();
    const result = await getJobById(String(doc._id), { role: 'ADMIN' });
    expect(idOf(result)).toBe(String(doc._id));
  });

  it('shows a published job to anyone', async () => {
    const doc = jobDoc({ status: 'PUBLISHED' });
    vi.mocked(Job.findById).mockReturnValue({
      populate: () => Promise.resolve(doc),
    } as never);
    const result = await getJobById(String(doc._id));
    expect(result.status).toBe('PUBLISHED');
  });
});

/**
 * `matchScore` on the job list.
 *
 * The web layer has always declared `JobWithMatch` and gated `MatchBadge` on
 * `matchScore !== undefined`, but nothing computed the value for `GET /jobs` — a
 * score existed only on `Application`, snapshotted at apply time, so the badge
 * could never appear on a job the student had not already applied to. These tests
 * pin both halves: that a signed-in student gets the score the *existing*
 * algorithm produces, and that every other caller still gets no score at all
 * rather than a zero.
 */
describe('listJobs — matchScore', () => {
  const SKILL_A = new Types.ObjectId();
  const SKILL_B = new Types.ObjectId();
  const SKILL_C = new Types.ObjectId();
  const STUDENT_USER = new Types.ObjectId().toHexString();

  const studentViewer = { role: 'STUDENT' as const, userId: STUDENT_USER };

  it('scores each row for a signed-in student', async () => {
    studentWithSkills([SKILL_A, SKILL_B]);
    vi.mocked(Job.find).mockImplementation((() =>
      findChain([listRow([SKILL_A, SKILL_B])])) as never);

    const { items } = await listJobs({}, {}, studentViewer);

    // Every required skill met and no preferred skills listed — the algorithm
    // gives required the full 100 in that case.
    expect(scoreOf(items[0])).toBe(100);
  });

  it('delegates to the existing algorithm rather than reimplementing it', async () => {
    studentWithSkills([SKILL_A]);
    vi.mocked(Job.find).mockImplementation((() =>
      findChain([listRow([SKILL_A, SKILL_B], [SKILL_C])])) as never);

    const { items } = await listJobs({}, {}, studentViewer);

    const expected = computeMatch(
      [String(SKILL_A)],
      [String(SKILL_A), String(SKILL_B)],
      [String(SKILL_C)],
    ).score;
    expect(scoreOf(items[0])).toBe(expected);
  });

  it('scores rows independently', async () => {
    studentWithSkills([SKILL_A]);
    vi.mocked(Job.find).mockImplementation((() =>
      findChain([listRow([SKILL_A]), listRow([SKILL_B])])) as never);

    const { items } = await listJobs({}, {}, studentViewer);

    expect(scoreOf(items[0])).toBe(100);
    expect(scoreOf(items[1])).toBe(0);
  });

  it('keeps the row shape otherwise intact', async () => {
    studentWithSkills([SKILL_A]);
    const row = listRow([SKILL_A]);
    vi.mocked(Job.find).mockImplementation((() => findChain([row])) as never);

    const { items } = await listJobs({}, {}, studentViewer);

    expect(idOf(items[0])).toBe(String(row._id));
  });

  it('omits the score for an anonymous visitor, without touching the student collections', async () => {
    vi.mocked(Job.find).mockImplementation((() => findChain([listRow([SKILL_A])])) as never);

    const { items } = await listJobs({}, {});

    expect(scoreOf(items[0])).toBeUndefined();
    expect(StudentProfile.findOne).not.toHaveBeenCalled();
    expect(StudentSkill.find).not.toHaveBeenCalled();
  });

  it('omits the score for a company viewer', async () => {
    vi.mocked(Job.find).mockImplementation((() => findChain([listRow([SKILL_A])])) as never);

    const { items } = await listJobs({}, {}, { role: 'COMPANY', userId: OWNER_USER });

    expect(scoreOf(items[0])).toBeUndefined();
    expect(StudentProfile.findOne).not.toHaveBeenCalled();
  });

  it('omits the score when the student has recorded no skills', async () => {
    studentWithSkills([]);
    vi.mocked(Job.find).mockImplementation((() => findChain([listRow([SKILL_A])])) as never);

    const { items } = await listJobs({}, {}, studentViewer);

    // 0% on every posting would be an invented verdict, not a measurement.
    expect(scoreOf(items[0])).toBeUndefined();
  });

  it('still lists jobs for a STUDENT account that has no profile', async () => {
    // `loadStudentSkillIds` 404s here, which is right for the profile-specific
    // endpoints that own it but must not take down a public browse page.
    vi.mocked(Job.find).mockImplementation((() => findChain([listRow([SKILL_A])])) as never);

    const { items } = await listJobs({}, {}, studentViewer);

    expect(items).toHaveLength(1);
    expect(scoreOf(items[0])).toBeUndefined();
  });
});
