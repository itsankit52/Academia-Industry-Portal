import type { Request, Response } from 'express';
import type { Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { noContent, ok } from '../../utils/apiResponse';
import {
  activateUser,
  deactivateUser,
  deleteUserCascade,
  forceCloseInternship,
  forceCloseJob,
  listUsers,
  setUserActive,
  verifyCompany,
} from './admin.service';

function parseRole(v: unknown): Role | undefined {
  if (
    v === 'STUDENT' ||
    v === 'COMPANY' ||
    v === 'ADMIN' ||
    v === 'FACULTY' ||
    v === 'INSTITUTION'
  ) {
    return v;
  }
  return undefined;
}

function parseBool(v: unknown): boolean | undefined {
  if (v === 'true' || v === true) return true;
  if (v === 'false' || v === false) return false;
  return undefined;
}

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  const doc = await deactivateUser(req.params.id!);
  ok(res, doc);
});

export const activate = asyncHandler(async (req: Request, res: Response) => {
  const doc = await activateUser(req.params.id!);
  ok(res, doc);
});

export const removeUser = asyncHandler(async (req: Request, res: Response) => {
  await deleteUserCascade(req.params.id!);
  noContent(res);
});

export const verifyCompanyProfile = asyncHandler(async (req: Request, res: Response) => {
  const doc = await verifyCompany(req.params.id!);
  ok(res, doc);
});

export const closeJob = asyncHandler(async (req: Request, res: Response) => {
  const doc = await forceCloseJob(req.params.id!);
  ok(res, doc);
});

export const closeInternship = asyncHandler(async (req: Request, res: Response) => {
  const doc = await forceCloseInternship(req.params.id!);
  ok(res, doc);
});

export const patchUser = asyncHandler(async (req: Request, res: Response) => {
  const { isActive } = req.body as { isActive: boolean };
  const doc = await setUserActive(req.params.id!, isActive);
  ok(res, doc);
});

export const users = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const result = await listUsers({
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    ...(parseRole(q.role) ? { role: parseRole(q.role)! } : {}),
    ...(parseBool(q.isActive) !== undefined ? { isActive: parseBool(q.isActive)! } : {}),
  });
  ok(res, result);
});
