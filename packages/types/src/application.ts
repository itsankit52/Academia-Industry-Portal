import type { ApplicationStatus, OpportunityType } from '@aip/config';

export interface TimelineEntry {
  status: ApplicationStatus;
  at: string;
  note?: string;
}

export interface Application {
  id: string;
  student: string | { id: string; fullName: string; email: string };
  opportunityType: OpportunityType;
  opportunity: string | { id: string; title: string; company?: { id: string; name: string } };
  status: ApplicationStatus;
  resume?: { id: string; url: string; mimeType: string } | null;
  coverLetter?: string;
  matchScore?: number;
  matchedSkills?: string[];
  missingSkills?: string[];
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export function getOpportunityTitle(app: Application): string {
  if (typeof app.opportunity === 'object' && app.opportunity !== null) return app.opportunity.title;
  return '—';
}

export function getCompanyName(app: Application): string {
  if (typeof app.opportunity === 'object' && app.opportunity !== null && app.opportunity.company) {
    return app.opportunity.company.name;
  }
  return '—';
}

export function getOpportunityId(app: Application): string {
  if (typeof app.opportunity === 'object' && app.opportunity !== null) return app.opportunity.id;
  if (typeof app.opportunity === 'string') return app.opportunity;
  return '';
}

export function getStudentName(app: Application): string {
  if (typeof app.student === 'object' && app.student !== null) return app.student.fullName;
  return '—';
}

export function getStudentEmail(app: Application): string {
  if (typeof app.student === 'object' && app.student !== null) return app.student.email;
  return '—';
}

export function getResumeUrl(app: Application): string | undefined {
  if (app.resume != null && typeof app.resume === 'object') return app.resume.url;
  return undefined;
}
