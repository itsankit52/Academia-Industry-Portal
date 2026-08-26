import { Types } from 'mongoose';
import type { AuditAction } from '@aip/config';
import type { Paginated } from '@aip/types';
import { AuditLog, type AuditLogDoc } from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';

export interface ListAuditLogsInput {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  action?: AuditAction;
  actorId?: string;
  entity?: string;
  from?: Date;
  to?: Date;
}

export async function listAuditLogs(input: ListAuditLogsInput): Promise<Paginated<AuditLogDoc>> {
  const pg = applyPagination(input);
  const filter: Record<string, unknown> = {};

  if (input.action) filter.action = input.action;
  if (input.actorId) filter.actor = new Types.ObjectId(input.actorId);
  if (input.entity) filter.entity = input.entity;

  if (input.from || input.to) {
    const createdAt: Record<string, Date> = {};
    if (input.from) createdAt.$gte = input.from;
    if (input.to) createdAt.$lte = input.to;
    filter.createdAt = createdAt;
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'email role')
      .sort(pg.sort)
      .skip(pg.skip)
      .limit(pg.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return buildPaginated(items as unknown as AuditLogDoc[], total, pg.page, pg.pageSize);
}

export async function getAuditLogById(id: string): Promise<AuditLogDoc> {
  const doc = await AuditLog.findById(id).populate('actor', 'email role');
  if (!doc) throw AppError.notFound('Audit log not found');
  return doc;
}
