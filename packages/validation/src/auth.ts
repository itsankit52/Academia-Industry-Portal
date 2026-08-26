import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@aip/config';
import { objectIdSchema } from './common';

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),
    role: z.enum(['STUDENT', 'COMPANY', 'FACULTY']),
    fullName: z.string().min(1).max(120).optional(),
    companyName: z.string().min(1).max(200).optional(),
    institutionId: objectIdSchema.optional(),
    designation: z.string().min(1).max(120).optional(),
    department: z.string().min(1).max(120).optional(),
  })
  .strict()
  .refine((v) => v.role !== 'STUDENT' || !!v.fullName, {
    message: 'fullName is required for STUDENT',
    path: ['fullName'],
  })
  .refine((v) => v.role !== 'COMPANY' || !!v.companyName, {
    message: 'companyName is required for COMPANY',
    path: ['companyName'],
  })
  .refine((v) => v.role !== 'FACULTY' || !!v.fullName, {
    message: 'fullName is required for FACULTY',
    path: ['fullName'],
  })
  .refine((v) => (v.role !== 'STUDENT' && v.role !== 'FACULTY') || !!v.institutionId, {
    message: 'institutionId is required for STUDENT and FACULTY',
    path: ['institutionId'],
  });

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
