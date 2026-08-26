import type { Request, Response } from 'express';
import type { OpportunityType } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  deleteSaved,
  deleteSavedByOpportunity,
  listSaved,
  saveOpportunity,
} from './saved-opportunities.service';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

function parseType(v: unknown): OpportunityType | undefined {
  if (v === 'JOB' || v === 'INTERNSHIP') return v;
  return undefined;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const result = await listSaved({
    userId,
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    ...(parseType(q.opportunityType) ? { opportunityType: parseType(q.opportunityType)! } : {}),
  });
  ok(res, result);
});

export const save = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { opportunityType, opportunityId } = req.body as {
    opportunityType: OpportunityType;
    opportunityId: string;
  };
  const doc = await saveOpportunity(userId, opportunityType, opportunityId);
  created(res, doc);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await deleteSaved(userId, req.params.id!);
  noContent(res);
});

export const removeByOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { opportunityType, opportunityId } = req.body as {
    opportunityType: OpportunityType;
    opportunityId: string;
  };
  const result = await deleteSavedByOpportunity(userId, opportunityType, opportunityId);
  ok(res, result);
});
