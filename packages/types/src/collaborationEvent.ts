import type { CollabEventType, Role } from '@aip/config';

export type CollabEventHostType = 'COMPANY' | 'INSTITUTION';
export type CollabEventMode = 'ONLINE' | 'ONSITE' | 'HYBRID';
export type CollabEventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';

export interface CollaborationEvent {
  id: string;
  title: string;
  description: string;
  eventType: CollabEventType;
  hostType: CollabEventHostType;
  host: string | { id: string; name: string };
  postedBy: string;
  startAt: string;
  endAt?: string;
  location?: string;
  mode: CollabEventMode;
  meetingLink?: string;
  capacity?: number;
  registeredCount: number;
  registrationDeadline?: string;
  targetAudience: Role[];
  tags: string[];
  status: CollabEventStatus;
  createdAt: string;
  updatedAt: string;
}
