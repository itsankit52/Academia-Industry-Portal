/**
 * Phase 5B — Post-ONGOING internship lifecycle.
 *
 * The transitions the spec asks for:
 *
 *   ONGOING → mentor assignment → progress reports → mentor feedback
 *          → COMPLETED → certificate → portfolio
 *
 * The service is exercised here with the model layer mocked, the same way
 * applications.status.test.ts does, because the unit we're testing is the
 * authorization and lifecycle glue around Mongoose — not the database.
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

import { Application, CompanyProfile, Internship, MentorProfile, User } from '../../../models';
import { createNotification } from '../../notifications/notifications.service';
import {
  assignMentorToApplication,
  completeInternshipForApplication,
  removeMentorFromApplication,
} from '../applications.service';

const COMPANY_USER = new Types.ObjectId().toHexString();
const COMPANY_ID = new Types.ObjectId();
const INTERNSHIP_ID = new Types.ObjectId();
const STUDENT_USER = new Types.ObjectId();
const STUDENT_PROFILE = new Types.ObjectId();
const MENTOR_USER = new Types.ObjectId();
const APPLICATION_ID = new Types.ObjectId();

function applicationDoc(status: string) {
  // The doc tracks what the service mutates; `save()` returns `this` so the
  // service's error checks (which happen after save) see the mutated state.
  const doc: Record<string, unknown> = {
    _id: APPLICATION_ID,
    opportunity: INTERNSHIP_ID,
    opportunityType: 'INTERNSHIP',
    status,
    mentor: null as unknown,
    mentorAssignedAt: null as unknown,
    timeline: [] as Array<Record<string, unknown>>,
    startedAt: new Date('2026-08-01'),
    startDate: new Date('2026-08-01'),
    expectedEndDate: new Date('2026-12-01'),
    student: { user: { _id: STUDENT_USER } },
    save: vi.fn(function save(this: Record<string, unknown>) {
      return Promise.resolve(this);
    }),
    toJSON(): Record<string, unknown> {
      return {
        id: String(this._id),
        status: this.status,
        timeline: this.timeline,
        mentor: this.mentor,
      };
    },
  };
  const chain: Record<string, unknown> = {};
  chain.populate = () => chain;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
  vi.mocked(Application.findById).mockReturnValue(chain as never);
  return doc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(CompanyProfile.findOne).mockImplementation((() =>
    Promise.resolve({ _id: COMPANY_ID })) as never);
  // Phase 14A: CompanyProfile.findById is called with .select('user').lean()
  // by resolveCompanyUserIdForApp — return a chainable Query mock.
  vi.mocked(CompanyProfile.findById).mockImplementation((() => {
    const doc = { _id: COMPANY_ID, user: COMPANY_USER };
    const chain: Record<string, unknown> = {};
    chain.lean = () => Promise.resolve(doc);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
    return { select: () => chain };
  }) as never);
  // Dual-shape mock: supports both `.select(...).lean()` (used by
  // resolveCompanyUserIdForApp) and the existing `.select(...)` chain that
  // pre-Phase-14A code awaited directly.
  vi.mocked(Internship.findById).mockImplementation((() => {
    const doc = { _id: INTERNSHIP_ID, company: COMPANY_ID, title: 'Backend Intern' };
    const chain: Record<string, unknown> = {};
    chain.lean = () => Promise.resolve(doc);
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
    return {
      select: () => chain,
    };
  }) as never);
  vi.mocked(MentorProfile.findOne).mockImplementation((() =>
    Promise.resolve({ user: MENTOR_USER, expertise: ['node', 'react'] })) as never);
  vi.mocked(User.findById).mockImplementation((() => ({
    select: () =>
      Promise.resolve({ _id: MENTOR_USER, email: 'mentor@example.com', role: 'FACULTY' }),
  })) as never);
  vi.mocked(createNotification).mockResolvedValue(undefined as never);
});

describe('Phase 5B — ONGOING → COMPLETED transition', () => {
  it('lets the owning company complete an ONGOING internship', async () => {
    const app = applicationDoc('ONGOING');
    // Assign a mentor so the Phase 14A mentor-completion notification fires.
    app.mentor = MENTOR_USER;

    const result = (await completeInternshipForApplication(
      COMPANY_USER,
      'COMPANY',
      String(APPLICATION_ID),
      { completionNotes: 'Great intern' },
    )) as { status: string };

    expect(result.status).toBe('COMPLETED');
    expect(app.status).toBe('COMPLETED');
    expect((app as { completedAt?: Date }).completedAt).toBeInstanceOf(Date);
    expect((app as { save: () => unknown }).save).toHaveBeenCalled();
    // Phase 14A: Four notifications now sent — completion + certificate for student,
    // plus completion notifications to assigned mentor and owning company.
    expect(createNotification).toHaveBeenCalledTimes(4);
  });

  it('refuses completion when the application is not ONGOING', async () => {
    applicationDoc('SELECTED');
    await expect(
      completeInternshipForApplication(COMPANY_USER, 'COMPANY', String(APPLICATION_ID), {}),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('refuses completion from a company that does not own the internship', async () => {
    applicationDoc('ONGOING');
    // The owning company is COMPANY_ID; this one resolves a different id.
    vi.mocked(Internship.findById).mockImplementation((() => {
      const doc = { _id: INTERNSHIP_ID, company: new Types.ObjectId() };
      const chain: Record<string, unknown> = {};
      chain.lean = () => Promise.resolve(doc);
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
      return { select: () => chain };
    }) as never);

    await expect(
      completeInternshipForApplication(COMPANY_USER, 'COMPANY', String(APPLICATION_ID), {}),
    ).rejects.toMatchObject({ statusCode: 403, message: 'Not your application' });
  });
});

describe('Phase 5B — Mentor assignment', () => {
  it('lets the owning company assign a mentor to an ONGOING internship', async () => {
    const app = applicationDoc('ONGOING');

    const result = (await assignMentorToApplication(
      COMPANY_USER,
      'COMPANY',
      String(APPLICATION_ID),
      { mentorUserId: MENTOR_USER.toHexString() },
    )) as { mentor: unknown };

    // The serialized form renders the mentor as an ObjectId — the value the
    // service actually wrote — not a hex string.
    expect(String(result.mentor)).toBe(String(MENTOR_USER));
    expect((app as { mentorAssignedAt?: Date }).mentorAssignedAt).toBeInstanceOf(Date);
    // Two notifications: student + mentor
    expect(createNotification).toHaveBeenCalledTimes(2);
  });

  it('rejects a mentor who has no MentorProfile', async () => {
    applicationDoc('ONGOING');
    vi.mocked(MentorProfile.findOne).mockImplementation((() => Promise.resolve(null)) as never);

    await expect(
      assignMentorToApplication(COMPANY_USER, 'COMPANY', String(APPLICATION_ID), {
        mentorUserId: MENTOR_USER.toHexString(),
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'The selected user is not registered as a mentor',
    });
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('rejects assignment for an application that has not started yet', async () => {
    applicationDoc('SELECTED');
    await expect(
      assignMentorToApplication(COMPANY_USER, 'COMPANY', String(APPLICATION_ID), {
        mentorUserId: MENTOR_USER.toHexString(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('lets the owning company remove a mentor', async () => {
    const app = applicationDoc('ONGOING');
    app.mentor = MENTOR_USER;

    await removeMentorFromApplication(COMPANY_USER, 'COMPANY', String(APPLICATION_ID));

    expect(app.mentor).toBeUndefined();
    expect((app as { mentorAssignedAt?: Date }).mentorAssignedAt).toBeUndefined();
  });

  it('refuses to remove a mentor from a different company', async () => {
    const app = applicationDoc('ONGOING');
    app.mentor = MENTOR_USER;
    vi.mocked(Internship.findById).mockImplementation((() => {
      const doc = { _id: INTERNSHIP_ID, company: new Types.ObjectId() };
      const chain: Record<string, unknown> = {};
      chain.lean = () => Promise.resolve(doc);
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
      return { select: () => chain };
    }) as never);

    await expect(
      removeMentorFromApplication(COMPANY_USER, 'COMPANY', String(APPLICATION_ID)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
