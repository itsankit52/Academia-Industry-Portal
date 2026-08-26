import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  deleteResume,
  getLatestResume,
  listResumeHistory,
  uploadResumeForStudent,
} from './resumes.service';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

export const uploadMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const file = req.file;
  if (!file) throw AppError.badRequest('Resume file is required');

  const doc = await uploadResumeForStudent({
    userId,
    buffer: file.buffer,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  });
  created(res, doc);
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doc = await getLatestResume(userId);
  ok(res, doc);
});

export const historyMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const result = await listResumeHistory({
    userId,
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
  });
  ok(res, result);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await deleteResume(userId, req.params.id!);
  noContent(res);
});
