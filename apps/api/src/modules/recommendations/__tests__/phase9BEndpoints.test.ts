/**
 * Phase 9B — Tests for the new career decision support endpoints.
 *
 * Coverage:
 * - GET /me/career-path/:type/:id — career path analysis
 * - GET /me/action-plan — personalized action plan
 * - GET /me/benchmark — privacy-safe peer benchmark
 * - GET /me/progression — readiness progression
 * - Validation: type whitelist, ObjectId validation
 * - RBAC: student access enforced
 */

import { Types } from 'mongoose';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import {
  careerPathForMe,
  actionPlanForMe,
  benchmarkForMe,
  progressionForMe,
} from '../recommendations.controller';
import { AppError } from '../../../utils/AppError';

vi.mock('../../matching/fullMatch.service', () => ({
  analyzeFullMatch: vi.fn(),
}));

vi.mock('../../../models', () => ({
  StudentProfile: { findOne: vi.fn() },
  StudentSkill: { find: vi.fn(), aggregate: vi.fn(), findOne: vi.fn() },
  Assessment: { find: vi.fn(), findOne: vi.fn() },
  TrainingEnrollment: { find: vi.fn() },
  TrainingProgram: { find: vi.fn() },
  MentorProfile: { find: vi.fn() },
  Job: { aggregate: vi.fn() },
  Internship: { aggregate: vi.fn() },
  Skill: { find: vi.fn() },
  User: { findById: vi.fn() },
  FacultyProfile: { findOne: vi.fn() },
  CompanyProfile: { findOne: vi.fn() },
}));

import { analyzeFullMatch } from '../../matching/fullMatch.service';
import {
  StudentProfile,
  StudentSkill,
  Assessment,
  TrainingEnrollment,
  TrainingProgram,
  MentorProfile,
  Job,
  Internship,
  Skill,
  User,
  FacultyProfile,
  CompanyProfile,
} from '../../../models';

const USER_ID = new Types.ObjectId().toString();
const OPP_ID = new Types.ObjectId().toString();

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: USER_ID },
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  (res as { status?: (n: number) => Response }).status = () => res as Response;
  (res as { json?: (v: unknown) => Response }).json = () => res as Response;
  return res as Response;
}

function chain<T>(result: T) {
  const q = {
    populate: () => q,
    select: () => q,
    sort: () => q,
    skip: () => q,
    limit: () => q,
    lean: () => Promise.resolve(result),
    then: (_onF: (v: T) => unknown, _onR?: (r: unknown) => unknown) => Promise.resolve(result),
  };
  return q as unknown as { populate(): typeof q; select(): typeof q; sort(): typeof q; skip(): typeof q; limit(): typeof q; lean(): Promise<T>; then(onF: (v: T) => unknown, onR?: (r: unknown) => unknown): Promise<T> };
}

/* ─── careerPathForMe ─────────────────────────────────────────────── */

describe('GET /me/career-path/:type/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getCareerPathAnalysis for valid JOB opportunity', async () => {
    const mockAnalysis = {
      opportunityId: OPP_ID,
      opportunityType: 'JOB' as const,
      opportunityTitle: 'Backend Engineer',
      studentId: new Types.ObjectId().toString(),
      score: 75,
      level: 'GOOD_MATCH',
      eligibility: { passed: true, failures: [] },
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
      explanation: { reasons: [], warnings: [], skillRatio: { matched: 0, total: 0 } },
    };
    vi.mocked(analyzeFullMatch).mockResolvedValue(mockAnalysis as never);
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: new Types.ObjectId() }) as never,
    );
    vi.mocked(StudentSkill.find).mockResolvedValue([] as never);
    vi.mocked(Skill.find).mockResolvedValue([] as never);
    vi.mocked(TrainingEnrollment.find).mockResolvedValue([] as never);
    vi.mocked(TrainingProgram.find).mockResolvedValue([] as never);
    vi.mocked(MentorProfile.find).mockResolvedValue([] as never);
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ email: 'test@test.com', role: 'FACULTY' }) }),
    } as never);
    vi.mocked(FacultyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    vi.mocked(CompanyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);

    const req = mockReq({ params: { type: 'JOB', id: OPP_ID } });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await careerPathForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(analyzeFullMatch).toHaveBeenCalledWith(USER_ID, 'JOB', OPP_ID);
  });

  it('calls getCareerPathAnalysis for valid INTERNSHIP opportunity', async () => {
    vi.mocked(analyzeFullMatch).mockResolvedValue({
      opportunityId: OPP_ID,
      opportunityType: 'INTERNSHIP' as const,
      opportunityTitle: 'Frontend Intern',
      studentId: new Types.ObjectId().toString(),
      score: 60,
      level: 'PARTIAL_MATCH',
      eligibility: { passed: true, failures: [] },
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
      explanation: { reasons: [], warnings: [], skillRatio: { matched: 0, total: 0 } },
    } as never);
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: new Types.ObjectId() }) as never,
    );
    vi.mocked(StudentSkill.find).mockResolvedValue([] as never);
    vi.mocked(Skill.find).mockResolvedValue([] as never);
    vi.mocked(TrainingEnrollment.find).mockResolvedValue([] as never);
    vi.mocked(TrainingProgram.find).mockResolvedValue([] as never);
    vi.mocked(MentorProfile.find).mockResolvedValue([] as never);
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ email: 'test@test.com', role: 'FACULTY' }) }),
    } as never);
    vi.mocked(FacultyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    vi.mocked(CompanyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);

    const req = mockReq({ params: { type: 'INTERNSHIP', id: OPP_ID } });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await careerPathForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(analyzeFullMatch).toHaveBeenCalledWith(USER_ID, 'INTERNSHIP', OPP_ID);
  });

  it('passes 400 when type is not JOB or INTERNSHIP', async () => {
    const req = mockReq({ params: { type: 'INVALID', id: OPP_ID } });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await careerPathForMe(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });

  it('passes 400 when id is not a valid ObjectId', async () => {
    const req = mockReq({ params: { type: 'JOB', id: 'not-an-id' } });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await careerPathForMe(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });

  it('requires authentication', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await careerPathForMe(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});

/* ─── actionPlanForMe ─────────────────────────────────────────────── */

describe('GET /me/action-plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: new Types.ObjectId() }) as never,
    );
    vi.mocked(StudentSkill.find).mockResolvedValue([] as never);
    vi.mocked(Job.aggregate).mockResolvedValue([] as never);
    vi.mocked(Internship.aggregate).mockResolvedValue([] as never);
    vi.mocked(Assessment.find).mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
    } as never);
    vi.mocked(TrainingEnrollment.find).mockResolvedValue([] as never);
    vi.mocked(TrainingProgram.find).mockResolvedValue([] as never);
    vi.mocked(MentorProfile.find).mockResolvedValue([] as never);
    vi.mocked(User.findById).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve({ email: 'test@test.com', role: 'FACULTY' }) }),
    } as never);
    vi.mocked(FacultyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
    vi.mocked(CompanyProfile.findOne).mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(null) }),
    } as never);
  });

  it('returns action plan without opportunity params', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await actionPlanForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('returns action plan with opportunity params', async () => {
    const req = mockReq({ query: { opportunityId: OPP_ID, opportunityType: 'JOB' } });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    vi.mocked(analyzeFullMatch).mockResolvedValue({
      opportunityId: OPP_ID,
      opportunityType: 'JOB',
      opportunityTitle: 'Test Job',
      studentId: new Types.ObjectId().toString(),
      score: 80,
      level: 'GOOD_MATCH',
      eligibility: { passed: true, failures: [] },
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
      explanation: { reasons: [], warnings: [], skillRatio: { matched: 0, total: 0 } },
    } as never);

    await actionPlanForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await actionPlanForMe(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});

/* ─── benchmarkForMe ─────────────────────────────────────────────── */

describe('GET /me/benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns benchmark result', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: new Types.ObjectId() }) as never,
    );
    vi.mocked(StudentSkill.find).mockResolvedValue([
      { skill: new Types.ObjectId(), proficiency: 'INTERMEDIATE' },
    ] as never);
    vi.mocked(StudentSkill.aggregate).mockResolvedValue([
      {
        _id: { category: 'PROGRAMMING' },
        avgRank: 2.5,
        count: 10,
        nStudents: Array.from({ length: 6 }, () => new Types.ObjectId()),
      },
    ] as never);

    const req = mockReq();
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await benchmarkForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await benchmarkForMe(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});

/* ─── progressionForMe ────────────────────────────────────────────── */

describe('GET /me/progression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns progression result', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: new Types.ObjectId() }) as never,
    );
    vi.mocked(StudentSkill.findOne).mockResolvedValue({ createdAt: new Date() } as never);
    vi.mocked(TrainingEnrollment.find).mockResolvedValue([] as never);
    vi.mocked(Assessment.findOne).mockResolvedValue(null as never);

    const req = mockReq({ query: { currentScore: '75' } });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await progressionForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('handles missing currentScore gracefully', async () => {
    vi.mocked(StudentProfile.findOne).mockReturnValue(
      chain({ _id: new Types.ObjectId() }) as never,
    );
    vi.mocked(StudentSkill.findOne).mockResolvedValue({ createdAt: new Date() } as never);
    vi.mocked(TrainingEnrollment.find).mockResolvedValue([] as never);
    vi.mocked(Assessment.findOne).mockResolvedValue(null as never);

    const req = mockReq({ query: {} });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await progressionForMe(req, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = vi.fn<(err?: unknown) => void>();

    await progressionForMe(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err.statusCode).toBe(401);
  });
});
