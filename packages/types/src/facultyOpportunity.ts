import type { OpportunityType, WorkMode } from '@aip/config';

export type FacultyOpportunityType = Extract<
  OpportunityType,
  'FACULTY_INTERNSHIP' | 'FDP' | 'CONSULTANCY' | 'COLLABORATIVE_RESEARCH' | 'PROJECT' | 'APPRENTICESHIP'
>;

export type FacultyOppHostType = 'COMPANY' | 'INSTITUTION';
export type FacultyOppStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
export type FacultyOppTargetRole = 'STUDENT' | 'FACULTY';

export interface FacultyOppStipend {
  amount?: number;
  currency: string;
}

export interface FacultyOppHostRef {
  id: string;
  name: string;
  logoUrl?: string;
}

export interface FacultyOpportunity {
  id: string;
  title: string;
  description: string;
  opportunityType: FacultyOpportunityType;
  hostType: FacultyOppHostType;
  host: string | FacultyOppHostRef;
  postedBy: string;
  requiredExpertise: string[];
  preferredQualifications: string[];
  durationWeeks?: number;
  stipend?: FacultyOppStipend;
  location: string;
  mode: WorkMode;
  applicationDeadline: string;
  openings: number;
  targetRoles: FacultyOppTargetRole[];
  status: FacultyOppStatus;
  createdAt: string;
  updatedAt: string;
}

export function getFacultyOppHostName(opp: FacultyOpportunity): string {
  if (typeof opp.host === 'object' && opp.host !== null) return opp.host.name;
  return '—';
}

export function getFacultyOppHostId(opp: FacultyOpportunity): string {
  if (typeof opp.host === 'object' && opp.host !== null) return opp.host.id;
  if (typeof opp.host === 'string') return opp.host;
  return '';
}
