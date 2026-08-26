import type { Request, Response } from 'express';
import type {
  CreateMentorProfileInput,
  UpdateMentorProfileInput,
  CreateMentorshipRequestInput,
  UpdateMentorshipRequestInput,
  SendMessageInput,
  ListMentorsQuery,
  ListMyRequestsQuery,
  ListMessagesQuery,
} from '@aip/validation';
import type { Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created } from '../../utils/apiResponse';
import type { MentorshipMenteeRole } from '../../models/MentorshipRequest';
import { AppError } from '../../utils/AppError';
import * as service from './mentorship.service';

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export const listMentors = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListMentorsQuery;
  const data = await service.listMentors(q, { page: q.page, pageSize: q.pageSize });
  return ok(res, data);
});

export const getMentor = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getMentorProfile(req.params.userId!);
  return ok(res, data);
});

export const becomeMentor = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.becomeMentor(req.user!.id, req.body as CreateMentorProfileInput);
  return created(res, data);
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateMyMentorProfile(
    req.user!.id,
    req.body as UpdateMentorProfileInput,
  );
  return ok(res, data);
});

export const createRequest = asyncHandler(async (req: Request, res: Response) => {
  const role = req.user!.role as Role;
  if (role !== 'STUDENT' && role !== 'FACULTY') {
    throw AppError.forbidden('Only STUDENT or FACULTY may request mentorship');
  }
  const menteeRole = role as MentorshipMenteeRole;
  const data = await service.requestMentorship(
    req.user!.id,
    menteeRole,
    req.body as CreateMentorshipRequestInput,
  );
  return created(res, data);
});

export const listMineAsMentee = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListMyRequestsQuery;
  const data = await service.listMyRequestsAsMentee(req.user!.id, q);
  return ok(res, data);
});

export const listMineAsMentor = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListMyRequestsQuery;
  const data = await service.listMyRequestsAsMentor(req.user!.id, q);
  return ok(res, data);
});

export const getRequest = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getRequestById(req.params.id!, req.user!.id);
  return ok(res, data);
});

export const patchRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateMentorshipRequestInput;
  const data = await service.updateRequestStatus(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
    body.status,
  );
  return ok(res, data);
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListMessagesQuery;
  const data = await service.getMessages(req.params.id!, req.user!.id, q);
  return ok(res, data);
});

export const postMessage = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.sendMessage(
    req.params.id!,
    req.user!.id,
    req.body as SendMessageInput,
  );
  return created(res, data);
});

export const listAllAdmin = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const data = await service.listAllMentorshipRequestsAdmin({
    page: num(q.page),
    pageSize: num(q.pageSize),
  });
  return ok(res, data);
});
