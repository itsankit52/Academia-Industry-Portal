export interface MentorshipMessage {
  id: string;
  request: string;
  sender: string | { id: string; email: string };
  body: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}
