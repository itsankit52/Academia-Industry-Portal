import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Application: { find: vi.fn(), countDocuments: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
  Internship: { find: vi.fn() },
  Interview: { find: vi.fn(), countDocuments: vi.fn() },
  Job: { find: vi.fn() },
}));

// The real module reads Cloudinary credentials at import time; the dashboard does
// not touch it, so it is stubbed rather than configured.
vi.mock('../../../config/cloudinary', () => ({
  cloudinary: { uploader: {} },
  isCloudinaryConfigured: () => false,
}));

import { Application, CompanyProfile, Internship, Interview, Job } from '../../../models';
import { getCompanyDashboard } from '../companies.service';

/**
 * The company dashboard, with the models mocked.
 *
 * Two things matter here. First, the whole page hangs off
 * `CompanyProfile.findOne({ user })` — the same lookup every other company route
 * uses — so a missing profile has to fail loudly rather than render an empty
 * dashboard. Second, the two lists are read with `.lean()`, which skips the
 * schema's `toJSON` transform; they therefore need `serializeLean`, or the rows
 * arrive with `_id` while `CandidateCard` links to `application.id`.
 */

const OWNER_USER = new Types.ObjectId().toHexString();
const OWNER_COMPANY = new Types.ObjectId();

const JOB_PUBLISHED = new Types.ObjectId();
const JOB_DRAFT = new Types.ObjectId();
const INTERNSHIP_PUBLISHED = new Types.ObjectId();
const APPLICATION_ID = new Types.ObjectId();
const INTERVIEW_ID = new Types.ObjectId();
const STUDENT_PROFILE_ID = new Types.ObjectId();

/** Mirrors a query that ends in `.select(...)`, `.lean()` or a sort/limit chain. */
function chain(rows: unknown) {
  const c: Record<string, unknown> = {};
  for (const method of ['select', 'sort', 'limit', 'populate', 'lean']) {
    c[method] = vi.fn(() => c);
  }
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return c;
}

/**
 * The filter a query mock was called with. Mongoose declares a zero-argument
 * overload for `find`, so `vi.mocked(Job.find).mock.calls` narrows to `[][]` and
 * TypeScript refuses to read an argument out of it.
 */
function filterOf(mock: { mock: { calls: unknown[][] } }): unknown {
  return mock.mock.calls[0]?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockReturnValue(
    chain({ _id: OWNER_COMPANY }) as never,
  );
  vi.mocked(Job.find).mockReturnValue(
    chain([
      { _id: JOB_PUBLISHED, status: 'PUBLISHED' },
      { _id: JOB_DRAFT, status: 'DRAFT' },
    ]) as never,
  );
  vi.mocked(Internship.find).mockReturnValue(
    chain([{ _id: INTERNSHIP_PUBLISHED, status: 'PUBLISHED' }]) as never,
  );
  vi.mocked(Application.countDocuments).mockResolvedValue(3 as never);
  vi.mocked(Application.find).mockReturnValue(
    chain([
      {
        _id: APPLICATION_ID,
        __v: 0,
        status: 'APPLIED',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        student: { _id: STUDENT_PROFILE_ID, fullName: 'Jane Smith' },
      },
    ]) as never,
  );
  vi.mocked(Interview.countDocuments).mockResolvedValue(1 as never);
  vi.mocked(Interview.find).mockReturnValue(
    chain([
      {
        _id: INTERVIEW_ID,
        __v: 0,
        application: APPLICATION_ID,
        scheduledAt: new Date('2026-09-15T09:30:00.000Z'),
      },
    ]) as never,
  );
});

describe('getCompanyDashboard', () => {
  it('resolves the acting company from the caller’s User id', async () => {
    await getCompanyDashboard(OWNER_USER);
    expect(vi.mocked(CompanyProfile.findOne).mock.calls[0]![0]).toEqual({ user: OWNER_USER });
    expect(filterOf(vi.mocked(Job.find))).toEqual({ company: OWNER_COMPANY });
    expect(filterOf(vi.mocked(Internship.find))).toEqual({ company: OWNER_COMPANY });
  });

  it('404s rather than rendering an empty dashboard when the profile is missing', async () => {
    vi.mocked(CompanyProfile.findOne).mockReturnValue(chain(null) as never);
    await expect(getCompanyDashboard(OWNER_USER)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Company profile not found',
    });
  });

  it('counts only published postings as active', async () => {
    const data = await getCompanyDashboard(OWNER_USER);
    expect(data.activeJobsCount).toBe(1);
    expect(data.activeInternshipsCount).toBe(1);
    expect(data.applicantsCount).toBe(3);
    expect(data.interviewsCount).toBe(1);
  });

  it('scopes applications to this company’s own postings only', async () => {
    await getCompanyDashboard(OWNER_USER);
    expect(vi.mocked(Application.countDocuments).mock.calls[0]![0]).toEqual({
      $or: [
        { opportunityType: 'JOB', opportunity: { $in: [JOB_PUBLISHED, JOB_DRAFT] } },
        { opportunityType: 'INTERNSHIP', opportunity: { $in: [INTERNSHIP_PUBLISHED] } },
      ],
    });
  });

  it('returns `id` on the lean rows, not `_id`', async () => {
    const data = await getCompanyDashboard(OWNER_USER);

    const applicant = data.recentApplicants[0] as Record<string, unknown>;
    // `CandidateCard` renders `to={`/company/applicants/${application.id}`}`, so an
    // `_id` here produced a link to `.../undefined` on every row.
    expect(applicant.id).toBe(String(APPLICATION_ID));
    expect(applicant).not.toHaveProperty('_id');
    expect(applicant).not.toHaveProperty('__v');

    // Populated references are nested plain objects with their own `_id`.
    expect((applicant.student as Record<string, unknown>).id).toBe(String(STUDENT_PROFILE_ID));

    const interview = data.upcomingInterviews[0] as Record<string, unknown>;
    expect(interview.id).toBe(String(INTERVIEW_ID));
    expect(interview.application).toBe(String(APPLICATION_ID));
  });

  it('leaves dates intact while rewriting ids', async () => {
    const data = await getCompanyDashboard(OWNER_USER);
    const interview = data.upcomingInterviews[0] as { scheduledAt: unknown };
    // Recursing into a Date would flatten it to `{}`, which is how the interview
    // cards would lose their time.
    expect(interview.scheduledAt).toBeInstanceOf(Date);
    expect((interview.scheduledAt as Date).toISOString()).toBe('2026-09-15T09:30:00.000Z');
  });

  it('only ever looks for interviews on its own applications', async () => {
    await getCompanyDashboard(OWNER_USER);
    expect(vi.mocked(Interview.countDocuments).mock.calls[0]![0]).toEqual({
      application: { $in: [APPLICATION_ID] },
    });
  });
});
