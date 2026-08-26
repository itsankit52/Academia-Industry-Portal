import type { NotificationType } from '@aip/config';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}
