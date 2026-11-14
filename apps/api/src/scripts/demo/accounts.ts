/**
 * Accounts and profiles: reference skills, institutions, the demo admin,
 * companies, faculty and students (with skills, projects, resume).
 */
import { Types } from 'mongoose';
import {
  CompanyProfile,
  FacultyProfile,
  Institution,
  Resume,
  Skill,
  StudentProfile,
  StudentProject,
  StudentSkill,
  User,
} from '../../models';
import { hashPassword } from '../../utils/password';
import { SKILL_SEEDS } from '../seedData/skills';
import { SeedAbort, renderPdf, type SeedContext } from './context';
import {
  DEMO_COMPANIES,
  DEMO_EMAIL_DOMAIN,
  DEMO_FACULTY,
  DEMO_INSTITUTIONS,
  demoEmail,
} from './data-people';
import { DEMO_STUDENTS } from './data-students';

export const DEMO_ADMIN_EMAIL = demoEmail('admin');

export interface AccountIds {
  skills: Map<string, Types.ObjectId>;
  institutions: Map<string, Types.ObjectId>;
  institutionUsers: Map<string, Types.ObjectId>;
  companies: Map<string, Types.ObjectId>;
  companyUsers: Map<string, Types.ObjectId>;
  faculty: Map<string, Types.ObjectId>;
  facultyUsers: Map<string, Types.ObjectId>;
  students: Map<string, Types.ObjectId>;
  studentUsers: Map<string, Types.ObjectId>;
  resumes: Map<string, Types.ObjectId>;
  adminUser: Types.ObjectId;
}

/** Plaintext passwords for accounts this run may create, keyed by email. */
export type PasswordBook = Map<string, string>;

/** Every demo login the seeder manages, in the order it is reported. */
export function demoAccounts(): { role: string; email: string }[] {
  return [
    { role: 'ADMIN', email: DEMO_ADMIN_EMAIL },
    ...DEMO_INSTITUTIONS.map((i) => ({ role: 'INSTITUTION', email: i.accountEmail })),
    ...DEMO_COMPANIES.map((c) => ({ role: 'COMPANY', email: c.email })),
    ...DEMO_FACULTY.map((f) => ({ role: 'FACULTY', email: f.email })),
    ...DEMO_STUDENTS.map((s) => ({ role: 'STUDENT', email: s.email })),
  ];
}

/** Adds only the catalogue skills that are missing; never edits existing ones. */
async function ensureSkills(ctx: SeedContext): Promise<Map<string, Types.ObjectId>> {
  const unique = new Map(SKILL_SEEDS.map((s) => [s.name.toLowerCase(), s]));
  for (const [name, s] of unique) {
    await ctx.ensure('skills (reference catalogue)', Skill, { name }, () => ({
      name,
      category: s.category,
      description: s.description,
      status: 'ACTIVE',
    }));
  }
  const rows = await Skill.find({})
    .select('_id name')
    .lean<{ _id: Types.ObjectId; name: string }[]>();
  const map = new Map(rows.map((r) => [r.name, r._id]));
  // Dry run: catalogue skills that would be created still need an id so that
  // the records depending on them are planned too.
  for (const name of unique.keys()) if (!map.has(name)) map.set(name, new Types.ObjectId());
  return map;
}

/**
 * Users are only ever matched on a demo-domain email. An existing user with
 * that email but another role is not something this seeder made, so it stops.
 */
async function ensureUser(
  ctx: SeedContext,
  passwords: PasswordBook,
  email: string,
  role: string,
  institution?: Types.ObjectId,
): Promise<Types.ObjectId> {
  if (!email.endsWith(`@${DEMO_EMAIL_DOMAIN}`)) throw new SeedAbort(`Not a demo email: ${email}`);
  const found = await User.findOne({ email })
    .select('_id role')
    .lean<{ _id: Types.ObjectId; role: string }>();
  if (found && found.role !== role) {
    throw new SeedAbort(
      `${email} exists with role ${found.role}, expected ${role}; refusing to touch it`,
    );
  }
  return ctx.ensure(`users (${role})`, User, { email }, async () => {
    const password = passwords.get(email);
    if (!password) throw new SeedAbort(`No generated password for ${email}`);
    return {
      email,
      passwordHash: await hashPassword(password),
      role,
      isActive: true,
      authProvider: 'local',
      ...(institution ? { institution } : {}),
    };
  });
}

export async function seedAccounts(ctx: SeedContext, passwords: PasswordBook): Promise<AccountIds> {
  const ids: AccountIds = {
    skills: await ensureSkills(ctx),
    institutions: new Map(),
    institutionUsers: new Map(),
    companies: new Map(),
    companyUsers: new Map(),
    faculty: new Map(),
    facultyUsers: new Map(),
    students: new Map(),
    studentUsers: new Map(),
    resumes: new Map(),
    adminUser: await ensureUser(ctx, passwords, DEMO_ADMIN_EMAIL, 'ADMIN'),
  };

  for (const inst of DEMO_INSTITUTIONS) {
    const clash = await Institution.findOne({ code: inst.code })
      .select('domain')
      .lean<{ domain: string }>();
    if (clash && !clash.domain.endsWith(DEMO_EMAIL_DOMAIN)) {
      throw new SeedAbort(`Institution code ${inst.code} belongs to a non-demo institution`);
    }
    const instId = await ctx.ensure('institutions', Institution, { code: inst.code }, () => ({
      name: inst.name,
      code: inst.code,
      domain: inst.domain,
      address: inst.address,
      city: inst.city,
      state: inst.state,
      contactEmail: inst.accountEmail,
      contactPhone: inst.phone,
      website: inst.website,
      verificationStatus: inst.verificationStatus,
      ...(inst.verificationStatus === 'VERIFIED' ? { verifiedAt: ctx.daysFromNow(-60) } : {}),
    }));
    ids.institutions.set(inst.key, instId);
    ids.institutionUsers.set(
      inst.key,
      await ensureUser(ctx, passwords, inst.accountEmail, 'INSTITUTION', instId),
    );
  }

  for (const c of DEMO_COMPANIES) {
    const userId = await ensureUser(ctx, passwords, c.email, 'COMPANY');
    ids.companyUsers.set(c.key, userId);
    ids.companies.set(
      c.key,
      await ctx.ensure('companyprofiles', CompanyProfile, { user: userId }, () => ({
        user: userId,
        companyName: c.companyName,
        description: c.description,
        industry: c.industry,
        website: c.website,
        phone: c.phone,
        location: c.location,
        companySize: c.companySize,
        foundedYear: c.foundedYear,
        ...(c.verified ? { verifiedAt: ctx.daysFromNow(-45) } : {}),
      })),
    );
  }

  for (const f of DEMO_FACULTY) {
    const instId = ids.institutions.get(f.institution)!;
    const userId = await ensureUser(ctx, passwords, f.email, 'FACULTY', instId);
    ids.facultyUsers.set(f.key, userId);
    ids.faculty.set(
      f.key,
      await ctx.ensure('facultyprofiles', FacultyProfile, { user: userId }, () => ({
        user: userId,
        institution: instId,
        fullName: f.fullName,
        designation: f.designation,
        department: f.department,
        employeeCode: f.employeeCode,
        gender: f.gender,
        phone: '+91 98000 1' + f.employeeCode.replace(/\D/g, '').padStart(4, '0'),
        qualifications: f.qualifications,
        researchInterests: f.researchInterests,
        bio: f.bio,
        city: DEMO_INSTITUTIONS.find((i) => i.key === f.institution)?.city,
        state: DEMO_INSTITUTIONS.find((i) => i.key === f.institution)?.state,
      })),
    );
  }

  for (const st of DEMO_STUDENTS) await seedStudent(ctx, passwords, ids, st);
  return ids;
}

async function seedStudent(
  ctx: SeedContext,
  passwords: PasswordBook,
  ids: AccountIds,
  st: (typeof DEMO_STUDENTS)[number],
): Promise<void> {
  const inst = DEMO_INSTITUTIONS.find((i) => i.key === st.institution)!;
  const instId = ids.institutions.get(st.institution)!;
  const userId = await ensureUser(ctx, passwords, st.email, 'STUDENT', instId);
  ids.studentUsers.set(st.key, userId);
  const slug = st.email.split('@')[0]!.replace('.', '-');

  const spId = await ctx.ensure('studentprofiles', StudentProfile, { user: userId }, () => ({
    user: userId,
    institution: instId,
    fullName: st.fullName,
    phone: `+91 99${String(Math.round(st.cgpa * 100)).padStart(4, '0')} ${st.graduationYear}`,
    gender: st.gender,
    city: st.city,
    state: st.state,
    college: inst.name,
    university: inst.name,
    degree: st.degree,
    branch: st.branch,
    semester: st.semester,
    graduationYear: st.graduationYear,
    cgpa: st.cgpa,
    bio: st.bio,
    preferredRoles: st.preferredRoles,
    preferredLocations: st.preferredLocations,
    softSkills: ['Communication', 'Teamwork', 'Problem Solving'],
    projects: st.projects.map((p) => ({
      title: p.title,
      description: p.description,
      techStack: p.technologies,
    })),
    certifications: st.certifications.map((c) => ({
      title: c.title,
      issuer: c.issuer,
      issuedAt: ctx.daysFromNow(-30 * c.monthsAgo),
    })),
    education: [
      {
        institution: inst.name,
        degree: st.degree,
        field: st.branch,
        startYear: st.graduationYear - 4,
        endYear: st.graduationYear,
        grade: `${st.cgpa} CGPA`,
      },
    ],
    languages: [
      { name: 'English', proficiency: 'Fluent' },
      { name: 'Hindi', proficiency: 'Fluent' },
    ],
    linkedinUrl: `https://www.linkedin.com/in/${slug}-demo`,
    githubUrl: `https://github.com/${slug}-demo`,
    careerInterests: `Looking for ${st.preferredRoles.join(' or ')} roles.`,
  }));
  ids.students.set(st.key, spId);

  for (const sk of st.skills) {
    const skillId = ids.skills.get(sk.name.toLowerCase());
    if (!skillId && ctx.apply) throw new SeedAbort(`Skill "${sk.name}" missing from catalogue`);
    if (!skillId) continue;
    await ctx.ensure('studentskills', StudentSkill, { student: spId, skill: skillId }, () => ({
      student: spId,
      skill: skillId,
      proficiency: sk.proficiency,
      ...(sk.years ? { yearsExperience: sk.years } : {}),
    }));
  }

  for (const [i, p] of st.projects.entries()) {
    await ctx.ensure('studentprojects', StudentProject, { student: spId, title: p.title }, () => ({
      student: spId,
      title: p.title,
      description: p.description,
      role: p.role,
      technologies: p.technologies,
      links: [{ label: 'Source', url: `https://github.com/${slug}-demo/project-${i + 1}` }],
      completedAt: ctx.daysFromNow(-90 - i * 60),
      isPublic: true,
    }));
  }

  ids.resumes.set(
    st.key,
    await ctx.ensure('resumes', Resume, { student: spId }, async () => {
      const data = await renderPdf(`${st.fullName} — Resume`, [
        `${st.degree}, ${st.branch} — ${inst.name} (${st.graduationYear}) · CGPA ${st.cgpa}`,
        `Skills: ${st.skills.map((s) => s.name).join(', ')}`,
        ...st.projects.map((p) => `Project — ${p.title}: ${p.description}`),
        ...st.certifications.map((c) => `Certification — ${c.title} (${c.issuer})`),
      ]);
      return {
        student: spId,
        storageMode: 'DATABASE',
        filename: `${slug}-resume.pdf`,
        data,
        mimeType: 'application/pdf',
        sizeBytes: data.length,
        parsedSkills: st.skills.map((s) => s.name.toLowerCase()),
        version: 1,
      };
    }),
  );
}
