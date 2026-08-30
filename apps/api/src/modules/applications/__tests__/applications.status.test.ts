import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Application: { findById: vi.fn() },
  Job: { findById: vi.fn() },
  Internship: { findById: vi.fn() },
  FacultyOpportunity: { findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn() },
  Institution: { findById: vi.fn() },
  Skill: { find: vi.fn() },
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
  User: { findById: vi.fn() },
  InterimReport: { find: vi.fn() },
  Resume: { findOne: vi.fn() },
}));

vi.mock('../../notifications/notifications.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

import { Application, CompanyProfile, Job } from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import { updateStatus } from '../applications.service';

/**
 * Shortlisting — the "hire" half of the company flow — with the models mocked.
 *
 * `requireRole('COMPANY','ADMIN')` on `PATCH /applications/:id/status` only
 * proves the caller is *a* company. What stops Company B moving a candidate
 * through Company A's pipeline is the ownership check in `updateStatus`, which
 * compares the application's opportunity's `company` against the profile
 * resolved from the caller's User id. That comparison is what this file asserts.
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

/** Mirrors `Application.findById(id).populate(...).populate(...)`. */
function applicationDoc() {
  const doc = {
    _id: new Types.ObjectId(),
    opportunity: new Types.ObjectId(),
    opportunityType: 'JOB',
    status: 'APPLIED',
    timeline: [] as Array<Record<string, unknown>>,
    student: { user: { _id: APPLICANT_USER } },
    faculty: null,
    save: vi.fn(() => Promise.resolve()),
    toJSON(): Record<string, unknown> {
      return { id: String(doc._id), status: doc.status, timeline: doc.timeline };
    },
  };
  const chain: Record<string, unknown> = {};
  chain.populate = vi.fn(() => chain);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
  vi.mocked(Application.findById).mockReturnValue(chain as never);
  return doc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockImplementation(((filter: { user: unknown }) => {
    const id = COMPANIES.get(String(filter.user));
    return Promise.resolve(id ? { _id: id } : null);
  }) as never);
  // The posting behind the application belongs to OWNER_COMPANY.
  vi.mocked(Job.findById).mockReturnValue({
    select: () => Promise.resolve({ company: OWNER_COMPANY, title: 'Backend Engineer' }),
  } as never);
  vi.mocked(createNotification).mockResolvedValue(undefined as never);
});

describe('updateStatus — company ownership', () => {
  it('lets the owning company shortlist a candidate', async () => {
    const app = applicationDoc();

    const result = (await updateStatus(OWNER_USER, 'COMPANY', String(app._id), {
      status: 'SHORTLISTED',
    } as never)) as { status: string };

    expect(result.status).toBe('SHORTLISTED');
    expect(app.save).toHaveBeenCalledTimes(1);
    // The timeline is the audit trail the candidate sees, so the transition has
    // to be appended rather than just overwriting `status`.
    expect(app.timeline).toHaveLength(1);
    expect(app.timeline[0]).toMatchObject({ status: 'SHORTLISTED' });
  });

  it('records the note when one is given, and omits the key when it is not', async () => {
    const withNote = applicationDoc();
    await updateStatus(OWNER_USER, 'COMPANY', String(withNote._id), {
      status: 'SHORTLISTED',
      note: 'Strong on system design',
    } as never);
    expect(withNote.timeline[0]).toMatchObject({ note: 'Strong on system design' });

    const withoutNote = applicationDoc();
    await updateStatus(OWNER_USER, 'COMPANY', String(withoutNote._id), {
      status: 'SHORTLISTED',
    } as never);
    expect(withoutNote.timeline[0]).not.toHaveProperty('note');
  });

  it('refuses a company that does not own the posting, and does not save', async () => {
    const app = applicationDoc();

    await expect(
      updateStatus(OTHER_USER, 'COMPANY', String(app._id), { status: 'SELECTED' } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your application' });

    expect(app.status).toBe('APPLIED');
    expect(app.save).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('refuses a COMPANY user whose CompanyProfile is missing', async () => {
    const app = applicationDoc();
    await expect(
      updateStatus(new Types.ObjectId().toHexString(), 'COMPANY', String(app._id), {
        status: 'SHORTLISTED',
      } as never),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Company profile not found' });
    expect(app.save).not.toHaveBeenCalled();
  });

  it('refuses a STUDENT outright', async () => {
    const app = applicationDoc();
    await expect(
      updateStatus(OWNER_USER, 'STUDENT', String(app._id), { status: 'SELECTED' } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Insufficient role' });
    expect(app.save).not.toHaveBeenCalled();
  });

  it('lets an ADMIN through without an ownership lookup', async () => {
    const app = applicationDoc();
    await updateStatus(OTHER_USER, 'ADMIN', String(app._id), { status: 'SELECTED' } as never);
    expect(app.status).toBe('SELECTED');
    expect(CompanyProfile.findOne).not.toHaveBeenCalled();
  });

  it('404s on an application that does not exist', async () => {
    const chain: Record<string, unknown> = {};
    chain.populate = vi.fn(() => chain);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(null).then(resolve);
    vi.mocked(Application.findById).mockReturnValue(chain as never);

    await expect(
      updateStatus(OWNER_USER, 'COMPANY', new Types.ObjectId().toHexString(), {
        status: 'SHORTLISTED',
      } as never),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Application not found' });
  });
});

describe('updateStatus — applicant notifications', () => {
  it('notifies the applicant when they are selected', async () => {
    const app = applicationDoc();
    await updateStatus(OWNER_USER, 'COMPANY', String(app._id), { status: 'SELECTED' } as never);

    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(target).toBe(String(APPLICANT_USER));
    expect(kind).toBe('APPLICATION_SELECTED');
    expect(title).toBe('You have been selected');
  });

  it('notifies the applicant when they are rejected', async () => {
    const app = applicationDoc();
    await updateStatus(OWNER_USER, 'COMPANY', String(app._id), { status: 'REJECTED' } as never);
    expect(vi.mocked(createNotification).mock.calls[0]![1]).toBe('APPLICATION_REJECTED');
  });

  it('notifies the applicant when they are shortlisted', async () => {
    // Shortlisting is a key transition — students should be notified.
    const app = applicationDoc();
    await updateStatus(OWNER_USER, 'COMPANY', String(app._id), { status: 'SHORTLISTED' } as never);
    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(target).toBe(String(APPLICANT_USER));
    expect(kind).toBe('APPLICATION_SHORTLISTED');
    expect(title).toBe('You have been shortlisted');
  });
});

describe('updateStatus — internship lifecycle', () => {
  it('allows SHORTLISTED → SELECTED transition for jobs (backward compat)', async () => {
    const app = applicationDoc();
    const result = (await updateStatus(OWNER_USER, 'COMPANY', String(app._id), {
      status: 'SELECTED',
    } as never)) as { status: string };
    expect(result.status).toBe('SELECTED');
  });

  it('refuses APPLIED → ONGOING (skipping all steps)', async () => {
    const app = applicationDoc();
    await expect(
      updateStatus(OWNER_USER, 'COMPANY', String(app._id), { status: 'ONGOING' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses REJECTED → SELECTED (terminal state)', async () => {
    const app = applicationDoc();
    app.status = 'REJECTED';
    await expect(
      updateStatus(OWNER_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
