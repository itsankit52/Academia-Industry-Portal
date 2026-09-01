import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import * as service from './institutions.service';

export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  const data = await service.listVerifiedPublic();
  return ok(res, data);
});

export const verifyCode = asyncHandler(async (req: Request, res: Response) => {
  const code = String(req.query['code'] ?? '');
  const result = await service.verifyInstitutionCode(code);
  return ok(res, result);
});
