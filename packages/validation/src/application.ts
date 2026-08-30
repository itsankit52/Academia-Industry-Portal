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

export const setInternshipDatesSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    expectedEndDate: z.string().datetime().optional(),
  })
  .strict();

// Phase 5B: Mentor assignment
export const assignMentorSchema = z
  .object({
    mentorUserId: objectIdSchema,
  })
  .strict();

// Phase 5B: Internship completion
export const completeInternshipSchema = z
  .object({
    completionNotes: z.string().max(2000).optional(),
    rating: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusInput = z.infer<typeof updateApplicationStatusSchema>;
export type SetInternshipDatesInput = z.infer<typeof setInternshipDatesSchema>;
export type AssignMentorInput = z.infer<typeof assignMentorSchema>;
export type CompleteInternshipInput = z.infer<typeof completeInternshipSchema>;

// Phase 6B: Offer details input
export const setOfferDetailsSchema = z
  .object({
    offeredSalary: z.number().min(0, 'Salary cannot be negative').optional(),
    currency: z.string().min(1, 'Currency is required').max(8).optional(),
    joiningDate: z.string().datetime().optional(),
    offerTerms: z.string().max(5000).optional(),
    offerExpiresAt: z.string().datetime().optional(),
  })
  .strict();

export type SetOfferDetailsInput = z.infer<typeof setOfferDetailsSchema>;

// Phase 6B: Withdrawal request input
export const withdrawOfferSchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .strict();

export type WithdrawOfferInput = z.infer<typeof withdrawOfferSchema>;
