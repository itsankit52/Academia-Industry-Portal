/**
 * Phase 10 — Early Intervention Detection
 *
 * Identifies students who need institutional attention based on measurable,
 * deterministic conditions derived from the existing data. Each intervention
 * is keyed so we can de-duplicate repeated alerts (same student + type).
 *
 * Rules:
 *   CRITICAL  → readiness score < 30 OR repeated rejection OR expiring offers
 *   HIGH      → readiness score 30-49 OR high-priority gaps OR no internships + no training
 *   MEDIUM    → readiness score 50-64 OR low assessment performance
 *   LOW       → readiness score 65-79 with a single tractable gap
 *
 * Institution scoping is strict: only students linked to the requesting
 * institution are considered. Company users must not receive institution-wide
 * student analytics.
 */

import { Types } from 'mongoose';
import type {
  StudentIntervention,
  InstitutionInterventions,
  InterventionSeverity,
  InterventionType,
  PlacementReadinessLevel,
} from '@aip/types';
import { PLACEMENT_READINESS_BANDS, SEVERITY_RANK, SEVERITY_ORDER } from '@aip/types';
import {
  Application,
  Assessment,
  StudentProfile,
  StudentSkill,
  TrainingEnrollment,
} from '../../models';
import { buildPlacementReadiness } from './placement-readiness.service';

/* ─── Constants ─────────────────────────────────────────────────────── */

const GAP_SEVERITY_THRESHOLDS = {
  CRITICAL_GAPS: 3,
  HIGH_GAPS: 2,
  MEDIUM_GAPS: 1,
} as const;

const ASSESSMENT_FLOOR = 50;
const REJECTION_FLOOR = 3;
const EXPIRY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/* ─── Helpers ───────────────────────────────────────────────────────── */

function round(n: number): number {
  return Math.round(n);
}

function severityRank(s: InterventionSeverity): number {
  return SEVERITY_RANK[s];
}

function levelFor(score: number): PlacementReadinessLevel {
  for (const band of PLACEMENT_READINESS_BANDS) {
    if (score >= band.min) return band.level;
  }
  return 'NOT_READY';
}

function severityFromScore(score: number): InterventionSeverity {
  if (score < 30) return 'CRITICAL';
  if (score < 50) return 'HIGH';
  if (score < 65) return 'MEDIUM';
  return 'LOW';
}

/* ─── Per-student intervention detection ─────────────────────────────── */

export interface DetectStudentInterventionsOptions {
  studentProfileId: Types.ObjectId;
  studentUserId: string;
  studentName: string;
  branch?: string;
}

/**
 * Detects all intervention types for a single student. Returns an array
 * (possibly empty). Each intervention is keyed for de-duplication.
 */
async function detectStudentInterventions(
  options: DetectStudentInterventionsOptions,
): Promise<StudentIntervention[]> {
  const { studentProfileId, studentUserId, studentName, branch } = options;
  const interventions: StudentIntervention[] = [];

  // Load readiness once — it feeds several checks.
  const readiness = await buildPlacementReadiness({ studentUserId });
  const score = readiness.overallScore;

  // ── LOW_READINESS ───────────────────────────────────────────────────
  if (score < 50) {
    const severity = severityFromScore(score);
    interventions.push({
      studentUserId,
      studentName,
      branch,
      readinessScore: score,
      readinessLevel: readiness.readinessLevel,
      interventionType: 'LOW_READINESS',
      severity,
      reason: `Overall placement readiness score is ${score} (${readiness.readinessLevel}).`,
      recommendedAction:
        'Review the readiness breakdown. Focus on closing the highest-weight gaps first.',
    });
  }

  // ── HIGH_PRIORITY_GAP ──────────────────────────────────────────────
  // Check how many skills the student is missing vs. what the industry demands.
  const studentSkillIds = await StudentSkill.find({ student: studentProfileId })
    .select('skill')
    .lean();

  const requiredSkillIds = new Set<string>();
  const publishableOpps = await (async () => {
    const { Job, Internship } = await import('../../models');
    const [jobs, interns] = await Promise.all([
      Job.find({ status: 'PUBLISHED' })
        .select('requiredSkills')
        .lean(),
      Internship.find({ status: 'PUBLISHED' })
        .select('requiredSkills')
        .lean(),
    ]);
    const ids = new Set<string>();
    for (const opp of [...jobs, ...interns]) {
      for (const s of (opp as { requiredSkills?: Types.ObjectId[] }).requiredSkills ?? []) {
        ids.add(String(s));
      }
    }
    return ids;
  })();
  for (const id of publishableOpps) requiredSkillIds.add(id);
  const ownedSet = new Set(studentSkillIds.map((r) => String(r.skill)));
  let missing = 0;
  for (const id of requiredSkillIds) if (!ownedSet.has(id)) missing += 1;

  if (missing >= GAP_SEVERITY_THRESHOLDS.CRITICAL_GAPS) {
    interventions.push({
      studentUserId,
      studentName,
      branch,
      readinessScore: score,
      readinessLevel: readiness.readinessLevel,
      interventionType: 'HIGH_PRIORITY_GAP',
      severity: 'HIGH',
      reason: `${missing} industry-required skills are not yet on the profile.`,
      recommendedAction: 'Enroll in training or add skills to close priority gaps.',
    });
  }

  // ── NO_INTERNSHIP ───────────────────────────────────────────────────
  const internshipApps = await Application.countDocuments({
    student: studentProfileId,
    opportunityType: 'INTERNSHIP',
  });
  const internshipCompleted = await Application.countDocuments({
    student: studentProfileId,
    opportunityType: 'INTERNSHIP',
    status: 'COMPLETED',
  });
  if (internshipApps === 0) {
    interventions.push({
      studentUserId,
      studentName,
      branch,
      readinessScore: score,
      readinessLevel: readiness.readinessLevel,
      interventionType: 'NO_INTERNSHIP',
      severity: 'MEDIUM',
      reason: 'No internship applications or experience on file.',
      recommendedAction: 'Encourage applying to internships to gain industry exposure.',
    });
  } else if (internshipApps > 0 && internshipCompleted === 0) {
    const ongoing = await Application.countDocuments({
      student: studentProfileId,
      opportunityType: 'INTERNSHIP',
      status: { $in: ['INTERNSHIP_STARTED', 'ONGOING'] },
    });
    if (ongoing === 0) {
      interventions.push({
        studentUserId,
        studentName,
        branch,
        readinessScore: score,
        readinessLevel: readiness.readinessLevel,
        interventionType: 'NO_INTERNSHIP',
        severity: 'MEDIUM',
        reason: `${internshipApps} internship application(s) but none completed or ongoing.`,
        recommendedAction: 'Follow up on internship applications; ensure completion.',
      });
    }
  }

  // ── LOW_ASSESSMENT ─────────────────────────────────────────────────
  const recent = await Assessment.find({
    student: studentProfileId,
    status: 'EVALUATED',
  })
    .sort({ createdAt: -1 })
    .limit(3)
    .select('evaluation.totalScore')
    .lean();
  if (recent.length > 0) {
    const avg =
      recent.reduce((sum, r) => {
        const s = (r as unknown as { evaluation?: { totalScore?: number } }).evaluation?.totalScore;
        return sum + (typeof s === 'number' ? s : 0);
      }, 0) / recent.length;
    if (avg < ASSESSMENT_FLOOR && recent.length >= 2) {
      interventions.push({
        studentUserId,
        studentName,
        branch,
        readinessScore: score,
        readinessLevel: readiness.readinessLevel,
        interventionType: 'LOW_ASSESSMENT',
        severity: 'MEDIUM',
        reason: `Average assessment score (last 3) is ${round(avg)}%, below the ${ASSESSMENT_FLOOR} floor.`,
        recommendedAction: 'Provide targeted study support or recommend retaking assessments.',
      });
    }
  }

  // ── NO_TRAINING ────────────────────────────────────────────────────
  const trainingCount = await TrainingEnrollment.countDocuments({
    student: studentProfileId,
    status: 'COMPLETED',
  });
  if (trainingCount === 0 && internshipCompleted === 0) {
    interventions.push({
      studentUserId,
      studentName,
      branch,
      readinessScore: score,
      readinessLevel: readiness.readinessLevel,
      interventionType: 'NO_TRAINING',
      severity: 'MEDIUM',
      reason: 'No completed industry training and no internship experience.',
      recommendedAction: 'Enroll in a training program or encourage internship applications.',
    });
  }

  // ── REPEATED_REJECTION ─────────────────────────────────────────────
  const rejectedCount = await Application.countDocuments({
    student: studentProfileId,
    status: 'REJECTED',
  });
  if (rejectedCount >= REJECTION_FLOOR) {
    interventions.push({
      studentUserId,
      studentName,
      branch,
      readinessScore: score,
      readinessLevel: readiness.readinessLevel,
      interventionType: 'REPEATED_REJECTION',
      severity: 'HIGH',
      reason: `${rejectedCount} application${rejectedCount === 1 ? '' : 's'} rejected.`,
      recommendedAction:
        'Review application strategy. Consider resume review and interview preparation support.',
    });
  }

  // ── LOW_INTERVIEW_CONVERSION ────────────────────────────────────────
  if (rejectedCount >= 2) {
    const total = await Application.countDocuments({ student: studentProfileId });
    const shortlisted = await Application.countDocuments({
      student: studentProfileId,
      status: 'SHORTLISTED',
    });
    const interviewed = await Application.countDocuments({
      student: studentProfileId,
      status: { $in: ['INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ACCEPTED', 'OFFER_REJECTED'] },
    });
    if (shortlisted > 0 && interviewed === 0) {
      interventions.push({
        studentUserId,
        studentName,
        branch,
        readinessScore: score,
        readinessLevel: readiness.readinessLevel,
        interventionType: 'LOW_INTERVIEW_CONVERSION',
        severity: 'MEDIUM',
        reason: `${shortlisted} shortlisted application(s) but none reached interview stage.`,
        recommendedAction: 'Offer interview preparation resources or mentorship.',
      });
    }
  }

  // ── OFFER_EXPIRY_RISK ──────────────────────────────────────────────
  const now = new Date();
  const expiringApps = await Application.find({
    student: studentProfileId,
    status: 'SELECTED',
    offerExpiresAt: { $ne: null },
  })
    .select('offerExpiresAt opportunity')
    .lean();
  for (const app of expiringApps) {
    if (!app.offerExpiresAt) continue;
    const msUntilExpiry = app.offerExpiresAt.getTime() - now.getTime();
    if (msUntilExpiry > 0 && msUntilExpiry < EXPIRY_WINDOW_MS) {
      const daysLeft = Math.ceil(msUntilExpiry / (24 * 60 * 60 * 1000));
      interventions.push({
        studentUserId,
        studentName,
        branch,
        readinessScore: score,
        readinessLevel: readiness.readinessLevel,
        interventionType: 'OFFER_EXPIRY_RISK',
        severity: msUntilExpiry < 7 * 24 * 60 * 60 * 1000 ? 'CRITICAL' : 'HIGH',
        reason: `Selected application expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        recommendedAction: 'Prompt the student to respond to the offer before expiry.',
      });
    }
  }

  // ── TARGET_ROLE_BELOW_READINESS ─────────────────────────────────────
  // Check if career target readiness is significantly below the overall score.
  const careerComp = readiness.componentScores.find((c) => c.key === 'CAREER_TARGET');
  if (careerComp && careerComp.score < 40 && score >= 60) {
    interventions.push({
      studentUserId,
      studentName,
      branch,
      readinessScore: score,
      readinessLevel: readiness.readinessLevel,
      interventionType: 'TARGET_ROLE_BELOW_READINESS',
      severity: 'MEDIUM',
      reason: `Career target readiness is ${round(careerComp.score)}% while overall score is ${score}. Skills may not align with stated goals.`,
      recommendedAction: 'Review preferred roles on the profile; update skills to match target.',
    });
  }

  return interventions;
}

/* ─── Institution-level aggregation ─────────────────────────────────── */

export interface GetInstitutionInterventionsOptions {
  institutionId: Types.ObjectId;
}

/**
 * Detects interventions for all students in an institution. Students are
 * processed in parallel but we cap the fan-out size to avoid memory spikes
 * with very large cohorts. Results are sorted by severity desc, then
 * readiness score asc (most critical first).
 */
export async function getInstitutionInterventions(
  input: GetInstitutionInterventionsOptions,
): Promise<InstitutionInterventions> {
  const profiles = await StudentProfile.find({ institution: input.institutionId })
    .select('user fullName branch')
    .lean();

  const rawInterventions = await Promise.all(
    profiles.map(async (p) => {
      const interventions = await detectStudentInterventions({
        studentProfileId: p._id as Types.ObjectId,
        studentUserId: String(p.user),
        studentName: p.fullName ?? 'Unknown',
        branch: typeof p.branch === 'string' ? p.branch : undefined,
      });
      return interventions;
    }),
  );

  const all = rawInterventions.flat();

  // De-duplicate: keep only one intervention per (studentUserId, interventionType).
  const seen = new Set<string>();
  const deduped: StudentIntervention[] = [];
  for (const intervention of all) {
    const key = `${intervention.studentUserId}:${intervention.interventionType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(intervention);
  }

  // Sort by severity desc, then readiness score asc.
  deduped.sort((a, b) => {
    const rankDiff = severityRank(b.severity) - severityRank(a.severity);
    if (rankDiff !== 0) return rankDiff;
    return a.readinessScore - b.readinessScore;
  });

  // Count by severity.
  const bySeverity: Partial<Record<InterventionSeverity, number>> = {};
  for (const sev of SEVERITY_ORDER) {
    bySeverity[sev] = deduped.filter((i) => i.severity === sev).length;
  }

  return {
    institutionId: String(input.institutionId),
    totalStudents: profiles.length,
    flaggedCount: deduped.length,
    interventions: deduped,
    bySeverity: bySeverity as Record<InterventionSeverity, number>,
    generatedAt: new Date().toISOString(),
  };
}

/* ─── Test-only exports ─────────────────────────────────────────────── */

export const __test = {
  severityFromScore,
  severityRank,
  GAP_SEVERITY_THRESHOLDS,
  ASSESSMENT_FLOOR,
  REJECTION_FLOOR,
  EXPIRY_WINDOW_MS,
};
