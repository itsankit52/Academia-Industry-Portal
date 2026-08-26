import { Types } from 'mongoose';
import { APTITUDE_CATEGORIES } from '@aip/config';
import type { AptitudeCategory } from '@aip/config';
import type {
  AptitudeCategoryCount,
  AptitudeQuestion as AptitudeQuestionDTO,
  AptitudeQuestionStudent,
  AptitudeTest as AptitudeTestDTO,
  AptitudeTestResult,
  AptitudeTestQuestionResult,
  AptitudeTestQuestionStudent,
  AptitudeTestSummary,
  Paginated,
} from '@aip/types';
import type {
  CreateAptitudeQuestionInput,
  ListAptitudeQuestionsQuery,
  ListMyAptitudeTestsQuery,
  UpdateAptitudeQuestionInput,
} from '@aip/validation';
import {
  AptitudeQuestion,
  AptitudeTest,
  Skill,
  StudentProfile,
  StudentSkill,
  type AptitudeQuestionDoc,
  type AptitudeTestDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';

const DEFAULT_DURATION_SECONDS = 1800;
const DEFAULT_PASSING_SCORE = 60;

const CATEGORY_SKILL_MAP: Record<AptitudeCategory, string> = {
  QUANT: 'quantitative aptitude',
  LOGIC: 'logical reasoning',
  VERBAL: 'verbal reasoning',
  ENGLISH: 'english',
};

async function loadStudentIdForUser(userId: string): Promise<Types.ObjectId> {
  const profile = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id as Types.ObjectId;
}

function requiredIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  throw AppError.internal('Missing timestamp on aptitude record');
}

function optionalIso(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

function mapQuestionAdmin(doc: AptitudeQuestionDoc | Record<string, unknown>): AptitudeQuestionDTO {
  const json =
    typeof (doc as AptitudeQuestionDoc).toJSON === 'function'
      ? ((doc as AptitudeQuestionDoc).toJSON() as Record<string, unknown>)
      : (doc as Record<string, unknown>);
  const idSource = json.id ?? json._id;
  return {
    id: String(idSource ?? ''),
    category: json.category as AptitudeCategory,
    question: String(json.question ?? ''),
    options: Array.isArray(json.options) ? (json.options as string[]) : [],
    correctIndex: Number(json.correctIndex ?? 0),
    explanation: typeof json.explanation === 'string' ? json.explanation : undefined,
    difficulty: (json.difficulty as 'EASY' | 'MEDIUM' | 'HARD') ?? 'MEDIUM',
    tags: Array.isArray(json.tags) ? (json.tags as string[]) : [],
    status: (json.status as 'ACTIVE' | 'ARCHIVED') ?? 'ACTIVE',
    createdAt: requiredIso(json.createdAt),
    updatedAt: requiredIso(json.updatedAt),
  };
}

function toStudentView(q: AptitudeQuestionDTO | Record<string, unknown>): AptitudeQuestionStudent {
  const idSource = (q as Record<string, unknown>).id ?? (q as Record<string, unknown>)._id;
  return {
    id: String(idSource ?? ''),
    category: (q as Record<string, unknown>).category as AptitudeCategory,
    question: String((q as Record<string, unknown>).question ?? ''),
    options: Array.isArray((q as Record<string, unknown>).options)
      ? ((q as Record<string, unknown>).options as string[])
      : [],
    difficulty: ((q as Record<string, unknown>).difficulty as 'EASY' | 'MEDIUM' | 'HARD') ?? 'MEDIUM',
    tags: Array.isArray((q as Record<string, unknown>).tags)
      ? ((q as Record<string, unknown>).tags as string[])
      : [],
  };
}

interface TestQuestionRow {
  questionId: unknown;
  chosenIndex: number | null;
  correct: boolean | null;
}

function testQuestionsArray(doc: AptitudeTestDoc): TestQuestionRow[] {
  const raw = ((doc.questions as unknown) as TestQuestionRow[] | undefined) ?? [];
  return raw;
}

function baseTestFields(doc: AptitudeTestDoc): Omit<AptitudeTestDTO, 'questions'> {
  return {
    id: String(doc._id),
    student: String(doc.student),
    user: String(doc.user),
    category: doc.category as AptitudeCategory,
    totalQuestions: Number(doc.totalQuestions ?? 0),
    correctCount: Number(doc.correctCount ?? 0),
    score: Number(doc.score ?? 0),
    passingScore: Number(doc.passingScore ?? DEFAULT_PASSING_SCORE),
    passed: Boolean(doc.passed),
    status: doc.status as AptitudeTestDTO['status'],
    startedAt: requiredIso(doc.startedAt),
    expiresAt: requiredIso(doc.expiresAt),
    submittedAt: optionalIso(doc.submittedAt),
    durationSeconds: Number(doc.durationSeconds ?? DEFAULT_DURATION_SECONDS),
    createdAt: requiredIso((doc as unknown as { createdAt: unknown }).createdAt),
    updatedAt: requiredIso((doc as unknown as { updatedAt: unknown }).updatedAt),
  };
}

async function mapTestStudentView(doc: AptitudeTestDoc): Promise<AptitudeTestDTO> {
  const rows = testQuestionsArray(doc);
  const questionIds = rows.map((r) => String(r.questionId));
  const questionDocs = await AptitudeQuestion.find({ _id: { $in: questionIds } }).lean();
  const byId = new Map<string, Record<string, unknown>>();
  for (const q of questionDocs) {
    byId.set(String(q._id), q as unknown as Record<string, unknown>);
  }

  const questions: AptitudeTestQuestionStudent[] = rows.map((row) => {
    const raw = byId.get(String(row.questionId));
    const student = raw
      ? toStudentView(raw)
      : {
          id: String(row.questionId),
          category: doc.category as AptitudeCategory,
          question: '',
          options: [],
          difficulty: 'MEDIUM' as const,
          tags: [] as string[],
        };
    return {
      questionId: String(row.questionId),
      chosenIndex: row.chosenIndex ?? null,
      question: student,
    };
  });

  return { ...baseTestFields(doc), questions };
}

async function mapTestResultView(doc: AptitudeTestDoc): Promise<AptitudeTestResult> {
  const rows = testQuestionsArray(doc);
  const questionIds = rows.map((r) => String(r.questionId));
  const questionDocs = await AptitudeQuestion.find({ _id: { $in: questionIds } })
    .select('+correctIndex')
    .lean();
  const byId = new Map<string, Record<string, unknown>>();
  for (const q of questionDocs) {
    byId.set(String(q._id), q as unknown as Record<string, unknown>);
  }

  const questions: AptitudeTestQuestionResult[] = rows.map((row) => {
    const raw = byId.get(String(row.questionId)) ?? {};
    return {
      questionId: String(row.questionId),
      chosenIndex: row.chosenIndex ?? null,
      correct: row.correct ?? null,
      correctIndex: Number(raw.correctIndex ?? 0),
      explanation: typeof raw.explanation === 'string' ? raw.explanation : undefined,
      question: String(raw.question ?? ''),
      options: Array.isArray(raw.options) ? (raw.options as string[]) : [],
    };
  });

  return { ...baseTestFields(doc), questions };
}

function summarizeTest(doc: AptitudeTestDoc | Record<string, unknown>): AptitudeTestSummary {
  const obj = doc as unknown as Record<string, unknown>;
  return {
    id: String(obj._id ?? obj.id ?? ''),
    category: obj.category as AptitudeCategory,
    status: (obj.status as AptitudeTestSummary['status']) ?? 'IN_PROGRESS',
    score: Number(obj.score ?? 0),
    passed: Boolean(obj.passed),
    totalQuestions: Number(obj.totalQuestions ?? 0),
    correctCount: Number(obj.correctCount ?? 0),
    submittedAt: optionalIso(obj.submittedAt),
    createdAt: requiredIso(obj.createdAt),
  };
}

export async function listCategoriesWithCounts(): Promise<AptitudeCategoryCount[]> {
  const rows = await AptitudeQuestion.aggregate<{ _id: AptitudeCategory; count: number }>([
    { $match: { status: 'ACTIVE' } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const byCategory = new Map<AptitudeCategory, number>();
  for (const r of rows) byCategory.set(r._id, r.count);
  return APTITUDE_CATEGORIES.map((category) => ({
    category,
    activeQuestionCount: byCategory.get(category) ?? 0,
  }));
}

export async function checkAndExpireTest(doc: AptitudeTestDoc): Promise<AptitudeTestDoc> {
  if (doc.status === 'IN_PROGRESS') {
    const expiresAt = doc.expiresAt as Date;
    if (expiresAt instanceof Date && expiresAt.getTime() <= Date.now()) {
      doc.status = 'EXPIRED';
      await doc.save();
    }
  }
  return doc;
}

export async function startTest(
  userId: string,
  category: AptitudeCategory,
  questionCount: number,
): Promise<AptitudeTestDTO> {
  const studentId = await loadStudentIdForUser(userId);

  const existing = await AptitudeTest.find({
    user: userId,
    category,
    status: 'IN_PROGRESS',
  });
  for (const t of existing) {
    await checkAndExpireTest(t);
  }
  const activeConflict = await AptitudeTest.findOne({
    user: userId,
    category,
    status: 'IN_PROGRESS',
  });
  if (activeConflict) {
    throw AppError.conflict('You already have an in-progress test in this category');
  }

  const totalActive = await AptitudeQuestion.countDocuments({ category, status: 'ACTIVE' });
  if (totalActive === 0) {
    throw AppError.badRequest('No active questions available in this category');
  }
  const requested = Math.min(questionCount, totalActive);

  const sampled = await AptitudeQuestion.aggregate<{ _id: Types.ObjectId }>([
    { $match: { category, status: 'ACTIVE' } },
    { $sample: { size: requested } },
    { $project: { _id: 1 } },
  ]);
  const ids = sampled.map((s) => s._id);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_DURATION_SECONDS * 1000);

  const created = await AptitudeTest.create({
    student: studentId,
    user: userId,
    category,
    questions: ids.map((id) => ({ questionId: id, chosenIndex: null, correct: null })),
    totalQuestions: ids.length,
    correctCount: 0,
    score: 0,
    passingScore: DEFAULT_PASSING_SCORE,
    passed: false,
    status: 'IN_PROGRESS',
    startedAt: now,
    expiresAt,
    durationSeconds: DEFAULT_DURATION_SECONDS,
  });

  return mapTestStudentView(created);
}

async function loadOwnedTest(testId: string, userId: string): Promise<AptitudeTestDoc> {
  if (!Types.ObjectId.isValid(testId)) throw AppError.notFound('Aptitude test not found');
  const doc = await AptitudeTest.findById(testId);
  if (!doc) throw AppError.notFound('Aptitude test not found');
  if (String(doc.user) !== String(userId)) throw AppError.forbidden('Not your test');
  return doc;
}

export async function getMyTest(
  testId: string,
  userId: string,
): Promise<{ test: AptitudeTestDTO; result?: AptitudeTestResult }> {
  const doc = await loadOwnedTest(testId, userId);
  await checkAndExpireTest(doc);
  const test = await mapTestStudentView(doc);
  if (doc.status === 'SUBMITTED') {
    const result = await mapTestResultView(doc);
    return { test, result };
  }
  return { test };
}

export async function saveAnswer(
  testId: string,
  userId: string,
  questionId: string,
  chosenIndex: number,
): Promise<{ savedAt: string }> {
  const doc = await loadOwnedTest(testId, userId);
  await checkAndExpireTest(doc);
  if (doc.status !== 'IN_PROGRESS') {
    throw AppError.badRequest(`Test is ${doc.status}, cannot save answer`);
  }

  const rows = testQuestionsArray(doc);
  const target = rows.find((r) => String(r.questionId) === questionId);
  if (!target) throw AppError.badRequest('Question does not belong to this test');

  const q = await AptitudeQuestion.findById(questionId).select('+correctIndex');
  if (!q) throw AppError.notFound('Question not found');

  target.chosenIndex = chosenIndex;
  target.correct = chosenIndex === Number(q.correctIndex);

  (doc.questions as unknown) = rows;
  doc.markModified('questions');
  await doc.save();
  return { savedAt: new Date().toISOString() };
}

async function ensureCategorySkill(category: AptitudeCategory): Promise<Types.ObjectId> {
  const skillName = CATEGORY_SKILL_MAP[category];
  let skill = await Skill.findOne({ name: skillName });
  if (!skill) {
    skill = await Skill.create({
      name: skillName,
      category: 'SOFT_SKILLS',
      description: `Aptitude domain: ${category.toLowerCase()}`,
      status: 'ACTIVE',
    });
  }
  return skill._id as Types.ObjectId;
}

async function upgradeStudentSkillFromTest(
  studentId: Types.ObjectId,
  category: AptitudeCategory,
): Promise<void> {
  const skillId = await ensureCategorySkill(category);
  const existing = await StudentSkill.findOne({ student: studentId, skill: skillId });
  if (existing) {
    if (existing.proficiency === 'BEGINNER') {
      existing.proficiency = 'INTERMEDIATE';
      await existing.save();
    }
    return;
  }
  await StudentSkill.create({
    student: studentId,
    skill: skillId,
    proficiency: 'INTERMEDIATE',
  });
}

export async function submitTest(testId: string, userId: string): Promise<AptitudeTestResult> {
  const doc = await loadOwnedTest(testId, userId);
  if (doc.status === 'SUBMITTED') {
    return mapTestResultView(doc);
  }
  if (doc.status === 'EXPIRED') {
    throw AppError.badRequest('Test has expired');
  }
  const refreshed = await checkAndExpireTest(doc);
  if (refreshed.status === 'EXPIRED') {
    throw AppError.badRequest('Test has expired');
  }

  const rows = testQuestionsArray(refreshed);
  const questionIds = rows.map((r) => String(r.questionId));
  const questionDocs = await AptitudeQuestion.find({ _id: { $in: questionIds } })
    .select('+correctIndex')
    .lean();
  const correctById = new Map<string, number>();
  for (const q of questionDocs) {
    correctById.set(String(q._id), Number((q as unknown as { correctIndex: number }).correctIndex));
  }

  let correctCount = 0;
  for (const row of rows) {
    const correctIndex = correctById.get(String(row.questionId));
    if (correctIndex === undefined) {
      row.correct = null;
      continue;
    }
    if (row.chosenIndex === null || row.chosenIndex === undefined) {
      row.correct = false;
      continue;
    }
    const isRight = Number(row.chosenIndex) === correctIndex;
    row.correct = isRight;
    if (isRight) correctCount += 1;
  }

  const total = rows.length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = score >= Number(doc.passingScore ?? DEFAULT_PASSING_SCORE);

  (doc.questions as unknown) = rows;
  doc.markModified('questions');
  doc.correctCount = correctCount;
  doc.score = score;
  doc.passed = passed;
  doc.status = 'SUBMITTED';
  doc.submittedAt = new Date();
  await doc.save();

  if (passed) {
    await upgradeStudentSkillFromTest(doc.student as Types.ObjectId, doc.category as AptitudeCategory);
  }

  return mapTestResultView(doc);
}

export async function listMyTests(
  userId: string,
  pag: PaginationInput,
  filters: ListMyAptitudeTestsQuery,
): Promise<Paginated<AptitudeTestSummary>> {
  const { page, pageSize, skip, limit } = applyPagination(pag);
  const where: Record<string, unknown> = { user: userId };
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;

  const [rows, total] = await Promise.all([
    AptitudeTest.find(where).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AptitudeTest.countDocuments(where),
  ]);
  const items = rows.map((r) => summarizeTest(r as unknown as Record<string, unknown>));
  return buildPaginated(items, total, page, pageSize);
}

export async function createQuestion(
  input: CreateAptitudeQuestionInput,
): Promise<AptitudeQuestionDTO> {
  if (input.correctIndex < 0 || input.correctIndex >= input.options.length) {
    throw AppError.badRequest('correctIndex is out of range for options');
  }
  const created = await AptitudeQuestion.create({
    category: input.category,
    question: input.question,
    options: input.options,
    correctIndex: input.correctIndex,
    explanation: input.explanation,
    difficulty: input.difficulty ?? 'MEDIUM',
    tags: input.tags ?? [],
    status: 'ACTIVE',
  });
  const withCorrect = await AptitudeQuestion.findById(created._id).select('+correctIndex');
  return mapQuestionAdmin(withCorrect ?? created);
}

export async function updateQuestion(
  id: string,
  patch: UpdateAptitudeQuestionInput,
): Promise<AptitudeQuestionDTO> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Question not found');
  const doc = await AptitudeQuestion.findById(id).select('+correctIndex');
  if (!doc) throw AppError.notFound('Question not found');
  const updated: Record<string, unknown> = { ...patch };
  if (Array.isArray(patch.options) && patch.options.length !== 4) {
    throw AppError.badRequest('options must contain exactly 4 items');
  }
  const nextCorrectIndex =
    patch.correctIndex !== undefined ? patch.correctIndex : Number(doc.correctIndex);
  const nextOptions = patch.options ?? (doc.options as unknown as string[]);
  if (nextCorrectIndex < 0 || nextCorrectIndex >= nextOptions.length) {
    throw AppError.badRequest('correctIndex is out of range for options');
  }
  Object.assign(doc, updated);
  await doc.save();
  return mapQuestionAdmin(doc);
}

export async function archiveQuestion(id: string): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Question not found');
  const doc = await AptitudeQuestion.findByIdAndUpdate(
    id,
    { $set: { status: 'ARCHIVED' } },
    { new: true },
  );
  if (!doc) throw AppError.notFound('Question not found');
}

export async function listQuestions(
  pag: PaginationInput,
  filters: ListAptitudeQuestionsQuery,
): Promise<Paginated<AptitudeQuestionDTO>> {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = {};
  if (filters.category) where.category = filters.category;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.status) where.status = filters.status;
  if (filters.search) where.question = { $regex: filters.search, $options: 'i' };

  const [rows, total] = await Promise.all([
    AptitudeQuestion.find(where).select('+correctIndex').sort(sort).skip(skip).limit(limit).lean(),
    AptitudeQuestion.countDocuments(where),
  ]);
  const items = rows.map((r) => mapQuestionAdmin(r as unknown as Record<string, unknown>));
  return buildPaginated(items, total, page, pageSize);
}
