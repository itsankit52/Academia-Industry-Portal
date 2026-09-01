import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MAX_PAGE_SIZE } from '@aip/config';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { queryKeys } from './queryKeys';
import type { Skill, Paginated } from '@aip/types';
import type { CreateSkillInput, UpdateSkillInput } from '@aip/validation';

export interface SkillsFilters {
  category?: string;
  status?: string;
  q?: string;
}

export function useSkills(filters?: SkillsFilters) {
  return useQuery({
    queryKey: queryKeys.skills(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.q) params.set('q', filters.q);
      const qs = params.toString();
      return apiGet<Paginated<Skill>>(`/skills${qs ? `?${qs}` : ''}`);
    },
  });
}

/**
 * The whole active skill catalogue, because `SkillPicker` filters it in the
 * browser rather than querying per keystroke.
 *
 * `/skills` is paginated and defaults to `DEFAULT_PAGE_SIZE` (12) when no
 * `pageSize` is sent, so this used to resolve to the alphabetically-first 12 of
 * the 38 seeded skills. The picker then searched only those twelve and answered
 * "No skills found." for react, python, typescript and most of the rest — the
 * user could see the input, type into it, and never get an option to click.
 * Requesting page 1 at `MAX_PAGE_SIZE` and following `totalPages` keeps that
 * from silently returning once the catalogue outgrows a single page.
 */
export function useSkillsCatalog() {
  return useQuery({
    queryKey: queryKeys.skillsCatalog(),
    queryFn: async () => {
      const path = (page: number) => `/skills?status=ACTIVE&pageSize=${MAX_PAGE_SIZE}&page=${page}`;
      const first = await apiGet<Paginated<Skill>>(path(1));
      if (first.totalPages <= 1) return first;
      const rest = await Promise.all(
        Array.from({ length: first.totalPages - 1 }, (_, i) =>
          apiGet<Paginated<Skill>>(path(i + 2)),
        ),
      );
      return {
        ...first,
        items: rest.reduce<Skill[]>((all, p) => all.concat(p.items), first.items),
      };
    },
  });
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkillInput) => apiPost<Skill>('/skills', data),
    onSuccess: () => {
      toast.success('Skill created.');
      // Invalidate both the list and the full catalog so the SkillPicker
      // immediately sees the newly created skill after a "Create" action.
      qc.invalidateQueries({ queryKey: ['skills'] });
      qc.invalidateQueries({ queryKey: queryKeys.skillsCatalog() });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillInput }) =>
      apiPatch<Skill>(`/skills/${id}`, data),
    onSuccess: () => {
      toast.success('Skill updated.');
      qc.invalidateQueries({ queryKey: ['skills'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/skills/${id}`),
    onSuccess: () => {
      toast.success('Skill deleted.');
      qc.invalidateQueries({ queryKey: ['skills'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
