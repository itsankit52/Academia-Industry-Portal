import type { Request, Response } from 'express';
import type { GenerateAssessmentInput, SaveAnswerInput } from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import * as service from './assessments.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const listMyAssessments = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listMyAssessments(req.user!.id, {
    page: num(q.page),
    pageSize: num(q.pageSize),
    sortBy: str(q.sortBy),
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
  });
  return ok(res, data);
});

export const getMyLatest = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMyLatest(req.user!.id);
  return ok(res, data);
});

export const getAssessmentSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getAssessmentSummary(req.user!.id);
  return ok(res, data);
});

export const generateAssessment = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.generateAssessment(
    req.user!.id,
    req.body as GenerateAssessmentInput,
  );
  return created(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getById(req.user!.id, req.params.id!);
  return ok(res, data);
});

export const saveAnswer = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.saveAnswer(
    req.user!.id,
    req.params.id!,
    req.body as SaveAnswerInput,
  );
  return ok(res, data);
});

export const submitAssessment = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.submitAssessment(req.user!.id, req.params.id!);
  return ok(res, data);
});
