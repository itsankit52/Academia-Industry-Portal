import type { Role } from '@aip/config';
import type {
  CreateFacultyOpportunityInput,
  ListFacultyOpportunitiesQuery,
  UpdateFacultyOpportunityInput,
} from '@aip/validation';
import { AppError } from '../../utils/AppError';
import {
  CompanyProfile,
  FacultyOpportunity,
  Institution,
  User,
} from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';

interface HostContext {
  hostType: 'COMPANY' | 'INSTITUTION';
  hostId: string;
}

async function resolveHostForCreator(userId: string, role: Role): Promise<HostContext> {
  if (role === 'COMPANY') {
    const company = await CompanyProfile.findOne({ user: userId }).select('_id');
    if (!company) throw AppError.notFound('Company profile not found');
    return { hostType: 'COMPANY', hostId: String(company._id) };
  }
  if (role === 'INSTITUTION') {
    const user = await User.findById(userId).select('institution');
    if (!user?.institution) throw AppError.badRequest('Institution not linked to user');
    return { hostType: 'INSTITUTION', hostId: String(user.institution) };
  }
  throw AppError.forbidden('Role cannot create faculty opportunities');
}

async function populateHost(doc: unknown): Promise<Record<string, unknown>> {
  const raw = (doc as { toJSON: () => Record<string, unknown> }).toJSON();
  const hostType = raw.hostType as 'COMPANY' | 'INSTITUTION';
  const id = String(raw.host);
  if (hostType === 'COMPANY') {
    const c = await CompanyProfile.findById(id).select('companyName logoUrl').lean();
    raw.host = c
      ? { id: String(c._id), name: c.companyName, ...(c.logoUrl ? { logoUrl: c.logoUrl } : {}) }
      : { id, name: '—' };
  } else {
    const i = await Institution.findById(id).select('name').lean();
    raw.host = i ? { id: String(i._id), name: i.name } : { id, name: '—' };
  }
  return raw;
}

async function populateHostList(rows: unknown[]): Promise<Record<string, unknown>[]> {
  return Promise.all(rows.map((r) => populateHost(r)));
}

export async function createOpportunity(
  userId: string,
  role: Role,
  input: CreateFacultyOpportunityInput,
): Promise<Record<string, unknown>> {
  if (role !== 'COMPANY' && role !== 'INSTITUTION') {
    throw AppError.forbidden('Only COMPANY or INSTITUTION users can create faculty opportunities');
  }
  const host = await resolveHostForCreator(userId, role);
  const doc = await FacultyOpportunity.create({
    ...input,
    applicationDeadline: new Date(input.applicationDeadline),
    hostType: host.hostType,
    host: host.hostId,
    postedBy: userId,
  });
  return populateHost(doc);
}

export interface FacultyOpportunityListFilters {
  q?: string;
  opportunityType?: string;
  status?: string;
  hostType?: string;
  mode?: string;
}

export async function listOpportunities(
  pag: PaginationInput,
  filters: FacultyOpportunityListFilters,
): Promise<ReturnType<typeof buildPaginated<Record<string, unknown>>>> {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = { status: filters.status ?? 'PUBLISHED' };
  if (filters.opportunityType) where.opportunityType = filters.opportunityType;
  if (filters.hostType) where.hostType = filters.hostType;
  if (filters.mode) where.mode = filters.mode;
  if (filters.q) where.$text = { $search: filters.q };

  const [rows, total] = await Promise.all([
    FacultyOpportunity.find(where).sort(sort).skip(skip).limit(limit),
    FacultyOpportunity.countDocuments(where),
  ]);
  const items = await populateHostList(rows);
  return buildPaginated(items, total, page, pageSize);
}

export async function getOpportunityById(id: string): Promise<Record<string, unknown>> {
  const doc = await FacultyOpportunity.findById(id);
  if (!doc) throw AppError.notFound('Faculty opportunity not found');
  return populateHost(doc);
}

async function assertOwner(id: string, userId: string, role: Role) {
  const doc = await FacultyOpportunity.findById(id);
  if (!doc) throw AppError.notFound('Faculty opportunity not found');
  if (role !== 'ADMIN' && String(doc.postedBy) !== userId) {
    throw AppError.forbidden('Not your opportunity');
  }
  return doc;
}

export async function updateOpportunity(
  id: string,
  userId: string,
  role: Role,
  input: UpdateFacultyOpportunityInput,
): Promise<Record<string, unknown>> {
  const doc = await assertOwner(id, userId, role);
  const patch: Record<string, unknown> = { ...input };
  if (input.applicationDeadline) patch.applicationDeadline = new Date(input.applicationDeadline);
  Object.assign(doc, patch);
  await doc.save();
  return populateHost(doc);
}

export async function patchOpportunity(
  id: string,
  userId: string,
  role: Role,
  input: UpdateFacultyOpportunityInput,
): Promise<Record<string, unknown>> {
  return updateOpportunity(id, userId, role, input);
}

export async function closeOpportunity(
  id: string,
  userId: string,
  role: Role,
): Promise<Record<string, unknown>> {
  const doc = await assertOwner(id, userId, role);
  doc.status = 'CLOSED';
  await doc.save();
  return populateHost(doc);
}

export async function deleteOpportunity(id: string, userId: string, role: Role): Promise<void> {
  const doc = await assertOwner(id, userId, role);
  await doc.deleteOne();
}

export async function listMyOpportunities(
  userId: string,
  role: Role,
  pag: PaginationInput,
  filters: FacultyOpportunityListFilters,
): Promise<ReturnType<typeof buildPaginated<Record<string, unknown>>>> {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = { postedBy: userId };
  if (filters.opportunityType) where.opportunityType = filters.opportunityType;
  if (filters.status) where.status = filters.status;
  if (filters.hostType) where.hostType = filters.hostType;
  if (filters.mode) where.mode = filters.mode;
  if (filters.q) where.$text = { $search: filters.q };
  if (role !== 'COMPANY' && role !== 'INSTITUTION' && role !== 'ADMIN') {
    throw AppError.forbidden('Role cannot manage faculty opportunities');
  }

  const [rows, total] = await Promise.all([
    FacultyOpportunity.find(where).sort(sort).skip(skip).limit(limit),
    FacultyOpportunity.countDocuments(where),
  ]);
  const items = await populateHostList(rows);
  return buildPaginated(items, total, page, pageSize);
}
