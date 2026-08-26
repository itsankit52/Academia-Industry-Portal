import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ok } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import {
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.service';

function requireUserId(req: Request): string {
  const id = req.user?.id;
  if (!id) throw AppError.unauthorized('Authentication required');
  return id;
}

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const q = req.query as Record<string, unknown>;
  const unreadOnly = q.unreadOnly === 'true' || q.unreadOnly === true;
  const result = await listNotifications({
    userId,
    page: q.page ? Number(q.page) : undefined,
    pageSize: q.pageSize ? Number(q.pageSize) : undefined,
    sortBy: typeof q.sortBy === 'string' ? q.sortBy : undefined,
    sortDir: q.sortDir === 'asc' ? 'asc' : 'desc',
    unreadOnly,
  });
  ok(res, result);
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doc = await markNotificationRead(userId, req.params.id!);
  ok(res, doc);
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await markAllNotificationsRead(userId);
  ok(res, result);
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const count = await countUnread(userId);
  ok(res, { count });
});
