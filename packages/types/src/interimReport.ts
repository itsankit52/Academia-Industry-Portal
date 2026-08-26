export interface InterimReport {
  id: string;
  application: string;
  student: string | { id: string; fullName: string };
  weekNumber: number;
  periodStart?: string;
  periodEnd?: string;
  workDescription?: string;
  learnings?: string;
  challenges?: string;
  hoursSpent?: number;
  submittedAt: string;
  mentorFeedback?: string;
  mentorRating?: number;
  mentorReviewedAt?: string;
  mentorReviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}
