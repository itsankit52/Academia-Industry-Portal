import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  computeSkillsGap,
  recommendInternships,
  recommendJobs,
  recommendTrainings,
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
