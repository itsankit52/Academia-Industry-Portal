import type { Request, Response } from 'express';
import type { UpdateFacultyProfileInput } from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import * as service from './faculty.service';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMyProfile(req.user!.id);
  return ok(res, data);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateMyProfile(
    req.user!.id,
    req.body as UpdateFacultyProfileInput,
  );
  return ok(res, data);
});
