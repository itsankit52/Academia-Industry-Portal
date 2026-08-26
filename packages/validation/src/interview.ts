import { z } from 'zod';
import { INTERVIEW_MODES, INTERVIEW_STATUSES } from '@aip/config';
import type { InterviewMode, InterviewStatus } from '@aip/config';
import { objectIdSchema } from './common';

const interviewModeEnum = z.enum(INTERVIEW_MODES as unknown as [InterviewMode, ...InterviewMode[]]);
const interviewStatusEnum = z.enum(
  INTERVIEW_STATUSES as unknown as [InterviewStatus, ...InterviewStatus[]],
);

export const createInterviewSchema = z
  .object({
    applicationId: objectIdSchema,
    mode: interviewModeEnum,
    scheduledAt: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(480),
    meetingLink: z.string().url().optional(),
    location: z.string().max(500).optional(),
    interviewer: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

export const updateInterviewSchema = z
  .object({
    mode: interviewModeEnum.optional(),
    scheduledAt: z.string().datetime().optional(),
    durationMinutes: z.number().int().min(15).max(480).optional(),
    meetingLink: z.string().url().optional(),
    location: z.string().max(500).optional(),
    interviewer: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    status: interviewStatusEnum.optional(),
    feedback: z.string().max(5000).optional(),
  })
  .strict();

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
