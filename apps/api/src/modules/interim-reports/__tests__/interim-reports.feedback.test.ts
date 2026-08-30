/**
 * Phase 5B — interim report authorization and mentor feedback.
 *
 * The flow under test is:
 *
 *   Student submits report → Mentor reviews → Mentor feedback → Student notified
 *
 * Authorization has three guardrails:
 *   - only the student who applied can submit
 *   - the assigned mentor, the company, or an admin can review
 *   - everyone else (a different mentor, another student) is forbidden
 */
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
  InterimReport: { create: vi.fn(), find: vi.fn(), findById: vi.fn() },
  Application: { findById: vi.fn() },
  StudentProfile: { findOne: vi.fn(), findById: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
  Job: { findById: vi.fn() },
  Internship: { findById: vi.fn() },
  User: { findById: vi.fn() },
  MentorProfile: { findOne: vi.fn() },
}));

vi.mock('../../notifications/notifications.service', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}));

import {
  Application,
  InterimReport,
  Internship,
  StudentProfile,
  User,
} from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import {
  addMentorFeedback,
  createReport,
} from '../interim-reports.service';

const STUDENT_USER = new Types.ObjectId().toHexString();
const STUDENT_PROFILE = new Types.ObjectId();
const OTHER_STUDENT_USER = new Types.ObjectId().toHexString();
const OTHER_STUDENT_PROFILE = new Types.ObjectId();
const COMPANY_USER = new Types.ObjectId().toHexString();
const MENTOR_USER = new Types.ObjectId();
const OTHER_MENTOR_USER = new Types.ObjectId();
const APPLICATION_ID = new Types.ObjectId();
const REPORT_ID = new Types.ObjectId();

function applicationDoc(opts: { mentor?: Types.ObjectId; student?: Types.ObjectId; status?: string } = {}) {
  const doc = {
    _id: APPLICATION_ID,
    student: opts.student ?? STUDENT_PROFILE,
    mentor: opts.mentor ?? null,
    opportunityType: 'INTERNSHIP',
    opportunity: new Types.ObjectId(),
    status: opts.status ?? 'ONGOING',
  };
  // Chainable mock that supports both .select() and .then() (await)
  const chain = {
    select: () => Promise.resolve(doc),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve),
  };
  vi.mocked(Application.findById).mockReturnValue(chain as never);
  return doc;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The student profile lookup the service uses to verify ownership.
  vi.mocked(StudentProfile.findOne).mockImplementation(((filter: { user: unknown }) => {
    const value = filter && typeof filter === 'object' ? filter : {};
    const matchUser = String((value as { user: unknown }).user);
    const resolved =
      matchUser === STUDENT_USER
        ? { _id: STUDENT_PROFILE }
        : matchUser === OTHER_STUDENT_USER
          ? { _id: OTHER_STUDENT_PROFILE }
          : null;
    return {
      select: () => Promise.resolve(resolved),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    } as never;
  }) as never);
  vi.mocked(StudentProfile.findById).mockImplementation(((id: unknown) => {
    const resolved = { _id: id, fullName: 'Test Intern', user: STUDENT_USER };
    return {
      select: () => Promise.resolve(resolved),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    } as never;
  }) as never);
  vi.mocked(Internship.findById).mockImplementation((() => {
    const resolved = { _id: new Types.ObjectId(), title: 'Backend Intern', company: { user: COMPANY_USER } };
    const chain: Record<string, unknown> = {
      populate: () => chain,
      select: () => ({
        lean: () => Promise.resolve(resolved),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
      }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolved).then(resolve),
    };
    return chain;
  }) as never);
  vi.mocked(createNotification).mockResolvedValue(undefined as never);
});

describe('createReport — student ownership', () => {
  it('lets a student submit a report against their own application', async () => {
    applicationDoc();
    vi.mocked(InterimReport.create).mockImplementation(((data: Record<string, unknown>) => ({
      _id: REPORT_ID,
      ...data,
      toJSON() {
        return { id: String(this._id), ...this };
      },
    })) as never);

    const result = (await createReport(STUDENT_USER, APPLICATION_ID.toHexString(), {
      weekNumber: 1,
      workDescription: 'Built the dashboard',
    } as never)) as { weekNumber: number; workDescription: string };

    expect(result.weekNumber).toBe(1);
    expect(result.workDescription).toBe('Built the dashboard');
  });

  it('rejects a different student from submitting on someone else’s application', async () => {
    applicationDoc();
    await expect(
      createReport(OTHER_STUDENT_USER, APPLICATION_ID.toHexString(), {
        weekNumber: 1,
      } as never),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your application' });
    expect(InterimReport.create).not.toHaveBeenCalled();
  });

  it('rejects a report on a not-yet-active application', async () => {
    applicationDoc({ status: 'APPLIED' });
    await expect(
      createReport(STUDENT_USER, APPLICATION_ID.toHexString(), {
        weekNumber: 1,
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('addMentorFeedback — mentor authorization', () => {
  function reportDoc() {
    const doc = {
      _id: REPORT_ID,
      application: APPLICATION_ID,
      weekNumber: 4,
      mentorFeedback: undefined as string | undefined,
      mentorRating: undefined as number | undefined,
      save: vi.fn(function save(this: { _id: unknown; mentorFeedback?: string; mentorRating?: number }) {
        return Promise.resolve(this);
      }),
      toJSON() {
        return {
          _id: this._id,
          application: this.application,
          weekNumber: this.weekNumber,
          mentorFeedback: this.mentorFeedback,
          mentorRating: this.mentorRating,
        };
      },
    };
    vi.mocked(InterimReport.findById).mockReturnValue({
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve),
    } as never);
    return doc;
  }

  it('lets the assigned mentor provide feedback', async () => {
    applicationDoc({ mentor: MENTOR_USER });
    const doc = reportDoc();

    await addMentorFeedback(
      REPORT_ID.toHexString(),
      MENTOR_USER.toHexString(),
      'FACULTY',
      { mentorFeedback: 'Solid week', mentorRating: 4 },
    );

    expect(doc.mentorFeedback).toBe('Solid week');
    expect(doc.mentorRating).toBe(4);
    expect(doc.save).toHaveBeenCalled();
    expect(createNotification).toHaveBeenCalledTimes(1);
  });

  it('rejects a different mentor from providing feedback', async () => {
    applicationDoc({ mentor: MENTOR_USER });
    reportDoc();

    await expect(
      addMentorFeedback(
        REPORT_ID.toHexString(),
        OTHER_MENTOR_USER.toHexString(),
        'FACULTY',
        { mentorFeedback: 'Looks good' },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only COMPANY, assigned mentor, or ADMIN may provide feedback',
    });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('rejects a student from providing feedback on their own report', async () => {
    applicationDoc({ mentor: MENTOR_USER });
    reportDoc();

    await expect(
      addMentorFeedback(
        REPORT_ID.toHexString(),
        STUDENT_USER,
        'STUDENT',
        { mentorFeedback: 'Self-review' },
      ),
    ).rejects.toMatchObject({
      statusCode: 403,
      message: 'Only COMPANY, assigned mentor, or ADMIN may provide feedback',
    });
  });
});
