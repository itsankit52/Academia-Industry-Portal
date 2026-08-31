import { z } from 'zod';
import { objectIdSchema } from './common';

// Phase 13 — Faculty-industry collaboration: withdrawal input
export const withdrawFacultyApplicationSchema = z
  .object({
    reason: z.string().max(1000).optional(),
  })
  .strict();

export type WithdrawFacultyApplicationInput = z.infer<typeof withdrawFacultyApplicationSchema>;
