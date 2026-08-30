import { Types } from 'mongoose';
import {
  Application,
  AptitudeTest,
  FacultyProfile,
  Interview,
  Internship,
  Job,
  Skill,
  StudentProfile,
  StudentSkill,
  User,
} from '../../models';
import { AppError } from '../../utils/AppError';
import { buildPaginated } from '../../utils/pagination';
import type { Paginated } from '@aip/types';

export interface DashboardStatsFilters {
  department?: string;
  fromDate?: Date;
  toDate?: Date;
  opportunityType?: string;
  applicationStatus?: string;
}

export interface DashboardStats {
  studentCount: number;
  activeStudents: number;
  assessmentCompletionCount: number;
  assessmentCompletionRate: number;
  skillDevelopmentCount: number;
  skillDevelopmentRate: number;
  facultyCount: number;
  activeApplicationsCount: number;
  internshipApplicationsCount: number;
  jobApplicationsCount: number;
  shortlistedStudentsCount: number;
  selectedStudentsCount: number;
  interviewsScheduledCount: number;
  placementsCount: number;
  placementPercentage: number;
  avgMatchScore: number;
  publishedJobsCount: number;
  publishedInternshipsCount: number;
  activeCompaniesCount: number;
  mostDemandedSkills: { skillId: string; name: string; count: number }[];
  industrySkillDemand: {
    skillId: string;
    name: string;
    category: string;
    count: number;
    percentage: number;
  }[];
  departmentWisePlacement: {
    department: string;
    placedCount: number;
    totalCount: number;
    rate: number;
  }[];
  verifiedDocumentsCount: number;
  pendingDocumentsCount: number;
  // Phase 5B: Internship metrics
  internshipMetrics: {
    totalApplications: number;
    selected: number;
    activeInterns: number;
    completedInterns: number;
    completionRate: number;
  };
  // Phase 6B: Placement pipeline metrics
  placementMetrics: {
    totalJobApplications: number;
    shortlisted: number;
    interviewed: number;
    selected: number;
    offerAccepted: number;
    offerRejected: number;
    offerExpired: number;
    withdrawalRequested: number;
    offerAcceptanceRate: number;
    interviewConversionRate: number;
    placementRate: number;
    // Phase 7B: Placements are OFFER_ACCEPTED → COMPLETED (placement completion
    // recorded by the company) — distinct from the offer being accepted.
    placementsCompleted: number;
    placementsPendingVerification: number;
    placementsVerified: number;
    verificationRate: number;
    recruitmentSources: { source: string; count: number }[];
  };
}

export interface StudentRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  branch?: string;
  semester?: number;
  graduationYear?: number;
  cgpa?: number;
}

export interface FacultyRow {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  qualificationsCount: number;
  researchInterestsCount: number;
}

export interface SkillGapItem {
  skillId: string;
  name: string;
  category?: string;
  missingCount: number;
  percentage: number;
}

export interface PlacementMetrics {
  byStatus: { status: string; count: number }[];
  byMonth: { month: string; count: number }[];
  byBranch: { branch: string; placedCount: number; totalCount: number; rate: number }[];
}

export interface FdpParticipation {
  totalFaculty: number;
  appliedToFdps: number;
  acceptedToFdps: number;
  completedFdps: number;
  byFacultyDept: { department: string; applied: number; accepted: number; completed: number }[];
}

export async function resolveInstitutionId(
  userId: string,
  role: string,
  queryInstitutionId?: string,
): Promise<Types.ObjectId> {
  if (queryInstitutionId) {
    if (!/^[a-f\d]{24}$/i.test(queryInstitutionId))
      throw AppError.badRequest('Invalid institutionId');
    return new Types.ObjectId(queryInstitutionId);
  }
  const user = await User.findById(userId).select('institution').lean();
  if (!user?.institution) {
    throw AppError.forbidden(
      role === 'ADMIN'
        ? 'Provide institutionId query param to scope this request.'
        : 'No institution linked to your account.',
    );
  }
  return user.institution as Types.ObjectId;
}

export async function getDashboardStats(
  institutionId: Types.ObjectId,
  filters: DashboardStatsFilters = {},
): Promise<DashboardStats> {
  const studentMatch: Record<string, unknown> = { institution: institutionId };
  if (filters.department) studentMatch.branch = filters.department;

  const studentQuery = StudentProfile.find(studentMatch).select('_id user');
  const [studentProfiles, facultyCount, studentCount] = await Promise.all([
    studentQuery.lean(),
    FacultyProfile.countDocuments({ institution: institutionId }),
    StudentProfile.countDocuments(studentMatch),
  ]);

  const studentIds = studentProfiles.map((s) => s._id) as Types.ObjectId[];
  const studentUserIds = studentProfiles.map((s) => s.user) as Types.ObjectId[];

  const activeUserMatch: Record<string, unknown> = { _id: { $in: studentUserIds }, isActive: true };
  const activeStudents = await User.countDocuments(activeUserMatch);

  const dateMatch: Record<string, unknown> = {};
  if (filters.fromDate) dateMatch.$gte = filters.fromDate;
  if (filters.toDate) dateMatch.$lte = filters.toDate;

  const appBaseMatch: Record<string, unknown> = { student: { $in: studentIds } };
  if (filters.opportunityType) appBaseMatch.opportunityType = filters.opportunityType;
  if (filters.applicationStatus) appBaseMatch.status = filters.applicationStatus;
  if (filters.fromDate || filters.toDate) appBaseMatch.createdAt = dateMatch;

  const [
    activeApplicationsCount,
    internshipApplicationsCount,
    jobApplicationsCount,
    shortlistedStudentsCount,
    selectedStudentsCount,
    interviewAppIds,
    publishedJobsCount,
    publishedInternshipsCount,
    assessmentAgg,
    distinctCompanyIds,
    departmentAgg,
    matchResult,
  ] = await Promise.all([
    Application.countDocuments({ ...appBaseMatch, status: { $ne: 'SELECTED' } }),
    Application.countDocuments({ ...appBaseMatch, opportunityType: 'INTERNSHIP' }),
    Application.countDocuments({ ...appBaseMatch, opportunityType: 'JOB' }),
    Application.distinct('student', { ...appBaseMatch, status: 'SHORTLISTED' }).then(
      (arr) => (arr as Types.ObjectId[]).length,
    ),
    Application.distinct('student', { ...appBaseMatch, status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] } }).then(
      (arr) => (arr as Types.ObjectId[]).length,
    ),
    Application.distinct('_id', {
      ...appBaseMatch,
      status: { $in: ['INTERVIEW_SCHEDULED', 'SHORTLISTED'] },
    }) as Promise<Types.ObjectId[]>,
    Job.countDocuments({ status: 'PUBLISHED' }),
    Internship.countDocuments({ status: 'PUBLISHED' }),
    AptitudeTest.aggregate<{ _id: string; count: number }>([
      { $match: { user: { $in: studentUserIds }, status: 'SUBMITTED' } },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
    Application.distinct('opportunity', {
      ...appBaseMatch,
      opportunityType: { $in: ['JOB', 'INTERNSHIP'] },
    }),
    StudentProfile.aggregate<{ _id: string | null; total: number; placed: number }>([
      { $match: studentMatch },
      {
        $lookup: {
          from: 'applications',
          let: { sid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$student', '$$sid'] },
                status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] },
                ...(filters.fromDate || filters.toDate ? { createdAt: dateMatch } : {}),
              },
            },
          ],
          as: 'placements',
        },
      },
      {
        $group: {
          _id: '$branch',
          total: { $sum: 1 },
          placed: { $sum: { $size: '$placements' } },
        },
      },
    ]),
    Application.aggregate<{ avg: number }>([
      { $match: { ...appBaseMatch, matchScore: { $exists: true, $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$matchScore' } } },
    ]),
  ]);

  const [interviewsScheduledCount, skillDemandRows, activeCompaniesCount] = await Promise.all([
    Interview.countDocuments({ application: { $in: interviewAppIds }, status: 'SCHEDULED' }),
    Job.aggregate<{ _id: unknown; count: number; name: string; category: string }>([
      { $match: { status: 'PUBLISHED' } },
      {
        $project: {
          skills: {
            $concatArrays: [
              { $ifNull: ['$requiredSkills', []] },
              { $ifNull: ['$preferredSkills', []] },
            ],
          },
        },
      },
      { $unwind: '$skills' },
      { $group: { _id: '$skills', count: { $sum: 1 } } },
      {
        $unionWith: {
          coll: 'internships',
          pipeline: [
            { $match: { status: 'PUBLISHED' } },
            {
              $project: {
                skills: {
                  $concatArrays: [
                    { $ifNull: ['$requiredSkills', []] },
                    { $ifNull: ['$preferredSkills', []] },
                  ],
                },
              },
            },
            { $unwind: '$skills' },
            { $group: { _id: '$skills', count: { $sum: 1 } } },
          ],
        },
      },
      { $group: { _id: '$_id', count: { $sum: '$count' } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $lookup: { from: 'skills', localField: '_id', foreignField: '_id', as: 'skill' } },
      { $unwind: '$skill' },
      { $project: { _id: 1, count: 1, name: '$skill.name', category: '$skill.category' } },
    ]),
    distinctCompanyIds.length > 0
      ? User.countDocuments({
          _id: { $in: distinctCompanyIds as Types.ObjectId[] },
          isActive: true,
        })
      : Promise.resolve(0),
  ]);

  const totalSkillDemand = skillDemandRows.reduce((s, r) => s + r.count, 0);
  const industrySkillDemand = skillDemandRows.map((r) => ({
    skillId: String(r._id),
    name: r.name,
    category: r.category,
    count: r.count,
    percentage: totalSkillDemand > 0 ? Math.round((r.count / totalSkillDemand) * 1000) / 10 : 0,
  }));

  const mostDemandedSkills = industrySkillDemand.slice(0, 10).map((s) => ({
    skillId: s.skillId,
    name: s.name,
    count: s.count,
  }));

  const assessmentCompletionCount = assessmentAgg.length;
  const assessmentCompletionRate =
    studentCount > 0 ? Math.round((assessmentCompletionCount / studentCount) * 1000) / 10 : 0;
  const studentsWithSkills = await StudentSkill.distinct('student', {
    student: { $in: studentIds },
  });
  const skillDevelopmentCount = (studentsWithSkills as Types.ObjectId[]).length;
  const skillDevelopmentRate =
    studentCount > 0 ? Math.round((skillDevelopmentCount / studentCount) * 1000) / 10 : 0;

  const placementPercentage =
    studentCount > 0 ? Math.round((selectedStudentsCount / studentCount) * 1000) / 10 : 0;

  const departmentWisePlacement = departmentAgg
    .map((d) => {
      const totalCount = d.total;
      const placedCount = d.placed;
      return {
        department: d._id ?? 'UNSPECIFIED',
        placedCount,
        totalCount,
        rate: totalCount > 0 ? Math.round((placedCount / totalCount) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  // Phase 5B: Compute internship-specific metrics for institution students
  const internshipTotal = await Application.countDocuments({
    student: { $in: studentIds },
    opportunityType: 'INTERNSHIP',
  });
  const internshipSelected = await Application.countDocuments({
    student: { $in: studentIds },
    opportunityType: 'INTERNSHIP',
    status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] },
  });
  const internshipActive = await Application.countDocuments({
    student: { $in: studentIds },
    opportunityType: 'INTERNSHIP',
    status: { $in: ['INTERNSHIP_STARTED', 'ONGOING'] },
  });
  const internshipCompleted = await Application.countDocuments({
    student: { $in: studentIds },
    opportunityType: 'INTERNSHIP',
    status: 'COMPLETED',
  });
  const internshipCompletionRate =
    internshipSelected > 0
      ? Math.round((internshipCompleted / internshipSelected) * 1000) / 10
      : 0;

  // Phase 6B / 7A: placement pipeline metrics for job applications.
  // "Expired" now means OFFER_EXPIRED status (set by the background processor
  // when offerExpiresAt passes) — more reliable than the old SELECTED + expired
  // date query.
  const placementMatch = {
    student: { $in: studentIds },
    opportunityType: 'JOB',
  };
  const [
    placementTotalJobs,
    placementShortlisted,
    placementInterviewed,
    placementSelected,
    placementOfferAccepted,
    placementOfferRejected,
    placementWithdrawalRequested,
    placementOfferExpired,
    placementCompleted,
    placementVerified,
    placementPendingVerification,
    recruitmentSourceAgg,
  ] = await Promise.all([
    Application.countDocuments(placementMatch),
    Application.countDocuments({ ...placementMatch, status: 'SHORTLISTED' }),
    Application.countDocuments({
      ...placementMatch,
      status: { $in: ['INTERVIEW_SCHEDULED', 'SELECTED', 'OFFER_ACCEPTED', 'OFFER_REJECTED'] },
    }),
    Application.countDocuments({ ...placementMatch, status: 'SELECTED' }),
    Application.countDocuments({ ...placementMatch, status: 'OFFER_ACCEPTED' }),
    Application.countDocuments({ ...placementMatch, status: 'OFFER_REJECTED' }),
    Application.countDocuments({ ...placementMatch, status: 'WITHDRAWAL_REQUESTED' }),
    Application.countDocuments({ ...placementMatch, status: 'OFFER_EXPIRED' }),
    // Phase 7B: company-confirmed placements (status COMPLETED with placedAt set).
    Application.countDocuments({ ...placementMatch, status: 'COMPLETED', placedAt: { $exists: true, $ne: null } }),
    Application.countDocuments({ ...placementMatch, 'placementVerification.status': 'VERIFIED' }),
    Application.countDocuments({
      ...placementMatch,
      placedAt: { $exists: true, $ne: null },
      $or: [
        { placementVerification: { $exists: false } },
        { 'placementVerification.status': 'PENDING' },
      ],
    }),
    // Phase 7B: recruitment source aggregation across placed applications.
    Application.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...placementMatch,
          recruitmentSource: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: '$recruitmentSource', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);
  // Offer acceptance rate = accepted / (accepted + rejected + expired).
  const offerDenominator =
    placementOfferAccepted + placementOfferRejected + placementOfferExpired;
  const offerAcceptanceRate =
    offerDenominator > 0
      ? Math.round((placementOfferAccepted / offerDenominator) * 1000) / 10
      : 0;
  // Interview conversion rate = selected / interviewed.
  const interviewConversionRate =
    placementInterviewed > 0
      ? Math.round((placementSelected / placementInterviewed) * 1000) / 10
      : 0;
  // Placement rate = (offer accepted) / total job applications.
  const placementRate =
    placementTotalJobs > 0
      ? Math.round((placementOfferAccepted / placementTotalJobs) * 1000) / 10
      : 0;

  return {
    studentCount,
    activeStudents,
    assessmentCompletionCount,
    assessmentCompletionRate,
    skillDevelopmentCount,
    skillDevelopmentRate,
    facultyCount,
    activeApplicationsCount,
    internshipApplicationsCount,
    jobApplicationsCount,
    shortlistedStudentsCount,
    selectedStudentsCount,
    interviewsScheduledCount,
    placementsCount: selectedStudentsCount,
    placementPercentage,
    avgMatchScore: Math.round((matchResult[0]?.avg ?? 0) * 10) / 10,
    publishedJobsCount,
    publishedInternshipsCount,
    activeCompaniesCount,
    mostDemandedSkills,
    industrySkillDemand,
    departmentWisePlacement,
    verifiedDocumentsCount: 0,
    pendingDocumentsCount: 0,
    internshipMetrics: {
      totalApplications: internshipTotal,
      selected: internshipSelected,
      activeInterns: internshipActive,
      completedInterns: internshipCompleted,
      completionRate: internshipCompletionRate,
    },
    placementMetrics: {
      totalJobApplications: placementTotalJobs,
      shortlisted: placementShortlisted,
      interviewed: placementInterviewed,
      selected: placementSelected,
      offerAccepted: placementOfferAccepted,
      offerRejected: placementOfferRejected,
      offerExpired: placementOfferExpired,
      withdrawalRequested: placementWithdrawalRequested,
      offerAcceptanceRate,
      interviewConversionRate,
      placementRate,
      // Phase 7B additions
      placementsCompleted: placementCompleted,
      placementsVerified: placementVerified,
      placementsPendingVerification: placementPendingVerification,
      verificationRate:
        placementCompleted > 0
          ? Math.round((placementVerified / placementCompleted) * 1000) / 10
          : 0,
      recruitmentSources: recruitmentSourceAgg.map((r) => ({
        source: r._id,
        count: r.count,
      })),
    },
  };
}

export async function listStudents(
  institutionId: Types.ObjectId,
  filters: { page: number; pageSize: number; q?: string; branch?: string; graduationYear?: number },
): Promise<Paginated<StudentRow>> {
  const { page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const match: Record<string, unknown> = { institution: institutionId };
  if (filters.branch) match.branch = filters.branch;
  if (filters.graduationYear) match.graduationYear = filters.graduationYear;
  if (filters.q) match.fullName = { $regex: filters.q, $options: 'i' };

  const [rawItems, total] = await Promise.all([
    StudentProfile.aggregate<{
      _id: Types.ObjectId;
      userId: string;
      fullName: string;
      email: string;
      branch?: string;
      semester?: number;
      graduationYear?: number;
      cgpa?: number;
    }>([
      { $match: match },
      { $sort: { fullName: 1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
          pipeline: [{ $project: { email: 1 } }],
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: { $toString: '$user' },
          fullName: 1,
          email: { $ifNull: ['$userDoc.email', ''] },
          branch: 1,
          semester: 1,
          graduationYear: 1,
          cgpa: 1,
        },
      },
    ]),
    StudentProfile.countDocuments(match),
  ]);

  return buildPaginated(
    rawItems.map((s) => ({ ...s, id: String(s._id) })),
    total,
    page,
    pageSize,
  );
}

export async function getStudentById(id: string, institutionId: Types.ObjectId) {
  const profile = await StudentProfile.findOne({ _id: id, institution: institutionId }).populate(
    'user',
    'email isActive',
  );
  if (!profile) throw AppError.notFound('Student not found');
  return profile;
}

export async function listFaculty(
  institutionId: Types.ObjectId,
  filters: {
    page: number;
    pageSize: number;
    q?: string;
    department?: string;
    designation?: string;
  },
): Promise<Paginated<FacultyRow>> {
  const { page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const match: Record<string, unknown> = { institution: institutionId };
  if (filters.department) match.department = filters.department;
  if (filters.designation) match.designation = filters.designation;
  if (filters.q) match.fullName = { $regex: filters.q, $options: 'i' };

  const [rawItems, total] = await Promise.all([
    FacultyProfile.aggregate<FacultyRow & { _id: Types.ObjectId }>([
      { $match: match },
      { $sort: { fullName: 1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
          pipeline: [{ $project: { email: 1 } }],
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userId: { $toString: '$user' },
          fullName: 1,
          email: { $ifNull: ['$userDoc.email', ''] },
          department: 1,
          designation: 1,
          qualificationsCount: { $size: { $ifNull: ['$qualifications', []] } },
          researchInterestsCount: { $size: { $ifNull: ['$researchInterests', []] } },
        },
      },
    ]),
    FacultyProfile.countDocuments(match),
  ]);

  return buildPaginated(
    rawItems.map((f) => ({ ...f, id: String(f._id) })),
    total,
    page,
    pageSize,
  );
}

export async function getFacultyById(id: string, institutionId: Types.ObjectId) {
  const profile = await FacultyProfile.findOne({ _id: id, institution: institutionId }).populate(
    'user',
    'email isActive',
  );
  if (!profile) throw AppError.notFound('Faculty member not found');
  return profile;
}

export async function getSkillGapTrends(institutionId: Types.ObjectId): Promise<SkillGapItem[]> {
  const studentIds = (await StudentProfile.distinct('_id', {
    institution: institutionId,
  })) as Types.ObjectId[];
  const studentCount = studentIds.length;
  if (studentCount === 0) return [];

  const studentIdStrings = studentIds.map(String);

  const [heldByStudent, requiredSkillRows] = await Promise.all([
    StudentSkill.aggregate<{ _id: string; skills: string[] }>([
      { $match: { student: { $in: studentIds } } },
      {
        $group: {
          _id: { $toString: '$student' },
          skills: { $addToSet: { $toString: '$skill' } },
        },
      },
    ]),
    Job.aggregate<{ _id: string }>([
      { $match: { status: 'PUBLISHED' } },
      { $project: { skills: { $ifNull: ['$requiredSkills', []] } } },
      { $unwind: '$skills' },
      { $group: { _id: { $toString: '$skills' } } },
      {
        $unionWith: {
          coll: 'internships',
          pipeline: [
            { $match: { status: 'PUBLISHED' } },
            { $project: { skills: { $ifNull: ['$requiredSkills', []] } } },
            { $unwind: '$skills' },
            { $group: { _id: { $toString: '$skills' } } },
          ],
        },
      },
      { $group: { _id: '$_id' } },
    ]),
  ]);

  const heldMap = new Map<string, Set<string>>();
  for (const sid of studentIdStrings) heldMap.set(sid, new Set());
  for (const row of heldByStudent) heldMap.set(row._id, new Set(row.skills));

  const requiredSkillIds = requiredSkillRows.map((r) => r._id);
  if (requiredSkillIds.length === 0) return [];

  const missingCounts = requiredSkillIds.map((skillId) => {
    let missing = 0;
    for (const [, skillSet] of heldMap) {
      if (!skillSet.has(skillId)) missing++;
    }
    return { skillId, missing };
  });

  missingCounts.sort((a, b) => b.missing - a.missing);
  const top15 = missingCounts.slice(0, 15);

  const skillDocs = await Skill.find({
    _id: { $in: top15.map((t) => new Types.ObjectId(t.skillId)) },
  })
    .select('name category')
    .lean();
  const skillMap = new Map(skillDocs.map((s) => [String(s._id), s]));

  return top15.map(({ skillId, missing }) => ({
    skillId,
    name: skillMap.get(skillId)?.name ?? 'Unknown',
    category: skillMap.get(skillId)?.category as string | undefined,
    missingCount: missing,
    percentage: Math.round((missing / studentCount) * 1000) / 10,
  }));
}

export async function getPlacementMetrics(
  institutionId: Types.ObjectId,
): Promise<PlacementMetrics> {
  const studentIds = (await StudentProfile.distinct('_id', {
    institution: institutionId,
  })) as Types.ObjectId[];

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const [byStatusRaw, byMonthRaw, placedStudentIds, allBranchCounts] = await Promise.all([
    Application.aggregate<{ _id: string; count: number }>([
      { $match: { student: { $in: studentIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Application.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          student: { $in: studentIds },
          status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] },
          updatedAt: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Application.distinct('student', {
      student: { $in: studentIds },
      status: { $in: ['SELECTED', 'OFFER_ACCEPTED'] },
    }) as Promise<Types.ObjectId[]>,
    StudentProfile.aggregate<{ _id: string | null; total: number }>([
      { $match: { institution: institutionId } },
      { $group: { _id: '$branch', total: { $sum: 1 } } },
    ]),
  ]);

  const placedBranchCounts = await StudentProfile.aggregate<{ _id: string | null; placed: number }>(
    [
      { $match: { _id: { $in: placedStudentIds }, institution: institutionId } },
      { $group: { _id: '$branch', placed: { $sum: 1 } } },
    ],
  );

  const placedMap = new Map(placedBranchCounts.map((r) => [r._id ?? 'UNSPECIFIED', r.placed]));

  return {
    byStatus: byStatusRaw.map((r) => ({ status: r._id, count: r.count })),
    byMonth: byMonthRaw.map((r) => ({ month: r._id, count: r.count })),
    byBranch: allBranchCounts.map((r) => {
      const branch = r._id ?? 'UNSPECIFIED';
      const totalCount = r.total;
      const placedCount = placedMap.get(branch) ?? 0;
      return {
        branch,
        placedCount,
        totalCount,
        rate: totalCount > 0 ? Math.round((placedCount / totalCount) * 1000) / 10 : 0,
      };
    }),
  };
}

export async function getFdpParticipation(
  institutionId: Types.ObjectId,
): Promise<FdpParticipation> {
  const [totalFaculty, studentIds] = await Promise.all([
    FacultyProfile.countDocuments({ institution: institutionId }),
    StudentProfile.distinct('_id', { institution: institutionId }) as Promise<Types.ObjectId[]>,
  ]);

  const fdpApps = await Application.find({
    student: { $in: studentIds },
    opportunityType: 'FDP',
  })
    .select('status')
    .lean();

  const appliedToFdps = fdpApps.length;
  const acceptedToFdps = fdpApps.filter((a) =>
    (['SHORTLISTED', 'SELECTED'] as string[]).includes(a.status),
  ).length;
  const completedFdps = fdpApps.filter((a) => a.status === 'SELECTED').length;

  return {
    totalFaculty,
    appliedToFdps,
    acceptedToFdps,
    completedFdps,
    byFacultyDept: [],
  };
}
