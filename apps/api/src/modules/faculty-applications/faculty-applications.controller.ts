/**
 * Phase 13 — Faculty-industry collaboration
 *
 * Controller for faculty-application lifecycle endpoints:
 *   PATCH /faculty-applications/:id/withdraw       — faculty withdraws
 *   GET    /faculty-applications/engagements        — faculty's active/completed engagements
 *   GET    /faculty-applications/:id/match-score   — pre-apply match score
 *   GET    /faculty-applications/opportunities/:oppId/applicants  — company/institution lists applicants
 */

import type { Request, Response } from 'express';
import type { Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import * as service from './faculty-applications.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// --- Faculty withdraw ---

export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.withdrawFacultyApplication(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    req.body?.reason,
  );
  return ok(res, data);
});

// --- Faculty engagements (active/completed collaborations) ---

export const listEngagements = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listMyEngagements(
    req.user!.id,
    req.user!.role as Role,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    { tab: str(q.tab) as 'ACTIVE' | 'COMPLETED' | 'ALL' | undefined },
  );
  return ok(res, data);
});

// --- Faculty: pre-apply match score ---

export const getMatchScore = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMatchScoreForOpportunity(
    req.user!.id,
    req.user!.role as Role,
    req.params.opportunityId!,
  );
  return ok(res, data);
});

// --- Company/Institution: applicants for a faculty opportunity ---

export const listOpportunityApplicants = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listApplicantsForOpportunity(
    req.user!.id,
    req.user!.role as Role,
    req.params.opportunityId!,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
  );
  return ok(res, data);
});

// --- Company/Institution/Admin: mark a faculty engagement as COMPLETED ---

export const completeEngagement = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.completeFacultyEngagement(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    { notes: req.body?.notes },
  );
  return ok(res, data);
});
