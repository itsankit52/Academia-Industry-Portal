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
