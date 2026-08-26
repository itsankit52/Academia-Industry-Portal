import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Interview: { create: vi.fn(), findById: vi.fn(), find: vi.fn(), countDocuments: vi.fn() },
  Application: { findById: vi.fn() },
  Job: { findById: vi.fn() },
  Internship: { findById: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
  StudentProfile: { findOne: vi.fn() },
}));

vi.mock('../../notifications/notifications.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

import { Application, CompanyProfile, Interview, Job } from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import { createInterview } from '../interviews.service';

/**
 * Interview scheduling, mirroring the ownership question asked in
 * `modules/applications/__tests__/applications.status.test.ts`: a COMPANY caller
 * may only schedule against an application for one of its own postings, which
 * `assertCompanyOwnsApplication` decides.
 */

const OWNER_USER = new Types.ObjectId().toHexString();
const OWNER_COMPANY = new Types.ObjectId();
const OTHER_USER = new Types.ObjectId().toHexString();
const OTHER_COMPANY = new Types.ObjectId();
const APPLICANT_USER = new Types.ObjectId();

const COMPANIES = new Map<string, Types.ObjectId>([
  [OWNER_USER, OWNER_COMPANY],
  [OTHER_USER, OTHER_COMPANY],
]);

const SCHEDULED_AT = '2026-09-15T09:30:00.000Z';

function applicationDoc() {
  const doc = {
    _id: new Types.ObjectId(),
    opportunity: new Types.ObjectId(),
    opportunityType: 'JOB',
    status: 'SHORTLISTED',
    timeline: [] as Array<Record<string, unknown>>,
    student: { user: { _id: APPLICANT_USER } },
    save: vi.fn(() => Promise.resolve()),
  };
  // `assertCompanyOwnsApplication` awaits findById directly, while
  // `getStudentUserIdFromApplication` chains `.populate(...)` onto it — so the
  // returned value has to be both a thenable and chainable.
  const chain: Record<string, unknown> = {};
  chain.populate = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
  vi.mocked(Application.findById).mockReturnValue(chain as never);
  return doc;
}

const input = {
  applicationId: '',
  mode: 'ONLINE',
  scheduledAt: SCHEDULED_AT,
  durationMinutes: 45,
  meetingLink: 'https://meet.example.com/abc',
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockImplementation(((filter: { user: unknown }) => {
    const id = COMPANIES.get(String(filter.user));
    return { select: () => Promise.resolve(id ? { _id: id } : null) };
  }) as never);
  vi.mocked(Job.findById).mockReturnValue({
    select: () => Promise.resolve({ company: OWNER_COMPANY }),
  } as never);
  vi.mocked(Interview.create).mockImplementation(((doc: Record<string, unknown>) => {
    const id = new Types.ObjectId();
    return Promise.resolve({ _id: id, toJSON: () => ({ id: String(id), ...doc }) });
  }) as never);
  vi.mocked(createNotification).mockResolvedValue(undefined as never);
});

describe('createInterview', () => {
  it('lets the owning company schedule and advances the application', async () => {
    const app = applicationDoc();

    const result = (await createInterview(OWNER_USER, 'COMPANY', {
      ...(input as object),
      applicationId: String(app._id),
    } as never)) as { application: unknown; durationMinutes: number };

    expect(Interview.create).toHaveBeenCalledTimes(1);
    expect(String(result.application)).toBe(String(app._id));
    expect(result.durationMinutes).toBe(45);

    expect(app.status).toBe('INTERVIEW_SCHEDULED');
    expect(app.timeline).toHaveLength(1);
    expect(app.timeline[0]).toMatchObject({ status: 'INTERVIEW_SCHEDULED' });
    expect(app.save).toHaveBeenCalledTimes(1);
  });

  it('tells the candidate about it', async () => {
    const app = applicationDoc();
    await createInterview(OWNER_USER, 'COMPANY', {
      ...(input as object),
      applicationId: String(app._id),
    } as never);

    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind] = vi.mocked(createNotification).mock.calls[0]!;
    expect(target).toBe(String(APPLICANT_USER));
    expect(kind).toBe('INTERVIEW_SCHEDULED');
  });

  it('refuses a company that does not own the posting', async () => {
    const app = applicationDoc();

    await expect(
      createInterview(OTHER_USER, 'COMPANY', {
        ...(input as object),
        applicationId: String(app._id),
      } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your application' });

    expect(Interview.create).not.toHaveBeenCalled();
    expect(app.save).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('refuses a COMPANY user whose CompanyProfile is missing', async () => {
    const app = applicationDoc();
    await expect(
      createInterview(new Types.ObjectId().toHexString(), 'COMPANY', {
        ...(input as object),
        applicationId: String(app._id),
      } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Company profile not found' });
    expect(Interview.create).not.toHaveBeenCalled();
  });

  it('stores the scheduled time as a Date, not the raw string', async () => {
    const app = applicationDoc();
    await createInterview(OWNER_USER, 'COMPANY', {
      ...(input as object),
      applicationId: String(app._id),
    } as never);

    const created = vi.mocked(Interview.create).mock.calls[0]![0] as { scheduledAt: unknown };
    expect(created.scheduledAt).toBeInstanceOf(Date);
    expect((created.scheduledAt as Date).toISOString()).toBe(SCHEDULED_AT);
  });

  it('omits optional fields that were not supplied rather than writing undefined', async () => {
    const app = applicationDoc();
    await createInterview(OWNER_USER, 'COMPANY', {
      applicationId: String(app._id),
      mode: 'ONLINE',
      scheduledAt: SCHEDULED_AT,
      durationMinutes: 30,
    } as never);

    const created = vi.mocked(Interview.create).mock.calls[0]![0] as Record<string, unknown>;
    expect(created).not.toHaveProperty('meetingLink');
    expect(created).not.toHaveProperty('location');
    expect(created).not.toHaveProperty('notes');
  });
});
