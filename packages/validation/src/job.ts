import { z } from 'zod';
import { WORK_MODES, EMPLOYMENT_TYPES, JOB_STATUSES } from '@aip/config';
import type { WorkMode, EmploymentType, JobStatus } from '@aip/config';
import { objectIdSchema } from './common';

const workModeEnum = z.enum(WORK_MODES as unknown as [WorkMode, ...WorkMode[]]);
const employmentTypeEnum = z.enum(EMPLOYMENT_TYPES as unknown as [EmploymentType, ...EmploymentType[]]);
const jobStatusEnum = z.enum(JOB_STATUSES as unknown as [JobStatus, ...JobStatus[]]);

const salarySchema = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0),
    currency: z.string().length(3),
  })
  .strict()
  .refine((s) => s.max >= s.min, { message: 'salary.max must be >= salary.min', path: ['max'] });

export const createJobSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(20).max(5000),
    location: z.string().min(1).max(200),
    workMode: workModeEnum,
    employmentType: employmentTypeEnum,
    salary: salarySchema.optional(),
    experienceMin: z.number().min(0).max(60).optional(),
    experienceMax: z.number().min(0).max(60).optional(),
    minCgpa: z.number().min(0).max(10).optional(),
    eligibleBranches: z.array(z.string().min(1).max(120)),
    eligibleGradYears: z.array(z.number().int().min(1950).max(2100)),
    requiredSkills: z.array(objectIdSchema).min(1),
    preferredSkills: z.array(objectIdSchema),
    applicationDeadline: z.string().datetime().optional(),
    openings: z.number().int().min(1).default(1),
    status: jobStatusEnum.default('DRAFT'),
  })
  .strict();

export const updateJobSchema = createJobSchema.partial();

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
