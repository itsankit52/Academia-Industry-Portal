import type { Request, Response } from 'express';
import type { Role } from '@aip/config';
import type {
  CreateFacultyOpportunityInput,
  ListFacultyOpportunitiesQuery,
  UpdateFacultyOpportunityInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { created, noContent, ok } from '../../utils/apiResponse';
import * as service from './faculty-opportunities.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListFacultyOpportunitiesQuery;
  const data = await service.listOpportunities(
    { page: q.page, pageSize: q.pageSize, sortBy: q.sortBy, sortDir: q.sortDir },
    {
      q: q.q,
      opportunityType: q.opportunityType,
      status: q.status,
      hostType: q.hostType,
      mode: q.mode,
    },
  );
  return ok(res, data);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListFacultyOpportunitiesQuery;
  const data = await service.listMyOpportunities(
    req.user!.id,
    req.user!.role as Role,
    { page: q.page, pageSize: q.pageSize, sortBy: q.sortBy, sortDir: q.sortDir },
    {
      q: q.q,
      opportunityType: q.opportunityType,
      status: q.status,
      hostType: q.hostType,
      mode: q.mode,
    },
  );
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getOpportunityById(req.params.id!);
  return ok(res, data);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createOpportunity(
    req.user!.id,
    req.user!.role as Role,
    req.body as CreateFacultyOpportunityInput,
  );
  return created(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateOpportunity(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
    req.body as UpdateFacultyOpportunityInput,
  );
  return ok(res, data);
});

export const patch = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.patchOpportunity(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
    req.body as UpdateFacultyOpportunityInput,
  );
  return ok(res, data);
});

export const close = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.closeOpportunity(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
  );
  return ok(res, data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteOpportunity(req.params.id!, req.user!.id, req.user!.role as Role);
  return noContent(res);
});
