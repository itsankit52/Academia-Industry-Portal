import { Readable } from 'node:stream';
import type { UpdateCompanyProfileInput } from '@aip/validation';
import { AppError } from '../../utils/AppError';
import { Application, CompanyProfile, Internship, Interview, Job, User } from '../../models';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary';
import { applyPagination, buildPaginated, type PaginationInput } from '../../utils/pagination';
import { serializeLean } from '../../utils/serializeLean';

export async function getMyProfile(userId: string) {
  const profile = await CompanyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Company profile not found');
  return profile.toJSON();
}

export async function updateMyProfile(userId: string, patch: UpdateCompanyProfileInput) {
  const profile = await CompanyProfile.findOneAndUpdate(
    { user: userId },
    { $set: patch },
    { new: true, runValidators: true },
  );
  if (!profile) throw AppError.notFound('Company profile not found');
  return profile.toJSON();
}

export async function uploadLogo(userId: string, file: Express.Multer.File) {
  if (!isCloudinaryConfigured()) {
    throw AppError.serviceUnavailable('Cloudinary is not configured');
  }
  if (!file) throw AppError.badRequest('No file uploaded');

  const profile = await CompanyProfile.findOne({ user: userId });
  if (!profile) throw AppError.notFound('Company profile not found');

  const uploaded = await new Promise<{ secure_url: string; public_id: string }>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `aip/company-logos/${String(profile._id)}`,
          resource_type: 'image',
          overwrite: true,
        },
        (err, result) => {
          if (err || !result) return reject(err ?? new Error('Upload failed'));
          resolve({ secure_url: result.secure_url, public_id: result.public_id });
        },
      );
      Readable.from(file.buffer).pipe(stream);
    },
  );

  profile.logoUrl = uploaded.secure_url;
  await profile.save();
  return profile.toJSON();
}

export async function getPublicCompany(id: string) {
  const profile = await CompanyProfile.findById(id);
  if (!profile) throw AppError.notFound('Company not found');
  const json = profile.toJSON() as Record<string, unknown>;
  return {
    id: json.id,
    companyName: json.companyName,
    industry: json.industry,
    logoUrl: json.logoUrl,
    website: json.website,
    description: json.description,
  };
}

export interface CompanyListFilters {
  industry?: string;
  verified?: boolean;
}

export async function listCompanies(pag: PaginationInput, filters: CompanyListFilters) {
  const { page, pageSize, skip, limit, sort } = applyPagination(pag);
  const where: Record<string, unknown> = {};
  if (filters.industry) where.industry = filters.industry;
  if (filters.verified !== undefined) {
    where.verifiedAt = filters.verified ? { $exists: true, $ne: null } : { $in: [null, undefined] };
  }
  const [rows, total] = await Promise.all([
    CompanyProfile.find(where).sort(sort).skip(skip).limit(limit),
    CompanyProfile.countDocuments(where),
  ]);

  // The admin companies UI needs the user id (for activate/deactivate) and the
  // user's isActive flag, plus a per-company active-jobs count. CompanyProfile
  // only stores the user ref, and isActive lives on the User, so we hydrate
  // both with a single bulk fetch.
  const userIds = rows.map((r) => r.user).filter((id): id is NonNullable<typeof id> => Boolean(id));
  const companyIds = rows.map((r) => r._id);
  const [users, jobCounts] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }, { isActive: 1 }).lean()
      : Promise.resolve([]),
    companyIds.length
      ? Job.aggregate<{ _id: unknown; count: number }>([
          { $match: { company: { $in: companyIds }, status: 'PUBLISHED' } },
          { $group: { _id: '$company', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const activeByUser = new Map<string, boolean>(
    users.map((u) => [String(u._id), Boolean(u.isActive)]),
  );
  const jobsByCompany = new Map<string, number>(jobCounts.map((j) => [String(j._id), j.count]));

  const items = rows.map((r) => {
    const json = r.toJSON() as unknown as { id: string; user?: unknown; verifiedAt?: unknown };
    return {
      ...json,
      userId: json.user ? String(json.user) : '',
      isActive: activeByUser.get(String(json.user)) ?? true,
      isVerified: Boolean(json.verifiedAt),
      activeJobsCount: jobsByCompany.get(json.id) ?? 0,
    };
  });

  return buildPaginated(items, total, page, pageSize);
}

export interface CompanyDashboard {
  activeJobsCount: number;
  activeInternshipsCount: number;
  applicantsCount: number;
  interviewsCount: number;
  recentApplicants: unknown[];
  upcomingInterviews: unknown[];
}

export async function getCompanyDashboard(userId: string): Promise<CompanyDashboard> {
  const company = await CompanyProfile.findOne({ user: userId }).select('_id');
  if (!company) throw AppError.notFound('Company profile not found');

  const companyId = company._id;
  const [jobs, internships] = await Promise.all([
    Job.find({ company: companyId }).select('_id status'),
    Internship.find({ company: companyId }).select('_id status'),
  ]);

  const activeJobsCount = jobs.filter((j) => j.status === 'PUBLISHED').length;
  const activeInternshipsCount = internships.filter((i) => i.status === 'PUBLISHED').length;

  const jobIds = jobs.map((j) => j._id);
  const internshipIds = internships.map((i) => i._id);

  const applicationFilter = {
    $or: [
      { opportunityType: 'JOB', opportunity: { $in: jobIds } },
      { opportunityType: 'INTERNSHIP', opportunity: { $in: internshipIds } },
    ],
  };

  const [applicantsCount, recentApplicantsDocs] = await Promise.all([
    Application.countDocuments(applicationFilter),
    Application.find(applicationFilter)
      .sort({ createdAt: -1 })
      .limit(6)
      .populate({ path: 'student', select: 'fullName college branch graduationYear' })
      .lean(),
  ]);

  const applicationIds = await Application.find(applicationFilter).select('_id');
  const appIds = applicationIds.map((a) => a._id);

  const now = new Date();
  const [interviewsCount, upcomingInterviewsDocs] = await Promise.all([
    Interview.countDocuments({ application: { $in: appIds } }),
    Interview.find({ application: { $in: appIds }, scheduledAt: { $gte: now } })
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),
  ]);

  return {
    activeJobsCount,
    activeInternshipsCount,
    applicantsCount,
    interviewsCount,
    // Both lists are read with `.lean()`, which skips the schema's toJSON
    // transform and so ships raw `_id`. The dashboard keys its Recent Applicants
    // and Upcoming Interviews rows off `id`, and CandidateCard links to
    // `/company/applicants/${application.id}` — so without this every one of
    // those links resolved to `.../undefined`.
    recentApplicants: serializeLean(recentApplicantsDocs),
    upcomingInterviews: serializeLean(upcomingInterviewsDocs),
  };
}
