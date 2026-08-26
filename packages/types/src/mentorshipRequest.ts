import type { MentorshipStatus } from '@aip/config';

export type MentorshipMenteeRole = 'STUDENT' | 'FACULTY';

export interface MentorshipRequest {
  id: string;
  mentee: string | { id: string; email: string; role: string };
  menteeRole: MentorshipMenteeRole;
  mentor: string | { id: string; email: string; role: string };
  status: MentorshipStatus;
  initialMessage: string;
  goals?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}
