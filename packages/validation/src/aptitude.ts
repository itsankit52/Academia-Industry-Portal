import { z } from 'zod';
import { APTITUDE_CATEGORIES } from '@aip/config';
import type { AptitudeCategory } from '@aip/config';
import { objectIdSchema, paginationQuerySchema } from './common';

const categoryEnum = z.enum(
  APTITUDE_CATEGORIES as unknown as [AptitudeCategory, ...AptitudeCategory[]],
);
const difficultyEnum = z.enum(['EASY', 'MEDIUM', 'HARD'] as const);
const statusEnum = z.enum(['ACTIVE', 'ARCHIVED'] as const);

export const createAptitudeQuestionSchema = z
  .object({
    category: categoryEnum,
    question: z.string().trim().min(10).max(1000),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().max(2000).optional(),
    difficulty: difficultyEnum.optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .strict();

export const updateAptitudeQuestionSchema = z
  .object({
    category: categoryEnum.optional(),
    question: z.string().trim().min(10).max(1000).optional(),
    options: z.array(z.string().trim().min(1)).length(4).optional(),
    correctIndex: z.number().int().min(0).max(3).optional(),
    explanation: z.string().trim().max(2000).optional(),
    difficulty: difficultyEnum.optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    status: statusEnum.optional(),
  })
  .strict();

export const startAptitudeTestSchema = z
  .object({
    category: categoryEnum,
    questionCount: z.number().int().min(1).max(50).default(15),
  })
  .strict();

export const saveAptitudeAnswerSchema = z
  .object({
    questionId: objectIdSchema,
    chosenIndex: z.number().int().min(0).max(3),
  })
  .strict();

export const listAptitudeQuestionsQuerySchema = paginationQuerySchema.extend({
  category: categoryEnum.optional(),
  difficulty: difficultyEnum.optional(),
  status: statusEnum.optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

export const listMyAptitudeTestsQuerySchema = paginationQuerySchema.extend({
  category: categoryEnum.optional(),
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'EXPIRED'] as const).optional(),
});

export type CreateAptitudeQuestionInput = z.infer<typeof createAptitudeQuestionSchema>;
export type UpdateAptitudeQuestionInput = z.infer<typeof updateAptitudeQuestionSchema>;
export type StartAptitudeTestInput = z.infer<typeof startAptitudeTestSchema>;
export type SaveAptitudeAnswerInput = z.infer<typeof saveAptitudeAnswerSchema>;
export type ListAptitudeQuestionsQuery = z.infer<typeof listAptitudeQuestionsQuerySchema>;
export type ListMyAptitudeTestsQuery = z.infer<typeof listMyAptitudeTestsQuerySchema>;
