import { Types } from 'mongoose';
import type { Paginated } from '@aip/types';
import type { CreateTrainingInput, UpdateTrainingInput } from '@aip/validation';
import {
  Job,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
  type TrainingProgramDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import { serializeLean } from '../../utils/serializeLean';
import { computeMatch } from '../matching/algorithm';

export interface ListTrainingsInput {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  skillIds?: string[];
  search?: string;
  status?: 'ACTIVE' | 'ARCHIVED';
  difficulty?: string;
  contentType?: string;
}

export async function listTrainings(
  input: ListTrainingsInput,
): Promise<Paginated<TrainingProgramDoc>> {
  const pg = applyPagination(input);
  const filter: Record<string, unknown> = {
    status: input.status ?? 'ACTIVE',
  };

  if (input.skillIds && input.skillIds.length > 0) {
    filter.skills = { $in: input.skillIds.map((id) => new Types.ObjectId(id)) };
  }
  if (input.search && input.search.trim().length > 0) {
    filter.title = { $regex: input.search.trim(), $options: 'i' };
  }
  if (input.difficulty) {
    filter.difficulty = input.difficulty;
  }
  if (input.contentType) {
    filter.contentType = input.contentType;
  }

  const [items, total] = await Promise.all([
    TrainingProgram.find(filter)
      .populate('skills')
      .sort(pg.sort)
      .skip(pg.skip)
      .limit(pg.limit)
      .lean(),
    TrainingProgram.countDocuments(filter),
  ]);

  // `.lean()` skips the schema's `toJSON` transform, so the rows still carry
  // `_id`. Every client list key and detail link is written against `id`.
  return buildPaginated(
    serializeLean(items as unknown as TrainingProgramDoc[]),
    total,
    pg.page,
    pg.pageSize,
  );
}

export async function getTrainingById(id: string): Promise<TrainingProgramDoc> {
  const doc = await TrainingProgram.findById(id).populate('skills');
  if (!doc) throw AppError.notFound('Training program not found');
  return doc;
}

export async function createTraining(input: CreateTrainingInput): Promise<TrainingProgramDoc> {
  const doc = await TrainingProgram.create({
    title: input.title,
    description: input.description,
    provider: input.provider,
    skills: input.skills.map((id) => new Types.ObjectId(id)),
    durationWeeks: input.durationWeeks,
    startDate: input.startDate ? new Date(input.startDate) : undefined,
    endDate: input.endDate ? new Date(input.endDate) : undefined,
    registrationDeadline: input.registrationDeadline
      ? new Date(input.registrationDeadline)
      : undefined,
    registrationUrl: input.registrationUrl,
    status: input.status,
    // Phase 15B — Extended fields
    contentType: (input as unknown as { contentType?: string }).contentType,
    difficulty: (input as unknown as { difficulty?: string }).difficulty,
    estimatedHours: (input as unknown as { estimatedHours?: number }).estimatedHours,
    certificateAvailable: (input as unknown as { certificateAvailable?: boolean })
      .certificateAvailable,
  });
  return doc.populate('skills');
}

export async function updateTraining(
  id: string,
  input: UpdateTrainingInput,
): Promise<TrainingProgramDoc> {
  const patch: Record<string, unknown> = { ...input };
  if (input.skills) {
    patch.skills = input.skills.map((s) => new Types.ObjectId(s));
  }
  // Handle date conversions
  if (input.startDate) patch.startDate = new Date(input.startDate);
  if (input.endDate) patch.endDate = new Date(input.endDate);
  if (input.registrationDeadline) {
    patch.registrationDeadline = new Date(input.registrationDeadline);
  }
  const doc = await TrainingProgram.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  }).populate('skills');
  if (!doc) throw AppError.notFound('Training program not found');
  return doc;
}

export async function archiveTraining(id: string): Promise<TrainingProgramDoc> {
  const doc = await TrainingProgram.findByIdAndUpdate(id, { status: 'ARCHIVED' }, { new: true });
  if (!doc) throw AppError.notFound('Training program not found');
  return doc;
}

export interface RecommendedTraining {
  training: TrainingProgramDoc;
  overlap: number;
}

export async function recommendTrainingsForStudent(
  userId: string,
  limit = 10,
): Promise<RecommendedTraining[]> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw AppError.notFound('Student profile not found');

  const [studentSkills, jobs] = await Promise.all([
    StudentSkill.find({ student: profile._id }).lean(),
    Job.find({ status: 'PUBLISHED' }).select('requiredSkills preferredSkills').limit(50).lean(),
  ]);

  const studentSkillIds = studentSkills.map((s) => String(s.skill));
  const missing = new Set<string>();

  for (const job of jobs) {
    const result = computeMatch(
      studentSkillIds,
      (job.requiredSkills ?? []).map((s) => String(s)),
      (job.preferredSkills ?? []).map((s) => String(s)),
    );
    for (const s of result.missingSkills) missing.add(String(s));
  }

  if (missing.size === 0) {
    const items = await TrainingProgram.find({ status: 'ACTIVE' })
      .populate('skills')
      .limit(limit)
      .lean();
    return (items as unknown as TrainingProgramDoc[]).map((training) => ({
      training: serializeLean(training),
      overlap: 0,
    }));
  }

  const missingIds = Array.from(missing).map((id) => new Types.ObjectId(id));

  const trainings = await TrainingProgram.find({
    status: 'ACTIVE',
    skills: { $in: missingIds },
  })
    .populate('skills')
    .lean();

  const missingSet = new Set(Array.from(missing));
  const ranked = (trainings as unknown as TrainingProgramDoc[])
    .map((training) => {
      const skillIds = (training.skills as unknown as Array<{ _id?: unknown; id?: string }>).map(
        (s) => String(s._id ?? s.id ?? s),
      );
      const overlap = skillIds.filter((id) => missingSet.has(id)).length;
      return { training: serializeLean(training), overlap };
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit);

  return ranked;
}
