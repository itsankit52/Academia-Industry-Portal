export type MentorAvailability = 'AVAILABLE' | 'BUSY' | 'UNAVAILABLE';

export interface MentorProfile {
  id: string;
  user: string | { id: string; email: string; role: string };
  bio?: string;
  expertise: string[];
  yearsExperience?: number;
  mentorshipCapacity: number;
  availability: MentorAvailability;
  linkedInUrl?: string;
  githubUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMentor {
  id: string;
  userId: string;
  fullName: string;
  bio?: string;
  expertise: string[];
  yearsExperience?: number;
  availability: MentorAvailability;
  mentorshipCapacity: number;
  activeCount?: number;
}

export interface RecommendedMentor extends PublicMentor {
  score: number;
  skillOverlap: number;
  expertiseOverlap: number;
  reasons: string[];
}
