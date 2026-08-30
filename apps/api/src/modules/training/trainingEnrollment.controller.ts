/**
 * Phase 8 — Training Enrollment Controller
 */
import type { Request, Response } from 'express';
import type { TrainingEnrollmentStatus } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  completeTrainingEnrollment,
  dropEnrollment,
  enrollStudentInTraining,
  getEnrollmentById,
  listMyEnrollments,
  listTrainingEnrollmentsForCompany,
  updateTrainingProgress,
} from './trainingEnrollment.service';
import { StudentProfile } from '../../models';

async function getMyStudentProfileId(userId: string) {
  const profile = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id.toString();
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentId = await getMyStudentProfileId(userId);
  const trainingId = req.params.id!;
  const doc = await enrollStudentInTraining(userId, studentId, trainingId);
  return created(res, doc);
});

export const getMyEnrollment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentId = await getMyStudentProfileId(userId);
  const enrollment = await getEnrollmentById(req.params.enrollmentId!, userId, req.user!.role);
  return ok(res, enrollment);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentId = await getMyStudentProfileId(userId);
  const q = req.query as Record<string, unknown>;
  const result = await listMyEnrollments(userId, studentId, {
    page: num(q.page),
    pageSize: num(q.pageSize),
    status: q.status as TrainingEnrollmentStatus | undefined,
  });
  return ok(res, result);
});

export const updateProgress = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentId = await getMyStudentProfileId(userId);
  const { progress } = req.body as { progress: number };
  const doc = await updateTrainingProgress(userId, studentId, req.params.enrollmentId!, progress);
  return ok(res, doc);
});

export const complete = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentId = await getMyStudentProfileId(userId);
  const doc = await completeTrainingEnrollment(userId, studentId, req.params.enrollmentId!);
  return ok(res, doc);
});

export const drop = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentId = await getMyStudentProfileId(userId);
  await dropEnrollment(userId, studentId, req.params.enrollmentId!);
  return noContent(res);
});

export const listTrainingEnrollments = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const result = await listTrainingEnrollmentsForCompany(req.params.id!, {
    page: num(q.page),
    pageSize: num(q.pageSize),
    status: q.status as TrainingEnrollmentStatus | undefined,
  });
  return ok(res, result);
});
