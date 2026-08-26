import { z } from 'zod';
import { MENTORSHIP_STATUSES } from '@aip/config';
import type { MentorshipStatus } from '@aip/config';
import { objectIdSchema } from './common';

const statusEnum = z.enum(
  MENTORSHIP_STATUSES as unknown as [MentorshipStatus, ...MentorshipStatus[]],
);

export const createMentorshipRequestSchema = z
  .object({
    mentorUserId: objectIdSchema,
    initialMessage: z.string().trim().min(1).max(1000),
    goals: z.string().trim().max(2000).optional(),
  })
  .strict();

export const updateMentorshipRequestSchema = z
  .object({
    status: statusEnum,
  })
  .strict();

export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export const listMyRequestsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    status: statusEnum.optional(),
  })
  .strict();

export const listMessagesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export type CreateMentorshipRequestInput = z.infer<typeof createMentorshipRequestSchema>;
export type UpdateMentorshipRequestInput = z.infer<typeof updateMentorshipRequestSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMyRequestsQuery = z.infer<typeof listMyRequestsQuerySchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
