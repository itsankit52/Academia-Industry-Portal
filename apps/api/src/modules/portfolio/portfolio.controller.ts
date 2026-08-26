import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AuditLog } from '../../models';
import * as service from './portfolio.service';

export const getPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const studentId = req.params.studentId!;
  const data = await service.getPublicPortfolio(studentId);
  void AuditLog.create({
    action: 'PORTFOLIO_VIEW',
    entity: 'StudentProfile',
    entityId: studentId,
    ip: req.ip,
    userAgent: req.get('user-agent') ?? undefined,
  });
  ok(res, data);
});
