/**
 * Phase 15B — Student Opportunity Discovery Controller
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import {
  applyToOpportunity,
  getOpportunityForStudent,
  listMyApplications,
  listOpportunitiesForStudent,
  withdrawApplication,
} from './student-opportunities.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const result = await listOpportunitiesForStudent(
    req.user!.id,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      q: typeof q.q === 'string' ? q.q : undefined,
      opportunityType: typeof q.opportunityType === 'string' ? q.opportunityType : undefined,
      hostType:
        q.hostType === 'COMPANY' || q.hostType === 'INSTITUTION'
          ? (q.hostType as 'COMPANY' | 'INSTITUTION')
          : undefined,
      mode: typeof q.mode === 'string' ? q.mode : undefined,
      requiredExpertise:
        typeof q.requiredExpertise === 'string'
          ? q.requiredExpertise
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
    },
  );
  ok(res, result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getOpportunityForStudent(req.user!.id, req.params.id!);
  ok(res, doc);
});

export const apply = asyncHandler(async (req: Request, res: Response) => {
  const result = await applyToOpportunity(req.user!.id, req.params.id!, {
    coverLetter: req.body?.coverLetter,
  });
  created(res, result);
});

export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  const result = await withdrawApplication(req.user!.id, req.params.id!);
  ok(res, result);
});

export const listMy = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const result = await listMyApplications(req.user!.id, {
    page: num(q.page),
    pageSize: num(q.pageSize),
  });
  ok(res, result);
});
