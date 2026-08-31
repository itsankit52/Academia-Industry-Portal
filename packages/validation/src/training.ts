import { z } from 'zod';
import { objectIdSchema } from './common';

const trainingStatusEnum = z.enum(['ACTIVE', 'ARCHIVED']);
const enrollmentStatusEnum = z.enum(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']);
const trainingContentTypeEnum = z.enum(['INTERNAL', 'EXTERNAL', 'HYBRID']);
const trainingDifficultyEnum = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']);
const lessonTypeEnum = z.enum(['VIDEO', 'ARTICLE', 'QUIZ', 'RESOURCE']);

// Base training object schema — kept as `ZodObject` so `.partial()` works.
// Cross-field rules (e.g. EXTERNAL requires registrationUrl) are applied via
// `.superRefine()` on the *create* schema only; the *update* schema is a
// straight `.partial()` of the same object, so existing EXTERNAL programmes
// can be updated without having to re-supply registrationUrl.
const trainingObjectSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(20).max(5000),
  provider: z.string().min(1).max(200),
  skills: z.array(objectIdSchema).min(1),
  durationWeeks: z.number().int().min(1).max(104),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  registrationUrl: z.string().url().optional(),
  status: trainingStatusEnum.default('ACTIVE'),
  // Phase 15B — Extended training fields
  contentType: trainingContentTypeEnum.default('INTERNAL'),
  difficulty: trainingDifficultyEnum.default('INTERMEDIATE'),
  estimatedHours: z.number().min(0).max(10000).optional(),
  certificateAvailable: z.boolean().default(false),
});

export const createTrainingSchema = trainingObjectSchema.strict().superRefine((data, ctx) => {
  if (data.contentType === 'EXTERNAL' && !data.registrationUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'registrationUrl is required for EXTERNAL training',
      path: ['registrationUrl'],
    });
  }
});

export const updateTrainingSchema = trainingObjectSchema.partial().strict();

export type CreateTrainingInput = z.infer<typeof createTrainingSchema>;
export type UpdateTrainingInput = z.infer<typeof updateTrainingSchema>;

// Phase 8 — Training enrollment
export const enrollmentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: enrollmentStatusEnum.optional(),
  })
  .strict();

export const updateProgressSchema = z
  .object({
    progress: z.number().int().min(0).max(100),
  })
  .strict();

export type EnrollmentQuery = z.infer<typeof enrollmentQuerySchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;

// Phase 15B — Training content (modules + lessons)
const trainingModuleObjectSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  order: z.number().int().min(0).optional(),
});

export const createTrainingModuleSchema = trainingModuleObjectSchema.strict();
export const updateTrainingModuleSchema = trainingModuleObjectSchema.partial().strict();

const trainingLessonObjectSchema = z.object({
  moduleId: objectIdSchema,
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  type: lessonTypeEnum.default('ARTICLE'),
  content: z.string().max(50000).optional(),
  resourceUrl: z.string().url().optional().or(z.literal('')),
  durationMinutes: z.number().int().min(0).max(1440).default(0),
  order: z.number().int().min(0).optional(),
  quizData: z.string().optional(),
});

export const createTrainingLessonSchema = trainingLessonObjectSchema
  .strict()
  .superRefine((data, ctx) => {
    if ((data.type === 'VIDEO' || data.type === 'RESOURCE') && !data.resourceUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `resourceUrl is required for ${data.type} type`,
        path: ['resourceUrl'],
      });
    }
  });

// For updates, `moduleId` cannot be changed (a lesson belongs to a single
// module), so we strip it from the partial object schema.
export const updateTrainingLessonSchema = trainingLessonObjectSchema
  .omit({ moduleId: true })
  .partial()
  .strict();

export const completeLessonSchema = z
  .object({
    lessonId: objectIdSchema,
  })
  .strict();

export type CreateTrainingModuleInput = z.infer<typeof createTrainingModuleSchema>;
export type UpdateTrainingModuleInput = z.infer<typeof updateTrainingModuleSchema>;
export type CreateTrainingLessonInput = z.infer<typeof createTrainingLessonSchema>;
export type UpdateTrainingLessonInput = z.infer<typeof updateTrainingLessonSchema>;
export type CompleteLessonInput = z.infer<typeof completeLessonSchema>;
