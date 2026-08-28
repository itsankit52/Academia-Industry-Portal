import type { UpdateStudentProfileInput } from '@aip/validation';
import { AppError } from '../../utils/AppError';
import {
  StudentProfile,
  Application,
  Interview,
  Notification,
  Resume,
  Job,
  Internship,
  StudentSkill,
} from '../../models';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { getAssessmentSummary } from '../assessments/assessments.service';

export async function getMyProfile(userId: string) {
  const profile = await StudentProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile.toJSON();
}

export async function updateMyProfile(userId: string, patch: UpdateStudentProfileInput) {
  const profile = await StudentProfile.findOneAndUpdate(
    { user: userId },
    { $set: patch },
    { new: true, runValidators: true },
  );
  if (!profile) throw AppError.notFound('Student profile not found');
  return profile.toJSON();
}

export async function getStudentById(id: string, role: 'ADMIN' | 'COMPANY') {
  const profile = await StudentProfile.findById(id).populate('user', 'email');
  if (!profile) throw AppError.notFound('Student not found');
  const json = profile.toJSON() as Record<string, unknown>;
  if (role === 'COMPANY') {
    return {
      id: json.id,
      fullName: json.fullName,
      college: json.college,
      university: json.university,
      degree: json.degree,
      branch: json.branch,
      graduationYear: json.graduationYear,
      cgpa: json.cgpa,
      email: (json.user as Record<string, unknown>)?.email,
      projects: json.projects,
      certifications: json.certifications,
      experience: json.experience,
      achievements: json.achievements,
      preferredRoles: json.preferredRoles,
      preferredLocations: json.preferredLocations,
    };
  }
  return json;
}

export interface StudentListFilters {
  branch?: string;
  graduationYear?: number;
  cgpaMin?: number;
}

export async function listStudents(pag: PaginationInput, filters: StudentListFilters) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = {};
  if (filters.branch) where.branch = filters.branch;
  if (typeof filters.graduationYear === 'number') where.graduationYear = filters.graduationYear;
  if (typeof filters.cgpaMin === 'number') where.cgpa = { $gte: filters.cgpaMin };

  const [rows, total] = await Promise.all([
    StudentProfile.find(where).sort(sort).skip(skip).limit(limit),
    StudentProfile.countDocuments(where),
  ]);
  return buildPaginated(
    rows.map((r) => r.toJSON()),
    total,
    page,
    pageSize,
  );
}

export async function getMySummary(userId: string) {
  const profile = await StudentProfile.findOne({ user: userId }).select('_id');
  if (!profile) throw AppError.notFound('Student profile not found');

  const [
    appliedCount,
    allAppIds,
    recentAppsRaw,
    unreadNotifications,
    resume,
    studentSkills,
    publishedJobsCount,
    latestAssessment,
  ] = await Promise.all([
    Application.countDocuments({ student: profile._id }),
    Application.find({ student: profile._id }).select('_id opportunity opportunityType'),
    Application.find({ student: profile._id }).sort({ createdAt: -1 }).limit(5).lean(),
    Notification.countDocuments({ user: userId, readAt: null }),
    Resume.findOne({ student: profile._id }).sort({ createdAt: -1 }).select('_id'),
    StudentSkill.find({ student: profile._id }).select('skill').lean(),
    Job.countDocuments({ status: 'PUBLISHED' }),
    getAssessmentSummary(userId),
  ]);

  const appIds = allAppIds.map((a) => a._id);
  const appliedJobIds = allAppIds
    .filter((a) => a.opportunityType === 'JOB')
    .map((a) => a.opportunity);

  const [interviewCount, upcomingInterviewsRaw, publishedJobs] = await Promise.all([
    Interview.countDocuments({ application: { $in: appIds } }),
    Interview.find({
      application: { $in: appIds },
      status: 'SCHEDULED',
      scheduledAt: { $gte: new Date() },
    })
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),
    Job.find({ status: 'PUBLISHED' }).select('requiredSkills preferredSkills _id').lean(),
  ]);

  const recentJobIds = recentAppsRaw
    .filter((a) => a.opportunityType === 'JOB')
    .map((a) => a.opportunity);
  const recentInternIds = recentAppsRaw
    .filter((a) => a.opportunityType === 'INTERNSHIP')
    .map((a) => a.opportunity);

  const [recentJobs, recentInterns] = await Promise.all([
    Job.find({ _id: { $in: recentJobIds } })
      .populate('company', 'companyName logoUrl')
      .select('title company')
      .lean(),
    Internship.find({ _id: { $in: recentInternIds } })
      .populate('company', 'companyName logoUrl')
      .select('title company')
      .lean(),
  ]);

  const jobMap = new Map(recentJobs.map((j) => [String(j._id), j]));
  const internMap = new Map(recentInterns.map((i) => [String(i._id), i]));

  const denormalizeOpp = (
    opp: (typeof recentJobs)[number] | (typeof recentInterns)[number] | undefined,
    rawId: unknown,
  ) => {
    if (!opp) return String(rawId);
    const company = opp.company as
      { _id: unknown; companyName?: string; logoUrl?: string } | undefined;
    return {
      id: String(opp._id),
      title: opp.title,
      company: company
        ? {
            id: String(company._id),
            name: company.companyName ?? '',
            logoUrl: company.logoUrl,
          }
        : undefined,
    };
  };

  const recentApplications = recentAppsRaw.map((a) => {
    const opp =
      a.opportunityType === 'JOB'
        ? jobMap.get(String(a.opportunity))
        : internMap.get(String(a.opportunity));
    return {
      id: String(a._id),
      student: String(a.student),
      opportunityType: a.opportunityType,
      opportunity: denormalizeOpp(opp, a.opportunity),
      status: a.status,
      coverLetter: a.coverLetter,
      matchScore: a.matchScore,
      timeline: (a.timeline ?? []).map((t) => ({
        status: t.status,
        at: t.at instanceof Date ? t.at.toISOString() : String(t.at),
        note: t.note,
      })),
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
    };
  });

  const upcomingInterviews = upcomingInterviewsRaw.map((iv) => ({
    id: String(iv._id),
    application: String(iv.application),
    mode: iv.mode,
    scheduledAt:
      iv.scheduledAt instanceof Date ? iv.scheduledAt.toISOString() : String(iv.scheduledAt),
    durationMinutes: iv.durationMinutes,
    meetingLink: iv.meetingLink,
    location: iv.location,
    interviewer: iv.interviewer,
    notes: iv.notes,
    feedback: iv.feedback,
    status: iv.status,
    createdAt: iv.createdAt instanceof Date ? iv.createdAt.toISOString() : String(iv.createdAt),
    updatedAt: iv.updatedAt instanceof Date ? iv.updatedAt.toISOString() : String(iv.updatedAt),
  }));

  const studentSkillIds = new Set(studentSkills.map((s) => String(s.skill)));
  const requiredSkillIds = new Set<string>();
  for (const j of publishedJobs) {
    for (const s of j.requiredSkills ?? []) requiredSkillIds.add(String(s));
  }
  let missingSkillsCount = 0;
  for (const rid of requiredSkillIds) {
    if (!studentSkillIds.has(rid)) missingSkillsCount++;
  }

  const recommendationCount = Math.max(0, publishedJobsCount - appliedJobIds.length);

  return {
    appliedCount,
    interviewCount,
    recommendationCount,
    missingSkillsCount,
    recentApplications,
    upcomingInterviews,
    unreadNotifications,
    hasResume: Boolean(resume),
    latestAssessment,
  };
}
