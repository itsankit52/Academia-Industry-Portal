import { Types } from 'mongoose';
import type { Proficiency, SkillCategory } from '@aip/config';
import type { StudentDataLoader } from '../recommendations/studentDataLoader';
import {
  Assessment,
  Internship,
  Job,
  Resume,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
} from '../../models';

export const PROFICIENCY_ORDER: Record<Proficiency, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

export interface SkillTimelineEvent {
  id: string;
  type: 'STUDENT_SKILL_CREATED' | 'STUDENT_SKILL_UPDATED' | 'ASSESSMENT';
  at: string;
  skillId?: string;
  skillName?: string;
  fromProficiency?: Proficiency;
  toProficiency?: Proficiency;
  /** Assessment-only fields */
  assessmentId?: string;
  scorePercent?: number;
  feedback?: string;
}

export interface SkillTimelineResponse {
  events: SkillTimelineEvent[];
}

export interface SkillEvidenceSummary {
  assessmentCount: number;
  assessmentAverageScore: number | null;
  resumeMentioned: boolean;
  trainingMatches: { id: string; title: string; url?: string }[];
  /** Number of published jobs/internships that require this skill. */
  industryDemand: number;
}

export interface StudentSkillWithMeta {
  id: string;
  skill: {
    id: string;
    name: string;
    category: SkillCategory;
  };
  proficiency: Proficiency;
  yearsExperience?: number;
  evidenceUrl?: string;
  evidence: SkillEvidenceSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGroup {
  category: SkillCategory;
  count: number;
  averageProficiency: number; // 1-4 scale
  skills: StudentSkillWithMeta[];
}

export interface StrengthAndGap {
  category: SkillCategory;
  skill: { id: string; name: string };
  proficiency: Proficiency;
}

export interface IndustryDemandInsight {
  topMissing: { name: string; id: string; missingCount: number }[];
  topMatched: { name: string; id: string; demandCount: number }[];
}

export interface SkillProfile {
  totals: {
    totalSkills: number;
    technicalCount: number;
    softSkillsCount: number;
    assessedSkillsCount: number;
    averageProficiency: number; // 0-100
    readinessScore: number; // 0-100
  };
  categories: CategoryGroup[];
  strengths: StrengthAndGap[];
  gaps: StrengthAndGap[];
  industry: IndustryDemandInsight;
  sourceBreakdown: {
    fromAssessments: number;
    fromResume: number;
    fromManual: number;
  };
}

async function loadStudentId(userId: string): Promise<Types.ObjectId> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) })
    .select('_id')
    .lean();
  if (!profile) throw new Error('Student profile not found');
  return profile._id as Types.ObjectId;
}

function studentSkillsWithSkillQuery(studentId: Types.ObjectId) {
  return StudentSkill.find({ student: studentId }).populate('skill', 'name category').lean();
}

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/**
 * Compose the student skill profile.
 *
 * Reuses:
 *   - StudentSkill / Skill for the catalogue-backed proficiency store
 *   - Assessment (Evaluation.skillBreakdown) for the assessment→skill signal
 *   - Resume.parsedSkills for the resume→skill signal
 *   - TrainingProgram.skills for the recommended next action
 *   - Job/Internship (via aggregation) for the industry-demand signal
 *
 * No new collections are created: this view is a join over the existing data.
 */
export async function buildSkillProfile(
  userId: string,
  loader?: StudentDataLoader,
): Promise<SkillProfile> {
  let studentId: Types.ObjectId;
  if (loader) {
    const profile = await loader.profile();
    if (!profile) throw new Error('Student profile not found');
    studentId = profile._id as Types.ObjectId;
  } else {
    studentId = await loadStudentId(userId);
  }

  // With a request-scoped loader the student's rows and the ACTIVE trainings
  // are shared with the other recommendation sub-services (same filters/sort).
  const [studentSkillRows, assessmentRows, latestResume, trainings, jobDemandRows] =
    await Promise.all([
      loader
        ? (loader.studentSkillsWithSkill() as unknown as ReturnType<
            typeof studentSkillsWithSkillQuery
          >)
        : studentSkillsWithSkillQuery(studentId),
      loader
        ? loader.evaluatedAssessments()
        : Assessment.find({ student: studentId, status: 'EVALUATED' })
            .select('evaluation.skillBreakdown evaluation.evaluatedAt createdAt skillNames')
            .sort({ createdAt: -1 })
            .lean(),
      Resume.findOne({ student: studentId }).sort({ version: -1 }).select('parsedSkills').lean(),
      loader
        ? loader.activeTrainings().then((rows) => rows.slice(0, 20))
        : TrainingProgram.find({ status: 'ACTIVE' })
            .select('title skills registrationUrl')
            .limit(20)
            .lean(),
      Assessment.aggregate<{ _id: Types.ObjectId; count: number; name: string; category: string }>([
        { $match: { status: 'EVALUATED' } },
        { $unwind: '$skills' },
        { $group: { _id: '$skills', count: { $sum: 1 } } },
        {
          $lookup: { from: 'skills', localField: '_id', foreignField: '_id', as: 'skill' },
        },
        { $unwind: '$skill' },
        { $project: { _id: 1, count: 1, name: '$skill.name', category: '$skill.category' } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

  // Build the assessment signal: for each skill, track the average score and
  // assessment count.
  const assessmentSignal = new Map<string, { count: number; sum: number }>();
  for (const a of assessmentRows) {
    const evalObj = (a as { evaluation?: { skillBreakdown?: unknown[] } }).evaluation;
    const breakdown = Array.isArray(evalObj?.skillBreakdown)
      ? (evalObj!.skillBreakdown as Array<{
          skillId: string;
          score: number;
          maxScore: number;
        }>)
      : [];
    for (const b of breakdown) {
      if (!b.skillId) continue;
      const prior = assessmentSignal.get(b.skillId) ?? { count: 0, sum: 0 };
      const pct = b.maxScore > 0 ? (b.score / b.maxScore) * 100 : 0;
      prior.count += 1;
      prior.sum += pct;
      assessmentSignal.set(b.skillId, prior);
    }
  }

  const resumeSkillsLower = new Set(
    (latestResume?.parsedSkills ?? []).map((s: unknown) => String(s).toLowerCase()),
  );

  const studentSkillIds = new Set(studentSkillRows.map((r) => String(r.skill._id)));

  // Compose per-skill entries with evidence metadata.
  const skills: StudentSkillWithMeta[] = studentSkillRows.map((row) => {
    const skillObj = row.skill as unknown as {
      _id: Types.ObjectId;
      name: string;
      category: SkillCategory;
    };
    const skillId = String(skillObj._id);
    const assessmentInfo = assessmentSignal.get(skillId);
    const trainingMatches = trainings
      .filter((t) => (t.skills ?? []).some((id: unknown) => String(id) === skillId))
      .slice(0, 3)
      .map((t) => ({
        id: String(t._id),
        title: String(t.title ?? ''),
        ...(t.registrationUrl ? { url: String(t.registrationUrl) } : {}),
      }));

    return {
      id: String(row._id),
      skill: {
        id: skillId,
        name: String(skillObj.name),
        category: skillObj.category,
      },
      proficiency: row.proficiency as Proficiency,
      yearsExperience: typeof row.yearsExperience === 'number' ? row.yearsExperience : undefined,
      evidenceUrl: row.evidenceUrl ?? undefined,
      evidence: {
        assessmentCount: assessmentInfo?.count ?? 0,
        assessmentAverageScore:
          assessmentInfo && assessmentInfo.count > 0
            ? Math.round((assessmentInfo.sum / assessmentInfo.count) * 10) / 10
            : null,
        resumeMentioned: resumeSkillsLower.has(String(skillObj.name).toLowerCase()),
        trainingMatches,
        industryDemand: 0,
      },
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  });

  // Group by category.
  const categoryMap = new Map<SkillCategory, StudentSkillWithMeta[]>();
  for (const s of skills) {
    const arr = categoryMap.get(s.skill.category) ?? [];
    arr.push(s);
    categoryMap.set(s.skill.category, arr);
  }

  const categories: CategoryGroup[] = Array.from(categoryMap.entries())
    .map(([category, list]) => {
      const profSum = list.reduce((s, x) => s + PROFICIENCY_ORDER[x.proficiency], 0);
      const avg = list.length > 0 ? profSum / list.length : 0;
      return {
        category,
        count: list.length,
        averageProficiency: Math.round(avg * 100) / 100,
        skills: list.sort(
          (a, b) => PROFICIENCY_ORDER[b.proficiency] - PROFICIENCY_ORDER[a.proficiency],
        ),
      };
    })
    .sort((a, b) => b.count - a.count);

  // Top strengths: highest proficiency skills, prefers EXPERT/ADVANCED.
  const strengths: StrengthAndGap[] = [...skills]
    .sort((a, b) => {
      const r = PROFICIENCY_ORDER[b.proficiency] - PROFICIENCY_ORDER[a.proficiency];
      if (r !== 0) return r;
      return (b.evidence.assessmentAverageScore ?? 0) - (a.evidence.assessmentAverageScore ?? 0);
    })
    .slice(0, 5)
    .map((s) => ({
      category: s.skill.category,
      proficiency: s.proficiency,
      skill: { id: s.skill.id, name: s.skill.name },
    }));

  // Industry demand insight: top 5 demanded skills from the assessments-driven
  // signal, separating those the student already has from those they are missing.
  const demanded = jobDemandRows.map((r) => ({
    id: String(r._id),
    name: String(r.name),
    count: Number(r.count),
  }));
  const topMatched = demanded.filter((d) => studentSkillIds.has(d.id)).slice(0, 5);
  const topMissing = demanded.filter((d) => !studentSkillIds.has(d.id)).slice(0, 5);

  // Soft "gaps" derived from weak proficiency in skills the student has already
  // added. Distinguishes "you don't have it" (industry.missing) from
  // "you have it but you're not yet strong" (skill-profile gaps).
  const gaps: StrengthAndGap[] = skills
    .filter((s) => PROFICIENCY_ORDER[s.proficiency] <= PROFICIENCY_ORDER.INTERMEDIATE)
    .sort((a, b) => PROFICIENCY_ORDER[a.proficiency] - PROFICIENCY_ORDER[b.proficiency])
    .slice(0, 5)
    .map((s) => ({
      category: s.skill.category,
      proficiency: s.proficiency,
      skill: { id: s.skill.id, name: s.skill.name },
    }));

  const technicalCount = skills.filter((s) => s.skill.category !== 'SOFT_SKILLS').length;
  const softCount = skills.filter((s) => s.skill.category === 'SOFT_SKILLS').length;
  const assessedSkillsCount = skills.filter((s) => s.evidence.assessmentCount > 0).length;

  // Average proficiency on a 1-4 scale, mapped to 0-100.
  const profTotal = skills.reduce((s, x) => s + PROFICIENCY_ORDER[x.proficiency], 0);
  const avgProf = skills.length > 0 ? profTotal / skills.length : 0;
  const averageProficiency = Math.round((avgProf / 4) * 100);

  // Source breakdown: a skill can be touched by more than one source, so this
  // counts the *number of skills touched by each source*, not the totals.
  const fromAssessments = skills.filter((s) => s.evidence.assessmentCount > 0).length;
  const fromResume = skills.filter((s) => s.evidence.resumeMentioned).length;
  const fromManual = skills.filter(
    (s) => s.evidence.assessmentCount === 0 && !s.evidence.resumeMentioned,
  ).length;

  // Readiness score: average proficiency weighted by industry relevance
  // (count of demanded skills the student has). When there is no demand data,
  // readiness collapses to the plain average so the score is never zero.
  const demandWeight =
    demanded.length > 0
      ? demanded.filter((d) => studentSkillIds.has(d.id)).reduce((s, d) => s + d.count, 0) /
        demanded.reduce((s, d) => s + d.count, 0)
      : 1;
  const readinessScore = Math.round(averageProficiency * (0.7 + 0.3 * demandWeight));

  return {
    totals: {
      totalSkills: skills.length,
      technicalCount,
      softSkillsCount: softCount,
      assessedSkillsCount,
      averageProficiency,
      readinessScore,
    },
    categories,
    strengths,
    gaps,
    industry: {
      topMissing: topMissing.map((d) => ({ ...d, missingCount: d.count })),
      topMatched: topMatched.map((d) => ({ ...d, demandCount: d.count })),
    },
    sourceBreakdown: {
      fromAssessments,
      fromResume,
      fromManual,
    },
  };
}

/**
 * Compose a lightweight skill history from StudentSkill change events
 * and Assessment submissions. This is the smallest safe solution:
 * no new collections, just joins over existing timestamps.
 *
 * - StudentSkill.createdAt → skill first added
 * - Assessment with status EVALUATED → assessment submitted
 *
 * Results are sorted newest-first, capped at 20 events.
 */
export async function buildSkillTimeline(userId: string): Promise<SkillTimelineResponse> {
  const studentId = await loadStudentId(userId);

  const [studentSkillRows, assessmentRows] = await Promise.all([
    StudentSkill.find({ student: studentId })
      .populate('skill', 'name')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean(),
    Assessment.find({ student: studentId, status: 'EVALUATED' })
      .select('skillNames evaluation.skillBreakdown evaluation.evaluatedAt createdAt')
      .sort({ createdAt: -1 })
      .limit(15)
      .lean(),
  ]);

  const events: SkillTimelineEvent[] = [];

  // StudentSkill creation events (first time a skill was added)
  for (const row of studentSkillRows) {
    const skillObj = row.skill as unknown as { _id: Types.ObjectId; name: string } | null;
    if (!skillObj) continue;
    events.push({
      id: String(row._id),
      type: 'STUDENT_SKILL_CREATED',
      at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      skillId: String(skillObj._id),
      skillName: skillObj.name,
      toProficiency: row.proficiency as Proficiency,
    });
  }

  // Assessment submission events
  for (const a of assessmentRows) {
    const evalObj = (
      a as unknown as { evaluation?: { skillBreakdown?: unknown[]; evaluatedAt?: unknown } }
    ).evaluation;
    const evaluatedAt =
      evalObj?.evaluatedAt instanceof Date
        ? evalObj.evaluatedAt.toISOString()
        : (a as unknown as { createdAt: unknown }).createdAt instanceof Date
          ? (a as unknown as { createdAt: Date }).createdAt.toISOString()
          : new Date().toISOString();
    const breakdown = Array.isArray(evalObj?.skillBreakdown)
      ? (evalObj!.skillBreakdown as Array<{
          skillId?: string;
          skillName?: string;
          score?: number;
          maxScore?: number;
        }>)
      : [];

    for (const b of breakdown) {
      const scorePct =
        b.maxScore && b.maxScore > 0 ? Math.round(((b.score ?? 0) / b.maxScore) * 100) : undefined;
      events.push({
        id: String(a._id),
        type: 'ASSESSMENT',
        at: evaluatedAt,
        skillId: b.skillId,
        skillName: b.skillName,
        assessmentId: String(a._id),
        scorePercent: scorePct,
        feedback:
          scorePct !== undefined
            ? scorePct >= 85
              ? 'Excellent'
              : scorePct >= 70
                ? 'Good'
                : scorePct >= 50
                  ? 'Needs improvement'
                  : 'Requires more study'
            : undefined,
      });
    }
  }

  // Sort all events newest-first and cap at 20
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return { events: events.slice(0, 20) };
}
