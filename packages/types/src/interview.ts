import type { InterviewMode, InterviewStatus } from '@aip/config';

export interface Interview {
  id: string;
  applicationId: string;
  candidateName: string;
  opportunityTitle: string;
  companyName: string;
  mode: InterviewMode;
  scheduledAt: string;
  durationMinutes: number;
  meetingLink?: string;
  location?: string;
  interviewer?: string;
  notes?: string;
  feedback?: string;
  status: InterviewStatus;
  createdAt: string;
  updatedAt: string;
}
