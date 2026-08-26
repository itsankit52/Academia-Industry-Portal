import { z } from 'zod';
import { GENDERS } from '@aip/config';
import type { Gender } from '@aip/config';
import { objectIdSchema } from './common';

const genderEnum = z.enum(GENDERS as unknown as [Gender, ...Gender[]]);

export const createFacultyProfileSchema = z
  .object({
    user: objectIdSchema,
    institution: objectIdSchema,
    fullName: z.string().trim().min(1).max(120),
    designation: z.string().trim().min(1).max(120),
    department: z.string().trim().min(1).max(120),
    employeeCode: z.string().trim().min(1).max(60).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    dob: z.string().datetime().optional(),
    gender: genderEnum.optional(),
    qualifications: z.array(z.string().trim().min(1).max(200)).default([]),
    researchInterests: z.array(z.string().trim().min(1).max(200)).default([]),
    bio: z.string().max(2000).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
  })
  .strict();

export const updateFacultyProfileSchema = z
  .object({
    institution: objectIdSchema.optional(),
    fullName: z.string().trim().min(1).max(120).optional(),
    designation: z.string().trim().min(1).max(120).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    employeeCode: z.string().trim().min(1).max(60).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    dob: z.string().datetime().optional(),
    gender: genderEnum.optional(),
    qualifications: z.array(z.string().trim().min(1).max(200)).optional(),
    researchInterests: z.array(z.string().trim().min(1).max(200)).optional(),
    bio: z.string().max(2000).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
  })
  .strict();

export type CreateFacultyProfileInput = z.infer<typeof createFacultyProfileSchema>;
export type UpdateFacultyProfileInput = z.infer<typeof updateFacultyProfileSchema>;
