import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Internship: {
    create: vi.fn(),
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
  CompanyProfile: { findOne: vi.fn() },
}));

import { CompanyProfile, Internship } from '../../../models';
import {
  createInternship,
  getInternshipById,
  listInternships,
  listMyInternships,
  patchInternship,
} from '../internships.service';

/**
 * The internship module mirrors the job module line for line, including
 * `getMyCompanyId` and the `String(x.company) !== companyId` ownership checks.
 * Mirroring the coverage too is what stops the two from drifting apart — the
 * internship forms have already needed the same fix as the job forms once.
 * See `modules/jobs/__tests__/jobs.service.test.ts`.
 */

const OWNER_USER = new Types.ObjectId().toHexString();
const OWNER_COMPANY = new Types.ObjectId();
const OTHER_USER = new Types.ObjectId().toHexString();
const OTHER_COMPANY = new Types.ObjectId();

const COMPANIES = new Map<string, Types.ObjectId>([
  [OWNER_USER, OWNER_COMPANY],
  [OTHER_USER, OTHER_COMPANY],
]);

function companyProfileFor(filter: unknown) {
  const user = String((filter as { user: unknown }).user);
  const id = COMPANIES.get(user);
  return { select: () => Promise.resolve(id ? { _id: id } : null) };
}

function internshipDoc(overrides: Record<string, unknown> = {}) {
  const doc = {
    _id: new Types.ObjectId(),
    title: 'Summer Intern',
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
 * overload for `find`, so `vi.mocked(Internship.find).mock.calls` narrows to
 * `[][]` and TypeScript refuses to read an argument out of it.
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockImplementation(companyProfileFor as never);
  vi.mocked(Internship.countDocuments).mockResolvedValue(0 as never);
  vi.mocked(Internship.find).mockImplementation((() => findChain([])) as never);
});

const input = {
  title: 'Summer Intern',
  description: 'A description long enough to satisfy the schema minimum length.',
  location: 'Bengaluru, India',
  workMode: 'REMOTE',
  durationMonths: 6,
  requiredSkills: [new Types.ObjectId().toHexString()],
  openings: 2,
} as never;

describe('createInternship', () => {
  it('stamps the internship with the caller’s own company', async () => {
    vi.mocked(Internship.create).mockImplementation(((doc: Record<string, unknown>) =>
      Promise.resolve({ toJSON: () => doc })) as never);

    await createInternship(OWNER_USER, input);

    expect(vi.mocked(CompanyProfile.findOne).mock.calls[0]![0]).toEqual({ user: OWNER_USER });
    const created = vi.mocked(Internship.create).mock.calls[0]![0] as { company: string };
    expect(created.company).toBe(String(OWNER_COMPANY));
  });

  it('ignores a company id supplied in the request body', async () => {
    vi.mocked(Internship.create).mockImplementation(((doc: Record<string, unknown>) =>
      Promise.resolve({ toJSON: () => doc })) as never);

    await createInternship(OWNER_USER, {
      ...(input as object),
      company: String(OTHER_COMPANY),
    } as never);

    const created = vi.mocked(Internship.create).mock.calls[0]![0] as { company: string };
    expect(created.company).toBe(String(OWNER_COMPANY));
  });

  it('refuses a COMPANY user who has no CompanyProfile', async () => {
    await expect(
      createInternship(new Types.ObjectId().toHexString(), input),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Company profile not found' });
    expect(Internship.create).not.toHaveBeenCalled();
  });
});

describe('patchInternship — publishing', () => {
  it('lets the owning company publish its own draft', async () => {
    const doc = internshipDoc();
    vi.mocked(Internship.findById).mockResolvedValue(doc as never);

    const result = await patchInternship(OWNER_USER, 'COMPANY', String(doc._id), {
      status: 'PUBLISHED',
    } as never);

    expect(doc.status).toBe('PUBLISHED');
    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('PUBLISHED');
  });

  it('refuses another company and does not save', async () => {
    const doc = internshipDoc();
    vi.mocked(Internship.findById).mockResolvedValue(doc as never);

    await expect(
      patchInternship(OTHER_USER, 'COMPANY', String(doc._id), { status: 'PUBLISHED' } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your internship' });

    expect(doc.status).toBe('DRAFT');
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('listMyInternships', () => {
  it('scopes the query to the caller’s own company', async () => {
    await listMyInternships(OWNER_USER, {});
    expect(filterOf(vi.mocked(Internship.find))).toEqual({
      company: String(OWNER_COMPANY),
    });
  });

  it('adds the status filter when one is given', async () => {
    await listMyInternships(OWNER_USER, {}, { status: 'draft' });
    expect(filterOf(vi.mocked(Internship.find))).toEqual({
      company: String(OWNER_COMPANY),
      status: 'DRAFT',
    });
  });
});

describe('internship visibility', () => {
  it('forces PUBLISHED on the public list and refuses a draft filter', async () => {
    await listInternships({}, {});
    expect(filterOf(vi.mocked(Internship.find))).toMatchObject({ status: 'PUBLISHED' });
    await expect(listInternships({}, { status: 'DRAFT' })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('hides an unpublished internship from everyone but its owner and admins', async () => {
    const doc = internshipDoc();
    vi.mocked(Internship.findById).mockReturnValue({
      populate: () => Promise.resolve(doc),
    } as never);

    await expect(getInternshipById(String(doc._id))).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      getInternshipById(String(doc._id), { role: 'COMPANY', userId: OTHER_USER }),
    ).rejects.toMatchObject({ statusCode: 404 });

    const owner = await getInternshipById(String(doc._id), {
      role: 'COMPANY',
      userId: OWNER_USER,
    });
    expect(idOf(owner)).toBe(String(doc._id));

    const admin = await getInternshipById(String(doc._id), { role: 'ADMIN' });
    expect(idOf(admin)).toBe(String(doc._id));
  });
});
