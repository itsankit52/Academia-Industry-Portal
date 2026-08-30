/**
 * Phase 11 — Outcomes Controller
 *
 * HTTP handlers for placement drive outcome recording and verification.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { OutcomesService } from './outcomes.service';
import { DriveReportsService } from './drive-reports.service';
import type { UserDoc } from '../../models/User';
import type { PlacementParticipantOutcome } from '@aip/config';

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

function requireOutcomeId(req: Request): string {
  if (!req.params.outcomeId) throw AppError.badRequest('Outcome id required');
  return req.params.outcomeId;
}

/** POST /placement-drives/:id/participants/:participantId/outcome */
export const recordOutcome = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN' && actor.role !== 'COMPANY') {
      throw AppError.forbidden('Not authorized to record outcomes');
    }

    const { outcome, salaryPackage, joiningDate, offerExpiresAt, offerLetterRef, notes } = req.body as {
      outcome: PlacementParticipantOutcome;
      salaryPackage?: { amount?: number; currency?: string; ctcLpa?: number };
      joiningDate?: string;
      offerExpiresAt?: string;
      offerLetterRef?: string;
      notes?: string;
    };

    if (!outcome || !OutcomesService.isValidOutcome(outcome)) {
      throw AppError.badRequest(`Invalid outcome: ${outcome}`);
    }

    const result = await OutcomesService.record({
      driveId: requireId(req),
      participantId: requireParticipantId(req),
      actor,
      outcome,
      salaryPackage,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      offerExpiresAt: offerExpiresAt ? new Date(offerExpiresAt) : undefined,
      offerLetterRef,
      notes,
    });
    created(res, result, 'Outcome recorded');
  },
);

/** PATCH /placement-drives/:id/outcomes/:outcomeId */
export const updateOutcome = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    const outcomeId = requireOutcomeId(req);

    // Only allow update before verification
    const existing = await OutcomesService.getById(outcomeId);
    if (!existing) throw AppError.notFound('Outcome not found');
    if (existing.verification?.status === 'VERIFIED') {
      throw AppError.badRequest('Cannot update a verified outcome');
    }

    const { outcome, salaryPackage, joiningDate, offerExpiresAt, notes } = req.body as {
      outcome?: PlacementParticipantOutcome;
      salaryPackage?: { amount?: number; currency?: string; ctcLpa?: number };
      joiningDate?: string;
      offerExpiresAt?: string;
      notes?: string;
    };

    if (outcome && !OutcomesService.isValidOutcome(outcome)) {
      throw AppError.badRequest(`Invalid outcome: ${outcome}`);
    }

    const result = await OutcomesService.record({
      driveId: requireId(req),
      participantId: String(existing.participant),
      actor,
      outcome: outcome as PlacementParticipantOutcome,
      salaryPackage,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      offerExpiresAt: offerExpiresAt ? new Date(offerExpiresAt) : undefined,
      notes,
    });
    ok(res, result, 'Outcome updated');
  },
);

/** PATCH /placement-drives/:id/outcomes/:outcomeId/verify */
export const verifyOutcome = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user as unknown as UserDoc;
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions can verify outcomes');
    }

    const { status, note } = req.body as { status: string; note?: string };
    if (!status || !['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
      throw AppError.badRequest('Status must be PENDING, VERIFIED, or REJECTED');
    }

    const outcome = await OutcomesService.verify(
      requireOutcomeId(req),
      status as 'PENDING' | 'VERIFIED' | 'REJECTED',
      actor,
      note,
    );
    ok(res, outcome, `Outcome ${status.toLowerCase()}`);
  },
);

/** GET /placement-drives/:id/outcomes */
export const listOutcomes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { outcome, companyId, verified, page, limit } = req.query;
    const result = await OutcomesService.listForDrive({
      driveId: requireId(req),
      outcome: outcome as PlacementParticipantOutcome | undefined,
      companyId: companyId as string | undefined,
      verified: verified === 'true' ? true : verified === 'false' ? false : undefined,
      page: num(page) ?? 1,
      limit: num(limit) ?? 20,
    });
    ok(res, result);
  },
);

/** GET /placement-drives/:id/outcomes/:outcomeId */
export const getOutcome = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const outcome = await OutcomesService.getById(requireOutcomeId(req));
    if (!outcome) throw AppError.notFound('Outcome not found');
    ok(res, outcome);
  },
);

/** GET /placement-drives/:id/report */
export const getDriveReport = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions can view drive reports');
    }
    const report = await DriveReportsService.getDriveReport(requireId(req));
    ok(res, report);
  },
);

/** GET /institution-analytics/placement-drives/report */
export const getInstitutionDrivesReport = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const actor = req.user!;
    if (actor.role !== 'INSTITUTION' && actor.role !== 'ADMIN') {
      throw AppError.forbidden('Only institutions can view placement reports');
    }
    const institutionId = (actor as unknown as { institutionId?: string }).institutionId;
    if (!institutionId) {
      throw AppError.badRequest('Institution context required');
    }
    const { from, to } = req.query;
    const report = await DriveReportsService.getInstitutionDrivesReport({
      institutionId,
      from: from ? new Date(from as string) : undefined,
      to: to ? new Date(to as string) : undefined,
    });
    ok(res, report);
  },
);

export const outcomesController = {
  recordOutcome,
  updateOutcome,
  verifyOutcome,
  listOutcomes,
  getOutcome,
  getDriveReport,
  getInstitutionDrivesReport,
};
