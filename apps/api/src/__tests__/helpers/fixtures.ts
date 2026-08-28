import type { Express } from 'express';
import type { Role, WorkMode, EmploymentType } from '@aip/config';
import request from 'supertest';
import { Types } from 'mongoose';
import { hashPassword } from '../../utils/password';
import {
  CompanyProfile,
  FacultyProfile,
  Institution,
  Skill,
  StudentProfile,
  User,
  type SkillDoc,
} from '../../models';
import { createJob } from '../../modules/jobs/jobs.service';
import type { CreateJobInput } from '@aip/validation';

export const TEST_PASSWORD = 'Test@1234';

export interface CreatedAuth {
  cookie: string;
  userId: string;
  email: string;
}

function extractCookies(setCookie: string[] | undefined): string {
  if (!setCookie || setCookie.length === 0) return '';
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

export function parseSetCookie(setCookie: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!setCookie) return out;
  for (const raw of setCookie) {
    const first = raw.split(';')[0]!;
    const [name, ...rest] = first.split('=');
    if (!name) continue;
    out[name.trim()] = rest.join('=');
  }
  return out;
}

interface CreateUserOptions {
  email?: string;
  fullName?: string;
  companyName?: string;
}

interface CreatedUserRow {
  userId: string;
  email: string;
  password: string;
}

let uniqueCounter = 0;
function uniqueEmail(role: Role): string {
  uniqueCounter += 1;
  return `test-${Date.now()}-${uniqueCounter}-${role.toLowerCase()}@t.demo`;
}

export async function ensureTestInstitution(): Promise<string> {
  const existing = await Institution.findOne({ code: 'TESTINST' });
  if (existing) return String(existing._id);
  try {
    const doc = await Institution.create({
      name: 'Test Institution',
      code: 'TESTINST',
      domain: 'testinst.edu',
      address: '1 Test Way',
      city: 'Testville',
      state: 'TS',
      contactEmail: 'registrar@testinst.edu',
      verificationStatus: 'VERIFIED',
      verifiedAt: new Date(),
    });
    return String(doc._id);
  } catch (err) {
    // Another suite (or another worker) raced us to insert the institution.
    // The first writer wins; fall through to the doc they wrote.
    const after = await Institution.findOne({ code: 'TESTINST' });
    if (after) return String(after._id);
    throw err;
  }
}

export async function createUserRow(
  role: Role,
  opts: CreateUserOptions = {},
): Promise<CreatedUserRow> {
  const email = (opts.email ?? uniqueEmail(role)).toLowerCase();
  const password = TEST_PASSWORD;
  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, passwordHash, role, isActive: true });

  if (role === 'STUDENT') {
    const institutionId = await ensureTestInstitution();
    await StudentProfile.create({
      user: user._id,
      institution: institutionId,
      fullName: opts.fullName ?? 'Test Student',
      branch: 'Computer Science',
      graduationYear: 2025,
      cgpa: 8.0,
    });
  } else if (role === 'COMPANY') {
    await CompanyProfile.create({
      user: user._id,
      companyName: opts.companyName ?? 'Test Company',
    });
  } else if (role === 'FACULTY') {
    const institutionId = await ensureTestInstitution();
    await FacultyProfile.create({
      user: user._id,
      institution: institutionId,
      fullName: opts.fullName ?? 'Dr. Test Faculty',
      designation: 'Assistant Professor',
      department: 'Computer Science',
    });
    // `resolveActorHost` looks up `user.institution` — keep it in sync.
    user.institution = new Types.ObjectId(institutionId);
    await user.save();
  }

  return { userId: String(user._id), email, password };
}

export async function loginAndGetCookie(
  app: Express,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return extractCookies(res.headers['set-cookie'] as string[] | undefined);
}

export async function createUserAndLogin(
  app: Express,
  role: Role,
  opts: CreateUserOptions = {},
): Promise<CreatedAuth> {
  const row = await createUserRow(role, opts);
  const cookie = await loginAndGetCookie(app, row.email, row.password);
  return { cookie, userId: row.userId, email: row.email };
}

export async function createSkillRow(name: string): Promise<SkillDoc> {
  return Skill.create({
    name: name.toLowerCase(),
    category: 'PROGRAMMING',
    description: `${name} skill used in tests`,
    status: 'ACTIVE',
  });
}

interface JobFixtureOptions {
  title?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  minCgpa?: number;
  eligibleBranches?: string[];
  eligibleGradYears?: number[];
  requiredSkillIds?: string[];
  preferredSkillIds?: string[];
}

export async function createJobViaService(companyUserId: string, opts: JobFixtureOptions = {}) {
  const requiredSkillIds = opts.requiredSkillIds ?? [new Types.ObjectId().toString()];
  const input: CreateJobInput = {
    title: opts.title ?? 'Test Job',
    description: 'A comprehensive test job used by the integration test suite to exercise the API.',
    location: 'Bengaluru, India',
    workMode: opts.workMode ?? 'HYBRID',
    employmentType: opts.employmentType ?? 'FULL_TIME',
    eligibleBranches: opts.eligibleBranches ?? [],
    eligibleGradYears: opts.eligibleGradYears ?? [],
    requiredSkills: requiredSkillIds,
    preferredSkills: opts.preferredSkillIds ?? [],
    openings: 1,
    status: 'PUBLISHED',
    ...(opts.minCgpa !== undefined ? { minCgpa: opts.minCgpa } : {}),
  };
  return createJob(companyUserId, input);
}
