import { z } from 'zod';
import { WORK_MODES } from '@aip/config';
import type { WorkMode } from '@aip/config';

export const FACULTY_OPPORTUNITY_TYPES = [
  'FACULTY_INTERNSHIP',
  'FDP',
  'CONSULTANCY',
  'COLLABORATIVE_RESEARCH',
  'PROJECT',
  'APPRENTICESHIP',
] as const;
export type FacultyOpportunityType = typeof FACULTY_OPPORTUNITY_TYPES[number];

export const FACULTY_OPP_HOST_TYPES = ['COMPANY', 'INSTITUTION'] as const;
export type FacultyOppHostType = typeof FACULTY_OPP_HOST_TYPES[number];

export const FACULTY_OPP_STATUSES = ['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'] as const;
export type FacultyOppStatus = typeof FACULTY_OPP_STATUSES[number];

export const FACULTY_OPP_TARGET_ROLES = ['STUDENT', 'FACULTY'] as const;
export type FacultyOppTargetRole = typeof FACULTY_OPP_TARGET_ROLES[number];

const facultyOpportunityTypeEnum = z.enum(
  FACULTY_OPPORTUNITY_TYPES as unknown as [FacultyOpportunityType, ...FacultyOpportunityType[]],
);
const hostTypeEnum = z.enum(FACULTY_OPP_HOST_TYPES as unknown as [FacultyOppHostType, ...FacultyOppHostType[]]);
const statusEnum = z.enum(FACULTY_OPP_STATUSES as unknown as [FacultyOppStatus, ...FacultyOppStatus[]]);
const targetRoleEnum = z.enum(
  FACULTY_OPP_TARGET_ROLES as unknown as [FacultyOppTargetRole, ...FacultyOppTargetRole[]],
);
const workModeEnum = z.enum(WORK_MODES as unknown as [WorkMode, ...WorkMode[]]);

const stipendSchema = z
  .object({
    amount: z.number().min(0),
    currency: z.string().min(1).max(6).default('INR'),
  })
  .strict();

function validateTargetRoles(input: {
  opportunityType: FacultyOpportunityType;
  targetRoles: FacultyOppTargetRole[];
}): boolean {
  const { opportunityType, targetRoles } = input;
  const set = new Set(targetRoles);
  if (['FDP', 'CONSULTANCY', 'COLLABORATIVE_RESEARCH'].includes(opportunityType)) {
    return set.has('FACULTY');
  }
  if (['PROJECT', 'APPRENTICESHIP'].includes(opportunityType)) {
    return set.has('STUDENT');
  }
  if (opportunityType === 'FACULTY_INTERNSHIP') {
    return set.has('FACULTY') && !set.has('STUDENT');
  }
  return true;
}

const baseObject = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(20).max(10000),
    opportunityType: facultyOpportunityTypeEnum,
    requiredExpertise: z.array(z.string().min(1).max(80)).default([]),
    preferredQualifications: z.array(z.string().min(1).max(200)).default([]),
    durationWeeks: z.number().int().min(1).max(260).optional(),
    stipend: stipendSchema.optional(),
    location: z.string().min(1).max(200),
    mode: workModeEnum,
    applicationDeadline: z.string().datetime(),
    openings: z.number().int().min(1).default(1),
    targetRoles: z.array(targetRoleEnum).min(1),
    status: statusEnum.default('DRAFT'),
  })
  .strict();

export const createFacultyOpportunitySchema = baseObject.refine(validateTargetRoles, {
  message: 'targetRoles do not match opportunityType rules',
  path: ['targetRoles'],
});

export const updateFacultyOpportunitySchema = baseObject.partial().strict();

export const listFacultyOpportunitiesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    sortBy: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    q: z.string().optional(),
    opportunityType: facultyOpportunityTypeEnum.optional(),
    status: statusEnum.optional(),
    hostType: hostTypeEnum.optional(),
    mode: workModeEnum.optional(),
  })
  .strict();

export type CreateFacultyOpportunityInput = z.infer<typeof createFacultyOpportunitySchema>;
export type UpdateFacultyOpportunityInput = z.infer<typeof updateFacultyOpportunitySchema>;
export type ListFacultyOpportunitiesQuery = z.infer<typeof listFacultyOpportunitiesQuerySchema>;
