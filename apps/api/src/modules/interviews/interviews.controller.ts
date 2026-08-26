import type { Request, Response } from 'express';
import type { CreateInterviewInput, UpdateInterviewInput } from '@aip/validation';
import type { Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './interviews.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createInterview(
    req.user!.id,
    req.user!.role as Role,
    req.body as CreateInterviewInput,
  );
  return created(res, data);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listInterviews(
    req.user!.id,
    req.user!.role as Role,
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy) ?? 'scheduledAt',
      sortDir: q.sortDir === 'desc' ? 'desc' : 'asc',
    },
    {
      status: str(q.status),
      from: str(q.from),
      to: str(q.to),
    },
  );
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getInterviewById(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
  );
  return ok(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateInterview(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    req.body as UpdateInterviewInput,
  );
  return ok(res, data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteInterview(req.params.id!);
  return noContent(res);
});
