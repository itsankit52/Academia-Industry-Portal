import type { Gender } from '@aip/config';

export interface FacultyProfile {
  id: string;
  user: string;
  institution: string;
  fullName: string;
  designation: string;
  department: string;
  employeeCode?: string;
  phone?: string;
  dob?: string;
  gender?: Gender;
  qualifications: string[];
  researchInterests: string[];
  bio?: string;
  city?: string;
  state?: string;
  createdAt: string;
  updatedAt: string;
}
