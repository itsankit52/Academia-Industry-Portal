/**
 * Phase 11 — Placement Drive Controller
 *
 * HTTP handlers for placement drive CRUD and lifecycle.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  PlacementDriveService,
  DriveTransitionResult,
  DriveActor,
} from './placementDrives.service';
import type { PlacementDriveStatus, PlacementDriveMode } from '@aip/config';
import { PLACEMENT_DRIVE_STATUSES } from '@aip/config';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toActor(req: Request): DriveActor {
  const { user } = req;
  if (!user) throw AppError.unauthorized('Authentication required');
  const u = user as unknown as { institutionId?: unknown };
  const institutionId =
    typeof u.institutionId === 'string'
      ? u.institutionId
      : u.institutionId != null
        ? String(u.institutionId)
        : undefined;
  return {
    id: user.id,
    role: user.role,
    institutionId,
    _id: user.id,
  };
}

function requireId(req: Request): string {
  const id = req.params.id;
  if (!id) throw AppError.badRequest('Missing drive id');
  return id;
}

/** POST /placement-drives */
export const createDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActor(req);
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions or admins can create placement drives');
    }

    const drive = await PlacementDriveService.create({
      ...req.body,
      actor,
    });
    created(res, drive, 'Placement drive created');
  },
);

/** GET /placement-drives */
export const listDrives = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActor(req);
    const {
      status,
      mode,
      institutionId,
      companyId,
      from,
      to,
      q,
      page,
      limit,
    } = req.query as Record<string, unknown>;

    // Students/companies see only drives their institution/company participates in
    let effectiveInstitutionId = institutionId as string | undefined;
    if (actor.role === 'STUDENT' && actor.institutionId) {
      effectiveInstitutionId = actor.institutionId;
    } else if (actor.role === 'INSTITUTION') {
      effectiveInstitutionId = actor.institutionId;
    }
    // For COMPANY role, companyId query param is used directly

    const result = await PlacementDriveService.list({
      status: status as PlacementDriveStatus | undefined,
      mode: mode as PlacementDriveMode | undefined,
      institutionId: effectiveInstitutionId,
      companyId: companyId as string | undefined,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
      q: q as string | undefined,
      page: num(page),
      limit: num(limit),
    });

    const pageNum = num(page) ?? 1;
    const limitNum = num(limit) ?? 20;
    ok(res, {
      data: result.drives,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        pages: Math.ceil(result.total / limitNum),
      },
    });
  },
);

/** GET /placement-drives/:id */
export const getDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const drive = await PlacementDriveService.getById(requireId(req));
    if (!drive) throw AppError.notFound('Placement drive not found');
    ok(res, drive);
  },
);

/** PATCH /placement-drives/:id */
export const updateDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActor(req);
    const id = requireId(req);
    const authorized = await PlacementDriveService.authorize(id, actor);
    if (!authorized) throw AppError.forbidden('Not authorized to update this drive');

    const drive = await PlacementDriveService.update(id, req.body);
    if (!drive) throw AppError.notFound('Placement drive not found');
    ok(res, drive, 'Placement drive updated');
  },
);

/** DELETE /placement-drives/:id — soft delete to ARCHIVED */
export const archiveDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActor(req);
    const id = requireId(req);
    const authorized = await PlacementDriveService.authorize(id, actor);
    if (!authorized) throw AppError.forbidden('Not authorized');

    const result = await PlacementDriveService.transition(
      id,
      'ARCHIVED',
      actor,
      'Archived by owner',
    );
    ok(res, result.drive, 'Placement drive archived');
  },
);

/** POST /placement-drives/:id/duplicate */
export const duplicateDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActor(req);
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions or admins can duplicate drives');
    }

    const drive = await PlacementDriveService.duplicate(requireId(req), actor);
    created(res, drive, 'Placement drive duplicated');
  },
);

/** POST /placement-drives/:id/transition */
export const transitionDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActor(req);
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions or admins can transition drives');
    }

    const { targetStatus, reason } = req.body as {
      targetStatus: PlacementDriveStatus;
      reason?: string;
    };

    if (!PLACEMENT_DRIVE_STATUSES.includes(targetStatus)) {
      throw AppError.badRequest('Invalid target status');
    }

    const result: DriveTransitionResult = await PlacementDriveService.transition(
      requireId(req),
      targetStatus,
      actor,
      reason,
    );
    ok(res, result.drive, `Drive transitioned to ${targetStatus}`);
  },
);

/** GET /placement-drives/:id/counts — participant counts by status */
export const getDriveCounts = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const counts = await PlacementDriveService.getParticipantCounts(requireId(req));
    ok(res, counts);
  },
);

export const placementDrivesController = {
  createDrive,
  listDrives,
  getDrive,
  updateDrive,
  archiveDrive,
  duplicateDrive,
  transitionDrive,
  getDriveCounts,
};
