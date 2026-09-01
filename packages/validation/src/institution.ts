import { z } from 'zod';
import { INSTITUTION_VERIFICATION_STATUSES } from '@aip/config';
import type { InstitutionVerificationStatus } from '@aip/config';

const codeSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and digits only');

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(253)
  .regex(
    /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    'Domain must be a valid FQDN (e.g. university.edu)',
  );

const verificationStatusEnum = z.enum(
  INSTITUTION_VERIFICATION_STATUSES as unknown as [
    InstitutionVerificationStatus,
    ...InstitutionVerificationStatus[],
  ],
);

export const createInstitutionSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    code: codeSchema,
    domain: domainSchema,
    address: z.string().trim().min(2).max(500),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(1).max(120),
    contactEmail: z.string().email().toLowerCase(),
    contactPhone: z.string().trim().min(3).max(30).optional(),
    website: z.string().url().optional(),
  })
  .strict();

export const updateInstitutionSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    code: codeSchema.optional(),
    domain: domainSchema.optional(),
    address: z.string().trim().min(2).max(500).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).max(120).optional(),
    contactEmail: z.string().email().toLowerCase().optional(),
    contactPhone: z.string().trim().min(3).max(30).optional(),
    website: z.string().url().optional(),
    verificationStatus: verificationStatusEnum.optional(),
  })
  .strict();

export const listInstitutionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    sortBy: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).default('desc'),
    verificationStatus: verificationStatusEnum.optional(),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export const inviteInstitutionUserSchema = z
  .object({
    email: z.string().email().toLowerCase(),
    role: z.enum(['INSTITUTION', 'FACULTY']),
    password: z.string().min(8),
    fullName: z.string().trim().min(1).max(120).optional(),
    designation: z.string().trim().min(1).max(120).optional(),
    department: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => v.role !== 'FACULTY' || !!v.fullName, {
    message: 'fullName is required for FACULTY',
    path: ['fullName'],
  });

export type CreateInstitutionInput = z.infer<typeof createInstitutionSchema>;
export type UpdateInstitutionInput = z.infer<typeof updateInstitutionSchema>;
export type ListInstitutionsQuery = z.infer<typeof listInstitutionsQuerySchema>;
export type InviteInstitutionUserInput = z.infer<typeof inviteInstitutionUserSchema>;
