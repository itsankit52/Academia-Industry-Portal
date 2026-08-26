import { z } from 'zod';
import { objectIdSchema } from './common';

export const markReadSchema = z
  .object({
    notificationIds: z.array(objectIdSchema).min(1),
  })
  .strict();

export type MarkReadInput = z.infer<typeof markReadSchema>;
