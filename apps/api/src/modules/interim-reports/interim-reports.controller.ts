import type { Request, Response } from 'express';
import type {
  CreateInterimReportInput,
  MentorFeedbackInput,
  ListInterimReportsQuery,
} from '@aip/validation';
import type { Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import * as service from './interim-reports.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createReport(
    req.user!.id,
    req.params.appId!,
    req.body as CreateInterimReportInput,
  );
  return created(res, data);
});

export const listForApp = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListInterimReportsQuery;
  const data = await service.listReportsForApplication(
    req.params.appId!,
    req.user!.id,
    req.user!.role as Role,
    q,
  );
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getReport(req.params.id!, req.user!.id, req.user!.role as Role);
  return ok(res, data);
});

export const feedback = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.addMentorFeedback(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
    req.body as MentorFeedbackInput,
  );
  return ok(res, data);
});
