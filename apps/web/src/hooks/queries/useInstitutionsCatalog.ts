import { useQuery } from '@tanstack/react-query';
import type { PublicInstitution } from '@aip/types';
import { apiGet } from '@/lib/api';

export function useInstitutionsCatalog() {
  return useQuery({
    queryKey: ['institutions', 'public'] as const,
    queryFn: async () => {
      const data = await apiGet<PublicInstitution[]>('/institutions/public');
      // `apiGet` returns `envelope.data`, so any 200 whose body is not this
      // API's `{ success, data }` envelope unwraps to `undefined` instead of
      // throwing — a static host answering the XHR with `index.html` because
      // `VITE_API_URL` was missing at build time is the usual way that happens.
      // Returning it verbatim made an unreachable API indistinguishable from an
      // empty catalogue: the consumer got `undefined`, `.map()` was skipped, and
      // the Institution select rendered its placeholder and nothing else, with
      // no error state to report. Fail loudly instead.
      if (!Array.isArray(data)) {
        throw new Error('The institution list was missing from the API response.');
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
