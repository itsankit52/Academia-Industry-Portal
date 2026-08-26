import { z } from 'zod';

export const createInterimReportSchema = z
  .object({
    weekNumber: z.number().int().min(1).max(52),
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    workDescription: z.string().trim().max(5000).optional(),
    learnings: z.string().trim().max(3000).optional(),
    challenges: z.string().trim().max(3000).optional(),
    hoursSpent: z.number().min(0).max(168).optional(),
  })
  .strict();

export const mentorFeedbackSchema = z
  .object({
    mentorFeedback: z.string().trim().min(1).max(2000),
    mentorRating: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const listInterimReportsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CreateInterimReportInput = z.infer<typeof createInterimReportSchema>;
export type MentorFeedbackInput = z.infer<typeof mentorFeedbackSchema>;
export type ListInterimReportsQuery = z.infer<typeof listInterimReportsQuerySchema>;
