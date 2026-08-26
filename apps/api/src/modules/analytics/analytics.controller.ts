import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import {
  getApplicationsOverTime,
  getCompanyParticipation,
  getDashboardSummary,
  getIndustrySkillDemand,
  getInternshipsByCategory,
  getJobsByCategory,
  getPlacementsOverTime,
  getStudentsByBranch,
} from './analytics.service';

function parseDays(v: unknown, fallback = 30): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(365, Math.floor(n)));
}

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const summary = await getDashboardSummary();
  ok(res, summary);
});

export const applicationsOverTime = asyncHandler(async (req: Request, res: Response) => {
  const days = parseDays((req.query as Record<string, unknown>).days);
  const items = await getApplicationsOverTime(days);
  ok(res, items);
});

export const placementsOverTime = asyncHandler(async (req: Request, res: Response) => {
  const days = parseDays((req.query as Record<string, unknown>).days);
  const items = await getPlacementsOverTime(days);
  ok(res, items);
});

export const jobsByCategory = asyncHandler(async (_req: Request, res: Response) => {
  const items = await getJobsByCategory();
  ok(res, items);
});

export const internshipsByCategory = asyncHandler(async (_req: Request, res: Response) => {
  const items = await getInternshipsByCategory();
  ok(res, items);
});

export const studentsByBranch = asyncHandler(async (_req: Request, res: Response) => {
  const items = await getStudentsByBranch();
  ok(res, items);
});

export const industrySkillDemand = asyncHandler(async (_req: Request, res: Response) => {
  const items = await getIndustrySkillDemand();
  ok(res, items);
});

export const companyParticipation = asyncHandler(async (_req: Request, res: Response) => {
  const items = await getCompanyParticipation();
  ok(res, items);
});
