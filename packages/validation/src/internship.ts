import { z } from 'zod';
import { WORK_MODES, INTERNSHIP_STATUSES } from '@aip/config';
import type { WorkMode, InternshipStatus } from '@aip/config';
import { objectIdSchema } from './common';

const workModeEnum = z.enum(WORK_MODES as unknown as [WorkMode, ...WorkMode[]]);
const internshipStatusEnum = z.enum(
  INTERNSHIP_STATUSES as unknown as [InternshipStatus, ...InternshipStatus[]],
);

export const createInternshipSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(20).max(5000),
    location: z.string().min(1).max(200),
    workMode: workModeEnum,
    durationMonths: z.number().int().min(1).max(24),
    stipend: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    minCgpa: z.number().min(0).max(10).optional(),
    eligibleBranches: z.array(z.string().min(1).max(120)),
    eligibleGradYears: z.array(z.number().int().min(1950).max(2100)),
    requiredSkills: z.array(objectIdSchema).min(1),
    preferredSkills: z.array(objectIdSchema),
    applicationDeadline: z.string().datetime().optional(),
    openings: z.number().int().min(1).default(1),
    status: internshipStatusEnum.default('DRAFT'),
  })
  .strict();

export const updateInternshipSchema = createInternshipSchema.partial();

export type CreateInternshipInput = z.infer<typeof createInternshipSchema>;
export type UpdateInternshipInput = z.infer<typeof updateInternshipSchema>;
