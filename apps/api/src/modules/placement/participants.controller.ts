/**
 * Phase 11 — Participant Controller
 *
 * HTTP handlers for participant registration, transition, and withdrawal.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { ParticipantService } from './participant.service';
import { EligibilityService } from './eligibility.service';
import type { ActorLike } from './participant.service';
import type { PlacementParticipantStatus } from '@aip/config';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function requireId(req: Request): string {
  if (!req.params.id) throw AppError.badRequest('Drive id required');
  return req.params.id;
}

function requireParticipantId(req: Request): string {
  if (!req.params.participantId) throw AppError.badRequest('Participant id required');
  return req.params.participantId;
}

function toActorLike(user: { id: string; role?: string; institutionId?: string }): ActorLike {
  return {
    id: user.id,
    role: user.role,
    institutionId: user.institutionId,
  };
}

/** POST /placement-drives/:id/register — register for a drive */
export const registerForDrive = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActorLike(req.user!);
    if (actor.role !== 'STUDENT' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only students can register for placement drives');
    }

    const driveId = requireId(req);
    const participant = await ParticipantService.register({
      driveId,
      actor,
      companyId: req.body.companyId as string | undefined,
      opportunityType: req.body.opportunityType as string | undefined,
      opportunityId: req.body.opportunityId as string | undefined,
      notes: req.body.notes as string | undefined,
    });
    created(res, participant, 'Registered for placement drive');
  },
);

/** GET /placement-drives/:id/eligibility-preview — check eligibility */
export const eligibilityPreview = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    const result = await EligibilityService.evaluate(requireId(req), actor.id);
    ok(res, result);
  },
);

/** GET /placement-drives/:id/eligibility-explanation — human-readable explanation */
export const eligibilityExplanation = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    const explanation = await EligibilityService.getExplanation(requireId(req), actor.id);
    ok(res, { explanation });
  },
);

/** GET /institution-analytics/placement-drives/:id/eligible-students — cohort view */
export const eligibleStudents = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions can view eligible students');
    }
    const { page, limit } = req.query;
    const result = await EligibilityService.getEligibleStudents(requireId(req), {
      page: num(page) ?? 1,
      limit: num(limit) ?? 20,
    });
    ok(res, result);
  },
);

/** GET /placement-drives/:id/participants — list participants */
export const listParticipants = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { status, companyId, page, limit } = req.query;

    const result = await ParticipantService.listForDrive({
      driveId: requireId(req),
      status: status as PlacementParticipantStatus | undefined,
      companyId: companyId as string | undefined,
      page: num(page) ?? 1,
      limit: num(limit) ?? 20,
    });
    ok(res, result);
  },
);

/** GET /placement-drives/:id/participants/:participantId */
export const getParticipant = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const participant = await ParticipantService.getById(requireParticipantId(req));
    if (!participant) throw AppError.notFound('Participant not found');
    ok(res, participant);
  },
);

/** PATCH /placement-drives/:id/participants/:participantId/transition */
export const transitionParticipantHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActorLike(req.user!);
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN' && actor.role !== 'COMPANY') {
      throw AppError.forbidden('Not authorized');
    }

    const { toStatus, reason, note } = req.body as {
      toStatus: PlacementParticipantStatus;
      reason?: string;
      note?: string;
    };
    const participant = await ParticipantService.transition(
      requireParticipantId(req),
      toStatus,
      actor,
      reason || note,
    );
    ok(res, participant, `Participant transitioned to ${toStatus}`);
  },
);

/** POST /placement-drives/:id/participants/:participantId/withdraw */
export const withdrawParticipantHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActorLike(req.user!);
    const { reason } = req.body as { reason: string };
    if (!reason) throw AppError.badRequest('Withdrawal reason is required');

    const participant = await ParticipantService.withdraw(
      requireParticipantId(req),
      actor,
      reason,
    );
    ok(res, participant, 'Participant withdrawn from drive');
  },
);

/** POST /placement-drives/:id/register-bulk — bulk register */
export const bulkRegister = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = toActorLike(req.user!);
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions can bulk register students');
    }

    const { studentIds, reason } = req.body;
    const result = await ParticipantService.bulkRegister({
      driveId: requireId(req),
      studentIds,
      actor,
      reason,
    });
    ok(
      res,
      result,
      `Bulk registration complete: ${result.registered} registered, ${result.failed} failed`,
    );
  },
);

/** GET /placement-drives/me/participations — student's own participations */
export const myParticipations = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    const { page, limit } = req.query;
    const result = await ParticipantService.getMyParticipations(actor.id, {
      page: num(page) ?? 1,
      limit: num(limit) ?? 20,
    });
    ok(res, result);
  },
);

export const participantsController = {
  registerForDrive,
  eligibilityPreview,
  eligibilityExplanation,
  eligibleStudents,
  listParticipants,
  getParticipant,
  transitionParticipant: transitionParticipantHandler,
  withdrawParticipant: withdrawParticipantHandler,
  bulkRegister,
  myParticipations,
};
