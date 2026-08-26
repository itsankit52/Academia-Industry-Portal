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
