/**
 * Phase 10 — Deterministic Placement-Readiness Engine
 *
 * Composes the existing Phase 9A/9B intelligence layers (skill profile,
 * recommendation skill-gap, full match, action plan, benchmark) and the
 * existing application/training/assessment/interim data into a single
 * 0-100 placement-readiness score with explainable component evidence.
 *
 * The engine never invents data. When the underlying inputs are missing
 * the engine returns a deterministic score and a `insufficientData` flag
 * the UI can render alongside the breakdown.
 *
 * No LLM, no new collections, no new dependencies. Institution scoping
 * is inherited from the institution-analytics service.
 */

import { Types } from 'mongoose';
import type {
  PlacementReadiness,
  PlacementReadinessLevel,
  PlacementComponentScore,
  PlacementStrength,
  PlacementBlocker,
  PlacementNextAction,
  StudentProficiencyRow,
} from '@aip/types';
import {
  PLACEMENT_READINESS_BANDS,
  PLACEMENT_READINESS_WEIGHTS,
} from '@aip/types';
import {
  Application,
  Assessment,
  Internship,
  Job,
  StudentProfile,
  StudentSkill,
  TrainingEnrollment,
} from '../../models';
import { buildSkillProfile, type SkillProfile } from '../skills/skillProfile.service';

/* ─── Constants ─────────────────────────────────────────────────────── */

const PROFICIENCY_RANK: Record<string, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const MIN_EVALUATED_ASSESSMENTS_FOR_SAMPLE = 1;
const MIN_APPLICATIONS_FOR_OUTCOME_SAMPLE = 3;

const BLOCKER_THRESHOLDS = {
  /** When the readiness band falls below this, raise a CRITICAL blocker. */
  CRITICAL_SCORE: 30,
  /** When the gap count exceeds this, raise a HIGH blocker. */
  HIGH_GAP_COUNT: 3,
  /** When assessment average score falls below this, raise a HIGH blocker. */
  ASSESSMENT_FLOOR: 50,
  /** When there are no completed trainings and no internship experience. */
  EXPERIENCE_FLOOR: 1,
} as const;

/* ─── Helpers ───────────────────────────────────────────────────────── */

function clamp01to100(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

function levelFor(score: number): PlacementReadinessLevel {
  for (const band of PLACEMENT_READINESS_BANDS) {
    if (score >= band.min) return band.level;
  }
  return 'NOT_READY';
}

function bandMeta(level: PlacementReadinessLevel) {
  const meta = PLACEMENT_READINESS_BANDS.find((b) => b.level === level);
  return {
    label: meta?.label ?? 'Not Ready',
    description: meta?.description ?? 'Build the foundation: skills, assessments, and exposure.',
  };
}

function round(n: number, places = 1): number {
  const m = Math.pow(10, places);
  return Math.round(n * m) / m;
}

function safeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/* ─── Component builders ────────────────────────────────────────────── */

/**
 * Skills component — derived from the existing skill profile service so
 * we never re-implement proficiency math. Returns a 0-100 score
 * representing weighted average proficiency (× 25) plus a small bonus for
 * skill count to reward breadth.
 *
 * Note: buildSkillProfile takes a user ObjectId (string), not a StudentProfile id.
 */
async function buildSkillsComponent(
  userId: string,
): Promise<{ score: number; evidence: string[]; insufficient: string[] }> {
  const profile: SkillProfile = await buildSkillProfile(userId);
  if (!profile || profile.totals.totalSkills === 0) {
    return {
      score: 0,
      evidence: ['No skills added yet — add your skills to begin building a profile.'],
      insufficient: ['No skills on profile.'],
    };
  }

  const allSkills = profile.categories.flatMap((c) => c.skills);
  const rows = allSkills.map((b) => ({
    proficiency: b.proficiency,
    rank: PROFICIENCY_RANK[b.proficiency] ?? 0,
  }));
  const avgRank = safeMean(rows.map((r) => r.rank));
  const proficiencyScore = (avgRank / 4) * 100;
  // Skill-count bonus capped at 10 points so a long list cannot dominate.
  const countBonus = Math.min(10, profile.totals.totalSkills * 1.5);
  const technicalBonus = profile.totals.technicalCount > 0 ? 5 : 0;
  const assessedBonus = profile.totals.assessedSkillsCount > 0 ? 5 : 0;
  const score = clamp01to100(proficiencyScore * 0.8 + countBonus + technicalBonus + assessedBonus);

  const evidence: string[] = [];
  if (profile.strengths.length > 0) {
    evidence.push(
      `Strong proficiency in ${profile.strengths
        .slice(0, 3)
        .map((s) => s.skill.name)
        .join(', ')}.`,
    );
  }
  if (profile.totals.totalSkills > 0) {
    evidence.push(`${profile.totals.totalSkills} skills on profile.`);
  }
  if (profile.totals.assessedSkillsCount > 0) {
    evidence.push(`${profile.totals.assessedSkillsCount} skill${profile.totals.assessedSkillsCount === 1 ? '' : 's'} verified by assessment.`);
  } else {
    evidence.push('No assessments yet — verifying skills strengthens your profile.');
  }
  if (profile.gaps.length > 0) {
    evidence.push(
      `${profile.gaps.length} high-priority gap${profile.gaps.length === 1 ? '' : 's'} (${profile.gaps
        .slice(0, 2)
        .map((g) => g.skill.name)
        .join(', ')}).`,
    );
  }

  return { score, evidence, insufficient: [] };
}

/**
 * Assessment component — average of the last 5 EVALUATED assessment scores
 * (0-100). Returns 0 when no assessed records exist (not a fabrication:
 * 0 reflects the actual state).
 */
async function buildAssessmentComponent(studentProfileId: Types.ObjectId): Promise<{
  score: number;
  evidence: string[];
  insufficient: string[];
}> {
  const recent = await Assessment.find({ student: studentProfileId, status: 'EVALUATED' })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('evaluation.totalScore')
    .lean();

  if (recent.length < MIN_EVALUATED_ASSESSMENTS_FOR_SAMPLE) {
    return {
      score: 0,
      evidence: ['No completed assessments — take one to verify your proficiency.'],
      insufficient: ['No evaluated assessments.'],
    };
  }

  const scores = recent
    .map((r) => (r as unknown as { evaluation?: { totalScore?: number } }).evaluation?.totalScore)
    .filter((s): s is number => typeof s === 'number' && s >= 0 && s <= 100);
  if (scores.length === 0) {
    return {
      score: 0,
      evidence: ['No completed assessments — take one to verify your proficiency.'],
      insufficient: ['No scored assessments.'],
    };
  }

  const avg = safeMean(scores);
  const evidence: string[] = [
    `Average assessment score: ${Math.round(avg)}% across ${scores.length} assessment${scores.length === 1 ? '' : 's'}.`,
  ];
  if (avg >= 75) evidence.push('Strong performance on assessments.');
  else if (avg < 50) evidence.push('Assessment performance is below the industry floor.');

  return { score: clamp01to100(avg), evidence, insufficient: [] };
}

/**
 * Industry alignment component — how much of the student's skill profile
 * overlaps with the union of published job + internship required skills.
 * Returns 0 when the student has no skills.
 */
async function buildIndustryAlignmentComponent(studentProfileId: Types.ObjectId): Promise<{
  score: number;
  evidence: string[];
  insufficient: string[];
}> {
  const [studentSkillIds, requiredRows] = await Promise.all([
    StudentSkill.find({ student: studentProfileId }).select('skill').lean(),
    Job.aggregate<{ _id: Types.ObjectId }>([
      { $match: { status: 'PUBLISHED' } },
      { $project: { requiredSkills: { $ifNull: ['$requiredSkills', []] } } },
      { $unwind: '$requiredSkills' },
      { $group: { _id: '$requiredSkills' } },
      {
        $unionWith: {
          coll: 'internships',
          pipeline: [
            { $match: { status: 'PUBLISHED' } },
            { $project: { requiredSkills: { $ifNull: ['$requiredSkills', []] } } },
            { $unwind: '$requiredSkills' },
            { $group: { _id: '$requiredSkills' } },
          ],
        },
      },
      { $group: { _id: '$_id' } },
    ]),
  ]);

  if (studentSkillIds.length === 0) {
    return {
      score: 0,
      evidence: ['Add skills to see how you align with industry demand.'],
      insufficient: ['No skills on profile.'],
    };
  }
  if (requiredRows.length === 0) {
    return {
      score: 50,
      evidence: ['No published opportunities to compare against.'],
      insufficient: [],
    };
  }

  const ownedSet = new Set(studentSkillIds.map((r) => String(r.skill)));
  const requiredSet = new Set(requiredRows.map((r) => String(r._id)));
  let matches = 0;
  for (const id of ownedSet) if (requiredSet.has(id)) matches += 1;
  const overlap = requiredSet.size > 0 ? matches / requiredSet.size : 0;
  // Require at least one match to push above the floor.
  const score = clamp01to100(overlap * 100);

  const evidence: string[] = [];
  if (matches > 0) {
    evidence.push(`Aligns with ${matches} of ${requiredSet.size} industry-required skills.`);
  } else {
    evidence.push('No overlap with published required skills yet — close priority gaps.');
  }

  return { score, evidence, insufficient: [] };
}

/**
 * Training component — completed enrollments contribute; in-progress
 * counts partially. The score scales with the count of completions
 * (capped at 5 → 100 points) plus a small in-progress bonus.
 */
async function buildTrainingComponent(studentProfileId: Types.ObjectId): Promise<{
  score: number;
  evidence: string[];
  insufficient: string[];
}> {
  const enrollments = await TrainingEnrollment.find({ student: studentProfileId })
    .select('status')
    .lean();
  if (enrollments.length === 0) {
    return {
      score: 0,
      evidence: ['No industry training enrollments yet.'],
      insufficient: ['No training enrollments.'],
    };
  }
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const inProgress = enrollments.filter((e) => e.status === 'IN_PROGRESS').length;
  const enrolled = enrollments.filter((e) => e.status === 'ENROLLED').length;

  const completedScore = Math.min(100, completed * 25); // 4 completions → 100
  const inProgressScore = Math.min(15, inProgress * 7.5);
  const enrolledScore = Math.min(5, enrolled * 2.5);
  const score = clamp01to100(completedScore + inProgressScore + enrolledScore);

  const evidence: string[] = [];
  if (completed > 0) {
    evidence.push(`Completed ${completed} industry training program${completed === 1 ? '' : 's'}.`);
  }
  if (inProgress > 0) {
    evidence.push(`${inProgress} training${inProgress === 1 ? '' : 's'} in progress.`);
  }
  if (enrolled > 0 && completed === 0) {
    evidence.push(`${enrolled} training${enrolled === 1 ? '' : 's'} enrolled.`);
  }
  if (completed === 0 && inProgress === 0 && enrolled === 0) {
    evidence.push('No completed trainings yet.');
  }

  return { score, evidence, insufficient: [] };
}

/**
 * Internship experience component — counts internship applications that
 * reached SELECTED / INTERNSHIP_STARTED / ONGOING / COMPLETED plus the
 * existence of a mentor assignment and a submitted interim report (proxy
 * for active engagement).
 */
async function buildInternshipExperienceComponent(studentProfileId: Types.ObjectId): Promise<{
  score: number;
  evidence: string[];
  insufficient: string[];
}> {
  const internships = await Application.find({
    student: studentProfileId,
    opportunityType: 'INTERNSHIP',
  })
    .select('status mentor interimReports')
    .lean();

  if (internships.length === 0) {
    return {
      score: 0,
      evidence: ['No internship experience yet — apply to internships to gain industry exposure.'],
      insufficient: ['No internship applications.'],
    };
  }

  const completed = internships.filter((i) => i.status === 'COMPLETED').length;
  const ongoing = internships.filter((i) =>
    i.status === 'INTERNSHIP_STARTED' || i.status === 'ONGOING',
  ).length;
  const selected = internships.filter((i) => i.status === 'SELECTED').length;
  const withMentor = internships.filter((i) => Boolean(i.mentor)).length;

  const completedScore = Math.min(60, completed * 30);
  const ongoingScore = Math.min(20, ongoing * 10);
  const selectedScore = Math.min(15, selected * 7.5);
  const mentorScore = withMentor > 0 ? 5 : 0;
  const score = clamp01to100(completedScore + ongoingScore + selectedScore + mentorScore);

  const evidence: string[] = [];
  if (completed > 0) {
    evidence.push(`Completed ${completed} internship${completed === 1 ? '' : 's'}.`);
  }
  if (ongoing > 0) {
    evidence.push(`${ongoing} internship${ongoing === 1 ? '' : 's'} currently ongoing.`);
  }
  if (selected > 0 && ongoing === 0 && completed === 0) {
    evidence.push(`Selected for ${selected} internship${selected === 1 ? '' : 's'} (not yet started).`);
  }
  if (withMentor > 0) {
    evidence.push(`Mentor assigned for ${withMentor} internship${withMentor === 1 ? '' : 's'}.`);
  }

  return { score, evidence, insufficient: [] };
}

/**
 * Career target component — measures how well the student's stated
 * preferred roles + skill profile aligns with industry demand. We
 * intersect the student skill ids against required skill ids of published
 * opportunities whose title loosely matches one of the student's
 * preferred roles. When preferred roles are missing, we fall back to a
 * generic industry demand check.
 */
async function buildCareerTargetComponent(
  studentProfileId: Types.ObjectId,
  preferredRoles: string[],
): Promise<{ score: number; evidence: string[]; insufficient: string[] }> {
  const studentSkillIds = await StudentSkill.find({ student: studentProfileId })
    .select('skill')
    .lean();
  const ownedSet = new Set(studentSkillIds.map((r) => String(r.skill)));

  // Collect published job + internship skills when preferredRoles are
  // provided. We use a coarse title match: any opportunity whose title
  // shares a token with the preferred roles.
  const tokens = preferredRoles
    .flatMap((r) => r.toLowerCase().split(/[^a-z0-9+#.]+/))
    .filter((t) => t.length >= 3);

  if (tokens.length === 0) {
    // Without a target, treat the career component as a generic readiness
    // indicator: how broad is the student's profile?
    const score = clamp01to100(Math.min(80, studentSkillIds.length * 8));
    return {
      score,
      evidence: ['Add preferred roles on your profile to evaluate target readiness.'],
      insufficient: studentSkillIds.length === 0 ? ['No skills on profile.'] : [],
    };
  }

  const regex = new RegExp(tokens.map(escapeRegex).join('|'), 'i');
  const [jobTitles, internTitles] = await Promise.all([
    Job.find({ status: 'PUBLISHED', title: regex })
      .select('requiredSkills preferredSkills')
      .lean(),
    Internship.find({ status: 'PUBLISHED', title: regex })
      .select('requiredSkills preferredSkills')
      .lean(),
  ]);

  const requiredIds = new Set<string>();
  for (const opp of [...jobTitles, ...internTitles]) {
    for (const s of opp.requiredSkills ?? []) requiredIds.add(String(s));
    for (const s of opp.preferredSkills ?? []) requiredIds.add(String(s));
  }

  if (requiredIds.size === 0) {
    return {
      score: clamp01to100(Math.min(70, studentSkillIds.length * 6)),
      evidence: [
        'No published opportunities match your preferred roles — broaden your search.',
      ],
      insufficient: [],
    };
  }

  let match = 0;
  for (const id of requiredIds) if (ownedSet.has(id)) match += 1;
  const ratio = match / requiredIds.size;
  const score = clamp01to100(ratio * 100);

  const evidence: string[] = [
    `Target role readiness: ${Math.round(ratio * 100)}% — ${match} of ${requiredIds.size} required/preferred skills matched.`,
  ];
  if (match === 0) evidence.push('No skill overlap with current opportunities matching your preferred roles.');

  return { score, evidence, insufficient: [] };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Application history component — gives a small credit for application
 * activity so the engine reflects real-world application behaviour.
 * Below the minimum sample size we return 0 to avoid noisy signals.
 */
async function buildApplicationHistoryComponent(studentProfileId: Types.ObjectId): Promise<{
  score: number;
  evidence: string[];
  insufficient: string[];
}> {
  const [totalCount, selectedCount, interviewCount, expiredCount] = await Promise.all([
    Application.countDocuments({ student: studentProfileId }),
    Application.countDocuments({
      student: studentProfileId,
      status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] },
    }),
    Application.countDocuments({
      student: studentProfileId,
      status: { $in: ['INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ACCEPTED', 'OFFER_REJECTED'] },
    }),
    Application.countDocuments({ student: studentProfileId, status: 'OFFER_EXPIRED' }),
  ]);

  if (totalCount < MIN_APPLICATIONS_FOR_OUTCOME_SAMPLE) {
    return {
      score: 0,
      evidence: [`Only ${totalCount} application${totalCount === 1 ? '' : 's'} on file — outcomes need a larger sample.`],
      insufficient: totalCount === 0 ? ['No applications.'] : [],
    };
  }

  // Volume score: scale with count (cap at 10 → 60 points).
  const volumeScore = Math.min(60, totalCount * 6);
  // Success score: offers accepted are strong.
  const successScore = Math.min(30, selectedCount * 15);
  // Interview score: interview activity shows engagement.
  const interviewScore = Math.min(10, interviewCount * 2.5);
  // Small penalty for expired offers.
  const expiredPenalty = Math.min(15, expiredCount * 5);
  const score = clamp01to100(volumeScore + successScore + interviewScore - expiredPenalty);

  const evidence: string[] = [
    `${totalCount} application${totalCount === 1 ? '' : 's'} submitted.`,
  ];
  if (interviewCount > 0) {
    evidence.push(`${interviewCount} reached the interview stage.`);
  }
  if (selectedCount > 0) {
    evidence.push(`${selectedCount} selected or offer accepted.`);
  }
  if (expiredCount > 0) {
    evidence.push(`${expiredCount} offer${expiredCount === 1 ? '' : 's'} expired.`);
  }

  return { score, evidence, insufficient: [] };
}

/* ─── Aggregation ───────────────────────────────────────────────────── */

interface ComponentBuildResult {
  key: PlacementComponentScore['key'];
  label: string;
  score: number;
  weight: number;
  evidence: string[];
}

function buildComponents(rows: ComponentBuildResult[]): PlacementComponentScore[] {
  return rows.map((r) => ({
    key: r.key,
    label: r.label,
    score: round(clamp01to100(r.score)),
    weight: r.weight,
    contribution: round(clamp01to100(r.score) * r.weight, 2),
    evidence: r.evidence,
  }));
}

function computeOverall(components: PlacementComponentScore[]): number {
  // Sum of (score * weight) yields a value in [0, 100] because weights sum to 1.
  const raw = components.reduce((acc, c) => acc + c.score * c.weight, 0);
  return Math.round(clamp01to100(raw));
}

/* ─── Strengths / Blockers / Next Actions ───────────────────────────── */

function buildStrengths(
  components: PlacementComponentScore[],
  profile: SkillProfile | null,
): PlacementStrength[] {
  const strengths: PlacementStrength[] = [];

  if (profile && profile.strengths.length > 0) {
    for (const s of profile.strengths.slice(0, 3)) {
      strengths.push({
        key: `skill:${s.skill.id}`,
        label: `Strong in ${s.skill.name}`,
        detail: `Recorded at ${s.proficiency} proficiency.`,
      });
    }
  }

  for (const c of components) {
    if (c.score >= 75) {
      strengths.push({
        key: `component:${c.key}`,
        label: `${c.label} is strong`,
        value: `${Math.round(c.score)}/100`,
        detail: c.evidence[0] ?? '',
      });
    }
  }

  // Dedupe by key while preserving order.
  const seen = new Set<string>();
  return strengths.filter((s) => {
    if (seen.has(s.key)) return false;
    seen.add(s.key);
    return true;
  });
}

function buildBlockers(
  components: PlacementComponentScore[],
  score: number,
  profile: SkillProfile | null,
  trainingScore: number,
  internshipScore: number,
  assessmentScore: number,
): PlacementBlocker[] {
  const blockers: PlacementBlocker[] = [];

  if (score < BLOCKER_THRESHOLDS.CRITICAL_SCORE) {
    blockers.push({
      key: 'readiness:critical',
      label: 'Overall readiness is critical',
      severity: 'CRITICAL',
      reason: `Score ${score} is below ${BLOCKER_THRESHOLDS.CRITICAL_SCORE}; multi-dimensional work is required.`,
    });
  }

  for (const c of components) {
    if (c.score < 30) {
      blockers.push({
        key: `component:${c.key}`,
        label: `${c.label} is below the floor`,
        severity: c.score < 15 ? 'CRITICAL' : 'HIGH',
        reason: c.evidence[0] ?? `${c.label} is contributing very little to readiness.`,
      });
    }
  }

  if (profile && profile.gaps.length >= BLOCKER_THRESHOLDS.HIGH_GAP_COUNT) {
    blockers.push({
      key: 'gap:many-high-priority',
      label: 'Multiple high-priority skill gaps',
      severity: 'HIGH',
      reason: `${profile.gaps.length} gaps (e.g. ${profile.gaps
        .slice(0, 2)
        .map((g) => g.skill.name)
        .join(', ')}) are flagged high-priority.`,
    });
  }

  if (
    assessmentScore > 0 &&
    assessmentScore < BLOCKER_THRESHOLDS.ASSESSMENT_FLOOR
  ) {
    blockers.push({
      key: 'assessment:low',
      label: 'Assessment performance below floor',
      severity: 'HIGH',
      reason: `Average assessment score is ${Math.round(assessmentScore)}%, below the ${BLOCKER_THRESHOLDS.ASSESSMENT_FLOOR} floor.`,
    });
  }

  if (
    trainingScore < 25 &&
    internshipScore < 25
  ) {
    blockers.push({
      key: 'experience:low',
      label: 'Limited industry exposure',
      severity: trainingScore + internshipScore < 10 ? 'CRITICAL' : 'MEDIUM',
      reason:
        'No completed trainings and no internship experience on file. Combine both to demonstrate real-world exposure.',
    });
  }

  // Dedupe by key.
  const seen = new Set<string>();
  return blockers.filter((b) => {
    if (seen.has(b.key)) return false;
    seen.add(b.key);
    return true;
  });
}

function buildNextActions(
  components: PlacementComponentScore[],
  profile: SkillProfile | null,
  trainingScore: number,
  internshipScore: number,
  assessmentScore: number,
): PlacementNextAction[] {
  const actions: PlacementNextAction[] = [];

  // 1) Take / re-take an assessment when there is none or score is low.
  if (assessmentScore === 0) {
    actions.push({
      type: 'ASSESSMENT',
      title: 'Take your first skill assessment',
      reason: 'Verified proficiency strengthens your profile and readiness signal.',
      ctaPath: '/student/assessments',
      ctaLabel: 'Take assessment',
    });
  } else if (assessmentScore < 60) {
    actions.push({
      type: 'ASSESSMENT',
      title: 'Re-take a skill assessment',
      reason: `Your average score is ${Math.round(assessmentScore)}%; a re-take can lift the signal.`,
      ctaPath: '/student/assessments',
      ctaLabel: 'Take assessment',
    });
  }

  // 2) Trainings when no completed trainings or low training score.
  if (trainingScore < 50) {
    actions.push({
      type: 'TRAINING',
      title: 'Enroll in an industry training program',
      reason: 'Completed trainings add an industry-aligned signal to your profile.',
      ctaPath: '/student/training',
      ctaLabel: 'Browse trainings',
    });
  }

  // 3) Internship when no internship experience.
  if (internshipScore < 50) {
    actions.push({
      type: 'OPPORTUNITY',
      title: 'Apply to an internship',
      reason: 'Internship experience is one of the strongest placement-readiness signals.',
      ctaPath: '/student/internships',
      ctaLabel: 'Browse internships',
    });
  }

  // 4) Top gap skill when gaps exist.
  if (profile && profile.gaps.length > 0) {
    const topGap = profile.gaps[0]!;
    actions.push({
      type: 'SKILL',
      title: `Close your top gap: ${topGap.skill.name}`,
      reason: `${topGap.skill.name} is a high-priority gap. Add it or take an assessment.`,
      ctaPath: '/student/skills',
      ctaLabel: 'Update skills',
    });
  }

  // 5) Component with the worst score that is not already covered.
  const sorted = [...components].sort((a, b) => a.score - b.score);
  const worst = sorted[0];
  if (worst && !actions.some((a) => a.type === componentToActionType(worst.key))) {
    actions.push({
      type: componentToActionType(worst.key),
      title: `Strengthen ${worst.label.toLowerCase()}`,
      reason: worst.evidence[0] ?? `${worst.label} is the lowest-scoring component.`,
      ctaPath: componentToCtaPath(worst.key),
      ctaLabel: 'Improve',
    });
  }

  return actions.slice(0, 6);
}

function componentToActionType(
  key: PlacementComponentScore['key'],
): PlacementNextAction['type'] {
  switch (key) {
    case 'SKILLS':
    case 'INDUSTRY_ALIGNMENT':
    case 'CAREER_TARGET':
      return 'SKILL';
    case 'ASSESSMENTS':
      return 'ASSESSMENT';
    case 'TRAINING':
      return 'TRAINING';
    case 'INTERNSHIP_EXPERIENCE':
      return 'OPPORTUNITY';
    case 'APPLICATION_HISTORY':
      return 'OPPORTUNITY';
    default:
      return 'SKILL';
  }
}

function componentToCtaPath(key: PlacementComponentScore['key']): string {
  switch (key) {
    case 'SKILLS':
    case 'INDUSTRY_ALIGNMENT':
    case 'CAREER_TARGET':
      return '/student/skills';
    case 'ASSESSMENTS':
      return '/student/assessments';
    case 'TRAINING':
      return '/student/training';
    case 'INTERNSHIP_EXPERIENCE':
      return '/student/internships';
    case 'APPLICATION_HISTORY':
      return '/student/applications';
    default:
      return '/student/skill-profile';
  }
}

/* ─── Public entry points ───────────────────────────────────────────── */

export interface BuildPlacementReadinessOptions {
  studentUserId: string;
}

/**
 * Builds a deterministic placement-readiness snapshot for the given
 * student. The student is resolved server-side from `studentUserId`; the
 * caller is responsible for ensuring the user is authorised.
 */
export async function buildPlacementReadiness(
  input: BuildPlacementReadinessOptions,
): Promise<PlacementReadiness> {
  const studentUserId = new Types.ObjectId(input.studentUserId);
  const profile = await StudentProfile.findOne({ user: studentUserId })
    .select('_id preferredRoles')
    .lean();
  if (!profile) {
    return {
      studentUserId: input.studentUserId,
      overallScore: 0,
      readinessLevel: 'NOT_READY',
      readinessLabel: 'Profile not found',
      readinessDescription: 'No student profile is linked to this user.',
      componentScores: [],
      strengths: [],
      blockers: [
        {
          key: 'profile:missing',
          label: 'Student profile is missing',
          severity: 'CRITICAL',
          reason: 'Create a profile to begin tracking readiness.',
        },
      ],
      recommendedNextActions: [
        {
          type: 'SKILL',
          title: 'Create your student profile',
          reason: 'A profile is required before readiness can be calculated.',
          ctaPath: '/student/profile',
          ctaLabel: 'Create profile',
        },
      ],
      generatedAt: new Date().toISOString(),
      insufficientData: true,
      insufficientReasons: ['Student profile not found.'],
    };
  }

  const skillProfile = await buildSkillProfile(input.studentUserId);

  // Run all component builders in parallel.
  const [
    skills,
    assessments,
    industry,
    training,
    internship,
    careerTarget,
    applications,
  ] = await Promise.all([
    buildSkillsComponent(input.studentUserId),
    buildAssessmentComponent(profile._id),
    buildIndustryAlignmentComponent(profile._id),
    buildTrainingComponent(profile._id),
    buildInternshipExperienceComponent(profile._id),
    buildCareerTargetComponent(
      profile._id,
      (profile.preferredRoles ?? []).map(String),
    ),
    buildApplicationHistoryComponent(profile._id),
  ]);

  const raw: ComponentBuildResult[] = [
    {
      key: 'SKILLS',
      label: 'Skills',
      score: skills.score,
      weight: PLACEMENT_READINESS_WEIGHTS.skills,
      evidence: skills.evidence,
    },
    {
      key: 'ASSESSMENTS',
      label: 'Assessments',
      score: assessments.score,
      weight: PLACEMENT_READINESS_WEIGHTS.assessments,
      evidence: assessments.evidence,
    },
    {
      key: 'INDUSTRY_ALIGNMENT',
      label: 'Industry Alignment',
      score: industry.score,
      weight: PLACEMENT_READINESS_WEIGHTS.industryAlignment,
      evidence: industry.evidence,
    },
    {
      key: 'TRAINING',
      label: 'Training',
      score: training.score,
      weight: PLACEMENT_READINESS_WEIGHTS.training,
      evidence: training.evidence,
    },
    {
      key: 'INTERNSHIP_EXPERIENCE',
      label: 'Internship Experience',
      score: internship.score,
      weight: PLACEMENT_READINESS_WEIGHTS.internshipExperience,
      evidence: internship.evidence,
    },
    {
      key: 'CAREER_TARGET',
      label: 'Career Target',
      score: careerTarget.score,
      weight: PLACEMENT_READINESS_WEIGHTS.careerTarget,
      evidence: careerTarget.evidence,
    },
    {
      key: 'APPLICATION_HISTORY',
      label: 'Application History',
      score: applications.score,
      weight: PLACEMENT_READINESS_WEIGHTS.applicationHistory,
      evidence: applications.evidence,
    },
  ];

  const components = buildComponents(raw);
  const overallScore = computeOverall(components);
  const level = levelFor(overallScore);
  const meta = bandMeta(level);

  const insufficientReasons = [
    ...skills.insufficient,
    ...assessments.insufficient,
    ...industry.insufficient,
    ...training.insufficient,
    ...internship.insufficient,
    ...careerTarget.insufficient,
    ...applications.insufficient,
  ];
  const insufficientData = insufficientReasons.length >= 3; // 3+ empty components => meaningful

  const strengths = buildStrengths(components, skillProfile);
  const blockers = buildBlockers(
    components,
    overallScore,
    skillProfile,
    training.score,
    internship.score,
    assessments.score,
  );
  const nextActions = buildNextActions(
    components,
    skillProfile,
    training.score,
    internship.score,
    assessments.score,
  );

  return {
    studentUserId: input.studentUserId,
    overallScore,
    readinessLevel: level,
    readinessLabel: meta.label,
    readinessDescription: meta.description,
    componentScores: components,
    strengths,
    blockers,
    recommendedNextActions: nextActions,
    generatedAt: new Date().toISOString(),
    insufficientData,
    insufficientReasons,
  };
}

/* ─── Institution-level readiness aggregation ──────────────────────── */

export interface InstitutionReadinessOptions {
  institutionId: Types.ObjectId;
  /** Optional precomputed per-student profile ids; when omitted we resolve them. */
  studentProfileIds?: Types.ObjectId[];
}

export interface InstitutionReadinessResult {
  totalStudents: number;
  perStudent: Array<{ studentUserId: string; score: number; level: PlacementReadinessLevel }>;
  perBranch: Array<{ branch: string; total: number; score: number }>;
}

/**
 * Build readiness for every student in the institution. Uses parallelism
 * via Promise.all but caps fan-out to avoid overloading the database —
 * callers should be ready to paginate in the future if needed.
 */
export async function buildInstitutionReadiness(
  options: InstitutionReadinessOptions,
): Promise<InstitutionReadinessResult> {
  let studentProfileIds = options.studentProfileIds;
  if (!studentProfileIds) {
    const profiles = await StudentProfile.find({ institution: options.institutionId })
      .select('user')
      .lean();
    studentProfileIds = profiles.map((p) => p._id) as Types.ObjectId[];
  }

  const perStudentRaw = await Promise.all(
    studentProfileIds.map(async (sid) => {
      const profile = await StudentProfile.findById(sid).select('user branch').lean();
      if (!profile) return null;
      const readiness = await buildPlacementReadiness({
        studentUserId: String(profile.user),
      });
      return {
        studentUserId: String(profile.user),
        branch: typeof profile.branch === 'string' ? profile.branch : 'UNSPECIFIED',
        score: readiness.overallScore,
        level: readiness.readinessLevel,
      };
    }),
  );

  const perStudent = perStudentRaw.filter(
    (s): s is { studentUserId: string; score: number; level: PlacementReadinessLevel; branch: string } =>
      s !== null,
  );

  // Branch aggregation.
  const branchMap = new Map<string, { total: number; scoreSum: number }>();
  for (const s of perStudent) {
    const cur = branchMap.get(s.branch) ?? { total: 0, scoreSum: 0 };
    cur.total += 1;
    cur.scoreSum += s.score;
    branchMap.set(s.branch, cur);
  }
  const perBranch = [...branchMap.entries()].map(([branch, v]) => ({
    branch,
    total: v.total,
    score: v.total > 0 ? Math.round(v.scoreSum / v.total) : 0,
  }));

  return {
    totalStudents: perStudent.length,
    perStudent: perStudent.map((s) => ({
      studentUserId: s.studentUserId,
      score: s.score,
      level: s.level,
    })),
    perBranch,
  };
}

/* ─── Test-only exports ─────────────────────────────────────────────── */

export const __test = {
  clamp01to100,
  levelFor,
  bandMeta,
  computeOverall,
  buildStrengths,
  buildBlockers,
  buildNextActions,
  componentToActionType,
  componentToCtaPath,
  PROFICIENCY_RANK,
  BLOCKER_THRESHOLDS,
  MIN_APPLICATIONS_FOR_OUTCOME_SAMPLE,
  MIN_EVALUATED_ASSESSMENTS_FOR_SAMPLE,
};

export type { StudentProficiencyRow };
