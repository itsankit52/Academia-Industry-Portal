import type { Request, Response } from 'express';
import { AUDIT_ACTIONS } from '@aip/config';
import type { AuditAction } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { getAuditLogById, listAuditLogs } from './audit.service';

function parseAction(v: unknown): AuditAction | undefined {
  if (typeof v !== 'string') return undefined;
  return (AUDIT_ACTIONS as readonly string[]).includes(v) ? (v as AuditAction) : undefined;
}

function parseDate(v: unknown): Date | undefined {
  if (typeof v !== 'string' || v.length === 0) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const result = await listAuditLogs({
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : 'createdAt',
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    ...(parseAction(q.action) ? { action: parseAction(q.action)! } : {}),
    ...(typeof q.actorId === 'string' ? { actorId: q.actorId } : {}),
    ...(typeof q.entity === 'string' ? { entity: q.entity } : {}),
    ...(parseDate(q.from) ? { from: parseDate(q.from)! } : {}),
    ...(parseDate(q.to) ? { to: parseDate(q.to)! } : {}),
  });
  ok(res, result);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const doc = await getAuditLogById(req.params.id!);
  ok(res, doc);
});
