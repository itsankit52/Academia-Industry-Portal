/**
 * Opportunities and the activity on them: jobs, internships, faculty
 * opportunities, student and faculty applications, and interviews. Field
 * conventions mirror applications.service / faculty-applications.service.
 */
import type { Types } from 'mongoose';
import { Application, FacultyOpportunity, Internship, Interview, Job } from '../../models';
import type { SeedContext } from './context';
import type { AccountIds } from './accounts';
import { DEMO_COMPANIES } from './data-people';
import { DEMO_STUDENTS } from './data-students';
import {
  DEMO_APPLICATIONS,
  DEMO_FACULTY_APPLICATIONS,
  DEMO_FACULTY_OPPORTUNITIES,
  DEMO_INTERNSHIPS,
  DEMO_JOBS,
  type DemoAppStatus,
} from './data-opportunities';

export interface ActivityIds {
  jobs: Map<string, Types.ObjectId>;
  internships: Map<string, Types.ObjectId>;
  facultyOpps: Map<string, Types.ObjectId>;
  /** `${student}:${opportunity}` → application id */
  applications: Map<string, Types.ObjectId>;
}

const STATUS_PATH: DemoAppStatus[] = [
  'APPLIED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'SELECTED',
  'OFFER_ACCEPTED',
];

/** The statuses an application passed through, ending at `final`. */
export function timelineFor(final: DemoAppStatus): DemoAppStatus[] {
  if (final === 'REJECTED') return ['APPLIED', 'UNDER_REVIEW', 'REJECTED'];
  return STATUS_PATH.slice(0, STATUS_PATH.indexOf(final) + 1);
}

/** Deterministic 0–100 score from skill overlap, in the spirit of the matcher. */
export function overlapScore(have: string[], required: string[], preferred: string[]): number {
  const own = new Set(have.map((h) => h.toLowerCase()));
  const req = required.filter((r) => own.has(r.toLowerCase())).length;
  const pref = preferred.filter((p) => own.has(p.toLowerCase())).length;
  const base = required.length ? (req / required.length) * 75 : 50;
  return Math.min(98, Math.round(20 + base + pref * 4));
}

const skillIds = (ids: AccountIds, names: string[]) =>
  names.map((n) => ids.skills.get(n.toLowerCase())).filter((x): x is Types.ObjectId => Boolean(x));

export async function seedActivity(ctx: SeedContext, ids: AccountIds): Promise<ActivityIds> {
  const out: ActivityIds = {
    jobs: new Map(),
    internships: new Map(),
    facultyOpps: new Map(),
    applications: new Map(),
  };

  for (const [i, j] of DEMO_JOBS.entries()) {
    const company = ids.companies.get(j.company)!;
    out.jobs.set(
      j.key,
      await ctx.ensure(
        'jobs',
        Job,
        { company, title: j.title },
        () => ({
          company,
          title: j.title,
          description: j.description,
          location: j.location,
          workMode: j.workMode,
          employmentType: j.employmentType,
          salary: { min: j.salaryLpa[0] * 100_000, max: j.salaryLpa[1] * 100_000, currency: 'INR' },
          experienceMin: 0,
          experienceMax: 1,
          ...(j.minCgpa ? { minCgpa: j.minCgpa } : {}),
          eligibleBranches: j.branches,
          eligibleGradYears: j.gradYears,
          requiredSkills: skillIds(ids, j.required),
          preferredSkills: skillIds(ids, j.preferred),
          applicationDeadline: ctx.daysFromNow(j.deadlineDays, 23),
          openings: j.openings,
          status: j.status,
        }),
        ctx.daysFromNow(-35 + i),
      ),
    );
  }

  for (const [i, it] of DEMO_INTERNSHIPS.entries()) {
    const company = ids.companies.get(it.company)!;
    out.internships.set(
      it.key,
      await ctx.ensure(
        'internships',
        Internship,
        { company, title: it.title },
        () => ({
          company,
          title: it.title,
          description: it.description,
          location: it.location,
          workMode: it.workMode,
          durationMonths: it.durationMonths,
          stipend: it.stipend,
          currency: 'INR',
          ...(it.minCgpa ? { minCgpa: it.minCgpa } : {}),
          eligibleBranches: it.branches,
          eligibleGradYears: it.gradYears,
          requiredSkills: skillIds(ids, it.required),
          preferredSkills: skillIds(ids, it.preferred),
          applicationDeadline: ctx.daysFromNow(it.deadlineDays, 23),
          openings: it.openings,
          status: it.status,
        }),
        ctx.daysFromNow(-30 + i),
      ),
    );
  }

  for (const fo of DEMO_FACULTY_OPPORTUNITIES) {
    const host =
      fo.hostType === 'COMPANY' ? ids.companies.get(fo.host)! : ids.institutions.get(fo.host)!;
    const postedBy =
      fo.hostType === 'COMPANY'
        ? ids.companyUsers.get(fo.host)!
        : ids.institutionUsers.get(fo.host)!;
    out.facultyOpps.set(
      fo.key,
      await ctx.ensure(
        'facultyopportunities',
        FacultyOpportunity,
        { host, title: fo.title },
        () => ({
          title: fo.title,
          description: fo.description,
          opportunityType: fo.opportunityType,
          hostType: fo.hostType,
          host,
          postedBy,
          requiredExpertise: fo.expertise,
          preferredQualifications: fo.qualifications,
          durationWeeks: fo.durationWeeks,
          ...(fo.stipend ? { stipend: { amount: fo.stipend, currency: 'INR' } } : {}),
          location: fo.location,
          mode: fo.mode,
          applicationDeadline: ctx.daysFromNow(fo.deadlineDays, 23),
          openings: fo.openings,
          targetRoles: fo.targetRoles,
          status: 'PUBLISHED',
        }),
        ctx.daysFromNow(-21),
      ),
    );
  }

  await seedStudentApplications(ctx, ids, out);
  await seedFacultyApplications(ctx, ids, out);
  return out;
}

async function seedStudentApplications(ctx: SeedContext, ids: AccountIds, out: ActivityIds) {
  for (const a of DEMO_APPLICATIONS) {
    const st = DEMO_STUDENTS.find((s) => s.key === a.student)!;
    const opp =
      a.type === 'JOB'
        ? DEMO_JOBS.find((j) => j.key === a.opportunity)!
        : DEMO_INTERNSHIPS.find((j) => j.key === a.opportunity)!;
    const company = DEMO_COMPANIES.find((c) => c.key === opp.company)!;
    const student = ids.students.get(a.student)!;
    const opportunity = (a.type === 'JOB' ? out.jobs : out.internships).get(a.opportunity)!;
    const statuses = timelineFor(a.status);
    const appliedAt = ctx.daysFromNow(-a.daysAgo);
    const step = a.daysAgo / Math.max(statuses.length, 1);
    const timeline = statuses.map((status, i) => ({
      status,
      at: ctx.daysFromNow(-a.daysAgo + Math.round(i * step)),
      ...(i > 0
        ? { note: `Moved to ${status.replace(/_/g, ' ').toLowerCase()} by ${company.companyName}` }
        : {}),
    }));
    const selected = a.status === 'SELECTED' || a.status === 'OFFER_ACCEPTED';
    const lastAt = timeline[timeline.length - 1]!.at;

    const appId = await ctx.ensure(
      'applications (student)',
      Application,
      { student, opportunityType: a.type, opportunity },
      () => ({
        student,
        opportunityType: a.type,
        opportunity,
        status: a.status,
        resume: ids.resumes.get(a.student),
        coverLetter: `I am excited to apply for the ${opp.title} role at ${company.companyName}. ${st.bio}`,
        matchScore: overlapScore(
          st.skills.map((s) => s.name),
          opp.required,
          opp.preferred,
        ),
        timeline,
        recruitmentSource: a.type === 'JOB' ? 'CAMPUS_DRIVE' : 'JOB_PORTAL',
        ...(selected ? { selectedAt: lastAt } : {}),
        ...(selected && a.type === 'INTERNSHIP'
          ? { startDate: ctx.daysFromNow(45), expectedEndDate: ctx.daysFromNow(45 + 90) }
          : {}),
        ...(a.status === 'OFFER_ACCEPTED' && a.type === 'JOB'
          ? {
              offerRespondedAt: lastAt,
              offerDetails: {
                offeredSalary: (opp as (typeof DEMO_JOBS)[number]).salaryLpa[1] * 100_000,
                currency: 'INR',
                joiningDate: ctx.daysFromNow(230),
                offerTerms:
                  'Full-time offer, joining after graduation. Subject to final semester results.',
                updatedAt: lastAt,
              },
            }
          : {}),
      }),
      appliedAt,
    );
    out.applications.set(`${a.student}:${a.opportunity}`, appId);

    if (a.interviewInDays !== undefined) {
      const upcoming = a.interviewInDays > 0;
      await ctx.ensure('interviews', Interview, { application: appId }, () => ({
        application: appId,
        mode: upcoming ? 'ONLINE' : 'ONSITE',
        scheduledAt: ctx.daysFromNow(a.interviewInDays!, upcoming ? 11 : 14),
        durationMinutes: 45,
        ...(upcoming
          ? { meetingLink: `https://meet.demo.acadin.test/${a.student}-${a.opportunity}` }
          : { location: `${company.companyName} office, ${opp.location}` }),
        interviewer: `${company.companyName} hiring panel`,
        notes: 'Technical round: problem solving and a discussion of one project from the resume.',
        ...(upcoming
          ? {}
          : { feedback: 'Strong fundamentals and clear communication. Recommended for offer.' }),
        status: upcoming ? 'SCHEDULED' : 'COMPLETED',
      }));
    }
  }
}

async function seedFacultyApplications(ctx: SeedContext, ids: AccountIds, out: ActivityIds) {
  for (const fa of DEMO_FACULTY_APPLICATIONS) {
    const faculty = ids.faculty.get(fa.faculty)!;
    const opp = DEMO_FACULTY_OPPORTUNITIES.find((o) => o.key === fa.opportunity)!;
    const opportunity = out.facultyOpps.get(fa.opportunity)!;
    const statuses =
      fa.status === 'UNDER_REVIEW'
        ? ['APPLIED', 'UNDER_REVIEW']
        : fa.status === 'SHORTLISTED'
          ? ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED']
          : fa.status === 'SELECTED'
            ? ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED']
            : ['APPLIED'];
    await ctx.ensure(
      'applications (faculty)',
      Application,
      { faculty, opportunityType: opp.opportunityType, opportunity },
      () => ({
        faculty,
        opportunityType: opp.opportunityType,
        opportunity,
        status: fa.status,
        coverLetter: `I would like to take part in "${opp.title}" and bring the experience back to my department.`,
        matchScore: 70 + statuses.length * 5,
        timeline: statuses.map((status, i) => ({ status, at: ctx.daysFromNow(-12 + i * 3) })),
        ...(fa.status === 'SELECTED' ? { selectedAt: ctx.daysFromNow(-3) } : {}),
      }),
      ctx.daysFromNow(-12),
    );
  }
}
