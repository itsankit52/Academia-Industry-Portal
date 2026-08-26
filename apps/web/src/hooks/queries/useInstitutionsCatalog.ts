import { useQuery } from '@tanstack/react-query';
import type { PublicInstitution } from '@aip/types';
import { apiGet } from '@/lib/api';

export function useInstitutionsCatalog() {
  return useQuery({
    queryKey: ['institutions', 'public'] as const,
    queryFn: () => apiGet<PublicInstitution[]>('/institutions/public'),
    staleTime: 5 * 60 * 1000,
  });
}
