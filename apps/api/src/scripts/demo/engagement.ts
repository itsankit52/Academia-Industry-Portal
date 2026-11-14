/**
 * Secondary activity that makes dashboards feel lived-in: saved items,
 * notifications, certificate documents awaiting verification, evaluated AI
 * assessments and campus placement drives with participants and outcomes.
 */
import type { Types } from 'mongoose';
import {
  Assessment,
  DocumentModel,
  Notification,
  PlacementDrive,
  PlacementDriveOutcome,
  PlacementParticipant,
  SavedOpportunity,
} from '../../models';
import { renderPdf, type SeedContext } from './context';
import type { AccountIds } from './accounts';
import type { ActivityIds } from './activity';
import { DEMO_COMPANIES, DEMO_INSTITUTIONS } from './data-people';
import { DEMO_STUDENTS } from './data-students';
import {
  DEMO_APPLICATIONS,
  DEMO_FACULTY_APPLICATIONS,
  DEMO_FACULTY_OPPORTUNITIES,
  DEMO_INTERNSHIPS,
  DEMO_JOBS,
  DEMO_SAVED,
} from './data-opportunities';

const NOTIFY: Record<string, string> = {
  UNDER_REVIEW: 'APPLICATION_STATUS_CHANGED',
  SHORTLISTED: 'APPLICATION_SHORTLISTED',
  INTERVIEW_SCHEDULED: 'INTERVIEW_SCHEDULED',
  SELECTED: 'APPLICATION_SELECTED',
  REJECTED: 'APPLICATION_REJECTED',
  OFFER_ACCEPTED: 'OFFER_ACCEPTED',
};

const oppTitle = (type: 'JOB' | 'INTERNSHIP', key: string) =>
  (type === 'JOB' ? DEMO_JOBS : DEMO_INTERNSHIPS).find((o) => o.key === key)!;

export async function seedEngagement(ctx: SeedContext, ids: AccountIds, act: ActivityIds) {
  for (const sv of DEMO_SAVED) {
    const student = ids.students.get(sv.student)!;
    const opportunity = (sv.type === 'JOB' ? act.jobs : act.internships).get(sv.opportunity)!;
    await ctx.ensure(
      'savedopportunities',
      SavedOpportunity,
      { student, opportunityType: sv.type, opportunity },
      () => ({
        student,
        opportunityType: sv.type,
        opportunity,
      }),
    );
  }

  await seedNotifications(ctx, ids, act);
  await seedDocuments(ctx, ids);
  await seedAssessments(ctx, ids);
  await seedPlacementDrives(ctx, ids, act);
}

async function notify(
  ctx: SeedContext,
  user: Types.ObjectId,
  type: string,
  title: string,
  body: string,
  link: string,
  daysAgo: number,
  read: boolean,
) {
  await ctx.ensure(
    'notifications',
    Notification,
    { user, title },
    () => ({
      user,
      type,
      title,
      body,
      link,
      ...(read ? { readAt: ctx.daysFromNow(-daysAgo + 1) } : {}),
    }),
    ctx.daysFromNow(-daysAgo),
  );
}

async function seedNotifications(ctx: SeedContext, ids: AccountIds, act: ActivityIds) {
  const perCompany = new Map<string, number>();
  for (const a of DEMO_APPLICATIONS) {
    const opp = oppTitle(a.type, a.opportunity);
    const company = DEMO_COMPANIES.find((c) => c.key === opp.company)!;
    const appId = act.applications.get(`${a.student}:${a.opportunity}`)!;
    const studentName = DEMO_STUDENTS.find((s) => s.key === a.student)!.fullName;
    const type = NOTIFY[a.status];
    if (type) {
      const label = a.status.replace(/_/g, ' ').toLowerCase();
      await notify(
        ctx,
        ids.studentUsers.get(a.student)!,
        type,
        `${opp.title} at ${company.companyName}: ${label}`,
        `Your application for ${opp.title} at ${company.companyName} is now ${label}.`,
        `/student/applications/${String(appId)}`,
        Math.max(1, Math.floor(a.daysAgo / 3)),
        a.daysAgo > 10,
      );
    }
    const n = perCompany.get(company.key) ?? 0;
    if (n < 3) {
      perCompany.set(company.key, n + 1);
      await notify(
        ctx,
        ids.companyUsers.get(company.key)!,
        'NEW_MATCHING_JOB',
        `New applicant for ${opp.title}: ${studentName}`,
        `${studentName} applied to ${opp.title}.`,
        '/company/applicants',
        a.daysAgo,
        a.daysAgo > 7,
      );
    }
  }
  for (const st of DEMO_STUDENTS.slice(0, 6)) {
    await notify(
      ctx,
      ids.studentUsers.get(st.key)!,
      'NEW_MATCHING_JOB',
      'New jobs match your skills',
      'Several newly published roles match your skill profile. Take a look.',
      '/student/recommended',
      1,
      false,
    );
  }
  for (const fa of DEMO_FACULTY_APPLICATIONS) {
    const opp = DEMO_FACULTY_OPPORTUNITIES.find((o) => o.key === fa.opportunity)!;
    await notify(
      ctx,
      ids.facultyUsers.get(fa.faculty)!,
      'FACULTY_APPLICATION_STATUS_UPDATED',
      `${opp.title}: ${fa.status.replace(/_/g, ' ').toLowerCase()}`,
      `Your engagement request for "${opp.title}" is ${fa.status.replace(/_/g, ' ').toLowerCase()}.`,
      '/faculty/applications',
      2,
      false,
    );
  }
  const pending = DEMO_INSTITUTIONS.find((i) => i.verificationStatus === 'PENDING')!;
  await notify(
    ctx,
    ids.adminUser,
    'ANNOUNCEMENT',
    `${pending.name} is awaiting verification`,
    `${pending.name} (${pending.city}) registered and needs institution verification.`,
    '/admin/institutions',
    2,
    false,
  );
}

async function seedDocuments(ctx: SeedContext, ids: AccountIds) {
  const plan: { student: string; status: 'PENDING' | 'VERIFIED' }[] = [
    { student: 'aarav', status: 'PENDING' },
    { student: 'diya', status: 'PENDING' },
    { student: 'arjun', status: 'PENDING' },
    { student: 'sneha', status: 'VERIFIED' },
  ];
  for (const p of plan) {
    const st = DEMO_STUDENTS.find((s) => s.key === p.student)!;
    const cert = st.certifications[0]!;
    const user = ids.studentUsers.get(p.student)!;
    await ctx.ensure(
      'documents',
      DocumentModel,
      { user, documentType: 'CERTIFICATE', title: cert.title },
      async () => {
        const data = await renderPdf(cert.title, [
          `Awarded to ${st.fullName}`,
          `Issued by ${cert.issuer}`,
        ]);
        return {
          user,
          documentType: 'CERTIFICATE',
          filename: `${cert.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
          data,
          mimeType: 'application/pdf',
          sizeBytes: data.length,
          title: cert.title,
          issuer: cert.issuer,
          issuedDate: ctx.daysFromNow(-30 * cert.monthsAgo),
          verificationStatus: p.status,
          ...(p.status === 'VERIFIED'
            ? {
                verifiedBy: ids.adminUser,
                verifiedAt: ctx.daysFromNow(-2),
                verificationNotes: 'Checked against issuer record.',
              }
            : {}),
        };
      },
      ctx.daysFromNow(-4),
    );
  }
}

async function seedAssessments(ctx: SeedContext, ids: AccountIds) {
  for (const key of ['aarav', 'sneha', 'diya']) {
    const st = DEMO_STUDENTS.find((s) => s.key === key)!;
    const student = ids.students.get(key)!;
    const skills = st.skills.slice(0, 3);
    const started = ctx.daysFromNow(-10, 15);
    const scores = skills.map((_, i) => 6 + ((i + st.cgpa * 10) % 4));
    const raw = scores.reduce((a, b) => a + b, 0);
    await ctx.ensure(
      'assessments (AI skill assessment)',
      Assessment,
      { student, generatedByModel: 'demo-seed' },
      () => ({
        student,
        status: 'EVALUATED',
        skills: skills.map((s) => ids.skills.get(s.name.toLowerCase())!),
        skillNames: skills.map((s) => s.name),
        questions: skills.map((s, i) => ({
          id: `q${i + 1}`,
          text: `Explain a real problem you solved with ${s.name} and the trade-offs you considered.`,
          targetSkills: [s.name],
          expectedConcepts: ['problem framing', 'trade-offs', 'outcome'],
          maxMarks: 10,
        })),
        answers: skills.map((s, i) => ({
          questionId: `q${i + 1}`,
          text: `In my project I used ${s.name} to …`,
          updatedAt: started,
        })),
        evaluation: {
          perQuestion: scores.map((score, i) => ({
            questionId: `q${i + 1}`,
            score,
            feedback: 'Good depth; add measurable outcomes.',
          })),
          skillBreakdown: skills.map((s, i) => ({
            skillId: String(ids.skills.get(s.name.toLowerCase())),
            skillName: s.name,
            category: 'PROGRAMMING',
            score: scores[i]!,
            maxScore: 10,
            questionCount: 1,
            answeredCount: 1,
          })),
          totalScore: Math.round((raw / (skills.length * 10)) * 100),
          rawScore: raw,
          maxScore: skills.length * 10,
          overallFeedback: `Solid applied knowledge of ${skills[0]!.name}.`,
          strengths: `Hands-on experience with ${skills[0]!.name}.`,
          weaknesses: `Deepen ${skills[skills.length - 1]!.name} fundamentals.`,
          evaluatedAt: ctx.daysFromNow(-10, 16),
        },
        durationMinutes: 30,
        questionCount: skills.length,
        startedAt: started,
        expiresAt: new Date(started.getTime() + 30 * 60_000),
        submittedAt: new Date(started.getTime() + 25 * 60_000),
        generatedByModel: 'demo-seed',
      }),
      started,
    );
  }
}

interface DrivePlan {
  institution: string;
  title: string;
  status: 'IN_PROGRESS' | 'OFFERS_IN_PROGRESS';
  companies: string[];
  jobs: string[];
  participants: { student: string; job: string; status: string; outcome?: 'ACCEPTED' }[];
}

const DRIVES: DrivePlan[] = [
  {
    institution: 'nit',
    title: 'Northfield Campus Placement Drive 2026-27',
    status: 'IN_PROGRESS',
    companies: ['nimbus', 'kestrel', 'greengrid'],
    jobs: ['nimbus-ds', 'kestrel-be', 'greengrid-emb'],
    participants: [
      { student: 'aarav', job: 'nimbus-ds', status: 'INTERVIEW_SCHEDULED' },
      { student: 'kabir', job: 'kestrel-be', status: 'INTERVIEW_SCHEDULED' },
      { student: 'ishita', job: 'greengrid-emb', status: 'INTERVIEW_SCHEDULED' },
    ],
  },
  {
    institution: 'rce',
    title: 'Riverside Cloud and AI Hiring Day',
    status: 'OFFERS_IN_PROGRESS',
    companies: ['orbit', 'nimbus'],
    jobs: ['orbit-sre', 'nimbus-mle'],
    participants: [
      { student: 'arjun', job: 'orbit-sre', status: 'ACCEPTED', outcome: 'ACCEPTED' },
      { student: 'sneha', job: 'nimbus-mle', status: 'INTERVIEW_SCHEDULED' },
    ],
  },
];

async function seedPlacementDrives(ctx: SeedContext, ids: AccountIds, act: ActivityIds) {
  for (const d of DRIVES) {
    const institution = ids.institutions.get(d.institution)!;
    const createdBy = ids.institutionUsers.get(d.institution)!;
    const jobs = d.jobs.map((k) => DEMO_JOBS.find((j) => j.key === k)!);
    const driveId = await ctx.ensure(
      'placementdrives',
      PlacementDrive,
      { institution, title: d.title },
      () => ({
        institution,
        title: d.title,
        description: `On-campus recruitment drive with ${d.companies.length} partner companies for the 2027 graduating batch.`,
        mode: 'HYBRID',
        location: DEMO_INSTITUTIONS.find((i) => i.key === d.institution)!.city,
        participatingCompanies: d.companies.map((c) => ids.companies.get(c)!),
        opportunities: jobs.map((j) => ({
          opportunityType: 'JOB',
          opportunityId: act.jobs.get(j.key)!,
          openings: j.openings,
        })),
        eligibilityRules: { minCgpa: 7, allowedGraduationYears: [2027], resumeRequired: true },
        registrationOpensAt: ctx.daysFromNow(-30),
        registrationClosesAt: ctx.daysFromNow(-12),
        driveStartsAt: ctx.daysFromNow(-8),
        driveEndsAt: ctx.daysFromNow(10),
        status: d.status,
        totalSlots: jobs.reduce((n, j) => n + j.openings, 0),
        filledSlots: d.participants.filter((p) => p.outcome).length,
        coordinators: [createdBy],
        createdBy,
      }),
      ctx.daysFromNow(-32),
    );

    for (const p of d.participants) {
      const job = DEMO_JOBS.find((j) => j.key === p.job)!;
      const student = ids.studentUsers.get(p.student)!;
      const company = ids.companies.get(job.company)!;
      const application = act.applications.get(`${p.student}:${p.job}`);
      const participantId = await ctx.ensure(
        'placementparticipants',
        PlacementParticipant,
        { drive: driveId, student, company },
        () => ({
          drive: driveId,
          student,
          studentProfile: ids.students.get(p.student)!,
          company,
          opportunity: { opportunityType: 'JOB', opportunityId: act.jobs.get(p.job)! },
          registeredAt: ctx.daysFromNow(-20),
          currentRound: p.outcome ? 'Final' : 'Technical interview',
          lastActivityAt: ctx.daysFromNow(-2),
          status: p.status,
          ...(application ? { application } : {}),
          timeline: [
            { status: 'REGISTERED', at: ctx.daysFromNow(-20), by: student },
            { status: 'SHORTLISTED', at: ctx.daysFromNow(-10), by: createdBy },
            { status: p.status, at: ctx.daysFromNow(-2), by: createdBy },
          ],
        }),
      );
      if (p.outcome) {
        await ctx.ensure(
          'placementdriveoutcomes',
          PlacementDriveOutcome,
          { participant: participantId },
          () => ({
            drive: driveId,
            participant: participantId,
            ...(application ? { application } : {}),
            student,
            company,
            outcome: p.outcome,
            salaryPackage: {
              amount: job.salaryLpa[1] * 100_000,
              currency: 'INR',
              ctcLpa: job.salaryLpa[1],
            },
            joiningDate: ctx.daysFromNow(230),
            recordedBy: createdBy,
            recordedAt: ctx.daysFromNow(-3),
            verification: {
              status: 'VERIFIED',
              verifiedBy: createdBy,
              verifiedAt: ctx.daysFromNow(-2),
            },
          }),
        );
      }
    }
  }
}
