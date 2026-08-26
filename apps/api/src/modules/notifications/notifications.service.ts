import { Types } from 'mongoose';
import type { NotificationType } from '@aip/config';
import type { Paginated } from '@aip/types';
import { Notification, type NotificationDoc } from '../../models';
import { AppError } from '../../utils/AppError';
import { applyPagination, buildPaginated } from '../../utils/pagination';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
): Promise<NotificationDoc> {
  return Notification.create({
    user: new Types.ObjectId(userId),
    type,
    title,
    body,
    ...(link ? { link } : {}),
  });
}

export interface ListNotificationsInput {
  userId: string;
  page?: number;
  pageSize?: number;
  unreadOnly?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function listNotifications(
  input: ListNotificationsInput,
): Promise<Paginated<NotificationDoc>> {
  const { userId, unreadOnly, page, pageSize, sortBy, sortDir } = input;
  const pg = applyPagination({ page, pageSize, sortBy, sortDir });
  const filter: Record<string, unknown> = { user: new Types.ObjectId(userId) };
  if (unreadOnly) filter.readAt = null;

  const [items, total] = await Promise.all([
    Notification.find(filter).sort(pg.sort).skip(pg.skip).limit(pg.limit).lean(),
    Notification.countDocuments(filter),
  ]);

  return buildPaginated(items as unknown as NotificationDoc[], total, pg.page, pg.pageSize);
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<NotificationDoc> {
  const doc = await Notification.findById(notificationId);
  if (!doc) throw AppError.notFound('Notification not found');
  if (String(doc.user) !== userId) throw AppError.forbidden('Not the owner');
  if (!doc.readAt) {
    doc.readAt = new Date();
    await doc.save();
  }
  return doc;
}

export async function markAllNotificationsRead(userId: string): Promise<{ modified: number }> {
  const result = await Notification.updateMany(
    { user: new Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } },
  );
  return { modified: result.modifiedCount ?? 0 };
}

export async function countUnread(userId: string): Promise<number> {
  return Notification.countDocuments({ user: new Types.ObjectId(userId), readAt: null });
}
