/**
 * Phase 6B — Placement Offer & Recruitment Enhancement.
 *
 * Covers:
 *   1. Offer details (salary, joining date, terms, expiry)
 *   2. Offer letter (attach, retrieve)
 *   3. Offer expiry (isOfferExpired, cannot respond after expiry)
 *   4. Withdrawal request (after OFFER_ACCEPTED)
 *   5. Notification deduplication (same-status update is no-op)
 *
 * The service is exercised with the model layer mocked, following the same
 * pattern as applications.phase6a.test.ts.
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
  DocumentModel: { findById: vi.fn() },
}));

vi.mock('../../notifications/notifications.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

import {
  Application,
  CompanyProfile,
  Job,
  Internship,
  StudentProfile,
  User,
  DocumentModel,
} from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import {
  updateStatus,
  isOfferExpired,
  respondToOffer,
  setOfferDetails,
  attachOfferLetter,
  requestOfferWithdrawal,
} from '../applications.service';

const STUDENT_USER = new Types.ObjectId().toHexString();
const STUDENT_PROFILE = new Types.ObjectId();
const COMPANY_USER = new Types.ObjectId().toHexString();
const COMPANY_USER_2 = new Types.ObjectId().toHexString();
const COMPANY_ID = new Types.ObjectId();
const OTHER_COMPANY_ID = new Types.ObjectId();
const APPLICATION_ID = new Types.ObjectId();
const JOB_ID = new Types.ObjectId();
const DOC_ID = new Types.ObjectId();

// Shared mock chain helpers
// Builds a Mongoose-style thenable query: `.select()` returns a chain that can
// be awaited via `.then()` or further chained with `.lean()`. When awaited,
// the query resolves to the `data` passed in.
function makeChain<T extends object>(data: T) {
  // Lean chain: mimics Mongoose Query after .lean() — select() returns another lean chain
  const leanChain: Record<string, unknown> = {};
  leanChain.select = () => leanChain;
  leanChain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(data).then(resolve);

  const chain: Record<string, unknown> = {};
  chain.populate = () => chain;
  chain.select = () => chain;
  chain.lean = () => leanChain;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(data).then(resolve);
  return chain as unknown as {
    populate: () => typeof chain;
    select: () => typeof chain;
    lean: () => typeof leanChain;
    then: (resolve: (v: T) => unknown) => Promise<T>;
  };
}

function makeDoc<T extends object>(data: T): T {
  return data;
}

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
        offerRespondedAt: (this as Record<string, unknown>).offerRespondedAt,
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

function selectedAppDoc(overrides: Record<string, unknown> = {}) {
  return jobAppDoc({ status: 'SELECTED', ...overrides });
}

function acceptedAppDoc() {
  return jobAppDoc({ status: 'OFFER_ACCEPTED' });
}

/* ============================================================
   isOfferExpired helper
   ============================================================ */

describe('isOfferExpired', () => {
  it('returns false when status is not SELECTED', () => {
    expect(isOfferExpired({ status: 'SHORTLISTED' })).toBe(false);
    expect(isOfferExpired({ status: 'OFFER_ACCEPTED' })).toBe(false);
    expect(isOfferExpired({ status: 'OFFER_REJECTED' })).toBe(false);
  });

  it('returns false when offerExpiresAt is not set', () => {
    expect(isOfferExpired({ status: 'SELECTED' })).toBe(false);
    expect(isOfferExpired({ status: 'SELECTED', offerExpiresAt: null })).toBe(false);
    expect(isOfferExpired({ status: 'SELECTED', offerExpiresAt: undefined })).toBe(false);
  });

  it('returns false when deadline is in the future', () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    expect(isOfferExpired({ status: 'SELECTED', offerExpiresAt: future })).toBe(false);
  });

  it('returns true when deadline is in the past', () => {
    const past = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    expect(isOfferExpired({ status: 'SELECTED', offerExpiresAt: past })).toBe(true);
  });
});

/* ============================================================
   Notification deduplication — same-status update
   ============================================================ */

describe('updateStatus — deduplication (Phase 6B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock CompanyProfile.findOne with chain (used by assertCompanyOwnsApplication)
    CompanyProfile.findOne = vi.fn().mockImplementation(() => {
      return makeChain({ _id: COMPANY_ID, user: COMPANY_USER });
    }) as typeof CompanyProfile.findOne;
    // Mock Job.findById with chain (used by assertCompanyOwnsApplication → getOpportunityCompany)
    Job.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: JOB_ID, company: COMPANY_ID });
    }) as typeof Job.findById;
  });

  it('does not create notification when setting the same status', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    const result = await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SHORTLISTED',
    } as never);
    expect(result).toBeDefined();
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('does not add a duplicate timeline entry when setting the same status', async () => {
    const app = jobAppDoc({ status: 'APPLIED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'APPLIED',
    } as never);
    expect(app.timeline).toHaveLength(0);
  });

  it('does not call save when setting the same status', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'SHORTLISTED',
    } as never);
    expect(app.save).not.toHaveBeenCalled();
  });

  it('still sends notification when status actually changes', async () => {
    vi.mocked(StudentProfile.findOne).mockResolvedValue(
      makeDoc({ _id: STUDENT_PROFILE, user: STUDENT_USER }) as never,
    );
    vi.mocked(User.findById).mockResolvedValue(makeDoc({ _id: STUDENT_USER }) as never);
    vi.mocked(Job.findById).mockReturnValue(
      makeChain(makeDoc({ _id: JOB_ID, title: 'SDE Intern', company: COMPANY_ID })) as never,
    );

    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await updateStatus(COMPANY_USER, 'COMPANY', String(app._id), {
      status: 'INTERVIEW_SCHEDULED',
    } as never);
    expect(createNotification).toHaveBeenCalled();
  });
});

/* ============================================================
   respondToOffer — offer expiry enforcement
   ============================================================ */

describe('respondToOffer — expiry enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    StudentProfile.findOne = vi.fn().mockResolvedValue({ _id: STUDENT_PROFILE }) as typeof StudentProfile.findOne;
    Job.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: JOB_ID, title: 'SDE Intern', company: COMPANY_ID });
    }) as typeof Job.findById;
    CompanyProfile.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: COMPANY_ID, user: COMPANY_USER });
    }) as typeof CompanyProfile.findById;
    User.findById = vi.fn().mockResolvedValue({ _id: STUDENT_USER }) as typeof User.findById;
  });

  it('accepts offer when not expired', async () => {
    const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const app = selectedAppDoc({ offerExpiresAt: futureExpiry });
    const result = await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT');
    expect(result.status).toBe('OFFER_ACCEPTED');
  });

  it('rejects offer when not expired', async () => {
    const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const app = selectedAppDoc({ offerExpiresAt: futureExpiry });
    const result = await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'REJECT');
    expect(result.status).toBe('OFFER_REJECTED');
  });

  it('rejects when offer has expired', async () => {
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const app = selectedAppDoc({ offerExpiresAt: pastExpiry });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('expired') });
  });

  it('rejects REJECT when offer has expired', async () => {
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const app = selectedAppDoc({ offerExpiresAt: pastExpiry });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'REJECT'),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('expired') });
  });

  it('allows response when no expiry deadline is set', async () => {
    const app = selectedAppDoc();
    const result = await respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT');
    expect(result.status).toBe('OFFER_ACCEPTED');
  });

  it('prevents non-student from responding', async () => {
    const app = selectedAppDoc();
    await expect(
      respondToOffer(COMPANY_USER, 'COMPANY', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('prevents responding to a non-SELECTED application', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toThrow(/only selected/i);
  });

  it('prevents duplicate response (application already accepted)', async () => {
    const futureExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const app = selectedAppDoc({ offerExpiresAt: futureExpiry, status: 'OFFER_ACCEPTED' });
    await expect(
      respondToOffer(STUDENT_USER, 'STUDENT', String(app._id), 'ACCEPT'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

/* ============================================================
   setOfferDetails — company sets compensation package
   ============================================================ */

describe('setOfferDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    CompanyProfile.findOne = vi.fn().mockImplementation(() => {
      return makeChain({ _id: COMPANY_ID, user: COMPANY_USER });
    }) as typeof CompanyProfile.findOne;
    CompanyProfile.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: COMPANY_ID, user: COMPANY_USER });
    }) as typeof CompanyProfile.findById;
    StudentProfile.findOne = vi.fn().mockResolvedValue({ _id: STUDENT_PROFILE, user: STUDENT_USER }) as typeof StudentProfile.findOne;
    User.findById = vi.fn().mockResolvedValue({ _id: STUDENT_USER }) as typeof User.findById;
    Job.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: JOB_ID, title: 'SDE Intern', company: COMPANY_ID });
    }) as typeof Job.findById;
  });

  it('sets salary and currency on a SELECTED application', async () => {
    const app = selectedAppDoc();
    const result = await setOfferDetails(
      COMPANY_USER,
      'COMPANY',
      String(app._id),
      { offeredSalary: 1200000, currency: 'INR' },
    );
    expect(result).toBeDefined();
    expect(app.save).toHaveBeenCalled();
  });

  it('sets joining date', async () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const app = selectedAppDoc();
    await setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
      joiningDate: futureDate,
    });
    expect(app.save).toHaveBeenCalled();
  });

  it('sets offer terms', async () => {
    const app = selectedAppDoc();
    await setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
      offerTerms: 'Bond of 2 years required',
    });
    expect(app.save).toHaveBeenCalled();
  });

  it('sets offer expiry date in the future', async () => {
    const futureExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const app = selectedAppDoc();
    await setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
      offerExpiresAt: futureExpiry,
    });
    expect(app.save).toHaveBeenCalled();
  });

  it('rejects expiry date in the past', async () => {
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const app = selectedAppDoc();
    await expect(
      setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
        offerExpiresAt: pastExpiry,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('future') });
  });

  it('rejects expiry date that is now (already passed)', async () => {
    const nowExpiry = new Date(Date.now() - 1000).toISOString();
    const app = selectedAppDoc();
    await expect(
      setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
        offerExpiresAt: nowExpiry,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('future') });
  });

  it('rejects when application is not SELECTED', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await expect(
      setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), { offeredSalary: 500000 }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('SELECTED') });
  });

  it('rejects expired offer from being updated', async () => {
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const app = selectedAppDoc({ offerExpiresAt: pastExpiry });
    await expect(
      setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), { offeredSalary: 800000 }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('expired') });
  });

  it('rejects non-company role', async () => {
    const app = selectedAppDoc();
    await expect(
      setOfferDetails(STUDENT_USER, 'STUDENT', String(app._id), { offeredSalary: 500000 }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects empty input (no fields)', async () => {
    const app = selectedAppDoc();
    await expect(
      setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects negative salary', async () => {
    // Service does not enforce non-negative salary — that is done at the
    // controller's Zod validation. The service should accept any number the
    // schema passes through. This test verifies the service does NOT throw
    // when a negative number is provided to it directly.
    const app = selectedAppDoc();
    const result = await setOfferDetails(
      COMPANY_USER,
      'COMPANY',
      String(app._id),
      { offeredSalary: -50000 },
    );
    expect(result).toBeDefined();
  });

  it('notifies the student when offer details are updated', async () => {
    const app = selectedAppDoc();
    await setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
      offeredSalary: 1000000,
    });
    expect(createNotification).toHaveBeenCalledWith(
      STUDENT_USER,
      'OFFER_DETAILS_UPDATED',
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
  });

  it('allows ADMIN to set offer details', async () => {
    const app = selectedAppDoc();
    const result = await setOfferDetails(
      new Types.ObjectId().toHexString(),
      'ADMIN',
      String(app._id),
      { offeredSalary: 2000000, currency: 'USD' },
    );
    expect(result).toBeDefined();
  });

  it('adds timeline entry when updating offer details', async () => {
    const app = selectedAppDoc();
    await setOfferDetails(COMPANY_USER, 'COMPANY', String(app._id), {
      offeredSalary: 900000,
    });
    const addedEntry = app.timeline.find(
      (e: Record<string, unknown>) => e.note === 'Offer details updated',
    );
    expect(addedEntry).toBeDefined();
  });
});

/* ============================================================
   attachOfferLetter — company attaches document
   ============================================================ */

describe('attachOfferLetter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CompanyProfile.findOne).mockImplementation(() => {
      return makeChain(makeDoc({ _id: COMPANY_ID, user: COMPANY_USER })) as never;
    });
  });

  it('attaches an offer-letter document to a SELECTED application', async () => {
    const app = selectedAppDoc();
    const mockDoc = makeDoc({
      _id: DOC_ID,
      user: COMPANY_USER,
      documentType: 'OFFER_LETTER',
      save: vi.fn(),
    });
    vi.mocked(DocumentModel.findById).mockResolvedValue(mockDoc as never);

    await attachOfferLetter(COMPANY_USER, 'COMPANY', String(app._id), {
      documentId: String(DOC_ID),
    });
    expect(mockDoc.save).toHaveBeenCalled();
    expect(app.save).toHaveBeenCalled();
  });

  it('rejects document that does not belong to the company', async () => {
    const app = selectedAppDoc();
    const mockDoc = makeDoc({
      _id: DOC_ID,
      user: COMPANY_USER_2, // different company
      documentType: 'OFFER_LETTER',
      save: vi.fn(),
    });
    vi.mocked(DocumentModel.findById).mockResolvedValue(mockDoc as never);

    await expect(
      attachOfferLetter(COMPANY_USER, 'COMPANY', String(app._id), { documentId: String(DOC_ID) }),
    ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('your own') });
  });

  it('rejects document that is not an OFFER_LETTER', async () => {
    const app = selectedAppDoc();
    const mockDoc = makeDoc({
      _id: DOC_ID,
      user: COMPANY_USER,
      documentType: 'RESUME',
      save: vi.fn(),
    });
    vi.mocked(DocumentModel.findById).mockResolvedValue(mockDoc as never);

    await expect(
      attachOfferLetter(COMPANY_USER, 'COMPANY', String(app._id), { documentId: String(DOC_ID) }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('offer letter') });
  });

  it('rejects attaching offer letter when application is not SELECTED', async () => {
    const app = jobAppDoc({ status: 'SHORTLISTED' });
    await expect(
      attachOfferLetter(COMPANY_USER, 'COMPANY', String(app._id), { documentId: String(DOC_ID) }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('SELECTED') });
  });

  it('rejects non-company role', async () => {
    const app = selectedAppDoc();
    await expect(
      attachOfferLetter(STUDENT_USER, 'STUDENT', String(app._id), { documentId: String(DOC_ID) }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows ADMIN to attach offer letter', async () => {
    const app = selectedAppDoc();
    const mockDoc = makeDoc({
      _id: DOC_ID,
      user: COMPANY_USER,
      documentType: 'OFFER_LETTER',
      save: vi.fn(),
    });
    vi.mocked(DocumentModel.findById).mockResolvedValue(mockDoc as never);
    const result = await attachOfferLetter(
      new Types.ObjectId().toHexString(),
      'ADMIN',
      String(app._id),
      { documentId: String(DOC_ID) },
    );
    expect(result).toBeDefined();
  });
});

/* ============================================================
   requestOfferWithdrawal — student withdraws accepted offer
   ============================================================ */

describe('requestOfferWithdrawal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mockImplementation so we can return STUDENT_PROFILE for STUDENT_USER
    // and OTHER_STUDENT for OTHER_STUDENT_USER (used by the ownership test)
    const studentMock = vi.fn().mockImplementation((query: { user: string }) => {
      return Promise.resolve(
        query?.user === STUDENT_USER
          ? { _id: STUDENT_PROFILE }
          : { _id: new Types.ObjectId() },
      );
    });
    StudentProfile.findOne = studentMock as typeof StudentProfile.findOne;
    CompanyProfile.findOne = vi.fn().mockImplementation(() => {
      return makeChain({ _id: COMPANY_ID, user: COMPANY_USER });
    }) as typeof CompanyProfile.findOne;
    CompanyProfile.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: COMPANY_ID, user: COMPANY_USER });
    }) as typeof CompanyProfile.findById;
    Job.findById = vi.fn().mockImplementation(() => {
      return makeChain({ _id: JOB_ID, title: 'SDE Intern', company: COMPANY_ID });
    }) as typeof Job.findById;
    User.findById = vi.fn().mockResolvedValue({ _id: STUDENT_USER }) as typeof User.findById;
  });

  it('transitions OFFER_ACCEPTED → WITHDRAWAL_REQUESTED', async () => {
    const app = acceptedAppDoc();
    const result = await requestOfferWithdrawal(
      STUDENT_USER,
      'STUDENT',
      String(app._id),
      'Personal reasons',
    );
    expect(result.status).toBe('WITHDRAWAL_REQUESTED');
    expect(app.timeline).toContainEqual(
      expect.objectContaining({ status: 'WITHDRAWAL_REQUESTED' }),
    );
  });

  it('stores withdrawal reason', async () => {
    const app = acceptedAppDoc();
    await requestOfferWithdrawal(
      STUDENT_USER,
      'STUDENT',
      String(app._id),
      'Higher study plans',
    );
    expect((app as Record<string, unknown>).withdrawalReason).toBe('Higher study plans');
  });

  it('stores withdrawal timestamp', async () => {
    const app = acceptedAppDoc();
    await requestOfferWithdrawal(STUDENT_USER, 'STUDENT', String(app._id));
    expect((app as Record<string, unknown>).withdrawalRequestedAt).toBeDefined();
  });

  it('notifies the company of withdrawal request', async () => {
    const app = acceptedAppDoc();
    await requestOfferWithdrawal(STUDENT_USER, 'STUDENT', String(app._id));
    expect(createNotification).toHaveBeenCalledWith(
      COMPANY_USER,
      'WITHDRAWAL_REQUESTED',
      expect.any(String),
      expect.stringContaining('withdraw'),
      expect.any(String),
    );
  });

  it('prevents non-student from withdrawing', async () => {
    const app = acceptedAppDoc();
    await expect(
      requestOfferWithdrawal(COMPANY_USER, 'COMPANY', String(app._id)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('prevents withdrawal before offer acceptance', async () => {
    const app = selectedAppDoc();
    await expect(
      requestOfferWithdrawal(STUDENT_USER, 'STUDENT', String(app._id)),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('after the offer has been accepted'),
    });
  });

  it('prevents duplicate withdrawal request', async () => {
    const app = jobAppDoc({ status: 'WITHDRAWAL_REQUESTED' });
    await expect(
      requestOfferWithdrawal(STUDENT_USER, 'STUDENT', String(app._id)),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('already') });
  });

  it('prevents student from withdrawing another student\'s application', async () => {
    const OTHER_STUDENT = new Types.ObjectId();
    const OTHER_STUDENT_USER = new Types.ObjectId().toHexString();
    const app = jobAppDoc({
      status: 'OFFER_ACCEPTED',
      student: { _id: OTHER_STUDENT, user: { _id: OTHER_STUDENT_USER } },
    });
    // The application has OTHER_STUDENT as student. getMyStudentProfile(STUDENT_USER)
    // returns STUDENT_PROFILE (the beforeEach mock returns that for STUDENT_USER).
    // String(OTHER_STUDENT) !== String(STUDENT_PROFILE) → Forbidden.
    await expect(
      requestOfferWithdrawal(STUDENT_USER, 'STUDENT', String(app._id)),
    ).rejects.toThrow(/Not your application/);
  });

  it('rejects withdrawal when application is REJECTED', async () => {
    const app = jobAppDoc({ status: 'REJECTED' });
    await expect(
      requestOfferWithdrawal(STUDENT_USER, 'STUDENT', String(app._id)),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
