/**
 * Phase 11 — Drive Reports Service
 *
 * Deterministic, derived reports for placement drives and institutions.
 * Always shows BOTH derived (canonical) and verified placement counts
 * with explicit insufficient-data flags.
 */
import { Types } from 'mongoose';
import { PlacementDrive } from '../../models/placement/PlacementDrive';
import { PlacementParticipant } from '../../models/placement/PlacementParticipant';
import { PlacementDriveOutcome } from '../../models/placement/PlacementDriveOutcome';
import {
  PARTICIPANT_FUNNEL_ORDER,
  PARTICIPANT_STATUS_LABELS,
  MIN_DRIVE_SAMPLE,
  type DriveReport,
  type DriveFunnelStep,
  type DriveCompanyBreakdown,
  type DriveBranchBreakdown,
  type InstitutionDrivesReport,
  type PlacementParticipantStatus,
} from '@aip/types';

export class DriveReportsService {
  /**
   * Generate a report for a single drive.
   */
  static async getDriveReport(driveId: string): Promise<DriveReport> {
    const drive = await PlacementDrive.findById(driveId).populate(
      'participatingCompanies',
      'companyName',
    );

    if (!drive) throw new Error('Drive not found');

    // Aggregate participants by status
    const participantAgg = await PlacementParticipant.aggregate([
      { $match: { drive: drive._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const participantByStatus: Record<string, number> = Object.fromEntries(
      participantAgg.map((r) => [r._id, r.count]),
    );

    // Build funnel in canonical order
    const funnel: DriveFunnelStep[] = PARTICIPANT_FUNNEL_ORDER.map((status: PlacementParticipantStatus) => ({
      status: status as PlacementParticipantStatus,
      label: PARTICIPANT_STATUS_LABELS[status as keyof typeof PARTICIPANT_STATUS_LABELS],
      count: participantByStatus[status] || 0,
    }));

    const totals = {
      registered: participantByStatus['REGISTERED'] || 0,
      screening: participantByStatus['SCREENING'] || 0,
      shortlisted: participantByStatus['SHORTLISTED'] || 0,
      interviewed: participantByStatus['INTERVIEWED'] || 0,
      offered: participantByStatus['OFFER_RECEIVED'] || 0,
      accepted: participantByStatus['ACCEPTED'] || 0,
      rejected:
        (participantByStatus['REJECTED'] || 0) + (participantByStatus['NOT_SELECTED'] || 0),
      withdrawn: participantByStatus['WITHDRAWN'] || 0,
      noShow: participantByStatus['NO_SHOW'] || 0,
      declined: participantByStatus['DECLINED'] || 0,
    };

    const totalRegistered =
      totals.registered +
      totals.screening +
      totals.shortlisted +
      totals.interviewed +
      totals.offered +
      totals.accepted;

    const rates = {
      screeningRate: totalRegistered > 0 ? totals.screening / totalRegistered : 0,
      shortlistRate: totals.screening > 0 ? totals.shortlisted / totals.screening : 0,
      interviewRate: totals.shortlisted > 0 ? totals.interviewed / totals.shortlisted : 0,
      offerRate: totalRegistered > 0 ? totals.offered / totalRegistered : 0,
      acceptanceRate: totals.offered > 0 ? totals.accepted / totals.offered : 0,
      declineRate: totals.offered > 0 ? totals.declined / totals.offered : 0,
    };

    // Per-company breakdown
    const byCompany: DriveCompanyBreakdown[] = await this.aggregateCompanyBreakdown(driveId);

    // Per-branch breakdown
    const byBranch: DriveBranchBreakdown[] = await this.aggregateBranchBreakdown(driveId);

    // Outcomes (verified vs derived)
    const outcomes = await PlacementDriveOutcome.find({ drive: drive._id }).populate(
      'company',
      'companyName',
    );

    const salaryCtc = outcomes
      .map((o) => o.salaryPackage?.ctcLpa)
      .filter((c): c is number => typeof c === 'number')
      .sort((a, b) => a - b);

    const salaryStats =
      salaryCtc.length > 0
        ? {
            minLpa: salaryCtc[0] as number,
            maxLpa: salaryCtc[salaryCtc.length - 1] as number,
            medianLpa: salaryCtc[Math.floor(salaryCtc.length / 2)] as number,
            currency: 'INR',
            sampleSize: salaryCtc.length,
          }
        : undefined;

    const derivedAccepted = totals.accepted;
    const verifiedAccepted = outcomes.filter(
      (o) => o.outcome === 'ACCEPTED' && o.verification?.status === 'VERIFIED',
    ).length;
    const pendingVerification = outcomes.filter(
      (o) => o.outcome === 'ACCEPTED' && (!o.verification || o.verification.status === 'PENDING'),
    ).length;
    const rejectedVerification = outcomes.filter((o) => o.verification?.status === 'REJECTED')
      .length;

    const insufficientData = totalRegistered < MIN_DRIVE_SAMPLE;
    const insufficientReasons: string[] = [];
    if (insufficientData) {
      insufficientReasons.push(
        `Only ${totalRegistered} participants recorded; minimum sample of ${MIN_DRIVE_SAMPLE} recommended for stable rates.`,
      );
    }

    return {
      driveId: String(drive._id),
      driveTitle: drive.title,
      driveStatus: drive.status as any,
      institutionId: String(drive.institution),
      totals,
      funnel,
      rates,
      byCompany,
      byBranch,
      salaryStats,
      derived: {
        placedCount: derivedAccepted,
        verifiedCount: derivedAccepted,
        pendingVerification,
      },
      verified: {
        placedCount: verifiedAccepted,
        verifiedCount: verifiedAccepted,
        pendingVerification,
      },
      verificationBreakdown: {
        pending: outcomes.filter(
          (o) => !o.verification || o.verification.status === 'PENDING',
        ).length,
        verified: outcomes.filter((o) => o.verification?.status === 'VERIFIED').length,
        rejected: rejectedVerification,
      },
      insufficientData,
      insufficientReasons,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Aggregate per-company statistics.
   */
  private static async aggregateCompanyBreakdown(
    driveId: string,
  ): Promise<DriveCompanyBreakdown[]> {
    const results = await PlacementParticipant.aggregate([
      { $match: { drive: new Types.ObjectId(driveId) } },
      { $group: { _id: '$company', participants: { $push: '$$ROOT' } } },
    ]);

    const breakdowns: DriveCompanyBreakdown[] = [];
    for (const r of results) {
      const participants = r.participants as Array<{ status: string }>;
      const statuses = participants.reduce<Record<string, number>>((acc: Record<string, number>, p: { status: string }) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      }, {});

      const totalRegistered = participants.length;
      const totalOffered = statuses['OFFER_RECEIVED'] || 0;
      const totalAccepted = statuses['ACCEPTED'] || 0;

      // Populate company name via dynamic import
      const { CompanyProfile } = await import('../../models/CompanyProfile');
      const company = await CompanyProfile.findById(r._id).select('companyName');

      breakdowns.push({
        companyId: String(r._id),
        companyName: company?.companyName || 'Unknown',
        totalRegistered,
        totalScreening: statuses['SCREENING'] || 0,
        totalShortlisted: statuses['SHORTLISTED'] || 0,
        totalInterviewed: statuses['INTERVIEWED'] || 0,
        totalOffered,
        totalAccepted,
        totalRejected: (statuses['REJECTED'] || 0) + (statuses['NOT_SELECTED'] || 0),
        totalWithdrawn: statuses['WITHDRAWN'] || 0,
        totalNoShow: statuses['NO_SHOW'] || 0,
        offerRate: totalRegistered > 0 ? totalOffered / totalRegistered : 0,
        acceptanceRate: totalOffered > 0 ? totalAccepted / totalOffered : 0,
      });
    }

    return breakdowns;
  }

  /**
   * Aggregate per-branch statistics.
   */
  private static async aggregateBranchBreakdown(driveId: string): Promise<DriveBranchBreakdown[]> {
    const results = await PlacementParticipant.aggregate([
      { $match: { drive: new Types.ObjectId(driveId) } },
      {
        $lookup: {
          from: 'studentprofiles',
          localField: 'studentProfile',
          foreignField: '_id',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$profile.branch',
          totalRegistered: { $sum: 1 },
          totalAccepted: {
            $sum: { $cond: [{ $eq: ['$status', 'ACCEPTED'] }, 1, 0] },
          },
        },
      },
    ]);

    return results.map((r) => ({
      branch: r._id || 'Unknown',
      totalRegistered: r.totalRegistered,
      totalAccepted: r.totalAccepted,
      acceptedRate: r.totalRegistered > 0 ? r.totalAccepted / r.totalRegistered : 0,
    }));
  }

  /**
   * Get institution-wide drives report.
   */
  static async getInstitutionDrivesReport(options: {
    institutionId: string;
    from?: Date;
    to?: Date;
  }): Promise<InstitutionDrivesReport> {
    const driveFilter: Record<string, unknown> = {
      institution: new Types.ObjectId(options.institutionId),
    };
    if (options.from || options.to) {
      driveFilter.driveStartsAt = {};
      if (options.from)
        (driveFilter.driveStartsAt as Record<string, Date>).$gte = options.from;
      if (options.to)
        (driveFilter.driveStartsAt as Record<string, Date>).$lte = options.to;
    }

    const drives = await PlacementDrive.find(driveFilter).sort({ driveStartsAt: -1 });
    const driveIds = drives.map((d) => d._id);

    // Aggregate participant counts across drives
    const agg = await PlacementParticipant.aggregate([
      { $match: { drive: { $in: driveIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const byStatus: Record<string, number> = Object.fromEntries(agg.map((r) => [r._id, r.count]));

    const totals = {
      registered: byStatus['REGISTERED'] || 0,
      accepted: byStatus['ACCEPTED'] || 0,
      verified: 0,
      offered: byStatus['OFFER_RECEIVED'] || 0,
      rejected: (byStatus['REJECTED'] || 0) + (byStatus['NOT_SELECTED'] || 0),
      withdrawn: byStatus['WITHDRAWN'] || 0,
    };

    // Count verified outcomes
    const verifiedCount = await PlacementDriveOutcome.countDocuments({
      drive: { $in: driveIds },
      outcome: 'ACCEPTED',
      'verification.status': 'VERIFIED',
    });
    totals.verified = verifiedCount;

    // Per-drive summaries
    const driveSummaries = await Promise.all(
      drives.map(async (d) => {
        const stats = await PlacementParticipant.aggregate([
          { $match: { drive: d._id } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);
        const s: Record<string, number> = Object.fromEntries(stats.map((r) => [r._id, r.count]));
        const registered =
          (s['REGISTERED'] || 0) +
          (s['SCREENING'] || 0) +
          (s['SHORTLISTED'] || 0) +
          (s['INTERVIEWED'] || 0) +
          (s['OFFER_RECEIVED'] || 0) +
          (s['ACCEPTED'] || 0);
        const accepted = s['ACCEPTED'] || 0;
        const verifiedForDrive = await PlacementDriveOutcome.countDocuments({
          drive: d._id,
          outcome: 'ACCEPTED',
          'verification.status': 'VERIFIED',
        });
        return {
          driveId: String(d._id),
          title: d.title,
          status: d.status as any,
          registered,
          accepted,
          verified: verifiedForDrive,
          offerRate: registered > 0 ? (s['OFFER_RECEIVED'] || 0) / registered : 0,
        };
      }),
    );

    const totalRegistered = totals.registered;
    const offerRate = totalRegistered > 0 ? totals.offered / totalRegistered : 0;
    const acceptanceRate = totals.offered > 0 ? totals.accepted / totals.offered : 0;
    const verificationRate = totals.accepted > 0 ? totals.verified / totals.accepted : 0;

    const insufficientData = driveIds.length < MIN_DRIVE_SAMPLE;
    const insufficientReasons: string[] = [];
    if (insufficientData) {
      insufficientReasons.push(
        `Only ${driveIds.length} drives recorded; minimum sample of ${MIN_DRIVE_SAMPLE} recommended for stable rates.`,
      );
    }

    return {
      institutionId: options.institutionId,
      from: options.from?.toISOString(),
      to: options.to?.toISOString(),
      totalDrives: drives.length,
      activeDrives: drives.filter((d) =>
        [
          'IN_PROGRESS',
          'REGISTRATION_OPEN',
          'REGISTRATION_CLOSED',
          'OFFERS_IN_PROGRESS',
        ].includes(d.status),
      ).length,
      completedDrives: drives.filter(
        (d) => d.status === 'COMPLETED' || d.status === 'CLOSED',
      ).length,
      cancelledDrives: drives.filter((d) => d.status === 'CANCELLED').length,
      summaryTotals: totals,
      aggregateFunnel: PARTICIPANT_FUNNEL_ORDER.map((status: PlacementParticipantStatus) => ({
        status: status as PlacementParticipantStatus,
        label: PARTICIPANT_STATUS_LABELS[status as keyof typeof PARTICIPANT_STATUS_LABELS],
        count: byStatus[status] || 0,
      })),
      aggregateRates: { offerRate, acceptanceRate, verificationRate },
      driveSummaries,
      insufficientData,
      insufficientReasons,
      generatedAt: new Date().toISOString(),
    };
  }
}
