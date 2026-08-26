import { z } from 'zod';
import { OPPORTUNITY_TYPES } from '@aip/config';
import type { OpportunityType } from '@aip/config';
import { objectIdSchema } from './common';

const opportunityTypeEnum = z.enum(
  OPPORTUNITY_TYPES as unknown as [OpportunityType, ...OpportunityType[]],
);

export const resumeAnalyzeSchema = z
  .object({
    text: z.string().min(50).max(20000),
  })
  .strict();

export const jobMatchExplainSchema = z
  .object({
    studentSkillIds: z.array(objectIdSchema).optional(),
    opportunityId: objectIdSchema,
    opportunityType: opportunityTypeEnum,
  })
  .strict();

export const chatSchema = z
  .object({
    message: z.string().min(1).max(2000),
  })
  .strict();

export type ResumeAnalyzeInput = z.infer<typeof resumeAnalyzeSchema>;
export type JobMatchExplainInput = z.infer<typeof jobMatchExplainSchema>;
export type ChatInput = z.infer<typeof chatSchema>;
