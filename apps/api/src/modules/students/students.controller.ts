import type { Request, Response } from 'express';
import type { AddStudentSkillInput, UpdateStudentProfileInput } from '@aip/validation';
import type { OpportunityType, Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import * as service from './students.service';
import * as skillsService from '../skills/skills.service';
import * as resumesService from '../resumes/resumes.service';
import * as savedService from '../saved-opportunities/saved-opportunities.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMyProfile(req.user!.id);
  return ok(res, data);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateMyProfile(
    req.user!.id,
    req.body as UpdateStudentProfileInput,
  );
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getStudentById(
    req.params.id!,
    req.user!.role as Extract<Role, 'ADMIN' | 'COMPANY'>,
  );
  return ok(res, data);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listStudents(
    {
      page: num(q.page),
      pageSize: num(q.pageSize),
      sortBy: str(q.sortBy),
      sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    },
    {
      branch: str(q.branch),
      graduationYear: num(q.graduationYear),
      cgpaMin: num(q.cgpaMin),
    },
  );
  return ok(res, data);
});

export const mySummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMySummary(req.user!.id);
  return ok(res, data);
});

export const listMySkills = asyncHandler(async (req: Request, res: Response) => {
  const data = await skillsService.listMyStudentSkills(req.user!.id);
  return ok(res, data);
});

export const addMySkill = asyncHandler(async (req: Request, res: Response) => {
  const data = await skillsService.addMyStudentSkill(
    req.user!.id,
    req.body as AddStudentSkillInput,
  );
  return created(res, data);
});

export const updateMySkill = asyncHandler(async (req: Request, res: Response) => {
  const data = await skillsService.updateMyStudentSkill(
    req.user!.id,
    req.params.id!,
    req.body as skillsService.UpdateStudentSkillPatch,
  );
  return ok(res, data);
});

export const deleteMySkill = asyncHandler(async (req: Request, res: Response) => {
  await skillsService.deleteMyStudentSkill(req.user!.id, req.params.id!);
  return noContent(res);
});

export const getMyResume = asyncHandler(async (req: Request, res: Response) => {
  const doc = await resumesService.getLatestResume(req.user!.id);
  return ok(res, doc);
});

export const uploadMyResume = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) throw AppError.badRequest('Resume file is required');
  const doc = await resumesService.uploadResumeForStudent({
    userId: req.user!.id,
    buffer: file.buffer,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    filename: file.originalname,
  });
  return created(res, doc);
});

export const downloadMyResume = asyncHandler(async (req: Request, res: Response) => {
  const bin = await resumesService.getResumeBinary(req.user!.id);
  if (bin.url) {
    return res.redirect(302, bin.url);
  }
  res.setHeader('Content-Type', bin.mimeType);
  res.setHeader('Content-Length', String(bin.sizeBytes));
  res.setHeader('Content-Disposition', `inline; filename="${bin.filename}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  return res.status(200).end(bin.buffer);
});

export const deleteMyResume = asyncHandler(async (req: Request, res: Response) => {
  await resumesService.deleteCurrentResume(req.user!.id);
  return noContent(res);
});

export const listMySaved = asyncHandler(async (req: Request, res: Response) => {
  const data = await savedService.listSavedGrouped(req.user!.id);
  return ok(res, data);
});

export const saveOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const { opportunityType, opportunityId } = req.body as {
    opportunityType: OpportunityType;
    opportunityId: string;
  };
  const doc = await savedService.saveOpportunity(req.user!.id, opportunityType, opportunityId);
  return created(res, doc);
});

export const unsaveOpportunity = asyncHandler(async (req: Request, res: Response) => {
  const { opportunityType, opportunityId } = req.params as {
    opportunityType: string;
    opportunityId: string;
  };
  if (opportunityType !== 'JOB' && opportunityType !== 'INTERNSHIP') {
    throw AppError.badRequest('Invalid opportunityType');
  }
  const result = await savedService.deleteSavedByOpportunity(
    req.user!.id,
    opportunityType,
    opportunityId,
  );
  return ok(res, result);
});
