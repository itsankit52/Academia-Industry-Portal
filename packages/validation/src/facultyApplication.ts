import { z } from 'zod';
import { objectIdSchema } from './common';

// Phase 13 — Faculty-industry collaboration: withdrawal input
export const withdrawFacultyApplicationSchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .strict();

export type WithdrawFacultyApplicationInput = z.infer<typeof withdrawFacultyApplicationSchema>;

// Phase 17 — Faculty engagement: create engagement (apply to faculty opportunity)
export const createEngagementSchema = z
  .object({
    coverLetter: z.string().max(5000).optional(),
  })
  .strict();

export type CreateEngagementInput = z.infer<typeof createEngagementSchema>;

// Phase 17 — Faculty engagement: update engagement status (host action)
export const updateEngagementStatusSchema = z
  .object({
    status: z.enum(['APPLIED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN']),
    note: z.string().max(2000).optional(),
  })
  .strict();

export type UpdateEngagementStatusInput = z.infer<typeof updateEngagementStatusSchema>;
