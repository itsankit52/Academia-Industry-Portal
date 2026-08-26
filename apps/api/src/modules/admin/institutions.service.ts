import type {
  CreateInstitutionInput,
  UpdateInstitutionInput,
  ListInstitutionsQuery,
  InviteInstitutionUserInput,
} from '@aip/validation';
import type { Paginated } from '@aip/types';
import type { InstitutionVerificationStatus } from '@aip/config';
import { AppError } from '../../utils/AppError';
import { hashPassword } from '../../utils/password';
import { applyPagination, buildPaginated } from '../../utils/pagination';
import {
  FacultyProfile,
  Institution,
  User,
  type InstitutionDoc,
  type UserDoc,
} from '../../models';

export async function createInstitution(input: CreateInstitutionInput): Promise<InstitutionDoc> {
  const codeExists = await Institution.findOne({ code: input.code.toUpperCase() });
  if (codeExists) throw AppError.conflict('Institution code already exists');
  const domainExists = await Institution.findOne({ domain: input.domain.toLowerCase() });
  if (domainExists) throw AppError.conflict('Institution domain already exists');
  return Institution.create({
    ...input,
    code: input.code.toUpperCase(),
    domain: input.domain.toLowerCase(),
  });
}

export interface ListInstitutionsFilters {
  verificationStatus?: InstitutionVerificationStatus;
  search?: string;
}

export async function listInstitutions(
  input: ListInstitutionsQuery,
): Promise<Paginated<InstitutionDoc>> {
  const pg = applyPagination(input);
  const filter: Record<string, unknown> = {};
  if (input.verificationStatus) filter.verificationStatus = input.verificationStatus;
  if (input.search) {
    const rx = new RegExp(input.search, 'i');
    filter.$or = [{ name: rx }, { code: rx }, { domain: rx }, { city: rx }];
  }
  const [items, total] = await Promise.all([
    Institution.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit),
    Institution.countDocuments(filter),
  ]);
  return buildPaginated(items, total, pg.page, pg.pageSize);
}

export async function updateInstitution(
  id: string,
  patch: UpdateInstitutionInput,
): Promise<InstitutionDoc> {
  const clean: Record<string, unknown> = { ...patch };
  if (typeof clean.code === 'string') clean.code = (clean.code as string).toUpperCase();
  if (typeof clean.domain === 'string') clean.domain = (clean.domain as string).toLowerCase();
  const doc = await Institution.findByIdAndUpdate(id, { $set: clean }, {
    new: true,
    runValidators: true,
  });
  if (!doc) throw AppError.notFound('Institution not found');
  return doc;
}

export async function verifyInstitution(id: string): Promise<InstitutionDoc> {
  const doc = await Institution.findByIdAndUpdate(
    id,
    { $set: { verificationStatus: 'VERIFIED', verifiedAt: new Date() } },
    { new: true },
  );
  if (!doc) throw AppError.notFound('Institution not found');
  return doc;
}

export interface InviteResult {
  user: UserDoc;
  facultyProfileId?: string;
}

export async function inviteInstitutionUser(
  institutionId: string,
  input: InviteInstitutionUserInput,
): Promise<InviteResult> {
  const institution = await Institution.findById(institutionId);
  if (!institution) throw AppError.notFound('Institution not found');

  const email = input.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) throw AppError.conflict('Email already registered');

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email,
    passwordHash,
    role: input.role,
    isActive: true,
    institution: institution._id,
  });

  if (input.role === 'FACULTY') {
    const profile = await FacultyProfile.create({
      user: user._id,
      institution: institution._id,
      fullName: input.fullName as string,
      designation: input.designation ?? 'Assistant Professor',
      department: input.department ?? 'General',
    });
    return { user, facultyProfileId: String(profile._id) };
  }

  return { user };
}
