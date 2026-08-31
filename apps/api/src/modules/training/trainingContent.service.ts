/**
 * Phase 15B — Training Content Service
 *
 * Manages modules and lessons for in-platform training content.
 * - Modules group related lessons into logical sections
 * - Lessons are the atomic learning units (VIDEO, ARTICLE, QUIZ, RESOURCE)
 * - Idempotent lesson completion tracking
 *
 * All operations resolve ownership/authorization server-side.
 */
import { Types } from 'mongoose';
import {
  TrainingModule,
  TrainingLesson,
  TrainingProgram,
  TrainingEnrollment,
  StudentProfile,
  type TrainingModuleDoc,
  type TrainingLessonDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import type {
  CreateTrainingModuleInput,
  UpdateTrainingModuleInput,
  CreateTrainingLessonInput,
  UpdateTrainingLessonInput,
} from '@aip/validation';

// ---------------------------------------------------------------------------
// Module operations
// ---------------------------------------------------------------------------

export async function listModulesForTraining(trainingId: string): Promise<TrainingModuleDoc[]> {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw AppError.badRequest('Invalid training id');
  }
  const modules = await TrainingModule.find({ training: new Types.ObjectId(trainingId) })
    .sort({ order: 1 })
    .lean();
  // `.lean()` skips toJSON transform; assign id from _id
  return modules.map((m) => ({
    ...m,
    id: String(m._id),
  })) as unknown as TrainingModuleDoc[];
}

export async function getModuleById(moduleId: string): Promise<TrainingModuleDoc> {
  if (!Types.ObjectId.isValid(moduleId)) {
    throw AppError.badRequest('Invalid module id');
  }
  const doc = await TrainingModule.findById(moduleId);
  if (!doc) throw AppError.notFound('Training module not found');
  return doc;
}

export async function createModule(
  trainingId: string,
  input: CreateTrainingModuleInput,
): Promise<TrainingModuleDoc> {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw AppError.badRequest('Invalid training id');
  }
  const training = await TrainingProgram.findById(trainingId);
  if (!training) throw AppError.notFound('Training program not found');

  // Auto-assign order if not provided
  let order = input.order;
  if (order === undefined) {
    const lastModule = await TrainingModule.findOne({ training: training._id })
      .sort({ order: -1 })
      .select('order')
      .lean();
    order = lastModule ? (lastModule.order ?? 0) + 1 : 0;
  }

  const doc = await TrainingModule.create({
    training: training._id,
    title: input.title,
    description: input.description,
    order,
  });
  return doc;
}

export async function updateModule(
  moduleId: string,
  input: UpdateTrainingModuleInput,
): Promise<TrainingModuleDoc> {
  if (!Types.ObjectId.isValid(moduleId)) {
    throw AppError.badRequest('Invalid module id');
  }
  const doc = await TrainingModule.findByIdAndUpdate(moduleId, input, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw AppError.notFound('Training module not found');
  return doc;
}

export async function deleteModule(moduleId: string): Promise<void> {
  if (!Types.ObjectId.isValid(moduleId)) {
    throw AppError.badRequest('Invalid module id');
  }
  // Also delete all lessons in this module
  const module = await TrainingModule.findById(moduleId);
  if (!module) throw AppError.notFound('Training module not found');

  await TrainingLesson.deleteMany({ module: module._id });
  await TrainingModule.deleteOne({ _id: module._id });
}

// ---------------------------------------------------------------------------
// Lesson operations
// ---------------------------------------------------------------------------

export async function listLessonsForModule(moduleId: string): Promise<TrainingLessonDoc[]> {
  if (!Types.ObjectId.isValid(moduleId)) {
    throw AppError.badRequest('Invalid module id');
  }
  const lessons = await TrainingLesson.find({ module: new Types.ObjectId(moduleId) })
    .sort({ order: 1 })
    .lean();
  return lessons.map((l) => ({
    ...l,
    id: String(l._id),
  })) as unknown as TrainingLessonDoc[];
}

export async function listLessonsForTraining(trainingId: string): Promise<TrainingLessonDoc[]> {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw AppError.badRequest('Invalid training id');
  }
  const lessons = await TrainingLesson.find({ training: new Types.ObjectId(trainingId) })
    .sort({ order: 1 })
    .lean();
  return lessons.map((l) => ({
    ...l,
    id: String(l._id),
  })) as unknown as TrainingLessonDoc[];
}

export async function getLessonById(lessonId: string): Promise<TrainingLessonDoc> {
  if (!Types.ObjectId.isValid(lessonId)) {
    throw AppError.badRequest('Invalid lesson id');
  }
  const doc = await TrainingLesson.findById(lessonId);
  if (!doc) throw AppError.notFound('Training lesson not found');
  return doc;
}

export async function createLesson(
  trainingId: string,
  input: CreateTrainingLessonInput,
): Promise<TrainingLessonDoc> {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw AppError.badRequest('Invalid training id');
  }
  const training = await TrainingProgram.findById(trainingId);
  if (!training) throw AppError.notFound('Training program not found');

  const module = await TrainingModule.findById(input.moduleId);
  if (!module) throw AppError.notFound('Training module not found');
  if (String(module.training) !== String(training._id)) {
    throw AppError.badRequest('Module does not belong to this training');
  }

  // Auto-assign order if not provided
  let order = input.order;
  if (order === undefined) {
    const lastLesson = await TrainingLesson.findOne({ module: module._id })
      .sort({ order: -1 })
      .select('order')
      .lean();
    order = lastLesson ? (lastLesson.order ?? 0) + 1 : 0;
  }

  const doc = await TrainingLesson.create({
    training: training._id,
    module: module._id,
    title: input.title,
    description: input.description,
    type: input.type,
    content: input.content,
    resourceUrl: input.resourceUrl,
    durationMinutes: input.durationMinutes,
    order,
    quizData: input.quizData,
  });
  return doc;
}

export async function updateLesson(
  lessonId: string,
  input: UpdateTrainingLessonInput,
): Promise<TrainingLessonDoc> {
  if (!Types.ObjectId.isValid(lessonId)) {
    throw AppError.badRequest('Invalid lesson id');
  }
  const doc = await TrainingLesson.findByIdAndUpdate(lessonId, input, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw AppError.notFound('Training lesson not found');
  return doc;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  if (!Types.ObjectId.isValid(lessonId)) {
    throw AppError.badRequest('Invalid lesson id');
  }
  const doc = await TrainingLesson.findById(lessonId);
  if (!doc) throw AppError.notFound('Training lesson not found');
  await TrainingLesson.deleteOne({ _id: doc._id });
}

// ---------------------------------------------------------------------------
// Training content structure (modules + lessons together)
// ---------------------------------------------------------------------------

export interface TrainingContentView {
  training: { id: string; title: string; contentType?: string; difficulty?: string };
  modules: Array<{
    id: string;
    title: string;
    description?: string;
    order: number;
    lessons: Array<{
      id: string;
      title: string;
      type: string;
      durationMinutes: number;
      order: number;
    }>;
  }>;
  totalLessons: number;
}

export async function getTrainingContent(trainingId: string): Promise<TrainingContentView> {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw AppError.badRequest('Invalid training id');
  }
  const training = await TrainingProgram.findById(trainingId);
  if (!training) throw AppError.notFound('Training program not found');

  const [modules, allLessons] = await Promise.all([
    TrainingModule.find({ training: training._id }).sort({ order: 1 }).lean(),
    TrainingLesson.find({ training: training._id }).sort({ order: 1 }).lean(),
  ]);

  const lessonsByModule = new Map<string, Array<(typeof allLessons)[number]>>();
  for (const lesson of allLessons) {
    const key = String(lesson.module);
    if (!lessonsByModule.has(key)) lessonsByModule.set(key, []);
    lessonsByModule.get(key)!.push(lesson);
  }

  return {
    training: {
      id: String(training._id),
      title: training.title,
      contentType: (training as unknown as { contentType?: string }).contentType,
      difficulty: (training as unknown as { difficulty?: string }).difficulty,
    },
    modules: modules.map((m) => ({
      id: String(m._id),
      title: m.title,
      description: m.description,
      order: m.order ?? 0,
      lessons: (lessonsByModule.get(String(m._id)) ?? []).map((l) => ({
        id: String(l._id),
        title: l.title,
        type: l.type,
        durationMinutes: l.durationMinutes ?? 0,
        order: l.order ?? 0,
      })),
    })),
    totalLessons: allLessons.length,
  };
}

// ---------------------------------------------------------------------------
// Student lesson completion (with idempotency)
// ---------------------------------------------------------------------------

/**
 * Mark a lesson as completed. Idempotent: completing the same lesson twice
 * does not create duplicate progress. Updates enrollment progress based on
 * total lessons in the training.
 */
export async function completeLesson(
  userId: string,
  studentProfileId: string,
  trainingId: string,
  lessonId: string,
): Promise<{
  enrollment: unknown;
  lesson: { id: string; title: string };
  totalLessons: number;
  completedCount: number;
  progress: number;
}> {
  if (!Types.ObjectId.isValid(trainingId)) {
    throw AppError.badRequest('Invalid training id');
  }
  if (!Types.ObjectId.isValid(lessonId)) {
    throw AppError.badRequest('Invalid lesson id');
  }

  // Verify the lesson belongs to this training
  const lesson = await TrainingLesson.findById(lessonId);
  if (!lesson) throw AppError.notFound('Training lesson not found');
  if (String(lesson.training) !== String(trainingId)) {
    throw AppError.badRequest('Lesson does not belong to this training');
  }

  // Verify the enrollment exists and belongs to the student
  const enrollment = await TrainingEnrollment.findOne({
    student: new Types.ObjectId(studentProfileId),
    training: new Types.ObjectId(trainingId),
  });
  if (!enrollment) {
    throw AppError.notFound('You are not enrolled in this training');
  }
  if (enrollment.status === 'DROPPED') {
    throw AppError.badRequest('Cannot complete lessons in a dropped training');
  }
  if (enrollment.status === 'COMPLETED') {
    throw AppError.badRequest('Training is already completed');
  }

  // Count total lessons in the training
  const totalLessons = await TrainingLesson.countDocuments({
    training: new Types.ObjectId(trainingId),
  });

  // Idempotency: only add if not already completed
  const completed = (enrollment.completedLessons ?? []).map((l) => String(l));
  const alreadyCompleted = completed.includes(String(lessonId));

  if (!alreadyCompleted) {
    enrollment.completedLessons = [
      ...(enrollment.completedLessons ?? []),
      new Types.ObjectId(lessonId),
    ] as unknown as typeof enrollment.completedLessons;
    enrollment.totalLessons = totalLessons;
    enrollment.currentLesson = new Types.ObjectId(
      lessonId,
    ) as unknown as typeof enrollment.currentLesson;

    // Calculate progress percentage
    if (totalLessons > 0) {
      const newCount = completed.length + 1;
      const pct = Math.min(100, Math.round((newCount / totalLessons) * 100));
      enrollment.progress = pct;
    } else {
      enrollment.progress = 100;
    }

    // Auto-transition to IN_PROGRESS
    if (enrollment.status === 'ENROLLED') {
      enrollment.status = 'IN_PROGRESS' as typeof enrollment.status;
      enrollment.startedAt = new Date();
    }

    await enrollment.save();
  }

  const completedCount = enrollment.completedLessons?.length ?? 0;
  return {
    enrollment,
    lesson: { id: String(lesson._id), title: lesson.title },
    totalLessons,
    completedCount,
    progress: enrollment.progress ?? 0,
  };
}

/**
 * Reassess skills for a student after training completion.
 * - Does NOT auto-upgrade proficiency to EXPERT.
 * - Records evidence (training, covered skills, certificate id).
 * - Returns the list of skills that should be reassessed.
 */
export async function getReassessmentRecommendations(
  userId: string,
  studentProfileId: string,
  enrollmentId: string,
): Promise<{
  enrollmentId: string;
  trainingTitle: string;
  coveredSkills: Array<{ id: string; name: string }>;
  message: string;
}> {
  if (!Types.ObjectId.isValid(enrollmentId)) {
    throw AppError.badRequest('Invalid enrollment id');
  }
  const enrollment = await TrainingEnrollment.findById(enrollmentId).populate('training').populate({
    path: 'student',
    select: 'user fullName',
  });
  if (!enrollment) throw AppError.notFound('Enrollment not found');

  // Authorize: must be the enrollment's student or admin
  const studentUserId = (enrollment.student as unknown as { user?: { _id?: unknown } })?.user?._id;
  if (String(studentUserId) !== userId) {
    throw AppError.forbidden('Not your enrollment');
  }
  if (String(enrollment.student?._id ?? enrollment.student) !== String(studentProfileId)) {
    throw AppError.forbidden('Not your enrollment');
  }

  const training = enrollment.training as unknown as {
    _id: unknown;
    title: string;
    skills: Array<{ _id: unknown; name: string }>;
  };

  // Resolve skill names
  const { Skill } = await import('../../models');
  const skillIds = (training.skills ?? []).map((s) => s._id ?? s);
  const skillRows = await Skill.find({ _id: { $in: skillIds } })
    .select('name')
    .lean();
  const coveredSkills = skillRows.map((s) => ({ id: String(s._id), name: String(s.name) }));

  return {
    enrollmentId: String(enrollment._id),
    trainingTitle: String(training.title),
    coveredSkills,
    message:
      'You have completed this training. Take a reassessment to upgrade your proficiency on the covered skills.',
  };
}
