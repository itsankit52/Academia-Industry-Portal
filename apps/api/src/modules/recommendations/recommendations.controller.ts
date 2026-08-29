import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import type { OpportunityType } from '@aip/config';
import {
  computeSkillsGap,
  recommendInternships,
  recommendJobs,
  recommendLearning,
  recommendTrainings,
  type LearningRecommendationsParams,
} from './recommendations.service';
import { analyzeFullMatch, type FullMatchAnalysis } from '../matching/fullMatch.service';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

function pageParams(req: Request): { page?: number; pageSize?: number } {
  const q = req.query as Record<string, unknown>;
  return {
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
  };
}

export const jobsForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await recommendJobs(userId, pageParams(req));
  ok(res, result);
});

export const internshipsForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await recommendInternships(userId, pageParams(req));
  ok(res, result);
});

export const trainingsForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await recommendTrainings(userId, pageParams(req));
  ok(res, result);
});

export const skillsGap = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await computeSkillsGap(userId);
  ok(res, result);
});

export const learningForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const params: LearningRecommendationsParams = {
    ...pageParams(req),
    targetOpportunityId:
      typeof q.targetOpportunityId === 'string' ? q.targetOpportunityId : undefined,
    targetOpportunityType:
      q.targetOpportunityType === 'JOB' || q.targetOpportunityType === 'INTERNSHIP'
        ? (q.targetOpportunityType as OpportunityType)
        : undefined,
  };
  const result = await recommendLearning(userId, params);
  ok(res, result);
});

/**
 * Returns the full multi-dimensional match analysis between the calling student
 * and a specific opportunity (job or internship). Reuses `analyzeFullMatch` —
 * no new business logic, just an HTTP surface for the existing deterministic
 * engine. Phase 4: makes the per-opportunity breakdown (skill match %,
 * proficiency gaps, career alignment, eligibility, industry demand) available
 * to the student UI without re-implementing the math.
 */
export const fullMatchForMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const userId = requireUserId(req);
  const { type, id } = req.params as { type?: string; id?: string };
  if (type !== 'JOB' && type !== 'INTERNSHIP') {
    throw AppError.badRequest("type must be either 'JOB' or 'INTERNSHIP'");
  }
  if (!id || !/^[a-fA-F0-9]{24}$/.test(id)) {
    throw AppError.badRequest('id must be a 24-character ObjectId');
  }
  const result: FullMatchAnalysis = await analyzeFullMatch(userId, type as OpportunityType, id);
  ok(res, result);
});
