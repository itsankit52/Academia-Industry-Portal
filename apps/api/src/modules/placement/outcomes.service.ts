/**
 * Phase 11 — Placement Drive Outcomes Service
 *
 * Records and verifies drive-level placement outcomes. Mirrors to Application
 * so canonical placement data remains in one place.
 */
import { Types } from 'mongoose';
import { PlacementDrive } from '../../models/placement/PlacementDrive';
import { PlacementParticipant } from '../../models/placement/PlacementParticipant';
import { PlacementDriveOutcome } from '../../models/placement/PlacementDriveOutcome';
import { Application } from '../../models/Application';
import type { PlacementDriveOutcomeDoc } from '../../models/placement/PlacementDriveOutcome';
import type { UserDoc } from '../../models/User';
import {
  PLACEMENT_PARTICIPANT_OUTCOMES,
  type PlacementParticipantOutcome,
  type VerificationStatus,
} from '@aip/config';

const PROCEEDS_TO_PLACEMENT: PlacementParticipantOutcome[] = ['OFFERED', 'ACCEPTED'];

export interface RecordOutcomeOptions {
  driveId: string;
  participantId: string;
  actor: UserDoc;
  outcome: PlacementParticipantOutcome;
  salaryPackage?: { amount?: number; currency?: string; ctcLpa?: number };
  joiningDate?: Date;
  offerExpiresAt?: Date;
  offerLetterRef?: string;
  notes?: string;
}

export class OutcomesService {
  /**
   * Record an outcome for a participant.
   */
  static async record(options: RecordOutcomeOptions): Promise<PlacementDriveOutcomeDoc> {
    const participant = await PlacementParticipant.findById(options.participantId);
    if (!participant) throw new Error('Participant not found');

    // Check if outcome already exists
    let outcome = await PlacementDriveOutcome.findOne({ participant: participant._id });

    if (outcome) {
      // Update existing
      outcome.outcome = options.outcome;
      if (options.salaryPackage) {
        outcome.salaryPackage = {
          amount: options.salaryPackage.amount,
          currency: options.salaryPackage.currency ?? 'INR',
          ctcLpa: options.salaryPackage.ctcLpa,
        };
      }
      if (options.joiningDate) outcome.joiningDate = options.joiningDate;
      if (options.offerExpiresAt) outcome.offerExpiresAt = options.offerExpiresAt;
      if (options.offerLetterRef) {
        outcome.offerLetterRef = new Types.ObjectId(options.offerLetterRef);
      }
      if (options.notes) outcome.notes = options.notes;
      outcome.recordedBy = options.actor._id;
      outcome.recordedAt = new Date();
    } else {
      // Create new
      outcome = new PlacementDriveOutcome({
        drive: new Types.ObjectId(options.driveId),
        participant: participant._id,
        application: participant.application,
        student: participant.student,
        company: participant.company,
        outcome: options.outcome,
        salaryPackage: options.salaryPackage
          ? {
              amount: options.salaryPackage.amount,
              currency: options.salaryPackage.currency ?? 'INR',
              ctcLpa: options.salaryPackage.ctcLpa,
            }
          : undefined,
        joiningDate: options.joiningDate,
        offerExpiresAt: options.offerExpiresAt,
        offerLetterRef: options.offerLetterRef
          ? new Types.ObjectId(options.offerLetterRef)
          : undefined,
        notes: options.notes,
        recordedBy: options.actor._id,
        recordedAt: new Date(),
        verification: { status: 'PENDING' },
      });
    }

    await outcome.save();

    // Mirror to Application if applicable
    if (PROCEEDS_TO_PLACEMENT.includes(options.outcome) && participant.application) {
      const updates: Record<string, unknown> = {};
      if (options.outcome === 'ACCEPTED') {
        updates.placedAt = new Date();
        updates.placementCompletedBy = options.actor._id;
        if (options.notes) updates.placementCompletionNotes = options.notes;
      }
      if (options.salaryPackage?.ctcLpa) {
        updates['offerDetails.offeredSalary'] = options.salaryPackage.amount;
        updates['offerDetails.currency'] = options.salaryPackage.currency || 'INR';
        updates['offerDetails.joiningDate'] = options.joiningDate;
      }
      if (options.offerExpiresAt) updates.offerExpiresAt = options.offerExpiresAt;
      if (Object.keys(updates).length > 0) {
        await Application.findByIdAndUpdate(participant.application, { $set: updates });
      }
    }

    return outcome;
  }

  /**
   * Verify or reject an outcome.
   */
  static async verify(
    outcomeId: string,
    status: VerificationStatus,
    actor: UserDoc,
    note?: string,
  ): Promise<PlacementDriveOutcomeDoc> {
    const outcome = await PlacementDriveOutcome.findById(outcomeId);
    if (!outcome) throw new Error('Outcome not found');

    outcome.verification = {
      status,
      verifiedBy: actor._id,
      verifiedAt: new Date(),
      note,
    };
    await outcome.save();

    // Mirror to Application.placementVerification
    if (outcome.application) {
      await Application.findByIdAndUpdate(outcome.application, {
        $set: {
          'placementVerification.status': status,
          'placementVerification.verifiedBy': actor._id,
          'placementVerification.verifiedAt': new Date(),
          'placementVerification.note': note,
        },
      });
    }

    return outcome;
  }

  /**
   * List outcomes for a drive.
   */
  static async listForDrive(options: {
    driveId: string;
    outcome?: PlacementParticipantOutcome;
    companyId?: string;
    verified?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ outcomes: PlacementDriveOutcomeDoc[]; total: number }> {
    const filter: Record<string, unknown> = { drive: new Types.ObjectId(options.driveId) };
    if (options.outcome) filter.outcome = options.outcome;
    if (options.companyId) filter.company = new Types.ObjectId(options.companyId);
    if (options.verified !== undefined) {
      filter['verification.status'] = options.verified ? 'VERIFIED' : { $ne: 'VERIFIED' };
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));

    const [outcomes, total] = await Promise.all([
      PlacementDriveOutcome.find(filter)
        .populate('student', 'name email')
        .populate('company', 'companyName')
        .populate('participant', 'status currentRound')
        .sort({ recordedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PlacementDriveOutcome.countDocuments(filter),
    ]);

    return { outcomes, total };
  }

  /**
   * Get outcome by ID.
   */
  static async getById(id: string): Promise<PlacementDriveOutcomeDoc | null> {
    return PlacementDriveOutcome.findById(id)
      .populate('student', 'name email')
      .populate('company', 'companyName')
      .populate('drive', 'title')
      .populate('participant');
  }

  /**
   * Helper to assert that the provided outcome is a valid PlacementParticipantOutcome.
   * Useful for route-level validation prior to calling record().
   */
  static isValidOutcome(value: string): value is PlacementParticipantOutcome {
    return (PLACEMENT_PARTICIPANT_OUTCOMES as readonly string[]).includes(value);
  }
}
