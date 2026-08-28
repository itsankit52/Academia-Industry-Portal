import { z } from 'zod';
import { GENDERS } from '@aip/config';
import type { Gender } from '@aip/config';

const genderEnum = z.enum(GENDERS as unknown as [Gender, ...Gender[]]);

export const updateStudentProfileSchema = z
  .object({
    fullName: z.string().min(1).max(120).optional(),
    phone: z.string().min(1).max(30).optional(),
    dob: z.string().datetime().optional(),
    gender: genderEnum.optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    address: z.string().max(500).optional(),
    college: z.string().max(200).optional(),
    university: z.string().max(200).optional(),
    degree: z.string().max(120).optional(),
    branch: z.string().max(120).optional(),
    semester: z.number().int().min(1).max(12).optional(),
    graduationYear: z.number().int().min(1950).max(2100).optional(),
    cgpa: z.number().min(0).max(10).optional(),
    bio: z.string().max(2000).optional(),
    projects: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            description: z.string().min(1).max(2000),
            techStack: z.array(z.string().min(1).max(80)),
            link: z.string().url().optional(),
          })
          .strict(),
      )
      .optional(),
    certifications: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            issuer: z.string().min(1).max(200),
            issuedAt: z.string().datetime(),
            credentialUrl: z.string().url().optional(),
          })
          .strict(),
      )
      .optional(),
    experience: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            organization: z.string().min(1).max(200),
            startDate: z.string().datetime(),
            endDate: z.string().datetime().optional(),
            description: z.string().max(2000).optional(),
          })
          .strict(),
      )
      .optional(),
    achievements: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            description: z.string().max(2000).optional(),
            date: z.string().datetime().optional(),
          })
          .strict(),
      )
      .optional(),
    preferredRoles: z.array(z.string().min(1).max(120)).optional(),
    preferredLocations: z.array(z.string().min(1).max(120)).optional(),
    softSkills: z.array(z.string().min(1).max(80)).optional(),
    education: z
      .array(
        z
          .object({
            institution: z.string().min(1).max(200),
            degree: z.string().min(1).max(200),
            field: z.string().max(200).optional(),
            startYear: z.number().int().min(1970).max(2100).optional(),
            endYear: z.number().int().min(1970).max(2100).optional(),
            grade: z.string().max(50).optional(),
            description: z.string().max(1000).optional(),
          })
          .strict(),
      )
      .optional(),
    languages: z
      .array(
        z
          .object({
            name: z.string().min(1).max(80),
            proficiency: z.string().max(50).optional(),
          })
          .strict(),
      )
      .optional(),
    linkedinUrl: z.string().url().max(500).optional().or(z.literal('')),
    githubUrl: z.string().url().max(500).optional().or(z.literal('')),
    portfolioUrl: z.string().url().max(500).optional().or(z.literal('')),
    twitterUrl: z.string().url().max(500).optional().or(z.literal('')),
    careerInterests: z.string().max(2000).optional(),
  })
  .strict();

export const updateCompanyProfileSchema = z
  .object({
    companyName: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional(),
    industry: z.string().max(120).optional(),
    website: z.string().url().optional(),
    phone: z.string().max(30).optional(),
    location: z.string().max(200).optional(),
    companySize: z.string().max(50).optional(),
    foundedYear: z.number().int().min(1800).max(2100).optional(),
    logoUrl: z.string().url().optional(),
  })
  .strict();

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;
export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;
