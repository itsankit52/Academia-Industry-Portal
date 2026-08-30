/**
 * Phase 11 — Participant Service
 *
 * Handles student registration, transition, and withdrawal from placement drives.
 * Maps participant lifecycle to Application lifecycle.
 */
import { Types } from 'mongoose';
import {
  PlacementDrive,
  PlacementParticipant,
  StudentProfile,
  Application,
} from '../../models';
import type { PlacementParticipantDoc } from '../../models/placement/PlacementParticipant';
import { evaluateEligibility } from './eligibility.service';
import {
  APPLICATION_STATUSES,
  PLACEMENT_PARTICIPANT_STATUSES,
  type PlacementParticipantStatus,
} from '@aip/config';

/* ─── Constants ─────────────────────────────────────────────────────── */

/** Mapping from participant status to application status (used to sync) */
const PARTICIPANT_TO_APPLICATION_STATUS: Partial<Record<PlacementParticipantStatus, string>> = {
  SCREENING: 'APPLIED',
  SHORTLISTED: 'SHORTLISTED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  INTERVIEWED: 'SHORTLISTED',
  OFFER_RECEIVED: 'SELECTED',
  ACCEPTED: 'OFFER_ACCEPTED',
  REJECTED: 'REJECTED',
  NOT_SELECTED: 'REJECTED',
  DECLINED: 'OFFER_REJECTED',
  NO_SHOW: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
};

function isValidParticipantStatus(s: string): s is PlacementParticipantStatus {
  return (PLACEMENT_PARTICIPANT_STATUSES as readonly string[]).includes(s);
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

/**
 * Authenticated actor passed in from the controller. `id` is the user id as
 * a string (mirrors `req.user` from `requireAuth` middleware). `role` and
 * `institutionId` are optional and used for authorisation checks.
 */
export interface ActorLike {
  id: string;
  role?: string;
  institutionId?: Types.ObjectId | string;
}

function actorObjectId(actor: ActorLike): Types.ObjectId {
  return new Types.ObjectId(actor.id);
}

/* ─── Registration ──────────────────────────────────────────────────── */

export interface RegisterParticipantInput {
  driveId: string;
  actor: ActorLike;
  companyId?: string;
  opportunityType?: string;
  opportunityId?: string;
  notes?: string;
}

/**
 * Register a student for a placement drive.
 */
export async function registerParticipant(input: RegisterParticipantInput): Promise<PlacementParticipantDoc> {
  const { driveId, actor, companyId, opportunityType, opportunityId, notes } = input;

  const drive = await PlacementDrive.findById(driveId);
  if (!drive) throw new Error('Drive not found');

  // Check registration window
  const now = new Date();
  if (drive.registrationOpensAt && now < drive.registrationOpensAt) {
    throw new Error('Registration has not yet opened');
  }
  if (drive.registrationClosesAt && now > drive.registrationClosesAt) {
    throw new Error('Registration has closed');
  }
  if (!['REGISTRATION_OPEN', 'PUBLISHED'].includes(drive.status)) {
    throw new Error('Registration is not currently open for this drive');
  }

  // Get student profile
  const studentUserId = actorObjectId(actor);
  const studentProfile = await StudentProfile.findOne({ user: studentUserId });
  if (!studentProfile) throw new Error('Student profile not found');

  // Check max participations
  const existingCount = await PlacementParticipant.countDocuments({
    drive: drive._id,
    student: studentUserId,
    status: { $nin: ['WITHDRAWN'] },
  });
  if (existingCount >= drive.maxParticipationsPerStudent) {
    throw new Error(
      `Maximum participations (${drive.maxParticipationsPerStudent}) reached for this drive`,
    );
  }

  // Check for duplicate (same drive, student, company)
  const company = companyId
    ? new Types.ObjectId(companyId)
    : drive.participatingCompanies[0];
  if (!company) throw new Error('Drive has no participating companies');
  const duplicate = await PlacementParticipant.findOne({
    drive: drive._id,
    student: studentUserId,
    company,
    status: { $nin: ['WITHDRAWN'] },
  });
  if (duplicate) throw new Error('You are already registered for this company in this drive');

  // Evaluate eligibility
  const eligibility = await evaluateEligibility(driveId, String(studentUserId));

  const status: PlacementParticipantStatus = eligibility.eligible
    ? 'REGISTERED'
    : 'ELIGIBILITY_FAILED';

  const participant = new PlacementParticipant({
    drive: drive._id,
    student: studentUserId,
    studentProfile: studentProfile._id,
    company,
    opportunity:
      opportunityType && opportunityId
        ? {
            opportunityType: opportunityType as 'JOB' | 'INTERNSHIP' | 'PROJECT' | 'APPRENTICESHIP' | 'FACULTY_INTERNSHIP' | 'FDP' | 'CONSULTANCY' | 'COLLABORATIVE_RESEARCH',
            opportunityId: new Types.ObjectId(opportunityId),
          }
        : undefined,
    status,
    notes,
    timeline: [
      {
        status,
        at: new Date(),
        by: studentUserId,
        note: eligibility.eligible
          ? 'Registered successfully'
          : `Registration attempted - eligibility failed: ${eligibility.failures.map((f: { message: string }) => f.message).join('; ')}`,
      },
    ],
  });

  await participant.save();
  return participant;
}

/* ─── Transitions ───────────────────────────────────────────────────── */

export interface TransitionParticipantInput {
  participantId: string;
  targetStatus: PlacementParticipantStatus;
  actor: ActorLike;
  reason?: string;
}

/**
 * Transition a participant to a new status.
 */
export async function transitionParticipant(
  input: TransitionParticipantInput,
): Promise<PlacementParticipantDoc> {
  const { participantId, targetStatus, actor, reason } = input;

  if (!isValidParticipantStatus(targetStatus)) {
    throw new Error(`Invalid participant status: ${targetStatus}`);
  }

  const participant = await PlacementParticipant.findById(participantId);
  if (!participant) throw new Error('Participant not found');

  // Update timeline
  participant.timeline.push({
    status: targetStatus,
    at: new Date(),
    by: actorObjectId(actor),
    note: reason,
  });
  participant.status = targetStatus;
  participant.lastActivityAt = new Date();

  await participant.save();

  // Sync to Application if applicable
  const appStatus = PARTICIPANT_TO_APPLICATION_STATUS[targetStatus];
  if (appStatus && participant.application) {
    const validAppStatus = (APPLICATION_STATUSES as readonly string[]).includes(appStatus)
      ? (appStatus as (typeof APPLICATION_STATUSES)[number])
      : null;
    if (validAppStatus) {
      await Application.findByIdAndUpdate(participant.application, {
        $set: { status: validAppStatus },
        $push: { timeline: { status: validAppStatus, note: reason } },
      });
    }
  }

  return participant;
}

/* ─── Withdrawal ───────────────────────────────────────────────────── */

export interface WithdrawParticipantInput {
  participantId: string;
  actor: ActorLike;
  reason: string;
}

/**
 * Withdraw a participant from a drive.
 */
export async function withdrawParticipant(
  input: WithdrawParticipantInput,
): Promise<PlacementParticipantDoc> {
  const { participantId, actor, reason } = input;

  const participant = await PlacementParticipant.findById(participantId);
  if (!participant) throw new Error('Participant not found');

  // Only the student themselves, institution of the drive, or admin can withdraw
  const drive = await PlacementDrive.findById(participant.drive);
  if (!drive) throw new Error('Drive not found');

  const actorId = actorObjectId(actor);
  const isOwner =
    String(participant.student) === String(actorId) ||
    (actor.role === 'INSTITUTION' && String(drive.institution) === String(actor.institutionId)) ||
    actor.role === 'ADMIN';

  if (!isOwner) throw new Error('Not authorized to withdraw this participant');

  participant.status = 'WITHDRAWN';
  participant.withdrawnAt = new Date();
  participant.withdrawalReason = reason;
  participant.timeline.push({
    status: 'WITHDRAWN',
    at: new Date(),
    by: actorId,
    note: reason,
  });
  participant.lastActivityAt = new Date();

  await participant.save();
  return participant;
}

/* ─── List / Get ────────────────────────────────────────────────────── */

export interface ListParticipantsInput {
  driveId: string;
  status?: PlacementParticipantStatus;
  companyId?: string;
  q?: string;
  page?: number;
  limit?: number;
}

/**
 * List participants for a drive with filters.
 */
export async function listParticipantsForDrive(
  input: ListParticipantsInput,
): Promise<{ participants: PlacementParticipantDoc[]; total: number }> {
  const filter: Record<string, unknown> = { drive: new Types.ObjectId(input.driveId) };
  if (input.status) filter.status = input.status;
  if (input.companyId) filter.company = new Types.ObjectId(input.companyId);

  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 20));

  const [participants, total] = await Promise.all([
    PlacementParticipant.find(filter)
      .populate('student', 'name email')
      .populate('studentProfile', 'fullName branch graduationYear cgpa')
      .populate('company', 'companyName logo')
      .sort({ registeredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PlacementParticipant.countDocuments(filter),
  ]);

  return { participants, total };
}

/**
 * Get a participant by ID.
 */
export async function getParticipantById(id: string): Promise<PlacementParticipantDoc | null> {
  return PlacementParticipant.findById(id)
    .populate('drive', 'title status')
    .populate('student', 'name email')
    .populate('studentProfile', 'fullName branch')
    .populate('company', 'companyName logo')
    .populate('application');
}

/**
 * Get my participations (student-facing).
 */
export async function getMyParticipationsForStudent(
  studentUserId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ participations: PlacementParticipantDoc[]; total: number }> {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));

  const [participations, total] = await Promise.all([
    PlacementParticipant.find({ student: new Types.ObjectId(studentUserId) })
      .populate('drive', 'title status mode location driveStartsAt registrationClosesAt')
      .populate('company', 'companyName logo')
      .sort({ registeredAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PlacementParticipant.countDocuments({ student: new Types.ObjectId(studentUserId) }),
  ]);

  return { participations, total };
}

/* ─── Bulk register ─────────────────────────────────────────────────── */

export interface BulkRegisterInput {
  driveId: string;
  studentIds: string[];
  actor: ActorLike;
  reason?: string;
}

/**
 * Bulk register students to a drive (institution/admin).
 */
export async function bulkRegisterParticipants(
  input: BulkRegisterInput,
): Promise<{ registered: number; failed: number; errors: string[] }> {
  let registered = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const studentId of input.studentIds) {
    try {
      const actor: ActorLike = {
        id: studentId,
        role: input.actor.role,
        institutionId: input.actor.institutionId,
      };
      await registerParticipant({
        driveId: input.driveId,
        actor,
        notes: input.reason,
      });
      registered++;
    } catch (err) {
      failed++;
      errors.push(`${studentId}: ${(err as Error).message}`);
    }
  }

  return { registered, failed, errors };
}

/* ─── Service class (class-based facade) ───────────────────────────── */

/**
 * Class-based facade matching the controller's `ParticipantService.X` usage.
 * The actual logic lives in the exported functions above.
 */
export class ParticipantService {
  static register(input: RegisterParticipantInput): Promise<PlacementParticipantDoc> {
    return registerParticipant(input);
  }

  static transition(
    participantId: string,
    targetStatus: PlacementParticipantStatus,
    actor: ActorLike,
    reason?: string,
  ): Promise<PlacementParticipantDoc> {
    return transitionParticipant({ participantId, targetStatus, actor, reason });
  }

  static withdraw(
    participantId: string,
    actor: ActorLike,
    reason: string,
  ): Promise<PlacementParticipantDoc> {
    return withdrawParticipant({ participantId, actor, reason });
  }

  static listForDrive(
    input: ListParticipantsInput,
  ): Promise<{ participants: PlacementParticipantDoc[]; total: number }> {
    return listParticipantsForDrive(input);
  }

  static getById(id: string): Promise<PlacementParticipantDoc | null> {
    return getParticipantById(id);
  }

  static getMyParticipations(
    studentUserId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<{ participations: PlacementParticipantDoc[]; total: number }> {
    return getMyParticipationsForStudent(studentUserId, options);
  }

  static bulkRegister(input: BulkRegisterInput): Promise<{ registered: number; failed: number; errors: string[] }> {
    return bulkRegisterParticipants(input);
  }
}

/* ─── Test-only exports ─────────────────────────────────────────────── */

export const __test = {
  PARTICIPANT_TO_APPLICATION_STATUS,
  isValidParticipantStatus,
};
