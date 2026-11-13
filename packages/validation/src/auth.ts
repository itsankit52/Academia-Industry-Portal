import { z } from 'zod';
import { PASSWORD_MIN_LENGTH } from '@aip/config';
import { objectIdSchema } from './common';

// ==================== REGISTER SCHEMA ====================

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(PASSWORD_MIN_LENGTH),

    role: z.enum(['STUDENT', 'COMPANY', 'FACULTY', 'INSTITUTION']),

    fullName: z.string().min(1).max(120).optional(),
    companyName: z.string().min(1).max(200).optional(),

    institutionId: objectIdSchema.optional(),

    // STUDENT: Institution code
    institutionCode: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and digits only')
      .optional(),

    // INSTITUTION: New institution details
    institutionName: z.string().min(2).max(200).optional(),
    institutionDomain: z.string().min(4).max(120).optional(),
    institutionAddress: z.string().min(1).max(500).optional(),
    institutionCity: z.string().min(1).max(120).optional(),
    institutionState: z.string().min(1).max(120).optional(),

    designation: z.string().min(1).max(120).optional(),
    department: z.string().min(1).max(120).optional(),
  })
  .strict()

  // STUDENT validation
  .refine((v) => v.role !== 'STUDENT' || !!v.fullName, {
    message: 'fullName is required for STUDENT',
    path: ['fullName'],
  })
  .refine((v) => v.role !== 'STUDENT' || !!v.institutionId, {
    message: 'institutionId is required for STUDENT',
    path: ['institutionId'],
  })
  .refine((v) => v.role !== 'STUDENT' || !!v.institutionCode, {
    message: 'institutionCode is required for STUDENT',
    path: ['institutionCode'],
  })

  // COMPANY validation
  .refine((v) => v.role !== 'COMPANY' || !!v.companyName, {
    message: 'companyName is required for COMPANY',
    path: ['companyName'],
  })

  // FACULTY validation
  .refine((v) => v.role !== 'FACULTY' || !!v.fullName, {
    message: 'fullName is required for FACULTY',
    path: ['fullName'],
  })
  .refine((v) => v.role !== 'FACULTY' || !!v.institutionId, {
    message: 'institutionId is required for FACULTY',
    path: ['institutionId'],
  })

  // INSTITUTION validation
  .refine((v) => v.role !== 'INSTITUTION' || !!v.institutionName, {
    message: 'institutionName is required for INSTITUTION',
    path: ['institutionName'],
  })
  .refine((v) => v.role !== 'INSTITUTION' || !!v.institutionDomain, {
    message: 'institutionDomain is required for INSTITUTION',
    path: ['institutionDomain'],
  })
  .refine((v) => v.role !== 'INSTITUTION' || !!v.institutionAddress, {
    message: 'institutionAddress is required for INSTITUTION',
    path: ['institutionAddress'],
  })
  .refine((v) => v.role !== 'INSTITUTION' || !!v.institutionCity, {
    message: 'institutionCity is required for INSTITUTION',
    path: ['institutionCity'],
  })
  .refine((v) => v.role !== 'INSTITUTION' || !!v.institutionState, {
    message: 'institutionState is required for INSTITUTION',
    path: ['institutionState'],
  });

// ==================== LOGIN SCHEMA ====================

export const loginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

// ==================== GOOGLE AUTH SCHEMA ====================

export const googleAuthSchema = z
  .object({
    idToken: z.string().min(1, 'idToken is required'),

    // Optional role for new Google users
    role: z.enum(['STUDENT', 'COMPANY', 'FACULTY', 'INSTITUTION']).optional(),

    // Role-specific onboarding fields
    fullName: z.string().min(1).max(120).optional(),
    companyName: z.string().min(1).max(200).optional(),

    institutionId: objectIdSchema.optional(),

    institutionCode: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[A-Z0-9]+$/, 'Code must be uppercase letters and digits only')
      .optional(),

    institutionName: z.string().min(2).max(200).optional(),
    institutionDomain: z.string().min(4).max(120).optional(),
    institutionAddress: z.string().min(1).max(500).optional(),
    institutionCity: z.string().min(1).max(120).optional(),
    institutionState: z.string().min(1).max(120).optional(),

    designation: z.string().min(1).max(120).optional(),
    department: z.string().min(1).max(120).optional(),
  })
  .strict();

// ==================== CHANGE PASSWORD SCHEMA ====================

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(PASSWORD_MIN_LENGTH),
  })
  .strict();

// ==================== TYPE EXPORTS ====================

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
