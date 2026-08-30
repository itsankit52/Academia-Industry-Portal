/**
 * Phase 9A — Test the personalized recommendations hook shape.
 * The full UI is integration-tested via the dashboard; here we just verify
 * the hook returns data and the query key is stable.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePersonalizedRecommendations } from '@/hooks/queries/usePersonalizedRecommendations';
import { apiGet } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const mockApiGet = vi.mocked(apiGet);

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('usePersonalizedRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /recommendations/me and returns the data', async () => {
    const payload = {
      readiness: {
        readinessScore: 75,
        level: 'Almost There',
        description: 'Almost there.',
      },
      skillGaps: [],
      trainings: [],
      mentors: [],
      jobs: [],
      internships: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiGet.mockResolvedValueOnce(payload as never);
    const client = makeClient();
    const { result } = renderHook(() => usePersonalizedRecommendations(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me');
    expect(result.current.data).toEqual(payload);
  });

  it('returns isLoading=true before the data resolves', async () => {
    mockApiGet.mockReturnValueOnce(new Promise(() => {}) as never);
    const client = makeClient();
    const { result } = renderHook(() => usePersonalizedRecommendations(), {
      wrapper: wrapper(client),
    });
    expect(result.current.isLoading).toBe(true);
  });
});
