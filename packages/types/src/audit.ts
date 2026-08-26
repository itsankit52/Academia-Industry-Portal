import type { AuditAction } from '@aip/config';

export interface AuditLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  role?: string;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}
