/**
 * Phase 11 — Action Queue Service
 *
 * Detects, stores, and resolves operational action items for institutions.
 * Idempotent via dedupeKey.
 */
import { Types } from 'mongoose';
import { PlacementActionItem } from '../../models/placement/PlacementActionItem';
import { PlacementDrive } from '../../models/placement/PlacementDrive';
import { PlacementParticipant } from '../../models/placement/PlacementParticipant';
import { PlacementDriveOutcome } from '../../models/placement/PlacementDriveOutcome';
import { Application } from '../../models/Application';
import type { PlacementActionItemDoc } from '../../models/placement/PlacementActionItem';
import type { UserDoc } from '../../models/User';
import {
  PLACEMENT_ACTION_ITEM_TYPES,
  PLACEMENT_ACTION_ITEM_SEVERITY,
  PLACEMENT_ACTION_ITEM_STATUSES,
  type PlacementActionItemType,
  type PlacementActionItemSeverity,
  type PlacementActionItemStatus,
} from '@aip/config';

interface DetectedItem {
  title: string;
  reason: string;
  recommendedAction?: string;
  ctaPath?: string;
  ctaLabel?: string;
  driveId?: Types.ObjectId;
  studentId?: Types.ObjectId;
  participantId?: Types.ObjectId;
  dedupeKey: string;
}

interface DetectionRule {
  type: PlacementActionItemType;
  severity: PlacementActionItemSeverity;
  detect: (institutionId: Types.ObjectId) => Promise<DetectedItem[]>;
}

const DETECTION_RULES: DetectionRule[] = [
  {
    type: 'OFFER_EXPIRY_RISK',
    severity: 'CRITICAL',
    detect: async (_institutionId) => {
      const fortyEightHours = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const apps = await Application.find({
        'placementVerification.status': { $ne: 'VERIFIED' },
        offerExpiresAt: { $lte: fortyEightHours, $gte: new Date() },
        status: 'SELECTED',
      }).limit(50);
      return apps.map((a) => ({
        title: 'Offer expiring soon',
        reason: `Application ${a._id} has an offer that expires before ${fortyEightHours.toISOString()}`,
        recommendedAction: 'Confirm offer acceptance with the student',
        ctaPath: `/institution/applications/${a._id}`,
        ctaLabel: 'View Application',
        studentId: a.student as Types.ObjectId,
        dedupeKey: `application:OFFER_EXPIRY_RISK:${a._id}`,
      }));
    },
  },
  {
    type: 'DRIVE_OUTCOME_PENDING_RECORD',
    severity: 'HIGH',
    detect: async (institutionId) => {
      const drives = await PlacementDrive.find({
        institution: institutionId,
        status: { $in: ['OFFERS_IN_PROGRESS', 'COMPLETED'] },
      });
      const results: DetectedItem[] = [];
      for (const drive of drives) {
        const participants = await PlacementParticipant.find({
          drive: drive._id,
          status: { $in: ['OFFER_RECEIVED', 'ACCEPTED'] },
        });
        for (const p of participants) {
          const outcome = await PlacementDriveOutcome.findOne({ participant: p._id });
          if (!outcome) {
            results.push({
              title: 'Outcome pending record',
              reason: `Drive "${drive.title}" has an offer-stage participant with no recorded outcome`,
              recommendedAction: 'Record the placement outcome for this student',
              ctaPath: `/institution/placement-drives/${drive._id}/participants/${p._id}`,
              ctaLabel: 'Record Outcome',
              driveId: drive._id,
              studentId: p.student,
              participantId: p._id,
              dedupeKey: `drive:DRIVE_OUTCOME_PENDING_RECORD:${p._id}`,
            });
          }
        }
      }
      return results;
    },
  },
  {
    type: 'POST_DRIVE_FOLLOWUP',
    severity: 'HIGH',
    detect: async (institutionId) => {
      const drives = await PlacementDrive.find({
        institution: institutionId,
        status: 'COMPLETED',
        driveEndsAt: { $lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      });
      const results: DetectedItem[] = [];
      for (const drive of drives) {
        const stuck = await PlacementParticipant.find({
          drive: drive._id,
          status: {
            $in: [
              'REGISTERED',
              'SCREENING',
              'SHORTLISTED',
              'INTERVIEW_SCHEDULED',
              'INTERVIEWED',
              'OFFER_PENDING',
            ],
          },
        });
        for (const p of stuck) {
          results.push({
            title: 'Post-drive follow-up needed',
            reason: `Student ${p.student} was not progressed to a final state after drive completed`,
            recommendedAction: 'Follow up with the student regarding their status',
            ctaPath: `/institution/placement-drives/${drive._id}/participants/${p._id}`,
            ctaLabel: 'View Participant',
            driveId: drive._id,
            studentId: p.student,
            participantId: p._id,
            dedupeKey: `participant:POST_DRIVE_FOLLOWUP:${p._id}`,
          });
        }
      }
      return results;
    },
  },
  {
    type: 'REGISTRATION_DEADLINE_APPROACHING',
    severity: 'HIGH',
    detect: async (institutionId) => {
      const fortyEightHours = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const drives = await PlacementDrive.find({
        institution: institutionId,
        status: 'REGISTRATION_OPEN',
        registrationClosesAt: { $lte: fortyEightHours, $gte: new Date() },
      });
      return drives.map(
        (d): DetectedItem => ({
          title: 'Registration deadline approaching',
          reason: `Drive "${d.title}" registration closes at ${d.registrationClosesAt?.toISOString()}`,
          recommendedAction: 'Notify eligible students to register before the deadline',
          ctaPath: `/institution/placement-drives/${d._id}`,
          ctaLabel: 'View Drive',
          driveId: d._id,
          dedupeKey: `drive:REGISTRATION_DEADLINE_APPROACHING:${d._id}`,
        }),
      );
    },
  },
];

export interface ListActionItemOptions {
  institutionId?: string;
  studentId?: string;
  type?: PlacementActionItemType;
  severity?: PlacementActionItemSeverity;
  status?: PlacementActionItemStatus;
  driveId?: string;
  page?: number;
  limit?: number;
}

export class ActionQueueService {
  /**
   * Run detection rules and create/update action items.
   */
  static async detect(institutionId: string): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;
    const instId = new Types.ObjectId(institutionId);

    for (const rule of DETECTION_RULES) {
      const detected = await rule.detect(instId);
      for (const item of detected) {
        const result = await PlacementActionItem.findOneAndUpdate(
          { dedupeKey: item.dedupeKey },
          {
            $set: {
              institution: instId,
              drive: item.driveId,
              participant: item.participantId,
              student: item.studentId,
              type: rule.type,
              severity: rule.severity,
              title: item.title,
              reason: item.reason,
              recommendedAction: item.recommendedAction,
              ctaPath: item.ctaPath,
              ctaLabel: item.ctaLabel,
              status: 'OPEN',
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true, new: true },
        );
        if (result) {
          // Mongoose's findOneAndUpdate with upsert returns a non-new document
          // when the row was already present. We rely on the absence of the
          // returned isNew flag (always undefined here) and instead compare
          // createdAt vs updatedAt to determine creation vs update.
          const wasCreated =
            result.createdAt.getTime() === result.updatedAt.getTime() ||
            Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 5;
          if (wasCreated) created++;
          else updated++;
        }
      }
    }

    return { created, updated };
  }

  /**
   * List action items for an actor.
   */
  static async list(options: ListActionItemOptions): Promise<{
    items: PlacementActionItemDoc[];
    total: number;
  }> {
    const filter: Record<string, unknown> = {};
    if (options.institutionId)
      filter.institution = new Types.ObjectId(options.institutionId);
    if (options.studentId) filter.student = new Types.ObjectId(options.studentId);
    if (options.type) filter.type = options.type;
    if (options.severity) filter.severity = options.severity;
    if (options.status) filter.status = options.status;
    if (options.driveId) filter.drive = new Types.ObjectId(options.driveId);

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));

    const [items, total] = await Promise.all([
      PlacementActionItem.find(filter)
        .populate('drive', 'title status')
        .populate('student', 'name email')
        .sort({ severity: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PlacementActionItem.countDocuments(filter),
    ]);

    return { items, total };
  }

  /**
   * Acknowledge an action item.
   */
  static async acknowledge(id: string, actor: UserDoc): Promise<PlacementActionItemDoc> {
    const item = await PlacementActionItem.findById(id);
    if (!item) throw new Error('Action item not found');
    item.status = 'ACKNOWLEDGED';
    item.assignee = actor._id;
    await item.save();
    return item;
  }

  /**
   * Mark an action item as in-progress.
   */
  static async start(id: string, actor: UserDoc): Promise<PlacementActionItemDoc> {
    const item = await PlacementActionItem.findById(id);
    if (!item) throw new Error('Action item not found');
    item.status = 'IN_PROGRESS';
    if (!item.assignee) item.assignee = actor._id;
    await item.save();
    return item;
  }

  /**
   * Resolve an action item.
   */
  static async resolve(
    id: string,
    actor: UserDoc,
    note?: string,
  ): Promise<PlacementActionItemDoc> {
    const item = await PlacementActionItem.findById(id);
    if (!item) throw new Error('Action item not found');
    item.status = 'RESOLVED';
    item.resolvedAt = new Date();
    item.resolvedBy = actor._id;
    if (note) item.resolutionNote = note;
    await item.save();
    return item;
  }

  /**
   * Dismiss an action item.
   */
  static async dismiss(
    id: string,
    actor: UserDoc,
    note?: string,
  ): Promise<PlacementActionItemDoc> {
    const item = await PlacementActionItem.findById(id);
    if (!item) throw new Error('Action item not found');
    item.status = 'DISMISSED';
    item.resolvedAt = new Date();
    item.resolvedBy = actor._id;
    if (note) item.resolutionNote = note;
    await item.save();
    return item;
  }

  /**
   * Get counts by status for an institution.
   */
  static async countsByStatus(institutionId: string): Promise<Record<PlacementActionItemStatus, number>> {
    const counts: Partial<Record<PlacementActionItemStatus, number>> = {};
    for (const status of PLACEMENT_ACTION_ITEM_STATUSES) {
      counts[status] = 0;
    }
    const agg = await PlacementActionItem.aggregate([
      { $match: { institution: new Types.ObjectId(institutionId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    for (const r of agg) {
      if ((PLACEMENT_ACTION_ITEM_STATUSES as readonly string[]).includes(r._id)) {
        counts[r._id as PlacementActionItemStatus] = r.count;
      }
    }
    return counts as Record<PlacementActionItemStatus, number>;
  }

  /**
   * Get counts by severity for an institution.
   */
  static async countsBySeverity(
    institutionId: string,
  ): Promise<Record<PlacementActionItemSeverity, number>> {
    const counts: Partial<Record<PlacementActionItemSeverity, number>> = {};
    for (const severity of PLACEMENT_ACTION_ITEM_SEVERITY) {
      counts[severity] = 0;
    }
    const agg = await PlacementActionItem.aggregate([
      { $match: { institution: new Types.ObjectId(institutionId) } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);
    for (const r of agg) {
      if ((PLACEMENT_ACTION_ITEM_SEVERITY as readonly string[]).includes(r._id)) {
        counts[r._id as PlacementActionItemSeverity] = r.count;
      }
    }
    return counts as Record<PlacementActionItemSeverity, number>;
  }

  /**
   * Get counts grouped by action item type for an institution.
   */
  static async countsByType(
    institutionId: string,
  ): Promise<Record<PlacementActionItemType, number>> {
    const counts: Partial<Record<PlacementActionItemType, number>> = {};
    for (const type of PLACEMENT_ACTION_ITEM_TYPES) {
      counts[type] = 0;
    }
    const agg = await PlacementActionItem.aggregate([
      { $match: { institution: new Types.ObjectId(institutionId) } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    for (const r of agg) {
      if ((PLACEMENT_ACTION_ITEM_TYPES as readonly string[]).includes(r._id)) {
        counts[r._id as PlacementActionItemType] = r.count;
      }
    }
    return counts as Record<PlacementActionItemType, number>;
  }
}
