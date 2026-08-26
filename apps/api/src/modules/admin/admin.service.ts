import { Types } from 'mongoose';
import type { Role } from '@aip/config';
import type { Paginated } from '@aip/types';
import {
  CompanyProfile,
  Internship,
  Job,
  StudentProfile,
  User,
  type CompanyProfileDoc,
  type InternshipDoc,
  type JobDoc,
  type UserDoc,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';

export async function deactivateUser(id: string): Promise<UserDoc> {
  const doc = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!doc) throw AppError.notFound('User not found');
  return doc;
}

export async function activateUser(id: string): Promise<UserDoc> {
  const doc = await User.findByIdAndUpdate(id, { isActive: true }, { new: true });
  if (!doc) throw AppError.notFound('User not found');
  return doc;
}

export async function setUserActive(id: string, isActive: boolean): Promise<UserDoc> {
  return isActive ? activateUser(id) : deactivateUser(id);
}

export async function deleteUserCascade(id: string): Promise<void> {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  const uid = new Types.ObjectId(id);

  if (user.role === 'STUDENT') {
    await StudentProfile.deleteOne({ user: uid });
  } else if (user.role === 'COMPANY') {
    await CompanyProfile.deleteOne({ user: uid });
  }
  await user.deleteOne();
}

export async function verifyCompany(id: string): Promise<CompanyProfileDoc> {
  const doc = await CompanyProfile.findByIdAndUpdate(
    id,
    { verifiedAt: new Date() },
    { new: true },
  );
  if (!doc) throw AppError.notFound('Company profile not found');
  return doc;
}

export async function forceCloseJob(id: string): Promise<JobDoc> {
  const doc = await Job.findByIdAndUpdate(id, { status: 'CLOSED' }, { new: true });
  if (!doc) throw AppError.notFound('Job not found');
  return doc;
}

export async function forceCloseInternship(id: string): Promise<InternshipDoc> {
  const doc = await Internship.findByIdAndUpdate(id, { status: 'CLOSED' }, { new: true });
  if (!doc) throw AppError.notFound('Internship not found');
  return doc;
}

export interface ListUsersInput {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  role?: Role;
  isActive?: boolean;
}

export async function listUsers(input: ListUsersInput): Promise<Paginated<UserDoc>> {
  const pg = applyPagination(input);
  const filter: Record<string, unknown> = {};
  if (input.role) filter.role = input.role;
  if (typeof input.isActive === 'boolean') filter.isActive = input.isActive;

  const [items, total] = await Promise.all([
    User.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit).lean(),
    User.countDocuments(filter),
  ]);

  return buildPaginated(items as unknown as UserDoc[], total, pg.page, pg.pageSize);
}
