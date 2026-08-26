import type { Gender } from '@aip/config';

export interface Experience {
  title: string;
  organization: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

export interface Project {
  title: string;
  description: string;
  techStack: string[];
  link?: string;
}

export interface Certification {
  title: string;
  issuer: string;
  issuedAt: string;
  credentialUrl?: string;
}

export interface Achievement {
  title: string;
  description?: string;
  date?: string;
}

export interface StudentProfile {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  dob?: string;
  gender?: Gender;
  city?: string;
  state?: string;
  address?: string;
  college?: string;
  university?: string;
  degree?: string;
  branch?: string;
  semester?: number;
  graduationYear?: number;
  cgpa?: number;
  bio?: string;
  projects: Project[];
  certifications: Certification[];
  experience: Experience[];
  achievements: Achievement[];
  preferredRoles: string[];
  preferredLocations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyProfile {
  id: string;
  userId: string;
  companyName: string;
  description?: string;
  industry?: string;
  website?: string;
  phone?: string;
  location?: string;
  companySize?: string;
  foundedYear?: number;
  logoUrl?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}
