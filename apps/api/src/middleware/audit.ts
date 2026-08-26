import type { Request, RequestHandler, Response } from 'express';
import type { AuditAction } from '@aip/config';
import { AuditLog } from '../models/AuditLog';
import { logger } from '../utils/logger';

interface AuditOptions {
  action: AuditAction;
  entity?: string;
  resolveEntityId?: (req: Request, res: Response) => string | undefined;
}

export function auditLog(options: AuditOptions): RequestHandler {
  const { action, entity, resolveEntityId } = options;
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      const actorId = req.user?.id;
      const role = req.user?.role;
      let entityId: string | undefined;
      try {
        entityId = resolveEntityId?.(req, res);
      } catch (err) {
        logger.debug({ err }, 'audit resolveEntityId failed');
      }
      void AuditLog.create({
        ...(actorId ? { actor: actorId } : {}),
        ...(role ? { role } : {}),
        action,
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        ip: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
      }).catch((err) => {
        logger.warn({ err, action }, 'Failed to write audit log');
      });
    });
    next();
  };
}
