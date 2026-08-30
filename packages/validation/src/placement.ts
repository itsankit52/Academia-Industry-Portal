/**
 * Phase 10 — Validation schemas for the placement-readiness module.
 *
 * The placement-readiness endpoints intentionally require no input from the
 * client: readiness is derived server-side from the authenticated student's
 * own data. Institution endpoints use the existing dashboardScopeSchema.
 * Only opportunityId/opportunityType (optional) filters are accepted.
 */

import { z } from 'zod';
import {
  PLACEMENT_DRIVE_MODES,
  PLACEMENT_DRIVE_STATUSES,
  PLACEMENT_PARTICIPANT_STATUSES,
  PLACEMENT_PARTICIPANT_OUTCOMES,
  PLACEMENT_ACTION_ITEM_TYPES,
  PLACEMENT_ACTION_ITEM_SEVERITY,
  PLACEMENT_ACTION_ITEM_STATUSES,
  GENDERS,
  OPPORTUNITY_TYPES,
  PROFICIENCY_LEVELS,
  VERIFICATION_STATUSES,
} from '@aip/config';
import { objectIdSchema, paginationQuerySchema } from './common';

export const placementReadinessQuerySchema = z.object({
  opportunityId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid opportunityId').optional(),
  opportunityType: z.enum(['JOB', 'INTERNSHIP']).optional(),
});

export const placementReadinessParamsSchema = z.object({
  opportunityId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid opportunityId').optional(),
  opportunityType: z.enum(['JOB', 'INTERNSHIP']).optional(),
});

export type PlacementReadinessQuery = z.infer<typeof placementReadinessQuerySchema>;
export type PlacementReadinessParams = z.infer<typeof placementReadinessParamsSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Phase 11 — Placement Drive Operations Validation
 *
 * Zod schemas for placement drive, participant, outcome, and action item
 * endpoints. Reuses objectIdSchema, idParamSchema, paginationQuerySchema
 * where appropriate.
 * ──────────────────────────────────────────────────────────────────────── */

// Eligibility rules
export const eligibilityRulesSchema = z
  .object({
    minCgpa: z.number().min(0).max(10).optional(),
    allowedBranches: z.array(z.string().trim().max(80)).optional(),
    allowedGraduationYears: z.array(z.number().int().min(1970).max(2100)).optional(),
    maxActiveBacklogs: z.number().int().min(0).optional(),
    gender: z.enum(GENDERS).optional(),
    minReadinessScore: z.number().min(0).max(100).optional(),
    blockIfAlreadyPlaced: z.boolean().optional(),
    maxOffersHeld: z.number().int().min(0).optional(),
    resumeRequired: z.boolean().optional(),
    minSkillProficiency: z
      .array(
        z.object({
          skillId: objectIdSchema,
          minProficiency: z.enum(PROFICIENCY_LEVELS),
        }),
      )
      .optional(),
  })
  .optional();

// Create a new placement drive
export const createPlacementDriveSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(20).max(5000),
    mode: z.enum(PLACEMENT_DRIVE_MODES),
    location: z.string().trim().max(200).optional(),
    participatingCompanies: z.array(objectIdSchema).min(1),
    opportunities: z
      .array(
        z.object({
          opportunityType: z.enum(OPPORTUNITY_TYPES),
          opportunityId: objectIdSchema,
          openings: z.number().int().min(1).default(1),
        }),
      )
      .default([]),
    eligibilityRules: eligibilityRulesSchema,
    registrationOpensAt: z.coerce.date().optional(),
    registrationClosesAt: z.coerce.date().optional(),
    driveStartsAt: z.coerce.date().optional(),
    driveEndsAt: z.coerce.date().optional(),
    maxParticipationsPerStudent: z.number().int().min(1).max(5).default(1),
    totalSlots: z.number().int().min(0).optional(),
    coordinators: z.array(objectIdSchema).default([]),
  })
  .strict()
  .refine(
    (data) => {
      if (data.registrationOpensAt && data.registrationClosesAt) {
        return data.registrationClosesAt > data.registrationOpensAt;
      }
      return true;
    },
    {
      message: 'registrationClosesAt must be after registrationOpensAt',
      path: ['registrationClosesAt'],
    },
  )
  .refine(
    (data) => {
      if (data.driveStartsAt && data.driveEndsAt) {
        return data.driveEndsAt > data.driveStartsAt;
      }
      return true;
    },
    {
      message: 'driveEndsAt must be after driveStartsAt',
      path: ['driveEndsAt'],
    },
  );

// Update an existing placement drive
export const updatePlacementDriveSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    mode: z.enum(PLACEMENT_DRIVE_MODES).optional(),
    location: z.string().trim().max(200).optional(),
    participatingCompanies: z.array(objectIdSchema).min(1).optional(),
    opportunities: z
      .array(
        z.object({
          opportunityType: z.enum(OPPORTUNITY_TYPES),
          opportunityId: objectIdSchema,
          openings: z.number().int().min(1).default(1),
        }),
      )
      .optional(),
    eligibilityRules: eligibilityRulesSchema,
    registrationOpensAt: z.coerce.date().optional(),
    registrationClosesAt: z.coerce.date().optional(),
    driveStartsAt: z.coerce.date().optional(),
    driveEndsAt: z.coerce.date().optional(),
    maxParticipationsPerStudent: z.number().int().min(1).max(5).optional(),
    totalSlots: z.number().int().min(0).optional(),
    coordinators: z.array(objectIdSchema).optional(),
  })
  .strict();

// List query schema for placement drives
export const placementDriveListQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(PLACEMENT_DRIVE_STATUSES).optional(),
    mode: z.enum(PLACEMENT_DRIVE_MODES).optional(),
    institutionId: objectIdSchema.optional(),
    companyId: objectIdSchema.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();

// Drive transition schema
export const placementDriveTransitionSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// Register for a drive
export const registerForDriveSchema = z
  .object({
    companyId: objectIdSchema.optional(),
    opportunityType: z.enum(OPPORTUNITY_TYPES).optional(),
    opportunityId: objectIdSchema.optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

// Bulk register schema
export const bulkRegisterSchema = z
  .object({
    studentIds: z.array(objectIdSchema).min(1).max(200),
    companyId: objectIdSchema.optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

// Transition participant schema
export const transitionParticipantSchema = z
  .object({
    toStatus: z.enum(PLACEMENT_PARTICIPANT_STATUSES),
    reason: z.string().trim().max(500).optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

// Withdraw participant schema
export const withdrawParticipantSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

// Record outcome schema
export const recordOutcomeSchema = z
  .object({
    outcome: z.enum(PLACEMENT_PARTICIPANT_OUTCOMES),
    salaryPackage: z
      .object({
        amount: z.number().min(0).optional(),
        currency: z.string().trim().max(8).default('INR'),
        ctcLpa: z.number().min(0).optional(),
      })
      .optional(),
    joiningDate: z.coerce.date().optional(),
    offerExpiresAt: z.coerce.date().optional(),
    offerLetterRef: objectIdSchema.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

// Update outcome schema
export const updateOutcomeSchema = z
  .object({
    outcome: z.enum(PLACEMENT_PARTICIPANT_OUTCOMES).optional(),
    salaryPackage: z
      .object({
        amount: z.number().min(0).optional(),
        currency: z.string().trim().max(8).optional(),
        ctcLpa: z.number().min(0).optional(),
      })
      .optional(),
    joiningDate: z.coerce.date().optional(),
    offerExpiresAt: z.coerce.date().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

// Verify outcome schema
export const verifyOutcomeSchema = z
  .object({
    status: z.enum(VERIFICATION_STATUSES),
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

// Action item list query
export const actionItemListQuerySchema = paginationQuerySchema
  .extend({
    type: z.enum(PLACEMENT_ACTION_ITEM_TYPES).optional(),
    severity: z.enum(PLACEMENT_ACTION_ITEM_SEVERITY).optional(),
    status: z.enum(PLACEMENT_ACTION_ITEM_STATUSES).optional(),
    driveId: objectIdSchema.optional(),
    studentId: objectIdSchema.optional(),
  })
  .strict();

// Resolve action item schema
export const resolveActionItemSchema = z
  .object({
    resolutionNote: z.string().trim().max(500).optional(),
  })
  .strict();

// List drive participants query
export const driveParticipantsListQuerySchema = paginationQuerySchema
  .extend({
    status: z.enum(PLACEMENT_PARTICIPANT_STATUSES).optional(),
    companyId: objectIdSchema.optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();

// List drive outcomes query
export const driveOutcomesListQuerySchema = paginationQuerySchema
  .extend({
    outcome: z.enum(PLACEMENT_PARTICIPANT_OUTCOMES).optional(),
    companyId: objectIdSchema.optional(),
    verified: z
      .union([z.literal('true'), z.literal('false')])
      .transform((v) => v === 'true')
      .optional(),
  })
  .strict();

// Institution drives report query
export const institutionDrivesReportQuerySchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict();

// Compare drives schema
export const compareDrivesSchema = z
  .object({
    driveIds: z.array(objectIdSchema).min(1).max(10),
  })
  .strict();

// Param schemas
export const idObjectIdParamSchema = z.object({ id: objectIdSchema }).strict();
export const driveIdAndParticipantIdSchema = z
  .object({
    id: objectIdSchema,
    participantId: objectIdSchema,
  })
  .strict();
export const driveIdAndOutcomeIdSchema = z
  .object({
    id: objectIdSchema,
    outcomeId: objectIdSchema,
  })
  .strict();

export type CreatePlacementDriveInput = z.infer<typeof createPlacementDriveSchema>;
export type UpdatePlacementDriveInput = z.infer<typeof updatePlacementDriveSchema>;
export type PlacementDriveListQuery = z.infer<typeof placementDriveListQuerySchema>;
export type RegisterForDriveInput = z.infer<typeof registerForDriveSchema>;
export type BulkRegisterInput = z.infer<typeof bulkRegisterSchema>;
export type TransitionParticipantInput = z.infer<typeof transitionParticipantSchema>;
export type WithdrawParticipantInput = z.infer<typeof withdrawParticipantSchema>;
export type RecordOutcomeInput = z.infer<typeof recordOutcomeSchema>;
export type UpdateOutcomeInput = z.infer<typeof updateOutcomeSchema>;
export type VerifyOutcomeInput = z.infer<typeof verifyOutcomeSchema>;
export type ActionItemListQuery = z.infer<typeof actionItemListQuerySchema>;
export type ResolveActionItemInput = z.infer<typeof resolveActionItemSchema>;
export type DriveParticipantsListQuery = z.infer<typeof driveParticipantsListQuerySchema>;
export type DriveOutcomesListQuery = z.infer<typeof driveOutcomesListQuerySchema>;
export type InstitutionDrivesReportQuery = z.infer<typeof institutionDrivesReportQuerySchema>;
export type CompareDrivesInput = z.infer<typeof compareDrivesSchema>;
