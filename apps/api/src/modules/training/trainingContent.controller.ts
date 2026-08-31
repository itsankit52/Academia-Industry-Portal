/**
 * Phase 15B — Training Content Controller
 *
 * HTTP handlers for training content (modules + lessons) management
 * and student lesson completion tracking.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { StudentProfile } from '../../models';
import {
  createModule,
  createLesson,
  updateModule,
  updateLesson,
  deleteModule,
  deleteLesson,
  getTrainingContent,
  getModuleById,
  getLessonById,
  listLessonsForModule,
  completeLesson,
  getReassessmentRecommendations,
} from './trainingContent.service';

async function getMyStudentProfileId(userId: string) {
  const profile = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id.toString();
}

// --- Module endpoints ---

export const listModules = asyncHandler(async (req: Request, res: Response) => {
  const modules = await getTrainingContent(req.params.id!);
  ok(res, modules);
});

export const createModuleHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await createModule(req.params.id!, req.body);
  created(res, doc);
});

export const getModuleHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getModuleById(req.params.moduleId!);
  ok(res, doc);
});

export const updateModuleHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await updateModule(req.params.moduleId!, req.body);
  ok(res, doc);
});

export const deleteModuleHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteModule(req.params.moduleId!);
  noContent(res);
});

// --- Lesson endpoints ---

export const listLessons = asyncHandler(async (req: Request, res: Response) => {
  const lessons = await listLessonsForModule(req.params.moduleId!);
  ok(res, lessons);
});

export const createLessonHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await createLesson(req.params.id!, req.body);
  created(res, doc);
});

export const getLessonHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getLessonById(req.params.lessonId!);
  ok(res, doc);
});

export const updateLessonHandler = asyncHandler(async (req: Request, res: Response) => {
  const doc = await updateLesson(req.params.lessonId!, req.body);
  ok(res, doc);
});

export const deleteLessonHandler = asyncHandler(async (req: Request, res: Response) => {
  await deleteLesson(req.params.lessonId!);
  noContent(res);
});

// --- Student lesson completion ---

export const completeLessonHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentProfileId = await getMyStudentProfileId(userId);
  const { lessonId } = req.body as { lessonId: string };
  const result = await completeLesson(userId, studentProfileId, req.params.id!, lessonId);
  ok(res, result);
});

export const reassessmentHandler = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const studentProfileId = await getMyStudentProfileId(userId);
  const result = await getReassessmentRecommendations(
    userId,
    studentProfileId,
    req.params.enrollmentId!,
  );
  ok(res, result);
});
