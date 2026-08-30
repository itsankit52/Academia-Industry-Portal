import { z } from 'zod';
import { objectIdSchema } from './common';

const trainingStatusEnum = z.enum(['ACTIVE', 'ARCHIVED']);
const enrollmentStatusEnum = z.enum(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'DROPPED']);

export const createTrainingSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(20).max(5000),
    provider: z.string().min(1).max(200),
    skills: z.array(objectIdSchema).min(1),
    durationWeeks: z.number().int().min(1).max(104),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    registrationDeadline: z.string().datetime().optional(),
    registrationUrl: z.string().url(),
    status: trainingStatusEnum.default('ACTIVE'),
  })
  .strict();

export const updateTrainingSchema = createTrainingSchema.partial();

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
