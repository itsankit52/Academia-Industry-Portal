import type { Request, Response } from 'express';
import type { UpdateCompanyProfileInput } from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import * as service from './companies.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return undefined;
}

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMyProfile(req.user!.id);
  return ok(res, data);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateMyProfile(
    req.user!.id,
    req.body as UpdateCompanyProfileInput,
  );
  return ok(res, data);
});

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw AppError.badRequest('No file uploaded');
  const data = await service.uploadLogo(req.user!.id, file);
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getPublicCompany(req.params.id!);
  return ok(res, data);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listCompanies(
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      industry: str(q.industry),
      verified: bool(q.verified),
    },
  );
  return ok(res, data);
});

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getCompanyDashboard(req.user!.id);
  return ok(res, data);
});
