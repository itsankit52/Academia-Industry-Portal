/**
 * Phase 11 — Action Queue Controller
 *
 * HTTP handlers for the operational action queue.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { ActionQueueService } from './action-queue.service';
import type { UserDoc } from '../../models/User';
import type {
  PlacementActionItemType,
  PlacementActionItemSeverity,
  PlacementActionItemStatus,
} from '@aip/config';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function requireId(req: Request): string {
  if (!req.params.id) throw AppError.badRequest('Action item id required');
  return req.params.id;
}

/** GET /placement-action-items */
export const listActionItems = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    const { type, severity, status, driveId, studentId, page, limit } = req.query;

    let institutionId: string | undefined;
    if (actor.role === 'STUDENT') {
      // students only see their own action items
    } else if (actor.role === 'INSTITUTION') {
      institutionId = (actor as unknown as { institutionId?: string }).institutionId;
    } else if (actor.role !== 'ADMIN') {
      throw AppError.forbidden('Not authorized');
    }

    const result = await ActionQueueService.list({
      institutionId,
      studentId: actor.role === 'STUDENT' ? actor.id : (studentId as string | undefined),
      type: type as PlacementActionItemType | undefined,
      severity: severity as PlacementActionItemSeverity | undefined,
      status: status as PlacementActionItemStatus | undefined,
      driveId: driveId as string | undefined,
      page: num(page) ?? 1,
      limit: num(limit) ?? 20,
    });
    ok(res, result);
  },
);

/** PATCH /placement-action-items/:id/acknowledge */
export const acknowledgeActionItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    const item = await ActionQueueService.acknowledge(requireId(req), actor);
    ok(res, item, 'Action item acknowledged');
  },
);

/** PATCH /placement-action-items/:id/start */
export const startActionItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    const item = await ActionQueueService.start(requireId(req), actor);
    ok(res, item, 'Action item started');
  },
);

/** PATCH /placement-action-items/:id/resolve */
export const resolveActionItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    const { resolutionNote } = req.body as { resolutionNote?: string };
    const item = await ActionQueueService.resolve(requireId(req), actor, resolutionNote);
    ok(res, item, 'Action item resolved');
  },
);

/** PATCH /placement-action-items/:id/dismiss */
export const dismissActionItem = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    const { resolutionNote } = req.body as { resolutionNote?: string };
    const item = await ActionQueueService.dismiss(requireId(req), actor, resolutionNote);
    ok(res, item, 'Action item dismissed');
  },
);

/** POST /placement-action-items/detect */
export const detectActionItems = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions can trigger action detection');
    }
    const institutionId = (actor as unknown as { institutionId?: string }).institutionId;
    if (!institutionId) {
      throw AppError.badRequest('Institution context required');
    }

    const { created, updated } = await ActionQueueService.detect(institutionId);
    ok(res, { created, updated }, `Detection complete: ${created} created, ${updated} updated`);
  },
);

export const actionQueueController = {
  listActionItems,
  acknowledgeActionItem,
  startActionItem,
  resolveActionItem,
  dismissActionItem,
  detectActionItems,
};
