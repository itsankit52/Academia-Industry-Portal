import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Skill, Paginated } from '@aip/types';
import { queryKeys } from './queryKeys';

export function useSkillsCatalog() {
  return useQuery({
    queryKey: queryKeys.skillsCatalog(),
    queryFn: () => apiGet<Paginated<Skill>>('/skills'),
  });
}
