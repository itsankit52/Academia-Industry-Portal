import { z } from 'zod';
import { objectIdSchema } from './common';
import {
  MAX_ANSWER_LENGTH,
  MAX_ASSESSMENT_QUESTIONS,
  MIN_ASSESSMENT_QUESTIONS,
} from '@aip/config';

export const generateAssessmentSchema = z
  .object({
    skillIds: z.array(objectIdSchema).optional(),
    questionCount: z
      .number()
      .int()
      .min(MIN_ASSESSMENT_QUESTIONS)
      .max(MAX_ASSESSMENT_QUESTIONS)
      .optional(),
    durationMinutes: z.number().int().min(15).max(120).optional(),
  })
  .strict();
export type GenerateAssessmentInput = z.infer<typeof generateAssessmentSchema>;

export const saveAnswerSchema = z
  .object({
    questionId: z.string().min(1),
    text: z.string().max(MAX_ANSWER_LENGTH).default(''),
  })
  .strict();
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
