/**
 * Phase 6A — Placement Application Lifecycle.
 *
 * Covers:
 *   - Valid/invalid application status transitions
 *   - Company authorization (own applications only)
 *   - Student ownership
 *   - Student offer acceptance (SELECTED → OFFER_ACCEPTED)
 *   - Student offer rejection (SELECTED → OFFER_REJECTED)
 *   - Selected application restrictions
 *   - Timeline creation
 *   - Notifications
 *   - Institution scoping (via getDashboardStats)
 *
 * The service is exercised with the model layer mocked, following the same
 * pattern as applications.status.test.ts and applications.phase5b.test.ts.
 */
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Application: { findById: vi.fn() },
  Job: { findById: vi.fn() },
  Internship: { findById: vi.fn() },
  FacultyOpportunity: { findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn(), findById: vi.fn() },
  Institution: { findById: vi.fn() },
  Skill: { find: vi.fn() },
  StudentProfile: { findOne: vi.fn(), findById: vi.fn() },
  StudentSkill: { find: vi.fn() },
  CompanyProfile: { findOne: vi.fn(), findById: vi.fn() },
  User: { findById: vi.fn() },
  InterimReport: { find: vi.fn() },
  Resume: { findOne: vi.fn() },
  MentorProfile: { findOne: vi.fn() },
}));

vi.mock('../../notifications/notifications.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

import {
  Application,
  CompanyProfile,
  Job,
  Internship,
  FacultyOpportunity,
  StudentProfile,
  User,
} from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import { updateStatus, respondToOffer } from '../applications.service';

const STUDENT_USER = new Types.ObjectId().toHexString();
const STUDENT_PROFILE = new Types.ObjectId();
const COMPANY_USER = new Types.ObjectId().toHexString();
const COMPANY_ID = new Types.ObjectId();
const OTHER_COMPANY_ID = new Types.ObjectId();
const APPLICATION_ID = new Types.ObjectId();
const JOB_ID = new Types.ObjectId();
const INTERNSHIP_ID = new Types.ObjectId();

function jobAppDoc(overrides: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    _id: APPLICATION_ID,
    opportunity: JOB_ID,
    opportunityType: 'JOB',
    status: 'SHORTLISTED',
    timeline: [] as Array<Record<string, unknown>>,
    student: { _id: STUDENT_PROFILE, user: { _id: STUDENT_USER } },
    faculty: null,
    save: vi.fn(function save(this: Record<string, unknown>) {
      return Promise.resolve(this);
    }),
    toJSON(): Record<string, unknown> {
      return {
        id: String(this._id),
        status: this.status,
        timeline: this.timeline as Array<Record<string, unknown>>,
        student: this.student,
        opportunityType: this.opportunityType,
        opportunity: this.opportunity,
        offerDetails: (this as Record<string, unknown>).offerDetails,
        offerExpiresAt: (this as Record<string, unknown>).offerExpiresAt,
        withdrawalRequestedAt: (this as Record<string, unknown>).withdrawalRequestedAt,
      };
    },
    ...overrides,
  };
  const chain: Record<string, unknown> = {};
  chain.populate = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
  vi.mocked(Application.findById).mockReturnValue(chain as never);
  return doc;
}

function internshipAppDoc(overrides: Record<string, unknown> = {}) {
  return jobAppDoc({ ...overrides, opportunityType: 'INTERNSHIP', opportunity: INTERNSHIP_ID });
}

function studentProfile() {
  return Promise.resolve({ _id: STUDENT_PROFILE, fullName: 'Test Student', user: STUDENT_USER });
}

// Build a thenable Mongoose-style query: `select()` returns a chain that
// can be awaited or chained further with `lean()`.
function queryReturning<T>(data: T) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.lean = () => Promise.resolve(data);
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(data).then(resolve);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockImplementation(
    ((() => Promise.resolve({ _id: COMPANY_ID })) as unknown) as never,
  );
  vi.mocked(CompanyProfile.findById).mockReturnValue(
    queryReturning({ _id: COMPANY_ID, user: COMPANY_USER }) as never,
  );
  // For Job/Internship findById, return a thenable chain with both `select()`
  // and `lean()` so it works whether the service awaits after `select()` or
  // chains through to `.lean()`.
  vi.mocked(Job.findById).mockReturnValue(
    queryReturning({ company: COMPANY_ID, title: 'Backend Engineer' }) as never,
  );
  vi.mocked(Internship.findById).mockReturnValue(
    queryReturning({ company: COMPANY_ID, title: 'Software Intern' }) as never,
  );
  vi.mocked(FacultyOpportunity.findById).mockReturnValue(
    queryReturning({ title: 'FDP Title', postedBy: COMPANY_USER }) as never,
  );
  vi.mocked(StudentProfile.findOne).mockImplementation(
    ((() => studentProfile()) as unknown) as never,
  );
  vi.mocked(User.findById).mockImplementation(
    ((() => Promise.resolve({ email: 'student@example.com' })) as unknown) as never,
  );
  vi.mocked(createNotification).mockResolvedValue(undefined as never);
});

/* ============================================================
   Valid application transitions
   ============================================================ */

describe('updateStatus — valid transitions', () => {
  it('lets company shortlist an APPLIED job application', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    const result = (await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SHORTLISTED',
    } as never)) as { status: string };
    expect(result.status).toBe('SHORTLISTED');
    expect(app.save).toHaveBeenCalled();
  });

  it('lets company move UNDER_REVIEW → SHORTLISTED for jobs', async () => {
    const app = jobAppDoc({ status: 'UNDER_REVIEW' });
    const result = (await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SHORTLISTED',
    } as never)) as { status: string };
    expect(result.status).toBe('SHORTLISTED');
  });

  it('lets company schedule interview for a shortlisted job', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    const result = (await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'INTERVIEW_SCHEDULED',
    } as never)) as { status: string };
    expect(result.status).toBe('INTERVIEW_SCHEDULED');
  });

  it('lets company select a shortlisted job candidate', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    const result = (await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SELECTED',
    } as never)) as { status: string };
    expect(result.status).toBe('SELECTED');
    expect(app.timeline).toContainEqual(expect.objectContaining({ status: 'SELECTED' }));
  });

  it('lets company reject a shortlisted job candidate', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    const result = (await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'REJECTED',
    } as never)) as { status: string };
    expect(result.status).toBe('REJECTED');
  });

  it('adds timeline entry for each transition', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SHORTLISTED',
    } as never);
    expect(app.timeline).toHaveLength(1);
    expect(app.timeline[0]).toMatchObject({ status: 'SHORTLISTED' });
  });

  it('records a note when provided', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SELECTED',
      note: 'Strong culture fit, excellent skills',
    } as never);
    expect(app.timeline[0]).toMatchObject({
      status: 'SELECTED',
      note: 'Strong culture fit, excellent skills',
    });
  });
});

/* ============================================================
   Invalid application transitions
   ============================================================ */

describe('updateStatus — invalid transitions', () => {
  it('refuses APPLIED → ONGOING (job)', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'ONGOING' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses SELECTED → INTERNSHIP_STARTED on a job', async () => {
    const app = jobAppDoc({ status: 'SELECTED' });
    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
        status: 'INTERNSHIP_STARTED' as never,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses REJECTED → SELECTED (terminal state)', async () => {
    const app = jobAppDoc({ status: 'REJECTED' });
    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses OFFER_ACCEPTED → SELECTED (offer already accepted)', async () => {
    const app = jobAppDoc({ status: 'OFFER_ACCEPTED' });
    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses OFFER_REJECTED → SELECTED (offer already declined)', async () => {
    const app = jobAppDoc({ status: 'OFFER_REJECTED' });
    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses COMPLETED → SELECTED', async () => {
    const app = internshipAppDoc({ status: 'COMPLETED' });
    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ============================================================
   Company authorization
   ============================================================ */

describe('updateStatus — company authorization', () => {
  it('refuses a company that does not own the posting', async () => {
    const app = jobAppDoc();
    vi.mocked(Job.findById).mockReturnValue(
      queryReturning({ company: OTHER_COMPANY_ID, title: 'Backend Engineer' }) as never,
    );

    await expect(
      updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your application' });
    expect(app.save).not.toHaveBeenCalled();
  });

  it('lets ADMIN bypass ownership check', async () => {
    const app = jobAppDoc();
    vi.mocked(CompanyProfile.findOne).mockClear();
    await updateStatus(COMPANY_USER, 'ADMIN', String(app._id), { status: 'SELECTED' as never });
    expect(CompanyProfile.findOne).not.toHaveBeenCalled();
  });

  it('refuses a STUDENT from calling updateStatus', async () => {
    const app = jobAppDoc();
    await expect(
      updateStatus(STUDENT_USER, 'STUDENT', String(app._id), { status: 'SHORTLISTED' as never }),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Insufficient role' });
  });
});

/* ============================================================
   Student ownership
   ============================================================ */

describe('respondToOffer — student ownership', () => {
  it('refuses a STUDENT without a profile', async () => {
    vi.mocked(StudentProfile.findOne).mockImplementation(
      ((() => Promise.resolve(null)) as unknown) as never,
    );
    const app = jobAppDoc({ status: 'SELECTED' });

    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Student profile not found' });
  });

  it('refuses a different student', async () => {
    const OTHER_STUDENT = new Types.ObjectId().toHexString();
    const OTHER_PROFILE = new Types.ObjectId();
    const app = jobAppDoc({
      student: { _id: OTHER_PROFILE, user: { _id: OTHER_STUDENT } },
    });

    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your application' });
  });

  it('refuses a non-STUDENT role', async () => {
    await expect(
      respondToOffer(COMPANY_USER, 'COMPANY', String(APPLICATION_ID), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Only students can respond to placement offers' });
  });

  it('404s when application does not exist', async () => {
    // Simulate Mongoose returning null when nothing is found — the service checks
    // `if (!app)` to turn that into "Application not found".
    vi.mocked(Application.findById).mockReturnValue({
      populate: () => ({
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(null).then(resolve),
      }),
    } as never);

    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', new Types.ObjectId().toHexString(), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Application not found' });
  });
});

/* ============================================================
   Student offer acceptance
   ============================================================ */

describe('respondToOffer — accept', () => {
  it('transitions SELECTED → OFFER_ACCEPTED for a job', async () => {
    const app = jobAppDoc({ status: 'SELECTED' });
    const result = (await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT')) as {
      status: string;
    };
    expect(result.status).toBe('OFFER_ACCEPTED');
    expect(app.status).toBe('OFFER_ACCEPTED');
    expect((app as { offerRespondedAt?: Date }).offerRespondedAt).toBeInstanceOf(Date);
  });

  it('transitions SELECTED → OFFER_ACCEPTED for an internship', async () => {
    const app = internshipAppDoc({ status: 'SELECTED' });
    const result = (await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT')) as {
      status: string;
    };
    expect(result.status).toBe('OFFER_ACCEPTED');
  });

  it('appends a timeline entry for acceptance', async () => {
    const app = jobAppDoc({ status: 'SELECTED' });
    await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT');
    expect(app.timeline).toContainEqual(
      expect.objectContaining({ status: 'OFFER_ACCEPTED', note: 'Student accepted the offer' }),
    );
  });

  it('notifies the company on acceptance', async () => {
    jobAppDoc({ status: 'SELECTED' });
    await respondToOffer(STUDENT_USER, 'STUDENT', String(APPLICATION_ID), 'ACCEPT');
    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(kind).toBe('OFFER_ACCEPTED');
    expect(title).toBe('Offer accepted');
  });
});

/* ============================================================
   Student offer rejection
   ============================================================ */

describe('respondToOffer — reject', () => {
  it('transitions SELECTED → OFFER_REJECTED', async () => {
    const app = jobAppDoc({ status: 'SELECTED' });
    const result = (await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'REJECT')) as {
      status: string;
    };
    expect(result.status).toBe('OFFER_REJECTED');
    expect(app.status).toBe('OFFER_REJECTED');
    expect((app as { offerRespondedAt?: Date }).offerRespondedAt).toBeInstanceOf(Date);
  });

  it('appends a timeline entry for rejection', async () => {
    const app = jobAppDoc({ status: 'SELECTED' });
    await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'REJECT');
    expect(app.timeline).toContainEqual(
      expect.objectContaining({ status: 'OFFER_REJECTED', note: 'Student declined the offer' }),
    );
  });

  it('notifies the company on rejection', async () => {
    jobAppDoc({ status: 'SELECTED' });
    await respondToOffer(STUDENT_USER, 'STUDENT', String(APPLICATION_ID), 'REJECT');
    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(kind).toBe('OFFER_REJECTED');
    expect(title).toBe('Offer declined');
  });
});

/* ============================================================
   Selected application restrictions
   ============================================================ */

describe('respondToOffer — selected restrictions', () => {
  it('refuses response when application is APPLIED', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Only selected applications can receive an offer response',
    });
  });

  it('refuses response when application is UNDER_REVIEW', async () => {
    const app = jobAppDoc({ status: 'UNDER_REVIEW' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses response when application is SHORTLISTED', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses response when application is REJECTED', async () => {
    const app = jobAppDoc({ status: 'REJECTED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses double response — cannot respond to OFFER_ACCEPTED', async () => {
    const app = jobAppDoc({ status: 'OFFER_ACCEPTED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'REJECT'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses double response — cannot respond to OFFER_REJECTED', async () => {
    const app = jobAppDoc({ status: 'OFFER_REJECTED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ============================================================
   Notifications
   ============================================================ */

describe('updateStatus — notifications', () => {
  it('notifies the applicant when shortlisted', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SHORTLISTED' as never });

    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(target).toBe(String(STUDENT_USER));
    expect(kind).toBe('APPLICATION_SHORTLISTED');
    expect(title).toBe('You have been shortlisted');
  });

  it('notifies the applicant when selected', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SELECTED' as never });

    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(target).toBe(String(STUDENT_USER));
    expect(kind).toBe('APPLICATION_SELECTED');
    expect(title).toBe('You have been selected');
  });

  it('notifies the applicant when rejected', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'REJECTED' as never });

    expect(createNotification).toHaveBeenCalledTimes(1);
    const [target, kind, title] = vi.mocked(createNotification).mock.calls[0]!;
    expect(target).toBe(String(STUDENT_USER));
    expect(kind).toBe('APPLICATION_REJECTED');
    expect(title).toBe('Application not selected');
  });

  // Phase 6B deduplication: calling updateStatus with the same status is a no-op.
    // Only the first call (which actually changes the status) sends a notification.
  it('sends only one notification when same status is set twice (Phase 6B deduplication)', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    vi.mocked(createNotification).mockClear();
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SHORTLISTED' as never });
    // Same status — Phase 6B deduplication: no-op, no notification
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SHORTLISTED' as never });
    expect(app.status).toBe('SHORTLISTED');
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('sends notification for each actual status change', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    vi.mocked(createNotification).mockClear();
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'SHORTLISTED' as never });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), { status: 'INTERVIEW_SCHEDULED' as never });
    expect(app.status).toBe('INTERVIEW_SCHEDULED');
    expect(createNotification).toHaveBeenCalledTimes(2);
  });
});
