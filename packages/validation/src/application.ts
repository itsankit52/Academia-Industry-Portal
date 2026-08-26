import { z } from 'zod';
import { APPLICATION_STATUSES, OPPORTUNITY_TYPES } from '@aip/config';
import type { ApplicationStatus, OpportunityType } from '@aip/config';
import { objectIdSchema } from './common';

const applicationStatusEnum = z.enum(
  APPLICATION_STATUSES as unknown as [ApplicationStatus, ...ApplicationStatus[]],
);
const opportunityTypeEnum = z.enum(
  OPPORTUNITY_TYPES as unknown as [OpportunityType, ...OpportunityType[]],
);

export const createApplicationSchema = z
  .object({
    opportunityType: opportunityTypeEnum,
    opportunityId: objectIdSchema,
    coverLetter: z.string().max(5000).optional(),
    resumeId: objectIdSchema.optional(),
  })
  .strict();

export const updateApplicationStatusSchema = z
  .object({
    status: applicationStatusEnum,
    note: z.string().max(500).optional(),
  })
  .strict();

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
