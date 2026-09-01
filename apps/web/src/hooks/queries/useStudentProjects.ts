import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { queryKeys } from './queryKeys';

export interface StudentProject {
  _id: string;
  title: string;
  description: string;
  role?: string;
  technologies?: string[];
  links?: Array<{ label: string; url: string }>;
  completedAt?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useStudentProjects() {
  return useQuery({
    queryKey: queryKeys.studentProjects(),
    queryFn: () => apiGet<{ items: StudentProject[] }>('/student-projects').then((r) => r.items),
  });
}
