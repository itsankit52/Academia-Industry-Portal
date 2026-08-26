import { z } from 'zod';

const availabilityEnum = z.enum(['AVAILABLE', 'BUSY', 'UNAVAILABLE']);

export const createMentorProfileSchema = z
  .object({
    bio: z.string().trim().max(5000).optional(),
    expertise: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    yearsExperience: z.number().int().min(0).max(60).optional(),
    mentorshipCapacity: z.number().int().min(0).max(50).optional(),
    availability: availabilityEnum.optional(),
    linkedInUrl: z.string().url().max(500).optional(),
    githubUrl: z.string().url().max(500).optional(),
  })
  .strict();

export const updateMentorProfileSchema = createMentorProfileSchema.partial();

export const listMentorsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    expertise: z.string().trim().min(1).optional(),
    availability: availabilityEnum.optional(),
    search: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type CreateMentorProfileInput = z.infer<typeof createMentorProfileSchema>;
export type UpdateMentorProfileInput = z.infer<typeof updateMentorProfileSchema>;
export type ListMentorsQuery = z.infer<typeof listMentorsQuerySchema>;
