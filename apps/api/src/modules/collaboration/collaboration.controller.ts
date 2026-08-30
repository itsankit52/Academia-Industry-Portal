import type { Request, Response } from 'express';
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsQuery,
  ListMyRegistrationsQuery,
  ListEventRegistrationsQuery,
  MarkAttendedInput,
  SubmitFeedbackInput,
} from '@aip/validation';
import type { Role } from '@aip/config';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok, created, noContent } from '../../utils/apiResponse';
import * as service from './collaboration.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListEventsQuery;
  const data = await service.listEvents(q, req.user?.id);
  return ok(res, data);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getEventById(req.params.id!);
  return ok(res, data);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.createEvent(
    req.user!.id,
    req.user!.role as Role,
    req.body as CreateEventInput,
  );
  return created(res, data);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.updateEvent(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
    req.body as UpdateEventInput,
  );
  return ok(res, data);
});

export const publish = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.publishEvent(req.params.id!, req.user!.id, req.user!.role as Role);
  return ok(res, data);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.cancelEvent(req.params.id!, req.user!.id, req.user!.role as Role);
  return ok(res, data);
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.registerForEvent(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
  );
  return created(res, data);
});

export const unregister = asyncHandler(async (req: Request, res: Response) => {
  await service.unregisterFromEvent(req.user!.id, req.params.id!);
  return noContent(res);
});

export const myRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListMyRegistrationsQuery;
  const data = await service.listMyRegistrations(req.user!.id, q);
  return ok(res, data);
});

export const eventRegistrations = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as unknown as ListEventRegistrationsQuery;
  const data = await service.listEventRegistrations(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
    q,
  );
  return ok(res, data);
});

export const markAttended = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as MarkAttendedInput;
  const data = await service.markAttended(
    req.user!.id,
    req.user!.role as Role,
    req.params.id!,
    body.attendeeUserId,
  );
  return ok(res, data);
});

export const submitFeedback = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as SubmitFeedbackInput;
  const data = await service.submitEventFeedback(
    req.user!.id,
    req.params.id!,
    body,
  );
  return ok(res, data);
});

export const feedbackSummary = asyncHandler(async (req: Request, res: Response) => {
  const data = await service.getEventFeedbackSummary(
    req.params.id!,
    req.user!.id,
    req.user!.role as Role,
  );
  return ok(res, data);
});
