import { Types } from 'mongoose';
import { StudentProject, StudentProfile, type StudentProjectDoc } from '../../models';
import { AppError } from '../../utils/AppError';

export interface CreateProjectInput {
  title: string;
  description: string;
  role?: string;
  technologies?: string[];
  links?: Array<{ label: string; url: string }>;
  completedAt?: string;
}

export interface UpdateProjectInput {
  title?: string;
  description?: string;
  role?: string;
  technologies?: string[];
  links?: Array<{ label: string; url: string }>;
  completedAt?: string;
  isPublic?: boolean;
}

async function resolveStudentProfileId(userId: string): Promise<Types.ObjectId> {
  const profile = await StudentProfile.findOne({ user: new Types.ObjectId(userId) }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile._id as Types.ObjectId;
}

export async function listMyProjects(userId: string) {
  const studentId = await resolveStudentProfileId(userId);
  return StudentProject.find({ student: studentId }).sort({ createdAt: -1 }).lean();
}

export async function getProjectById(
  userId: string,
  projectId: string,
): Promise<StudentProjectDoc> {
  const studentId = await resolveStudentProfileId(userId);
  if (!Types.ObjectId.isValid(projectId)) throw AppError.notFound('Project not found');
  const doc = await StudentProject.findOne({
    _id: new Types.ObjectId(projectId),
    student: studentId,
  });
  if (!doc) throw AppError.notFound('Project not found');
  return doc;
}

export async function createProject(
  userId: string,
  input: CreateProjectInput,
): Promise<StudentProjectDoc> {
  const studentId = await resolveStudentProfileId(userId);
  const doc = await StudentProject.create({
    student: studentId,
    title: input.title,
    description: input.description,
    role: input.role,
    technologies: input.technologies ?? [],
    links: (input.links ?? []).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    completedAt: input.completedAt ? new Date(input.completedAt) : undefined,
  });
  return doc;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput,
): Promise<StudentProjectDoc> {
  const studentId = await resolveStudentProfileId(userId);
  if (!Types.ObjectId.isValid(projectId)) throw AppError.notFound('Project not found');
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.role !== undefined) patch.role = input.role;
  if (input.technologies !== undefined) patch.technologies = input.technologies;
  if (input.links !== undefined)
    patch.links = input.links.map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
  if (input.completedAt !== undefined)
    patch.completedAt = input.completedAt ? new Date(input.completedAt) : undefined;
  if (input.isPublic !== undefined) patch.isPublic = input.isPublic;

  const doc = await StudentProject.findOneAndUpdate(
    { _id: new Types.ObjectId(projectId), student: studentId },
    { $set: patch },
    { new: true, runValidators: true },
  );
  if (!doc) throw AppError.notFound('Project not found');
  return doc;
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  const studentId = await resolveStudentProfileId(userId);
  if (!Types.ObjectId.isValid(projectId)) throw AppError.notFound('Project not found');
  const result = await StudentProject.deleteOne({
    _id: new Types.ObjectId(projectId),
    student: studentId,
  });
  if (result.deletedCount === 0) throw AppError.notFound('Project not found');
}
