import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  OPPORTUNITY_TYPES,
  RECRUITMENT_SOURCES,
  VERIFICATION_STATUSES,
} from '@aip/config';
import type {
  ApplicationStatus,
  OpportunityType,
  RecruitmentSource,
  VerificationStatus,
} from '@aip/config';
import { objectIdSchema } from './common';

const applicationStatusEnum = z.enum(
  APPLICATION_STATUSES as unknown as [ApplicationStatus, ...ApplicationStatus[]],
);
const opportunityTypeEnum = z.enum(
  OPPORTUNITY_TYPES as unknown as [OpportunityType, ...OpportunityType[]],
);
const recruitmentSourceEnum = z.enum(
  RECRUITMENT_SOURCES as unknown as [RecruitmentSource, ...RecruitmentSource[]],
);
const verificationStatusEnum = z.enum(
  VERIFICATION_STATUSES as unknown as [VerificationStatus, ...VerificationStatus[]],
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

// Phase 7B: Recruitment source input — company sets/updates how the candidate
// was sourced for this specific application.
export const setRecruitmentSourceSchema = z
  .object({
    source: recruitmentSourceEnum,
  })
  .strict();

export type SetRecruitmentSourceInput = z.infer<typeof setRecruitmentSourceSchema>;

// Phase 7B: Placement completion (company marks candidate as placed/joined).
// Distinct from OFFER_ACCEPTED — that records the student accepting the offer;
// this records the candidate actually joining the role.
export const completePlacementSchema = z
  .object({
    placedAt: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type CompletePlacementInput = z.infer<typeof completePlacementSchema>;

// Phase 7B: Placement verification (institution/admin). Status is the explicit
// new state (PENDING/VERIFIED/REJECTED); institutions are expected to verify
// genuine placements, so the API defaults to VERIFIED when no status is sent
// for a normal verification call.
export const verifyPlacementSchema = z
  .object({
    status: verificationStatusEnum.default('VERIFIED'),
    note: z.string().max(2000).optional(),
  })
  .strict();

export type VerifyPlacementInput = z.infer<typeof verifyPlacementSchema>;
