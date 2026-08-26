export interface SavedOpportunity {
  id: string;
  studentId: string;
  opportunityType: 'JOB' | 'INTERNSHIP';
  opportunityId: string;
  createdAt: string;
}
