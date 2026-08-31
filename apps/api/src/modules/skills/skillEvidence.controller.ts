/**
 * Phase 15B — Skill Evidence Controller
 */
import type { Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import {
  getSkillEvidence,
  getSkillsToReassess as getSkillsToReassessService,
} from './skillEvidence.service';

export const getMySkillEvidence = asyncHandler(async (_req, res: Response) => {
  const userId = (_req as { user?: { id?: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const result = await getSkillEvidence(userId);
  ok(res, result);
});

export const getSkillsToReassess = asyncHandler(async (_req, res: Response) => {
  const userId = (_req as { user?: { id?: string } }).user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const result = await getSkillsToReassessService(userId);
  ok(res, result);
});
