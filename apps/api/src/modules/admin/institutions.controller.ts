import type { Request, Response } from 'express';
import type {
  CreateInstitutionInput,
  UpdateInstitutionInput,
  ListInstitutionsQuery,
  InviteInstitutionUserInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, ok } from '../../utils/apiResponse';
import * as service from './institutions.service';

export const create = asyncHandler(async (req: Request, res: Response) => {
  const doc = await service.createInstitution(req.body as CreateInstitutionInput);
  return created(res, doc);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listInstitutions(req.query as unknown as ListInstitutionsQuery);
  return ok(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const doc = await service.updateInstitution(
    req.params.id!,
    req.body as UpdateInstitutionInput,
  );
  return ok(res, doc);
});

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const doc = await service.verifyInstitution(req.params.id!);
  return ok(res, doc);
});

export const inviteUser = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.inviteInstitutionUser(
    req.params.id!,
    req.body as InviteInstitutionUserInput,
  );
  return created(res, {
    user: result.user.toJSON(),
    ...(result.facultyProfileId ? { facultyProfileId: result.facultyProfileId } : {}),
  });
});
