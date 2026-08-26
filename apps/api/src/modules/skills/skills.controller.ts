import type { Request, Response } from 'express';
import type {
  CreateSkillInput,
  UpdateSkillInput,
  AddStudentSkillInput,
} from '@aip/validation';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './skills.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listSkills(
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy) ?? 'name',
      sortDir: q.sortDir === 'desc' ? 'desc' : 'asc',
    },
    {
      category: str(q.category),
      search: str(q.search),
      status: str(q.status),
    },
  );
  return ok(res, data);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createSkill(req.body as CreateSkillInput);
  return created(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateSkill(req.params.id!, req.body as UpdateSkillInput);
  return ok(res, data);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.archiveSkill(req.params.id!);
  return noContent(res);
});

export const listMyStudentSkills = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listMyStudentSkills(req.user!.id);
  return ok(res, data);
});

export const addMyStudentSkill = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.addMyStudentSkill(req.user!.id, req.body as AddStudentSkillInput);
  return created(res, data);
});

export const updateMyStudentSkill = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateMyStudentSkill(
    req.user!.id,
    req.params.id!,
    req.body as service.UpdateStudentSkillPatch,
  );
  return ok(res, data);
});

export const deleteMyStudentSkill = asyncHandler(async (req: Request, res: Response) => {
  await service.deleteMyStudentSkill(req.user!.id, req.params.id!);
  return noContent(res);
});

export const listForStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.listSkillsForStudent(req.params.studentId!);
  return ok(res, data);
});
