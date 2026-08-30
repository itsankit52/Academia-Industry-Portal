import type { Request, Response } from 'express';
import type { CreateInternshipInput, UpdateInternshipInput } from '@aip/validation';
import type { Role } from '@aip/config';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './internships.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function csv(v: unknown): string[] | undefined {
  const s = str(v);
  if (!s) return undefined;
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

/**
 * `optionalAuth` fills `req.user` when the caller is signed in, so this is
 * absent for anonymous visitors and the service falls back to public rules.
 */
function viewerOf(req: Request): service.InternshipViewer {
  return { userId: req.user?.id, role: req.user?.role as Role | undefined };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listInternships(
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      search: str(q.search),
      workMode: str(q.workMode),
      location: str(q.location),
      status: str(q.status),
      skillIds: csv(q.skillIds),
      companyId: str(q.companyId),
    },
    viewerOf(req),
  );
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getInternshipById(req.params.id!, viewerOf(req));
  return ok(res, data);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createInternship(req.user!.id, req.body as CreateInternshipInput);
  return created(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateInternship(
    req.user!.id,
    req.params.id!,
    req.body as UpdateInternshipInput,
  );
  return ok(res, data);
});

export const close = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.closeInternship(req.user!.id, req.params.id!);
  return ok(res, data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteInternship(req.user!.id, req.user!.role as Role, req.params.id!);
  return noContent(res);
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.patchInternship(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    req.body as UpdateInternshipInput,
  );
  return ok(res, data);
});

export const listManaged = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listMyInternships(
    req.user!.id,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    { status: str(q.status) },
  );
  return ok(res, data);
});

const setDatesSchema = z.object({
  startDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
});

export const setDates = asyncHandler(async (req: Request, res: Response) => {
  const parsed = setDatesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.errors });
  }
  const data = await service.setInternshipDates(
    req.user!.id,
    req.params.id!,
    parsed.data,
  );
  return ok(res, data);
});

export const startInternship = asyncHandler(async (req: Request, res: Response) => {
  const parsed = setDatesSchema.safeParse(req.body);
  const data = parsed.success ? parsed.data : undefined;
  const result = await service.startInternship(req.user!.id, req.params.id!, data);
  return ok(res, result);
});

export const markOngoing = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.markInternshipOngoing(req.user!.id, req.params.id!);
  return ok(res, result);
});

export const getApplicationStats = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getInternshipApplicationStats(req.user!.id, req.params.id!);
  return ok(res, data);
});
