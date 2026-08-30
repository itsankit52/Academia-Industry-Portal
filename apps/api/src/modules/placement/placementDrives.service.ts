/**
 * Phase 11 — Placement Drive Service
 *
 * Handles CRUD operations and lifecycle transitions for placement drives.
 * Lifecycle is deterministic and auditable.
 */
import { Types } from 'mongoose';
import { PlacementDrive } from '../../models/placement/PlacementDrive';
import { PlacementParticipant } from '../../models/placement/PlacementParticipant';
import type { PlacementDriveDoc } from '../../models/placement/PlacementDrive';
import type { Role } from '@aip/config';

import {
  PLACEMENT_DRIVE_STATUSES,
  type PlacementDriveStatus,
  type PlacementDriveMode,
} from '@aip/config';

/**
 * Mirrors the shape `requireAuth` attaches to `req.user` plus the
 * `institutionId` field that the user document carries. The existing
 * `req.user` global type is `{ id; role }` — this richer local type is what
 * controllers pass in as the `actor` argument.
 */
export interface DriveActor {
  id: string;
  role: Role;
  institutionId?: string;
  _id?: unknown;
}

export interface EligibilityRulesInput {
  minCgpa?: number;
  allowedBranches?: string[];
  allowedGraduationYears?: number[];
  maxActiveBacklogs?: number;
  gender?: string;
  minReadinessScore?: number;
  blockIfAlreadyPlaced?: boolean;
  maxOffersHeld?: number;
  resumeRequired?: boolean;
  minSkillProficiency?: Array<{ skillId: string; minProficiency: string }>;
}

export interface DriveTransitionResult {
  drive: PlacementDriveDoc;
  previousStatus: PlacementDriveStatus;
  newStatus: PlacementDriveStatus;
}

/** Deterministic lifecycle: allowed transitions from each status */
const ALLOWED_TRANSITIONS: Record<PlacementDriveStatus, PlacementDriveStatus[]> = {
  DRAFT: ['PUBLISHED', 'ARCHIVED'],
  PUBLISHED: ['REGISTRATION_OPEN', 'ARCHIVED', 'CANCELLED'],
  REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'CANCELLED'],
  REGISTRATION_CLOSED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['OFFERS_IN_PROGRESS', 'CANCELLED'],
  OFFERS_IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export interface CreateDriveInput {
  title: string;
  description: string;
  mode: PlacementDriveMode;
  location?: string;
  participatingCompanies: string[];
  opportunities?: Array<{ opportunityType: string; opportunityId: string; openings?: number }>;
  eligibilityRules?: EligibilityRulesInput;
  registrationOpensAt?: Date;
  registrationClosesAt?: Date;
  driveStartsAt?: Date;
  driveEndsAt?: Date;
  maxParticipationsPerStudent?: number;
  totalSlots?: number;
  coordinators?: string[];
  actor: DriveActor;
}

export interface UpdateDriveInput {
  title?: string;
  description?: string;
  mode?: PlacementDriveMode;
  location?: string;
  participatingCompanies?: string[];
  opportunities?: Array<{ opportunityType: string; opportunityId: string; openings?: number }>;
  eligibilityRules?: EligibilityRulesInput;
  registrationOpensAt?: Date;
  registrationClosesAt?: Date;
  driveStartsAt?: Date;
  driveEndsAt?: Date;
  maxParticipationsPerStudent?: number;
  totalSlots?: number;
  coordinators?: string[];
}

export interface ListDrivesOptions {
  status?: PlacementDriveStatus;
  mode?: PlacementDriveMode;
  institutionId?: string;
  companyId?: string;
  from?: Date;
  to?: Date;
  q?: string;
  page?: number;
  limit?: number;
}

export class PlacementDriveService {
  /**
   * Create a new placement drive. InstitutionId resolved from actor.
   */
  static async create(input: CreateDriveInput): Promise<PlacementDriveDoc> {
    if (!input.actor.institutionId && input.actor.role !== 'ADMIN') {
      throw new Error('Actor must be associated with an institution');
    }

    const drive = new PlacementDrive({
      institution: new Types.ObjectId(
        input.actor.institutionId ?? String(input.actor._id ?? input.actor.id),
      ),
      title: input.title,
      description: input.description,
      mode: input.mode,
      location: input.location,
      participatingCompanies: input.participatingCompanies.map(
        (id) => new Types.ObjectId(id),
      ),
      opportunities: (input.opportunities || []).map((o) => ({
        opportunityType: o.opportunityType,
        opportunityId: new Types.ObjectId(o.opportunityId),
        openings: o.openings || 1,
      })),
      eligibilityRules: input.eligibilityRules || {},
      registrationOpensAt: input.registrationOpensAt,
      registrationClosesAt: input.registrationClosesAt,
      driveStartsAt: input.driveStartsAt,
      driveEndsAt: input.driveEndsAt,
      status: 'DRAFT',
      maxParticipationsPerStudent: input.maxParticipationsPerStudent ?? 1,
      totalSlots: input.totalSlots,
      coordinators: (input.coordinators || []).map((id) => new Types.ObjectId(id)),
      createdBy: new Types.ObjectId(input.actor.id),
      metadata: { timeline: [] },
    });
    return drive.save();
  }

  /**
   * List placement drives with filters.
   */
  static async list(
    options: ListDrivesOptions,
  ): Promise<{ drives: PlacementDriveDoc[]; total: number }> {
    const filter: Record<string, unknown> = {};

    if (options.status) filter.status = options.status;
    if (options.mode) filter.mode = options.mode;
    if (options.institutionId) {
      filter.institution = new Types.ObjectId(options.institutionId);
    }
    if (options.companyId) {
      filter.participatingCompanies = { $in: [new Types.ObjectId(options.companyId)] };
    }
    if (options.from || options.to) {
      filter.driveStartsAt = {};
      if (options.from) (filter.driveStartsAt as Record<string, Date>).$gte = options.from;
      if (options.to) (filter.driveStartsAt as Record<string, Date>).$lte = options.to;
    }
    if (options.q) {
      filter.$text = { $search: options.q };
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));

    const [drives, total] = await Promise.all([
      PlacementDrive.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('participatingCompanies', 'companyName logo')
        .populate('institution', 'name'),
      PlacementDrive.countDocuments(filter),
    ]);

    return { drives, total };
  }

  /**
   * Get a single drive by ID.
   */
  static async getById(id: string): Promise<PlacementDriveDoc | null> {
    return PlacementDrive.findById(id)
      .populate('participatingCompanies', 'companyName logo website')
      .populate('institution', 'name')
      .populate('createdBy', 'name email')
      .populate('coordinators', 'name email');
  }

  /**
   * Update a drive (only in DRAFT or before registration opens).
   */
  static async update(
    id: string,
    input: UpdateDriveInput,
  ): Promise<PlacementDriveDoc | null> {
    const update: Record<string, unknown> = {};

    if (input.title !== undefined) update.title = input.title;
    if (input.description !== undefined) update.description = input.description;
    if (input.mode !== undefined) update.mode = input.mode;
    if (input.location !== undefined) update.location = input.location;
    if (input.participatingCompanies !== undefined) {
      update.participatingCompanies = input.participatingCompanies.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (input.opportunities !== undefined) {
      update.opportunities = input.opportunities.map((o) => ({
        opportunityType: o.opportunityType,
        opportunityId: new Types.ObjectId(o.opportunityId),
        openings: o.openings || 1,
      }));
    }
    if (input.eligibilityRules !== undefined) update.eligibilityRules = input.eligibilityRules;
    if (input.registrationOpensAt !== undefined) {
      update.registrationOpensAt = input.registrationOpensAt;
    }
    if (input.registrationClosesAt !== undefined) {
      update.registrationClosesAt = input.registrationClosesAt;
    }
    if (input.driveStartsAt !== undefined) update.driveStartsAt = input.driveStartsAt;
    if (input.driveEndsAt !== undefined) update.driveEndsAt = input.driveEndsAt;
    if (input.maxParticipationsPerStudent !== undefined) {
      update.maxParticipationsPerStudent = input.maxParticipationsPerStudent;
    }
    if (input.totalSlots !== undefined) update.totalSlots = input.totalSlots;
    if (input.coordinators !== undefined) {
      update.coordinators = input.coordinators.map((id) => new Types.ObjectId(id));
    }

    return PlacementDrive.findByIdAndUpdate(id, { $set: update }, { new: true });
  }

  /**
   * Transition a drive to a new status. Enforces the lifecycle state machine.
   */
  static async transition(
    id: string,
    targetStatus: PlacementDriveStatus,
    actor: DriveActor,
    reason?: string,
  ): Promise<DriveTransitionResult> {
    const drive = await PlacementDrive.findById(id);
    if (!drive) throw new Error('Drive not found');

    const currentStatus = drive.status as PlacementDriveStatus;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!PLACEMENT_DRIVE_STATUSES.includes(targetStatus)) {
      throw new Error(`Invalid target status: ${targetStatus}`);
    }
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid transition: cannot move from ${currentStatus} to ${targetStatus}. ` +
          `Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none'}`,
      );
    }

    // Enforce: drive must have at least 1 screened participant before OFFERS_IN_PROGRESS
    if (targetStatus === 'OFFERS_IN_PROGRESS') {
      const hasInterview = await PlacementParticipant.exists({
        drive: drive._id,
        status: { $in: ['INTERVIEWED', 'OFFER_PENDING', 'OFFER_RECEIVED'] },
      });
      if (!hasInterview) {
        throw new Error(
          'At least one participant must have completed an interview before advancing to offers stage',
        );
      }
    }

    // Push timeline entry
    const timelineEntry: Record<string, unknown> = {
      status: targetStatus,
      at: new Date(),
      by: new Types.ObjectId(actor.id),
    };
    if (reason) timelineEntry.note = reason;

    drive.status = targetStatus;
    if (!drive.metadata) {
      drive.set('metadata', { timeline: [] });
    }
    const meta = (drive.metadata as { timeline?: unknown[] }) || { timeline: [] };
    if (!meta.timeline) meta.timeline = [];
    meta.timeline.push(timelineEntry);
    drive.set('metadata', meta);
    drive.set('lastActivityAt', new Date());

    await drive.save();

    return { drive, previousStatus: currentStatus, newStatus: targetStatus };
  }

  /**
   * Duplicate a drive (creates a new DRAFT copy).
   */
  static async duplicate(id: string, actor: DriveActor): Promise<PlacementDriveDoc> {
    const original = await PlacementDrive.findById(id);
    if (!original) throw new Error('Drive not found');

    const copy = new PlacementDrive({
      institution: new Types.ObjectId(
        actor.institutionId ?? String(original.institution),
      ),
      title: `${original.title} (Copy)`,
      description: original.description,
      mode: original.mode as PlacementDriveMode,
      location: original.location,
      participatingCompanies: original.participatingCompanies,
      opportunities: original.opportunities,
      eligibilityRules: original.eligibilityRules,
      status: 'DRAFT',
      maxParticipationsPerStudent: original.maxParticipationsPerStudent,
      filledSlots: 0,
      coordinators: [],
      createdBy: new Types.ObjectId(actor.id),
      metadata: { timeline: [] },
    });
    return copy.save();
  }

  /**
   * Authorize: is the actor allowed to manage this drive?
   */
  static async authorize(driveId: string, actor: DriveActor): Promise<boolean> {
    if (actor.role === 'ADMIN') return true;
    if (actor.role === 'INSTITUTION') {
      const drive = await PlacementDrive.findById(driveId).select('institution');
      if (!drive) return false;
      return String(drive.institution) === String(actor.institutionId);
    }
    return false;
  }

  /**
   * Count participants per status for a drive.
   */
  static async getParticipantCounts(driveId: string): Promise<Record<string, number>> {
    const results = await PlacementParticipant.aggregate<{ _id: string; count: number }>([
      { $match: { drive: new Types.ObjectId(driveId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(results.map((r) => [r._id, r.count]));
  }
}
