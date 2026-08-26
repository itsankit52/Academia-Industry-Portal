import type {
  CreateSkillInput,
  UpdateSkillInput,
  AddStudentSkillInput,
} from '@aip/validation';
import type { Proficiency } from '@aip/config';
import { AppError } from '../../utils/AppError';
import { Skill, StudentSkill, StudentProfile } from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';

export interface SkillListFilters {
  category?: string;
  search?: string;
  status?: string;
}

export async function listSkills(pag: PaginationInput, filters: SkillListFilters) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = { status: filters.status ?? 'ACTIVE' };
  if (filters.category) where.category = filters.category;
  if (filters.search) where.name = { $regex: filters.search, $options: 'i' };

  const [rows, total] = await Promise.all([
    Skill.find(where).sort(sort).skip(skip).limit(limit),
    Skill.countDocuments(where),
  ]);
  return buildPaginated(rows.map((r) => r.toJSON()), total, page, pageSize);
}

export async function createSkill(input: CreateSkillInput) {
  const name = input.name.toLowerCase();
  const exists = await Skill.findOne({ name });
  if (exists) throw AppError.conflict('Skill already exists');
  const skill = await Skill.create({ ...input, name });
  return skill.toJSON();
}

export async function updateSkill(id: string, patch: UpdateSkillInput) {
  const clean: Record<string, unknown> = { ...patch };
  if (typeof clean.name === 'string') clean.name = clean.name.toLowerCase();
  const skill = await Skill.findByIdAndUpdate(
    id,
    { $set: clean },
    { new: true, runValidators: true },
  );
  if (!skill) throw AppError.notFound('Skill not found');
  return skill.toJSON();
}

export async function archiveSkill(id: string) {
  const skill = await Skill.findByIdAndUpdate(
    id,
    { $set: { status: 'ARCHIVED' } },
    { new: true },
  );
  if (!skill) throw AppError.notFound('Skill not found');
}

async function getStudentIdFromUser(userId: string): Promise<string> {
  const profile = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return String(profile._id);
}

export async function listMyStudentSkills(userId: string) {
  const studentId = await getStudentIdFromUser(userId);
  const rows = await StudentSkill.find({ student: studentId }).populate('skill');
  return rows.map((r) => r.toJSON());
}

export async function addMyStudentSkill(userId: string, input: AddStudentSkillInput) {
  const studentId = await getStudentIdFromUser(userId);
  const skillExists = await Skill.findById(input.skillId).select('_id');
  if (!skillExists) throw AppError.notFound('Skill not found');
  const dup = await StudentSkill.findOne({ student: studentId, skill: input.skillId });
  if (dup) throw AppError.conflict('Skill already added');
  const created = await StudentSkill.create({
    student: studentId,
    skill: input.skillId,
    proficiency: input.proficiency,
    yearsExperience: input.yearsExperience,
    evidenceUrl: input.evidenceUrl,
  });
  await created.populate('skill');
  return created.toJSON();
}

export interface UpdateStudentSkillPatch {
  proficiency?: Proficiency;
  yearsExperience?: number;
  evidenceUrl?: string;
}

export async function updateMyStudentSkill(
  userId: string,
  id: string,
  patch: UpdateStudentSkillPatch,
) {
  const studentId = await getStudentIdFromUser(userId);
  const doc = await StudentSkill.findById(id);
  if (!doc) throw AppError.notFound('Student skill not found');
  if (String(doc.student) !== studentId) throw AppError.forbidden('Not your skill');
  if (patch.proficiency !== undefined) doc.proficiency = patch.proficiency;
  if (patch.yearsExperience !== undefined) doc.yearsExperience = patch.yearsExperience;
  if (patch.evidenceUrl !== undefined) doc.evidenceUrl = patch.evidenceUrl;
  await doc.save();
  await doc.populate('skill');
  return doc.toJSON();
}

export async function deleteMyStudentSkill(userId: string, id: string) {
  const studentId = await getStudentIdFromUser(userId);
  const doc = await StudentSkill.findById(id);
  if (!doc) throw AppError.notFound('Student skill not found');
  if (String(doc.student) !== studentId) throw AppError.forbidden('Not your skill');
  await doc.deleteOne();
}

export async function listSkillsForStudent(studentId: string) {
  const rows = await StudentSkill.find({ student: studentId }).populate('skill');
  return rows.map((r) => r.toJSON());
}
