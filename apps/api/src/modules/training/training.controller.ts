import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  archiveTraining,
  createTraining,
  getTrainingById,
  listTrainings,
  recommendTrainingsForStudent,
  updateTraining,
} from './training.service';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

function parseStatus(v: unknown): 'ACTIVE' | 'ARCHIVED' | undefined {
  if (v === 'ACTIVE' || v === 'ARCHIVED') return v;
  return undefined;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const skillIds =
    typeof q.skillIds === 'string' && q.skillIds.length > 0
      ? q.skillIds.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
  const result = await listTrainings({
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    ...(skillIds ? { skillIds } : {}),
    ...(typeof q.search === 'string' ? { search: q.search } : {}),
    ...(parseStatus(q.status) ? { status: parseStatus(q.status)! } : {}),
  });
  ok(res, result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getTrainingById(req.params.id!);
  ok(res, doc);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const doc = await createTraining(req.body);
  created(res, doc);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const doc = await updateTraining(req.params.id!, req.body);
  ok(res, doc);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await archiveTraining(req.params.id!);
  noContent(res);
});

export const recommendedForMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const items = await recommendTrainingsForStudent(userId, 10);
  ok(res, { items });
});
