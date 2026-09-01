import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './student-projects.service';

function requireStudentId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw new Error('Authentication required');
  return id;
}

export const listMyProjects = asyncHandler(async (req: Request, res: Response) => {
  const studentUserId = requireStudentId(req);
  const items = await service.listMyProjects(studentUserId);
  ok(res, { items });
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const studentUserId = requireStudentId(req);
  const item = await service.getProjectById(studentUserId, req.params.id!);
  ok(res, item);
});

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const studentUserId = requireStudentId(req);
  const item = await service.createProject(studentUserId, req.body);
  created(res, item);
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const studentUserId = requireStudentId(req);
  const item = await service.updateProject(studentUserId, req.params.id!, req.body);
  ok(res, item);
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  const studentUserId = requireStudentId(req);
  await service.deleteProject(studentUserId, req.params.id!);
  noContent(res);
});
