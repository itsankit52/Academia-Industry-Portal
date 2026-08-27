import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Interview: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn(), create: vi.fn() },
  Application: { find: vi.fn(), findById: vi.fn(), countDocuments: vi.fn() },
  Job: { find: vi.fn(), findById: vi.fn() },
  Internship: { find: vi.fn(), findById: vi.fn() },
  FacultyOpportunity: { find: vi.fn(), findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn(), findById: vi.fn() },
  Institution: { findById: vi.fn() },
  Skill: { find: vi.fn() },
  StudentProfile: { findOne: vi.fn(), findById: vi.fn() },
  StudentSkill: { find: vi.fn() },
  CompanyProfile: { findOne: vi.fn(), findById: vi.fn() },
  User: { findById: vi.fn() },
  InterimReport: { find: vi.fn() },
  Resume: { findOne: vi.fn() },
}));

vi.mock('../../notifications/notifications.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

import {
  Application,
  CompanyProfile,
  Internship,
  Interview,
  Job,
  StudentProfile,
  User,
} from '../../../models';
import { getInterviewById, listInterviews } from '../interviews.service';

/**
 * The interview views render `candidateName`, `opportunityTitle`, `companyName`
 * and `applicationId` — four fields `@aip/types` declares on an `Interview` and
 * the schema does not store. Nothing on the API had ever derived them, so the
 * cards showed a blank header and the cancel dialog asked "Cancel the interview
 * with undefined?".
 *
 * The real applications service is used here rather than a stub of it, because
 * the point of routing through `summarizeApplication` is that an interview and
 * the applicants table resolve a candidate the same way; a stub would let the two
 * drift apart without failing anything.
 */

const COMPANY_USER = new Types.ObjectId().toHexString();
const COMPANY_ID = new Types.ObjectId();
const JOB_ID = new Types.ObjectId();
const APP_ID = new Types.ObjectId();
const STUDENT_PROFILE = new Types.ObjectId();
const STUDENT_USER = new Types.ObjectId();

/** One interview as it leaves Mongoose, `toJSON` transform already applied. */
function interviewRow(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  const json = {
    id: String(_id),
    application: String(APP_ID),
    mode: 'ONLINE',
    scheduledAt: '2026-09-01T09:30:00.000Z',
    durationMinutes: 45,
    status: 'SCHEDULED',
    ...overrides,
  };
  return { _id, application: json.application, toJSON: () => ({ ...json }) };
}

/**
 * Both services share this mocked model. The interviews service continues
 * `.select('_id')`, the applications service awaits the query directly, so the
 * double has to answer to either.
 */
function companyProfileDouble(id: Types.ObjectId) {
  const doc = { _id: id };
  return {
    select: () => Promise.resolve(doc),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(CompanyProfile.findOne).mockImplementation((() =>
    companyProfileDouble(COMPANY_ID)) as never);
  vi.mocked(Job.find).mockReturnValue({
    select: () => Promise.resolve([{ _id: JOB_ID }]),
  } as never);
  vi.mocked(Internship.find).mockReturnValue({ select: () => Promise.resolve([]) } as never);

  // `.select('_id')` is awaited by the interview scoping; nothing else uses find.
  vi.mocked(Application.find).mockReturnValue({
    select: () => Promise.resolve([{ _id: APP_ID }]),
  } as never);

  // Two callers, two shapes: the access check awaits `findById` straight away,
  // while `summarizeApplication` continues `.select(...).lean()`.
  const appDoc = {
    _id: APP_ID,
    student: STUDENT_PROFILE,
    opportunityType: 'JOB',
    opportunity: JOB_ID,
  };
  vi.mocked(Application.findById).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(appDoc) }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(appDoc).then(resolve),
  } as never);

  vi.mocked(Job.findById).mockReturnValue({
    select: () => ({
      populate: () => ({
        lean: () =>
          Promise.resolve({
            _id: JOB_ID,
            title: 'Backend Engineer',
            company: { _id: COMPANY_ID, companyName: 'Acme Corp' },
          }),
      }),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ _id: JOB_ID, company: COMPANY_ID }).then(resolve),
    }),
  } as never);

  vi.mocked(StudentProfile.findById).mockReturnValue({
    select: () => ({
      lean: () =>
        Promise.resolve({ _id: STUDENT_PROFILE, fullName: 'Asha Menon', user: STUDENT_USER }),
    }),
  } as never);
  vi.mocked(User.findById).mockReturnValue({
    select: () => ({
      lean: () => Promise.resolve({ _id: STUDENT_USER, email: 'asha.menon@example.edu' }),
    }),
  } as never);
});

function mockInterviewFind(rows: ReturnType<typeof interviewRow>[]) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => Promise.resolve(rows),
  } as Record<string, unknown>;
  vi.mocked(Interview.find).mockReturnValue(chain as never);
  vi.mocked(Interview.countDocuments).mockResolvedValue(rows.length as never);
}

describe('listInterviews — the four derived fields', () => {
  it('names the candidate, the posting and the company on every row', async () => {
    mockInterviewFind([interviewRow()]);

    const page = (await listInterviews(COMPANY_USER, 'COMPANY', {}, {})) as {
      items: Record<string, unknown>[];
    };

    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      applicationId: String(APP_ID),
      candidateName: 'Asha Menon',
      opportunityTitle: 'Backend Engineer',
      companyName: 'Acme Corp',
    });
  });

  it("keeps the interview's own stored fields intact", async () => {
    // The summary is merged onto the row, not substituted for it.
    const row = interviewRow();
    mockInterviewFind([row]);

    const page = (await listInterviews(COMPANY_USER, 'COMPANY', {}, {})) as {
      items: Record<string, unknown>[];
    };

    expect(page.items[0]).toMatchObject({
      id: String(row._id),
      mode: 'ONLINE',
      scheduledAt: '2026-09-01T09:30:00.000Z',
      durationMinutes: 45,
      status: 'SCHEDULED',
    });
  });

  it('resolves each row rather than reusing the first one', async () => {
    mockInterviewFind([interviewRow(), interviewRow()]);

    const page = (await listInterviews(COMPANY_USER, 'COMPANY', {}, {})) as {
      items: Record<string, unknown>[];
    };

    expect(page.items.map((i) => i.candidateName)).toEqual(['Asha Menon', 'Asha Menon']);
    expect(StudentProfile.findById).toHaveBeenCalledTimes(2);
  });

  it('serves the row unchanged when its application has been deleted', async () => {
    // A dangling ref must not take the interviews page down.
    vi.mocked(Application.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(null).then(resolve),
    } as never);
    const row = interviewRow();
    mockInterviewFind([row]);

    const page = (await listInterviews(COMPANY_USER, 'COMPANY', {}, {})) as {
      items: Record<string, unknown>[];
    };

    expect(page.items[0]).toMatchObject({ id: String(row._id) });
    expect(page.items[0]).not.toHaveProperty('candidateName');
  });
});

describe('getInterviewById — the same four fields', () => {
  it('derives them for the single-interview read too', async () => {
    const row = interviewRow();
    vi.mocked(Interview.findById).mockResolvedValue(row as never);

    const iv = (await getInterviewById(COMPANY_USER, 'COMPANY', String(row._id))) as Record<
      string,
      unknown
    >;

    expect(iv).toMatchObject({
      id: String(row._id),
      candidateName: 'Asha Menon',
      opportunityTitle: 'Backend Engineer',
      companyName: 'Acme Corp',
    });
  });

  it('still refuses a company that does not own the posting', async () => {
    // Deriving the names must not have moved ahead of the access check.
    const row = interviewRow();
    vi.mocked(Interview.findById).mockResolvedValue(row as never);
    vi.mocked(CompanyProfile.findOne).mockImplementation((() =>
      companyProfileDouble(new Types.ObjectId())) as never);

    await expect(getInterviewById(COMPANY_USER, 'COMPANY', String(row._id))).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not your interview',
    });
  });
});
