import { Types } from 'mongoose';
import {
  DEFAULT_ASSESSMENT_DURATION_MIN,
  DEFAULT_ASSESSMENT_QUESTIONS,
} from '@aip/config';
import type { AssessmentStatus } from '@aip/config';
import type {
  Assessment as AssessmentDTO,
  AssessmentAnswer,
  AssessmentEvaluation,
  AssessmentQuestion,
  AssessmentSummary,
  Paginated,
} from '@aip/types';
import type { GenerateAssessmentInput, SaveAnswerInput } from '@aip/validation';
import {
  Assessment,
  Skill,
  StudentProfile,
  StudentSkill,
  type AssessmentDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { getModelName, isGeminiConfigured } from '../../config/gemini';
import { evaluateAnswers, generateQuestions } from './assessments.gemini';

async function loadStudentId(userId: string): Promise<Types.ObjectId> {
  const profile = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id as Types.ObjectId;
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

function requiredIso(value: unknown): string {
  const iso = toIso(value);
  if (!iso) throw AppError.internal('Missing timestamp on assessment record');
  return iso;
}

function mapQuestion(raw: unknown): AssessmentQuestion {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(obj.id ?? ''),
    text: String(obj.text ?? ''),
    targetSkills: Array.isArray(obj.targetSkills) ? (obj.targetSkills as string[]) : [],
    expectedConcepts: Array.isArray(obj.expectedConcepts) ? (obj.expectedConcepts as string[]) : [],
    maxMarks: Number(obj.maxMarks ?? 0),
  };
}

function mapAnswer(raw: unknown): AssessmentAnswer {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    questionId: String(obj.questionId ?? ''),
    text: typeof obj.text === 'string' ? obj.text : '',
    updatedAt: requiredIso(obj.updatedAt),
  };
}

function mapEvaluation(raw: unknown): AssessmentEvaluation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const perQuestion = Array.isArray(obj.perQuestion)
    ? (obj.perQuestion as Array<Record<string, unknown>>).map((pq) => ({
        questionId: String(pq.questionId ?? ''),
        score: Number(pq.score ?? 0),
        feedback: typeof pq.feedback === 'string' ? pq.feedback : '',
      }))
    : [];
  return {
    perQuestion,
    totalScore: Number(obj.totalScore ?? 0),
    rawScore: Number(obj.rawScore ?? 0),
    maxScore: Number(obj.maxScore ?? 0),
    overallFeedback: typeof obj.overallFeedback === 'string' ? obj.overallFeedback : '',
    strengths: typeof obj.strengths === 'string' ? obj.strengths : '',
    weaknesses: typeof obj.weaknesses === 'string' ? obj.weaknesses : '',
    evaluatedAt: requiredIso(obj.evaluatedAt),
  };
}

function mapAssessment(doc: AssessmentDoc | Record<string, unknown>): AssessmentDTO {
  const json =
    typeof (doc as AssessmentDoc).toJSON === 'function'
      ? ((doc as AssessmentDoc).toJSON() as Record<string, unknown>)
      : (doc as Record<string, unknown>);
  const idSource = json.id ?? json._id;
  return {
    id: String(idSource ?? ''),
    student: String(json.student ?? ''),
    status: (json.status as AssessmentStatus) ?? 'GENERATED',
    skills: Array.isArray(json.skills) ? (json.skills as unknown[]).map((s) => String(s)) : [],
    skillNames: Array.isArray(json.skillNames) ? (json.skillNames as string[]) : [],
    questions: Array.isArray(json.questions) ? (json.questions as unknown[]).map(mapQuestion) : [],
    answers: Array.isArray(json.answers) ? (json.answers as unknown[]).map(mapAnswer) : [],
    evaluation: mapEvaluation(json.evaluation),
    durationMinutes: Number(json.durationMinutes ?? 0),
    questionCount: Number(json.questionCount ?? 0),
    startedAt: requiredIso(json.startedAt),
    expiresAt: requiredIso(json.expiresAt),
    submittedAt: toIso(json.submittedAt),
    generatedByModel: String(json.generatedByModel ?? ''),
    createdAt: requiredIso(json.createdAt),
    updatedAt: requiredIso(json.updatedAt),
  };
}

async function loadOwnedAssessment(userId: string, assessmentId: string): Promise<AssessmentDoc> {
  const studentId = await loadStudentId(userId);
  const doc = await Assessment.findById(assessmentId);
  if (!doc) throw AppError.notFound('Assessment not found');
  if (String(doc.student) !== String(studentId)) throw AppError.forbidden('Not your assessment');
  return doc;
}

export async function listMyAssessments(
  userId: string,
  input: PaginationInput,
): Promise<Paginated<AssessmentDTO>> {
  const studentId = await loadStudentId(userId);
  const { page, pageSize, skip, limit } = applyPagination(input);
  const [rows, total] = await Promise.all([
    Assessment.find({ student: studentId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Assessment.countDocuments({ student: studentId }),
  ]);
  const items = rows.map((row) => mapAssessment(row as unknown as Record<string, unknown>));
  return buildPaginated(items, total, page, pageSize);
}

export async function getMyLatest(userId: string): Promise<AssessmentDTO | null> {
  const studentId = await loadStudentId(userId);
  const row = await Assessment.findOne({ student: studentId }).sort({ createdAt: -1 }).lean();
  if (!row) return null;
  return mapAssessment(row as unknown as Record<string, unknown>);
}

export async function getAssessmentSummary(userId: string): Promise<AssessmentSummary> {
  const studentId = await loadStudentId(userId);
  const [totalCount, latest, evalStats] = await Promise.all([
    Assessment.countDocuments({ student: studentId }),
    Assessment.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    Assessment.aggregate<{ _id: null; avg: number }>([
      { $match: { student: studentId, status: 'EVALUATED' } },
      { $group: { _id: null, avg: { $avg: '$evaluation.totalScore' } } },
    ]),
  ]);
  if (!latest) {
    return { totalCount: 0 };
  }
  const latestObj = latest as unknown as Record<string, unknown>;
  const evaluation = latestObj.evaluation as Record<string, unknown> | undefined;
  const latestDate =
    toIso(latestObj.submittedAt) ??
    toIso(latestObj.createdAt) ??
    new Date().toISOString();
  const avg = evalStats.length > 0 ? evalStats[0]!.avg : undefined;
  return {
    latestId: String(latestObj._id ?? ''),
    latestScore: typeof evaluation?.totalScore === 'number' ? (evaluation.totalScore as number) : undefined,
    latestStatus: (latestObj.status as AssessmentStatus) ?? undefined,
    latestSkills: Array.isArray(latestObj.skillNames) ? (latestObj.skillNames as string[]) : [],
    latestDate,
    totalCount,
    averageScore: typeof avg === 'number' ? Math.round(avg * 100) / 100 : undefined,
  };
}

export async function generateAssessment(
  userId: string,
  input: GenerateAssessmentInput,
): Promise<AssessmentDTO> {
  if (!isGeminiConfigured()) {
    throw AppError.serviceUnavailable('AI is not configured');
  }
  const studentId = await loadStudentId(userId);

  const studentSkillRows = await StudentSkill.find({ student: studentId }).select('skill').lean();
  let skillIdCandidates = studentSkillRows.map((r) => String(r.skill));

  if (input.skillIds && input.skillIds.length > 0) {
    const requested = new Set(input.skillIds);
    skillIdCandidates = skillIdCandidates.filter((id) => requested.has(id));
    if (skillIdCandidates.length === 0) {
      skillIdCandidates = input.skillIds;
    }
  }

  if (skillIdCandidates.length === 0) {
    throw AppError.badRequest('Add at least one skill before generating an assessment');
  }

  const skillDocs = await Skill.find({ _id: { $in: skillIdCandidates } }).select('name').lean();
  const skillNames = skillDocs.map((s) => String(s.name));
  if (skillNames.length === 0) {
    throw AppError.badRequest('Add at least one skill before generating an assessment');
  }
  const skillObjectIds = skillDocs.map((s) => s._id);

  const questionCount = input.questionCount ?? DEFAULT_ASSESSMENT_QUESTIONS;
  const durationMinutes = input.durationMinutes ?? DEFAULT_ASSESSMENT_DURATION_MIN;

  const questions = await generateQuestions(skillNames, questionCount);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60_000);

  const created = await Assessment.create({
    student: studentId,
    status: 'GENERATED',
    skills: skillObjectIds,
    skillNames,
    questions,
    answers: [],
    durationMinutes,
    questionCount: questions.length,
    startedAt: now,
    expiresAt,
    generatedByModel: getModelName(),
  });

  return mapAssessment(created);
}

export async function getById(userId: string, assessmentId: string): Promise<AssessmentDTO> {
  const doc = await loadOwnedAssessment(userId, assessmentId);
  return mapAssessment(doc);
}

export async function saveAnswer(
  userId: string,
  assessmentId: string,
  input: SaveAnswerInput,
): Promise<{ updatedAt: string }> {
  const doc = await loadOwnedAssessment(userId, assessmentId);
  if (doc.status === 'SUBMITTED' || doc.status === 'EVALUATED') {
    throw AppError.badRequest('Assessment already submitted');
  }
  const expiresAt = doc.expiresAt as Date;
  if (expiresAt instanceof Date && expiresAt.getTime() <= Date.now()) {
    throw AppError.conflict('Assessment has expired');
  }
  const questions = ((doc.questions as unknown) as Array<{ id: string }>) ?? [];
  const exists = questions.some((q) => String(q.id) === input.questionId);
  if (!exists) throw AppError.badRequest('Question does not belong to this assessment');

  if (doc.status === 'GENERATED') doc.status = 'IN_PROGRESS';

  const answers = ((doc.answers as unknown) as Array<{
    questionId: string;
    text: string;
    updatedAt: Date;
  }>) ?? [];
  const updatedAt = new Date();
  const next = answers.filter((a) => String(a.questionId) !== input.questionId);
  next.push({ questionId: input.questionId, text: input.text, updatedAt });
  (doc.answers as unknown) = next;
  doc.markModified('answers');
  await doc.save();
  return { updatedAt: updatedAt.toISOString() };
}

export async function submitAssessment(
  userId: string,
  assessmentId: string,
): Promise<AssessmentDTO> {
  const doc = await loadOwnedAssessment(userId, assessmentId);
  if (doc.status === 'EVALUATED') return mapAssessment(doc);

  const now = new Date();
  doc.status = 'SUBMITTED';
  doc.submittedAt = now;

  const questions = (((doc.questions as unknown) as unknown[]) ?? []).map(mapQuestion);
  const answers = (((doc.answers as unknown) as unknown[]) ?? []).map(mapAnswer);

  const evaluation = await evaluateAnswers(questions, answers);

  const rawScore = evaluation.perQuestion.reduce((sum, pq) => sum + pq.score, 0);
  const maxScore = questions.reduce((sum, q) => sum + q.maxMarks, 0);
  const totalScore = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;

  (doc.evaluation as unknown) = {
    perQuestion: evaluation.perQuestion,
    totalScore,
    rawScore,
    maxScore,
    overallFeedback: evaluation.overallFeedback,
    strengths: evaluation.strengths,
    weaknesses: evaluation.weaknesses,
    evaluatedAt: now,
  };
  doc.markModified('evaluation');
  doc.status = 'EVALUATED';
  await doc.save();

  return mapAssessment(doc);
}
