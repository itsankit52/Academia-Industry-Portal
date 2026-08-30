export interface EventRegistration {
  id: string;
  event: string | { id: string; title: string };
  user: string | { id: string; email: string };
  registeredAt: string;
  attendedAt?: string;
  feedback?: string;
  rating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventFeedbackSummary {
  eventId: string;
  averageRating: number;
  totalFeedback: number;
  ratings: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  recentComments: Array<{
    id: string;
    rating: number;
    comment: string;
    submittedAt: string;
    attendeeName: string;
  }>;
}
