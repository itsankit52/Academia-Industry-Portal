import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../models', () => ({
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
  FacultyOpportunity,
  FacultyProfile,
  Internship,
  Job,
  StudentProfile,
  User,
} from '../../../models';
import { getStudentEmail, getStudentName, type Application as ApplicationView } from '@aip/types';
import {
  listApplications,
  getApplicationById,
  summarizeApplication,
} from '../applications.service';

/**
 * Why the company-side applicant lists rendered every candidate as "—".
 *
 * `listApplications` reads the applications straight out of the collection
 * without populating the applicant, so `student` serialized to a bare ObjectId
 * string. `getStudentName()` in `@aip/types` only has a name to show when that
 * slot holds an object, so it fell through to its "—" placeholder for every row
 * — and the placeholder looked like missing data rather than a missing join.
 *
 * These tests drive the serialization layer and then hand the result to the very
 * helpers the pages call, so a regression at either end fails here. The helpers
 * are imported rather than reimplemented on purpose: asserting on `fullName`
 * directly would keep passing if the shared contract moved underneath the pages.
 */

const COMPANY_USER = new Types.ObjectId().toHexString();
const COMPANY_ID = new Types.ObjectId();
const JOB_ID = new Types.ObjectId();
const FACULTY_OPP_ID = new Types.ObjectId();

const STUDENT_PROFILE = new Types.ObjectId();
const STUDENT_USER = new Types.ObjectId();
const FACULTY_PROFILE = new Types.ObjectId();
const FACULTY_USER = new Types.ObjectId();

const EMAILS = new Map<string, string>([
  [String(STUDENT_USER), 'asha.menon@example.edu'],
  [String(FACULTY_USER), 'dr.rao@example.edu'],
]);

/** `Model.findById(id).select(...).lean()` */
function leanFindById(rows: Map<string, Record<string, unknown> | null>) {
  return ((id: unknown) => ({
    select: () => ({ lean: () => Promise.resolve(rows.get(String(id)) ?? null) }),
    // `summarizeApplication` calls `.select(...).lean()`; nothing here needs the
    // bare-promise form, so leaving it off keeps the double actually double.
  })) as never;
}

/** One row as it leaves Mongoose: a document whose `toJSON` applied the transform. */
function applicationRow(overrides: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  const json = {
    id: String(_id),
    student: String(STUDENT_PROFILE),
    opportunityType: 'JOB',
    opportunity: String(JOB_ID),
    status: 'APPLIED',
    timeline: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
  return { _id, toJSON: () => ({ ...json }) };
}

function mockApplicationFind(rows: ReturnType<typeof applicationRow>[]) {
  const chain = {
    sort: () => chain,
    skip: () => chain,
    limit: () => Promise.resolve(rows),
  } as Record<string, unknown>;
  vi.mocked(Application.find).mockReturnValue(chain as never);
  vi.mocked(Application.countDocuments).mockResolvedValue(rows.length as never);
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(CompanyProfile.findOne).mockImplementation((() =>
    Promise.resolve({ _id: COMPANY_ID })) as never);

  // The company owns exactly one job and one faculty-facing posting.
  vi.mocked(Job.find).mockReturnValue({
    select: () => Promise.resolve([{ _id: JOB_ID }]),
  } as never);
  vi.mocked(Internship.find).mockReturnValue({ select: () => Promise.resolve([]) } as never);
  vi.mocked(FacultyOpportunity.find).mockReturnValue({
    select: () => Promise.resolve([{ _id: FACULTY_OPP_ID, opportunityType: 'FDP' }]),
  } as never);

  vi.mocked(Job.findById).mockReturnValue({
    // `.select('company')` is awaited directly by the ownership checks, while the
    // serialization path continues `.populate(...).lean()`; one double serves both.
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
        Promise.resolve({ _id: JOB_ID, company: COMPANY_ID, title: 'Backend Engineer' }).then(
          resolve,
        ),
    }),
  } as never);
  vi.mocked(FacultyOpportunity.findById).mockReturnValue({
    select: () => ({
      lean: () =>
        Promise.resolve({
          _id: FACULTY_OPP_ID,
          title: 'Faculty Development Programme',
          hostType: 'COMPANY',
          host: COMPANY_ID,
        }),
    }),
  } as never);
  vi.mocked(CompanyProfile.findById).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: COMPANY_ID, companyName: 'Acme Corp' }) }),
  } as never);

  vi.mocked(StudentProfile.findById).mockImplementation(
    leanFindById(
      new Map([
        [
          String(STUDENT_PROFILE),
          { _id: STUDENT_PROFILE, fullName: 'Asha Menon', user: STUDENT_USER },
        ],
      ]),
    ),
  );
  vi.mocked(FacultyProfile.findById).mockImplementation(
    leanFindById(
      new Map([
        [
          String(FACULTY_PROFILE),
          { _id: FACULTY_PROFILE, fullName: 'Dr. Rao', user: FACULTY_USER },
        ],
      ]),
    ),
  );
  vi.mocked(User.findById).mockImplementation(((id: unknown) => ({
    select: () => ({
      lean: () => {
        const email = EMAILS.get(String(id));
        return Promise.resolve(email ? { _id: id, email } : null);
      },
    }),
  })) as never);
});

describe('listApplications — the applicant a company sees', () => {
  /**
   * The services are typed against the loose `Record<string, unknown>` rows
   * Mongoose hands back, while the assertions read the `ApplicationView` the API
   * actually serves. Neither type overlaps the other structurally, so every cast
   * below goes through `unknown` — a direct one is a TS2352.
   */
  it("resolves the student the company's pages read the name from", async () => {
    mockApplicationFind([applicationRow()]);

    const page = (await listApplications(COMPANY_USER, 'COMPANY', {}, {})) as unknown as {
      items: ApplicationView[];
    };

    expect(page.items).toHaveLength(1);
    const app = page.items[0]!;
    // The shape `@aip/types` declares, so the shared helpers can read it.
    expect(app.student).toEqual({
      id: String(STUDENT_PROFILE),
      fullName: 'Asha Menon',
      email: 'asha.menon@example.edu',
    });
    expect(getStudentName(app)).toBe('Asha Menon');
    expect(getStudentEmail(app)).toBe('asha.menon@example.edu');
    // The regression this file exists for.
    expect(getStudentName(app)).not.toBe('—');
  });

  it('resolves a faculty applicant on a company-hosted opportunity', async () => {
    // FDPs, consultancy and collaborative research put a FacultyProfile in the
    // applicant slot, so a student-only lookup would still show "—" here.
    mockApplicationFind([
      applicationRow({
        student: undefined,
        faculty: String(FACULTY_PROFILE),
        opportunityType: 'FDP',
        opportunity: String(FACULTY_OPP_ID),
      }),
    ]);

    const page = (await listApplications(COMPANY_USER, 'COMPANY', {}, {})) as unknown as {
      items: ApplicationView[];
    };

    const app = page.items[0]!;
    expect(app.faculty).toEqual({
      id: String(FACULTY_PROFILE),
      fullName: 'Dr. Rao',
      email: 'dr.rao@example.edu',
    });
    expect(getStudentName(app)).toBe('Dr. Rao');
    expect(getStudentEmail(app)).toBe('dr.rao@example.edu');
  });

  it('leaves the empty applicant slot alone', async () => {
    mockApplicationFind([applicationRow({ faculty: null })]);

    const page = (await listApplications(COMPANY_USER, 'COMPANY', {}, {})) as unknown as {
      items: ApplicationView[];
    };

    expect(page.items[0]!.faculty).toBeNull();
    expect(FacultyProfile.findById).not.toHaveBeenCalled();
  });

  it('keeps serving the row when the profile has been deleted', async () => {
    // A dangling ref must not take the whole applicants table down with it; the
    // page falls back to its placeholder for that one row.
    mockApplicationFind([applicationRow({ student: String(new Types.ObjectId()) })]);

    const page = (await listApplications(COMPANY_USER, 'COMPANY', {}, {})) as unknown as {
      items: ApplicationView[];
    };

    expect(page.items).toHaveLength(1);
    expect(getStudentName(page.items[0]!)).toBe('—');
  });

  it('still carries the opportunity and company the same row renders', async () => {
    mockApplicationFind([applicationRow()]);

    const page = (await listApplications(COMPANY_USER, 'COMPANY', {}, {})) as unknown as {
      items: ApplicationView[];
    };

    expect(page.items[0]!.opportunity).toEqual({
      id: String(JOB_ID),
      title: 'Backend Engineer',
      company: { id: String(COMPANY_ID), name: 'Acme Corp' },
    });
  });

  it('reads each applicant once per row and does not fan out per field', async () => {
    mockApplicationFind([applicationRow(), applicationRow(), applicationRow()]);

    await listApplications(COMPANY_USER, 'COMPANY', {}, {});

    expect(StudentProfile.findById).toHaveBeenCalledTimes(3);
    expect(User.findById).toHaveBeenCalledTimes(3);
  });
});

describe('getApplicationById — the already-populated applicant', () => {
  /**
   * This path *does* populate, but a profile keeps its email on the nested `user`
   * row, so a client reading `student.email` found nothing there. Flattening has
   * to happen without re-reading the profile that was just populated.
   */
  it('flattens the populated profile and its user email, with no extra reads', async () => {
    const _id = new Types.ObjectId();
    const doc = {
      _id,
      opportunity: JOB_ID,
      opportunityType: 'JOB',
      student: { _id: STUDENT_PROFILE },
      faculty: null,
      toJSON: () => ({
        id: String(_id),
        student: {
          id: String(STUDENT_PROFILE),
          fullName: 'Asha Menon',
          college: 'Alpha Institute of Technology',
          user: { id: String(STUDENT_USER), email: 'asha.menon@example.edu' },
        },
        faculty: null,
        opportunityType: 'JOB',
        opportunity: String(JOB_ID),
        status: 'APPLIED',
        timeline: [],
      }),
    };
    const chain: Record<string, unknown> = {};
    chain.populate = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(doc).then(resolve);
    vi.mocked(Application.findById).mockReturnValue(chain as never);

    const app = (await getApplicationById(
      COMPANY_USER,
      'COMPANY',
      String(_id),
    )) as unknown as ApplicationView;

    expect(app.student).toEqual({
      id: String(STUDENT_PROFILE),
      fullName: 'Asha Menon',
      email: 'asha.menon@example.edu',
    });
    expect(getStudentEmail(app)).toBe('asha.menon@example.edu');
    expect(StudentProfile.findById).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });

  it('still refuses a company that does not own the posting', async () => {
    // Flattening the applicant must not have moved ahead of the ownership check.
    const _id = new Types.ObjectId();
    const chain: Record<string, unknown> = {};
    chain.populate = () => chain;
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({
        _id,
        opportunity: JOB_ID,
        opportunityType: 'JOB',
        student: { _id: STUDENT_PROFILE },
        faculty: null,
        toJSON: () => ({ id: String(_id) }),
      }).then(resolve);
    vi.mocked(Application.findById).mockReturnValue(chain as never);
    vi.mocked(CompanyProfile.findOne).mockImplementation((() =>
      Promise.resolve({ _id: new Types.ObjectId() })) as never);

    await expect(getApplicationById(COMPANY_USER, 'COMPANY', String(_id))).rejects.toMatchObject({
      statusCode: 403,
      message: 'Not your application',
    });
    expect(StudentProfile.findById).not.toHaveBeenCalled();
  });
});

describe('summarizeApplication — the names an interview shows', () => {
  function mockApplicationFindById(doc: Record<string, unknown> | null) {
    vi.mocked(Application.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(doc) }),
    } as never);
  }

  /**
   * `summarizeApplication` reads the application with `.lean()`, so unlike the
   * list path the applicant arrives as an ObjectId rather than a hex string. An
   * ObjectId's `id` property is the raw 12-byte buffer, so resolving the ref by
   * reading `id` off it looked up a garbage key and left the interview cards with
   * a blank candidate — this test is what caught that.
   */
  it('derives candidate, opportunity and company from the application', async () => {
    const _id = new Types.ObjectId();
    mockApplicationFindById({
      _id,
      student: STUDENT_PROFILE,
      opportunityType: 'JOB',
      opportunity: JOB_ID,
    });

    await expect(summarizeApplication(String(_id))).resolves.toEqual({
      applicationId: String(_id),
      candidateName: 'Asha Menon',
      opportunityTitle: 'Backend Engineer',
      companyName: 'Acme Corp',
    });
  });

  it('summarizes a faculty applicant through the same path', async () => {
    const _id = new Types.ObjectId();
    mockApplicationFindById({
      _id,
      faculty: FACULTY_PROFILE,
      opportunityType: 'FDP',
      opportunity: FACULTY_OPP_ID,
    });

    const summary = await summarizeApplication(String(_id));
    expect(summary?.candidateName).toBe('Dr. Rao');
    expect(summary?.opportunityTitle).toBe('Faculty Development Programme');
  });

  it('returns null for an application that no longer exists', async () => {
    mockApplicationFindById(null);
    expect(await summarizeApplication(new Types.ObjectId().toHexString())).toBeNull();
  });
});
