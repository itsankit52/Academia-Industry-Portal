/**
 * Phase 4 — tests for the new GET /recommendations/full-match/:type/:id
 * endpoint. The endpoint is a thin pass-through to analyzeFullMatch; these
 * tests focus on input validation (type whitelist, ObjectId shape) so we do
 * not duplicate coverage of the full-match engine.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { fullMatchForMe } from '../recommendations.controller';
import { AppError } from '../../../utils/AppError';

vi.mock('../../matching/fullMatch.service', () => ({
  analyzeFullMatch: vi.fn(),
}));

import { analyzeFullMatch } from '../../matching/fullMatch.service';

const USER_ID = new Types.ObjectId().toString();
const OPP_ID = new Types.ObjectId().toString();

function mockReq(type?: string, id?: string, userId: string = USER_ID): Request {
  return {
    user: { id: userId },
    params: { type, id },
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  (res as { status?: (n: number) => Response }).status = () => res as Response;
  (res as { json?: (v: unknown) => Response }).json = () => res as Response;
  return res as Response;
}

describe('GET /recommendations/full-match/:type/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analyzeFullMatch).mockResolvedValue({
      opportunityId: OPP_ID,
      opportunityType: 'JOB',
      opportunityTitle: 'Backend Engineer',
      studentId: new Types.ObjectId().toString(),
      score: 80,
      matchPercentage: 75,
      level: 'GOOD_MATCH',
      recommendation: 'Good fit',
      eligibility: { passed: true, failures: [] },
      matchedSkills: { technical: [], soft: [] },
      missingSkills: { technical: [], soft: [] },
      proficiencyGaps: [],
      preferredMatched: [],
      careerInterestsMatch: { matched: [], missing: [], score: 100 },
      breakdown: {
        technical: 80,
        proficiency: 100,
        soft: 100,
        career: 100,
        industryDemand: 100,
        eligibility: 100,
      },
      explanation: { reasons: [], warnings: [], skillRatio: { matched: 0, total: 0 } },
    });
  });

  it('calls analyzeFullMatch for a valid JOB opportunity', async () => {
    const req = mockReq('JOB', OPP_ID);
    const res = mockRes();
    const next = vi.fn<Parameters<NextFunction>>();
    await fullMatchForMe(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(analyzeFullMatch).toHaveBeenCalledWith(USER_ID, 'JOB', OPP_ID);
  });

  it('calls analyzeFullMatch for a valid INTERNSHIP opportunity', async () => {
    const req = mockReq('INTERNSHIP', OPP_ID);
    const res = mockRes();
    const next = vi.fn<Parameters<NextFunction>>();
    await fullMatchForMe(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(analyzeFullMatch).toHaveBeenCalledWith(USER_ID, 'INTERNSHIP', OPP_ID);
  });

  it('passes a 400 AppError to next when type is not JOB or INTERNSHIP', async () => {
    const req = mockReq('FOO', OPP_ID);
    const res = mockRes();
    const next = vi.fn<Parameters<NextFunction>>();
    await fullMatchForMe(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/JOB|INTERNSHIP/);
  });

  it('passes a 400 AppError to next when id is not a 24-character ObjectId', async () => {
    const req = mockReq('JOB', 'not-an-id');
    const res = mockRes();
    const next = vi.fn<Parameters<NextFunction>>();
    await fullMatchForMe(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });

  it('passes a 401 AppError to next when request has no authenticated user', async () => {
    const req = mockReq('JOB', OPP_ID, '');
    const res = mockRes();
    const next = vi.fn<Parameters<NextFunction>>();
    await fullMatchForMe(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]![0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});
