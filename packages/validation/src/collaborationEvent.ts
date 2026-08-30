import { z } from 'zod';
import { COLLAB_EVENT_TYPES, ROLES } from '@aip/config';
import type { CollabEventType, Role } from '@aip/config';

const eventTypeEnum = z.enum(
  COLLAB_EVENT_TYPES as unknown as [CollabEventType, ...CollabEventType[]],
);
const roleEnum = z.enum(ROLES as unknown as [Role, ...Role[]]);
const hostTypeEnum = z.enum(['COMPANY', 'INSTITUTION']);
const modeEnum = z.enum(['ONLINE', 'ONSITE', 'HYBRID']);
const statusEnum = z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']);

export const createEventSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().min(20).max(10000),
    eventType: eventTypeEnum,
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    location: z.string().trim().max(500).optional(),
    mode: modeEnum,
    meetingLink: z.string().url().max(500).optional(),
    capacity: z.number().int().min(1).max(100000).optional(),
    registrationDeadline: z.string().datetime().optional(),
    targetAudience: z.array(roleEnum).max(10).default([]),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  })
  .strict();

export const updateEventSchema = createEventSchema.partial().extend({
  status: statusEnum.optional(),
});

export const listEventsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    eventType: eventTypeEnum.optional(),
    status: statusEnum.optional(),
    hostType: hostTypeEnum.optional(),
    mode: modeEnum.optional(),
    since: z.string().datetime().optional(),
    search: z.string().trim().min(1).max(200).optional(),
    mine: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .transform((v) => v === true || v === 'true')
      .optional(),
  })
  .strict();

export const registerForEventSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const listMyRegistrationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const listEventRegistrationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const markAttendedSchema = z
  .object({
    attendeeUserId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id'),
  })
  .strict();

// Phase 8 — Event feedback
export const submitFeedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
export type RegisterForEventInput = z.infer<typeof registerForEventSchema>;
export type ListMyRegistrationsQuery = z.infer<typeof listMyRegistrationsQuerySchema>;
export type ListEventRegistrationsQuery = z.infer<typeof listEventRegistrationsQuerySchema>;
export type MarkAttendedInput = z.infer<typeof markAttendedSchema>;
