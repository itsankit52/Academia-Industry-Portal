import {
  Application,
  CompanyProfile,
  Internship,
  Job,
  StudentProfile,
  StudentSkill,
  User,
} from '../../models';

export interface DashboardTotals {
  students: number;
  companies: number;
  jobs: number;
  internships: number;
  applications: number;
  placements: number;
  activeJobs: number;
  activeInternships: number;
}

export interface SkillCount {
  skillId: string;
  name: string;
  count: number;
}

export interface DashboardSummary {
  totals: DashboardTotals;
  placementRate: number;
  topDemandedSkills: SkillCount[];
  topStudentSkills: SkillCount[];
  applicationsByStatus: Record<string, number>;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [
    students,
    companies,
    jobs,
    internships,
    applications,
    placements,
    activeJobs,
    activeInternships,
  ] = await Promise.all([
    User.countDocuments({ role: 'STUDENT' }),
    User.countDocuments({ role: 'COMPANY' }),
    Job.countDocuments(),
    Internship.countDocuments(),
    Application.countDocuments(),
    Application.countDocuments({ status: 'SELECTED' }),
    Job.countDocuments({ status: 'PUBLISHED' }),
    Internship.countDocuments({ status: 'PUBLISHED' }),
  ]);

  const totals: DashboardTotals = {
    students,
    companies,
    jobs,
    internships,
    applications,
    placements,
    activeJobs,
    activeInternships,
  };

  const placementRate = applications > 0 ? (placements / applications) * 100 : 0;

  const [topDemandedSkills, topStudentSkills, statusRows] = await Promise.all([
    aggregateDemandedSkills(10),
    aggregateStudentSkills(10),
    Application.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const applicationsByStatus: Record<string, number> = {};
  for (const row of statusRows) applicationsByStatus[row._id] = row.count;

  return {
    totals,
    placementRate,
    topDemandedSkills,
    topStudentSkills,
    applicationsByStatus,
  };
}

async function aggregateDemandedSkills(limit: number): Promise<SkillCount[]> {
  const rows = await Job.aggregate<{ _id: unknown; count: number; name: string }>([
    { $match: { status: { $in: ['PUBLISHED', 'DRAFT', 'CLOSED'] } } },
    { $project: { skills: { $concatArrays: [{ $ifNull: ['$requiredSkills', []] }, { $ifNull: ['$preferredSkills', []] }] } } },
    { $unwind: '$skills' },
    { $group: { _id: '$skills', count: { $sum: 1 } } },
    {
      $unionWith: {
        coll: 'internships',
        pipeline: [
          { $project: { skills: { $concatArrays: [{ $ifNull: ['$requiredSkills', []] }, { $ifNull: ['$preferredSkills', []] }] } } },
          { $unwind: '$skills' },
          { $group: { _id: '$skills', count: { $sum: 1 } } },
        ],
      },
    },
    { $group: { _id: '$_id', count: { $sum: '$count' } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $lookup: { from: 'skills', localField: '_id', foreignField: '_id', as: 'skill' } },
    { $unwind: '$skill' },
    { $project: { _id: 1, count: 1, name: '$skill.name' } },
  ]);
  return rows.map((r) => ({ skillId: String(r._id), name: r.name, count: r.count }));
}

async function aggregateStudentSkills(limit: number): Promise<SkillCount[]> {
  const rows = await StudentSkill.aggregate<{ _id: unknown; count: number; name: string }>([
    { $group: { _id: '$skill', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $lookup: { from: 'skills', localField: '_id', foreignField: '_id', as: 'skill' } },
    { $unwind: '$skill' },
    { $project: { _id: 1, count: 1, name: '$skill.name' } },
  ]);
  return rows.map((r) => ({ skillId: String(r._id), name: r.name, count: r.count }));
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

function daysAgoStart(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
}

function fillTimeSeries(rows: { _id: string; count: number }[], days: number): TimeSeriesPoint[] {
  const map = new Map(rows.map((r) => [r._id, r.count]));
  const out: TimeSeriesPoint[] = [];
  const start = daysAgoStart(days);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
  }
  return out;
}

export async function getApplicationsOverTime(days: number): Promise<TimeSeriesPoint[]> {
  const start = daysAgoStart(days);
  const rows = await Application.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return fillTimeSeries(rows, days);
}

export async function getPlacementsOverTime(days: number): Promise<TimeSeriesPoint[]> {
  const start = daysAgoStart(days);
  const rows = await Application.aggregate<{ _id: string; count: number }>([
    { $match: { status: 'SELECTED', updatedAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return fillTimeSeries(rows, days);
}

export interface CategoryCount {
  category: string;
  count: number;
}

export async function getJobsByCategory(): Promise<CategoryCount[]> {
  const rows = await Job.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$employmentType', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, count: r.count }));
}

export async function getInternshipsByCategory(): Promise<CategoryCount[]> {
  const rows = await Internship.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$workMode', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, count: r.count }));
}

export interface BranchCount {
  branch: string;
  count: number;
}

export async function getStudentsByBranch(): Promise<BranchCount[]> {
  const rows = await StudentProfile.aggregate<{ _id: string | null; count: number }>([
    { $group: { _id: '$branch', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ branch: r._id ?? 'UNSPECIFIED', count: r.count }));
}

export interface SkillDemandItem {
  skillId: string;
  name: string;
  category: string;
  count: number;
  percentage: number;
}

export async function getIndustrySkillDemand(): Promise<SkillDemandItem[]> {
  const [jobCount, internCount] = await Promise.all([
    Job.countDocuments(),
    Internship.countDocuments(),
  ]);
  const denominator = jobCount + internCount;

  const rows = await Job.aggregate<{ _id: unknown; count: number; name: string; category: string }>([
    { $project: { skills: { $concatArrays: [{ $ifNull: ['$requiredSkills', []] }, { $ifNull: ['$preferredSkills', []] }] } } },
    { $unwind: '$skills' },
    { $group: { _id: '$skills', count: { $sum: 1 } } },
    {
      $unionWith: {
        coll: 'internships',
        pipeline: [
          { $project: { skills: { $concatArrays: [{ $ifNull: ['$requiredSkills', []] }, { $ifNull: ['$preferredSkills', []] }] } } },
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
  ]);

  return rows.map((r) => ({
    skillId: String(r._id),
    name: r.name,
    category: r.category,
    count: r.count,
    percentage: denominator > 0 ? (r.count / denominator) * 100 : 0,
  }));
}

export interface CompanyParticipationItem {
  companyId: string;
  companyName: string;
  jobCount: number;
  internshipCount: number;
  total: number;
}

export async function getCompanyParticipation(): Promise<CompanyParticipationItem[]> {
  const jobRows = await Job.aggregate<{ _id: unknown; count: number }>([
    { $group: { _id: '$company', count: { $sum: 1 } } },
  ]);
  const internshipRows = await Internship.aggregate<{ _id: unknown; count: number }>([
    { $group: { _id: '$company', count: { $sum: 1 } } },
  ]);

  const jobMap = new Map(jobRows.map((r) => [String(r._id), r.count]));
  const internMap = new Map(internshipRows.map((r) => [String(r._id), r.count]));
  const ids = new Set<string>([...jobMap.keys(), ...internMap.keys()]);

  const companies = await CompanyProfile.find({ _id: { $in: Array.from(ids) } })
    .select('_id companyName')
    .lean();
  const nameMap = new Map(companies.map((c) => [String(c._id), String(c.companyName)]));

  const rows: CompanyParticipationItem[] = Array.from(ids).map((id) => {
    const jobCount = jobMap.get(id) ?? 0;
    const internshipCount = internMap.get(id) ?? 0;
    return {
      companyId: id,
      companyName: nameMap.get(id) ?? 'Unknown',
      jobCount,
      internshipCount,
      total: jobCount + internshipCount,
    };
  });

  rows.sort((a, b) => b.total - a.total);
  return rows.slice(0, 20);
}
