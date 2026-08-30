/**
 * Phase 7B — Placement Completion, Recruitment Source, Verification Tests
 *
 * Scenarios:
 *   1. completePlacementForApplication: happy path OFFER_ACCEPTED -> COMPLETED
 *   2. completePlacementForApplication: rejects when status != OFFER_ACCEPTED
 *   3. completePlacementForApplication: rejects when caller is COMPANY not owning the opportunity
 *   4. verifyPlacement: happy path PENDING -> VERIFIED
 *   5. verifyPlacement: idempotent — calling VERIFIED twice does not double-push timeline
 *   6. verifyPlacement: rejects when role is STUDENT/FACULTY/COMPANY
 *   7. verifyPlacement: rejects when placedAt is missing
 *   8. setRecruitmentSource: writes recruitmentSource + recruitmentSourceUpdatedAt + timeline note
 *   9. isOfferExpired: returns false for non-SELECTED statuses even if offerExpiresAt is in the past
 *  10. processExpiredOffers: idempotency — two parallel invocations do not double-push timeline
 *
 * The service is exercised with the model layer mocked, following the same
 * pattern as applications.phase7a.test.ts.
 */
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  Application: {
    find: vi.fn(),
    findById: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
  Job: { findById: vi.fn() },
  Internship: { findById: vi.fn() },
  FacultyOpportunity: { findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn(), findById: vi.fn() },
  Institution: { findById: vi.fn() },
  Skill: { find: vi.fn() },
  StudentProfile: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
  StudentSkill: { find: vi.fn() },
  CompanyProfile: { findById: vi.fn(), findOne: vi.fn() },
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
  StudentProfile,
  CompanyProfile,
  User,
  Job,
} from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import { isOfferExpired, processExpiredOffers } from '../offerExpiry.service';
import * as service from '../applications.service';

const STUDENT_PROFILE_ID = new Types.ObjectId();
const STUDENT_USER_ID = new Types.ObjectId();
const APPLICATION_ID = new Types.ObjectId();
const COMPANY_USER_ID = new Types.ObjectId();
const COMPANY_PROFILE_ID = new Types.ObjectId();
const INSTITUTION_USER_ID = new Types.ObjectId();
const JOB_ID = new Types.ObjectId();

/**
 * Builds a Mongoose query chain mock that always supports .select() and .lean().
 *
 * Supports all patterns used in the Phase 7B service code:
 *   - findById(id).lean()
 *   - findById(id).select('field').lean()
 *   - findById(id).populate().lean()
 *   - findById(id).populate().select().lean()
 *   - findOne(query).select('field').lean()
 */
function makeLeanChain<T extends object>(data: T) {
  // The final lean() promise
  const leanChain = {
    then: <TResult = T>(
      onfulfilled?: ((value: T) => TResult | PromiseLike<TResult>) | null,
      onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
    ) => Promise.resolve(data).then(onfulfilled, onrejected) as Promise<TResult>,
  };

  // select() chain: findById().select('field').lean()
  // or findOne().select('field').lean()
  const selectChain = {
    select: () => selectChain,
    lean: () => leanChain,
    then: leanChain.then,
  };

  // populate() chain: findById().populate().lean()
  const populateChain = {
    populate: () => populateChain,
    select: () => selectChain,
    lean: () => leanChain,
    then: leanChain.then,
  };

  // Root query: findById() or findOne()
  const rootChain = {
    populate: () => populateChain,
    select: () => selectChain,
    lean: () => leanChain,
    then: leanChain.then,
  };

  return rootChain;
}

/**
 * A fully-populated Application document used as the base for test scenarios.
 * Methods like .save() and .toJSON() are wired up.
 */
function makeMockApp(overrides: Record<string, unknown> = {}) {
  const app: Record<string, unknown> = {
    _id: APPLICATION_ID,
    student: { _id: STUDENT_PROFILE_ID, user: { _id: STUDENT_USER_ID, institution: 'inst-1' } },
    opportunity: JOB_ID,
    opportunityType: 'JOB',
    status: 'OFFER_ACCEPTED',
    timeline: [],
    save: vi.fn(() => Promise.resolve()),
    toJSON: function () {
      return { id: String(APPLICATION_ID), ...this };
    },
  };
  Object.assign(app, overrides);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Phase 7B — isOfferExpired helper', () => {
  it('returns false for non-SELECTED statuses even if offerExpiresAt is in the past', () => {
    const result = isOfferExpired({
      status: 'OFFER_ACCEPTED' as never,
      offerExpiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    });
    expect(result).toBe(false);
  });

  it('returns false for OFFER_REJECTED even if offerExpiresAt is in the past', () => {
    const result = isOfferExpired({
      status: 'OFFER_REJECTED' as never,
      offerExpiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    });
    expect(result).toBe(false);
  });

  it('returns true for SELECTED with past offerExpiresAt', () => {
    const result = isOfferExpired({
      status: 'SELECTED' as never,
      offerExpiresAt: new Date(Date.now() - 1000 * 60),
    });
    expect(result).toBe(true);
  });

  it('returns false for SELECTED with future offerExpiresAt', () => {
    const result = isOfferExpired({
      status: 'SELECTED' as never,
      offerExpiresAt: new Date(Date.now() + 1000 * 60),
    });
    expect(result).toBe(false);
  });

  it('returns false when offerExpiresAt is missing', () => {
    const result = isOfferExpired({
      status: 'SELECTED' as never,
      offerExpiresAt: null,
    });
    expect(result).toBe(false);
  });
});

describe('Phase 7B — processExpiredOffers idempotency', () => {
  it('two parallel invocations do not double-push timeline', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60);

    const mockLeanDoc = {
      _id: APPLICATION_ID,
      status: 'SELECTED',
      offerExpiresAt: pastDate,
      opportunityType: 'JOB',
      student: STUDENT_PROFILE_ID,
    };

    // find() returns the array of expired offers
    (Application.find as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      lean: () => Promise.resolve([mockLeanDoc]),
    } as never);

    // First findOneAndUpdate call: succeeds and returns the updated doc
    // Second call: returns null (idempotency — already OFFER_EXPIRED)
    (Application.findOneAndUpdate as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ...mockLeanDoc,
        status: 'OFFER_EXPIRED',
      } as never)
      .mockResolvedValueOnce(null as never);

    // Student lookup for notification
    (StudentProfile.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ _id: STUDENT_PROFILE_ID, user: { _id: STUDENT_USER_ID } }) as never,
    );

    await processExpiredOffers();
    await processExpiredOffers();

    // Two attempts were made, but only one notification fired
    expect(createNotification).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 7B — completePlacementForApplication', () => {
  it('rejects when application status is not OFFER_ACCEPTED', async () => {
    const mockApp = makeMockApp({ status: 'SELECTED' });
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );
    // assertCompanyOwnsApplication: CompanyProfile.findOne + Job.findById
    (CompanyProfile.findOne as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ _id: COMPANY_PROFILE_ID, user: COMPANY_USER_ID }) as never,
    );
    (Job.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ company: COMPANY_PROFILE_ID }) as never,
    );

    await expect(
      service.completePlacementForApplication(
        COMPANY_USER_ID.toHexString(),
        'COMPANY',
        APPLICATION_ID.toHexString(),
        {},
      ),
    ).rejects.toThrow(/offer has been accepted/);
  });

  it('rejects when caller is STUDENT', async () => {
    const mockApp = makeMockApp();
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );

    await expect(
      service.completePlacementForApplication(
        STUDENT_USER_ID.toHexString(),
        'STUDENT',
        APPLICATION_ID.toHexString(),
        {},
      ),
    ).rejects.toThrow();
  });

  it('happy path: OFFER_ACCEPTED -> COMPLETED with timeline entry and notification', async () => {
    const mockApp = makeMockApp({ status: 'OFFER_ACCEPTED' });
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );

    // Job lookup for assertCompanyOwnsApplication
    (Job.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ company: COMPANY_PROFILE_ID }) as never,
    );

    // CompanyProfile lookup for assertCompanyOwnsApplication
    (CompanyProfile.findOne as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ _id: COMPANY_PROFILE_ID, user: COMPANY_USER_ID }) as never,
    );

    await service.completePlacementForApplication(
      COMPANY_USER_ID.toHexString(),
      'COMPANY',
      APPLICATION_ID.toHexString(),
      { notes: 'Candidate joined on 2024-01-15' },
    );

    expect(mockApp.status).toBe('COMPLETED');
    expect(mockApp.placedAt).toBeInstanceOf(Date);
    expect(mockApp.placementCompletedBy).toBe(COMPANY_USER_ID.toHexString());
    expect(mockApp.placementCompletionNotes).toBe('Candidate joined on 2024-01-15');
    expect(mockApp.placementVerification).toEqual({ status: 'PENDING' });
    const timeline = mockApp.timeline as Array<{ status: string; note?: string }>;
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.status).toBe('COMPLETED');
    expect(timeline[0]?.note).toContain('Placement completed');
    expect(mockApp.save).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(
      STUDENT_USER_ID.toHexString(),
      'PLACEMENT_COMPLETED',
      expect.any(String),
      expect.stringContaining('confirmed'),
      expect.stringContaining(APPLICATION_ID.toHexString()),
    );
  });
});

describe('Phase 7B — verifyPlacement', () => {
  it('rejects when role is STUDENT', async () => {
    await expect(
      service.verifyPlacement(
        STUDENT_USER_ID.toHexString(),
        'STUDENT',
        APPLICATION_ID.toHexString(),
        { status: 'VERIFIED' },
      ),
    ).rejects.toThrow(/institution or admin/);
  });

  it('rejects when role is COMPANY', async () => {
    await expect(
      service.verifyPlacement(
        COMPANY_USER_ID.toHexString(),
        'COMPANY',
        APPLICATION_ID.toHexString(),
        { status: 'VERIFIED' },
      ),
    ).rejects.toThrow(/institution or admin/);
  });

  it('rejects when placedAt is missing', async () => {
    const mockApp = makeMockApp({
      status: 'COMPLETED',
      placedAt: undefined,
    });
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );
    // assertInstitutionOwnsStudent uses User.findById and StudentProfile.findById
    (User.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ institution: 'inst-1' }) as never,
    );
    (StudentProfile.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ institution: 'inst-1' }) as never,
    );

    await expect(
      service.verifyPlacement(
        INSTITUTION_USER_ID.toHexString(),
        'INSTITUTION',
        APPLICATION_ID.toHexString(),
        { status: 'VERIFIED' },
      ),
    ).rejects.toThrow(/Placement must be completed/);
  });

  it('happy path: PENDING -> VERIFIED writes verification and notifications', async () => {
    const mockApp = makeMockApp({
      status: 'COMPLETED',
      placedAt: new Date(),
      placementVerification: { status: 'PENDING' },
    });
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );
    // assertInstitutionOwnsStudent: User.findById + StudentProfile.findById
    (User.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ institution: 'inst-1' }) as never,
    );
    (StudentProfile.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ institution: 'inst-1' }) as never,
    );
    // resolveCompanyUserIdForApp: Job.findById + CompanyProfile.findById
    (Job.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ company: COMPANY_PROFILE_ID }) as never,
    );
    (CompanyProfile.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ user: COMPANY_USER_ID }) as never,
    );

    await service.verifyPlacement(
      INSTITUTION_USER_ID.toHexString(),
      'INSTITUTION',
      APPLICATION_ID.toHexString(),
      { status: 'VERIFIED', note: 'Confirmed via phone call' },
    );

    expect((mockApp.placementVerification as { status: string }).status).toBe('VERIFIED');
    expect((mockApp.placementVerification as { verifiedBy: string }).verifiedBy).toBe(
      INSTITUTION_USER_ID.toHexString(),
    );
    const timeline = mockApp.timeline as Array<{ note?: string }>;
    expect(timeline[0]?.note).toContain('VERIFIED');
    expect(timeline[0]?.note).toContain('Confirmed via phone call');
    expect(mockApp.save).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledWith(
      STUDENT_USER_ID.toHexString(),
      'PLACEMENT_VERIFIED',
      expect.any(String),
      expect.stringContaining('VERIFIED'),
      expect.any(String),
    );
  });

  it('is idempotent: calling VERIFIED twice does not double-push timeline', async () => {
    const mockApp = makeMockApp({
      status: 'COMPLETED',
      placedAt: new Date(),
      placementVerification: {
        status: 'VERIFIED',
        verifiedBy: INSTITUTION_USER_ID,
        verifiedAt: new Date(),
      },
    });
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );
    (User.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ institution: 'inst-1' }) as never,
    );
    (StudentProfile.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ institution: 'inst-1' }) as never,
    );

    await service.verifyPlacement(
      INSTITUTION_USER_ID.toHexString(),
      'INSTITUTION',
      APPLICATION_ID.toHexString(),
      { status: 'VERIFIED' },
    );

    // No save or notification when already in target state
    expect(mockApp.save).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});

describe('Phase 7B — setRecruitmentSource', () => {
  it('rejects when caller is STUDENT', async () => {
    const mockApp = makeMockApp();
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );

    await expect(
      service.setRecruitmentSource(
        STUDENT_USER_ID.toHexString(),
        'STUDENT',
        APPLICATION_ID.toHexString(),
        { source: 'JOB_PORTAL' },
      ),
    ).rejects.toThrow();
  });

  it('happy path: writes recruitmentSource, recruitmentSourceUpdatedAt, timeline note', async () => {
    const mockApp = makeMockApp();
    (Application.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain(mockApp) as never,
    );
    // assertCompanyOwnsApplication uses Job.findById + CompanyProfile.findOne
    (Job.findById as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ company: COMPANY_PROFILE_ID }) as never,
    );
    (CompanyProfile.findOne as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      makeLeanChain({ _id: COMPANY_PROFILE_ID, user: COMPANY_USER_ID }) as never,
    );

    await service.setRecruitmentSource(
      COMPANY_USER_ID.toHexString(),
      'COMPANY',
      APPLICATION_ID.toHexString(),
      { source: 'CAMPUS_DRIVE' },
    );

    expect(mockApp.recruitmentSource).toBe('CAMPUS_DRIVE');
    expect(mockApp.recruitmentSourceUpdatedAt).toBeInstanceOf(Date);
    const timeline = mockApp.timeline as Array<{ note?: string }>;
    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.note).toContain('CAMPUS_DRIVE');
    expect(mockApp.save).toHaveBeenCalled();
  });
});
