import { z } from 'zod';

export const dashboardScopeSchema = z.object({
  institutionId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid institutionId').optional(),
});

export const listStudentsQuerySchema = dashboardScopeSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  branch: z.string().optional(),
  graduationYear: z.coerce.number().int().min(1970).max(2100).optional(),
});

export const listFacultyQuerySchema = dashboardScopeSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().optional(),
  department: z.string().optional(),
  designation: z.string().optional(),
});

export type DashboardScope = z.infer<typeof dashboardScopeSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type ListFacultyQuery = z.infer<typeof listFacultyQuerySchema>;
