import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  deleteResume,
  getLatestResume,
  listResumeHistory,
  setParsedSkills,
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

/**
 * Persist the skills the student confirms from the AI/extractor output.
 *
 * Without this endpoint the resume→skill profile signal stays empty in
 * `buildSkillProfile`, because resume upload never sees the parsed text
 * directly. The flow is: upload PDF → student reviews list of suggested
 * skills → confirm. This endpoint owns the confirm step.
 */
export const confirmSkills = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const body = req.body as { skills?: unknown };
  if (!Array.isArray(body.skills)) {
    throw AppError.badRequest('skills must be an array of strings');
  }
  const skills = (body.skills as unknown[])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((s) => s.trim());
  const doc = await setParsedSkills(userId, skills);
  ok(res, doc);
});
