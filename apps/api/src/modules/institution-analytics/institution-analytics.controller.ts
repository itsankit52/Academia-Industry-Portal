import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import {
  resolveInstitutionId,
  getDashboardStats,
  listStudents,
  getStudentById,
  listFaculty,
  getFacultyById,
  getSkillGapTrends,
  getPlacementMetrics,
  getFdpParticipation,
  getFacultyEngagementMetrics,
} from './institution-analytics.service';
import type { ListStudentsQuery, ListFacultyQuery, DashboardScope } from '@aip/validation';

export const dashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, q.institutionId);
  ok(
    res,
    await getDashboardStats(institutionId, {
      department: q.department,
      fromDate: q.fromDate,
      toDate: q.toDate,
      opportunityType: q.opportunityType,
      applicationStatus: q.applicationStatus,
    }),
  );
});

export const listStudentsHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListStudentsQuery;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, q.institutionId);
  ok(
    res,
    await listStudents(institutionId, {
      page: q.page,
      pageSize: q.pageSize,
      q: q.q,
      branch: q.branch,
      graduationYear: q.graduationYear,
    }),
  );
});

export const getStudentHandler = asyncHandler(async (req: Request, res: Response) => {
  const { institutionId: qId } = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
  ok(res, await getStudentById(req.params['id'] as string, institutionId));
});

export const listFacultyHandler = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListFacultyQuery;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, q.institutionId);
  ok(
    res,
    await listFaculty(institutionId, {
      page: q.page,
      pageSize: q.pageSize,
      q: q.q,
      department: q.department,
      designation: q.designation,
    }),
  );
});

export const getFacultyHandler = asyncHandler(async (req: Request, res: Response) => {
  const { institutionId: qId } = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
  ok(res, await getFacultyById(req.params['id'] as string, institutionId));
});

export const skillGapTrends = asyncHandler(async (req: Request, res: Response) => {
  const { institutionId: qId } = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
  ok(res, await getSkillGapTrends(institutionId));
});

export const placementMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { institutionId: qId } = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
  ok(res, await getPlacementMetrics(institutionId));
});

export const fdpParticipation = asyncHandler(async (req: Request, res: Response) => {
  const { institutionId: qId } = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
  ok(res, await getFdpParticipation(institutionId));
});

export const facultyEngagementMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { institutionId: qId } = req.query as DashboardScope;
  const institutionId = await resolveInstitutionId(req.user!.id, req.user!.role, qId);
  ok(res, await getFacultyEngagementMetrics(institutionId));
});
