/**
 * Phase 9B — Tests for the career decision support hooks.
 *
 * Coverage:
 * - useCareerPathAnalysis: calls correct endpoint, returns data
 * - useCareerActionPlan: calls correct endpoint, returns data
 * - useCareerBenchmark: calls correct endpoint, returns data
 * - useReadinessProgression: calls correct endpoint, returns data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useCareerPathAnalysis } from '@/hooks/queries/useCareerPathAnalysis';
import { useCareerActionPlan } from '@/hooks/queries/useCareerActionPlan';
import { useCareerBenchmark } from '@/hooks/queries/useCareerBenchmark';
import { useReadinessProgression } from '@/hooks/queries/useReadinessProgression';
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

/* ─── useCareerPathAnalysis ──────────────────────────────────────── */

describe('useCareerPathAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /recommendations/me/career-path/JOB/:id and returns data', async () => {
    const mockData = {
      opportunity: { id: '123', type: 'JOB', title: 'Backend Engineer' },
      readiness: { opportunityId: '123', opportunityType: 'JOB', opportunityTitle: 'Backend Engineer', readinessScore: 75, matchLevel: 'GOOD_MATCH', eligible: true, headline: 'Ready', matchedSkills: [], partialSkills: [], missingSkills: [], topGaps: [], recommendedActions: [], evidence: [] },
      skillComparison: [],
      strongestMatches: [],
      highestPriorityGaps: [],
      recommendedTrainings: [],
      recommendedMentor: null,
      nextActions: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useCareerPathAnalysis('JOB', '507f1f77bcf86cd799439011'), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me/career-path/JOB/507f1f77bcf86cd799439011');
    expect(result.current.data).toEqual(mockData);
  });

  it('calls /recommendations/me/career-path/INTERNSHIP/:id', async () => {
    const mockData = {
      opportunity: { id: '456', type: 'INTERNSHIP', title: 'Frontend Intern' },
      readiness: { opportunityId: '456', opportunityType: 'INTERNSHIP', opportunityTitle: 'Frontend Intern', readinessScore: 60, matchLevel: 'PARTIAL_MATCH', eligible: true, headline: 'Close', matchedSkills: [], partialSkills: [], missingSkills: [], topGaps: [], recommendedActions: [], evidence: [] },
      skillComparison: [],
      strongestMatches: [],
      highestPriorityGaps: [],
      recommendedTrainings: [],
      recommendedMentor: null,
      nextActions: [],
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useCareerPathAnalysis('INTERNSHIP', '507f1f77bcf86cd799439012'), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me/career-path/INTERNSHIP/507f1f77bcf86cd799439012');
  });

  it('does not fetch when type or id is missing', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useCareerPathAnalysis('' as never, ''), {
      wrapper: wrapper(client),
    });
    expect(result.current.isLoading).toBe(false);
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});

/* ─── useCareerActionPlan ─────────────────────────────────────────── */

describe('useCareerActionPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /recommendations/me/action-plan without params', async () => {
    const mockData = {
      actions: [
        { priority: 1, type: 'TRAINING', title: 'Complete React Training', reason: 'Covers gaps', ctaPath: '/training', ctaLabel: 'Start training' },
        { priority: 2, type: 'ASSESSMENT', title: 'Take assessment', reason: 'Verify skills', ctaPath: '/assessments', ctaLabel: 'Take assessment' },
      ],
      total: 2,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useCareerActionPlan(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me/action-plan');
    expect(result.current.data).toEqual(mockData);
  });

  it('calls /recommendations/me/action-plan with opportunity params', async () => {
    const mockData = {
      actions: [{ priority: 1, type: 'OPPORTUNITY', title: 'Apply to Backend Engineer', reason: 'Ready', ctaPath: '/jobs/123', ctaLabel: 'View opportunity' }],
      total: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useCareerActionPlan({ opportunityId: '507f1f77bcf86cd799439011', opportunityType: 'JOB' }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me/action-plan?opportunityId=507f1f77bcf86cd799439011&opportunityType=JOB');
  });
});

/* ─── useCareerBenchmark ──────────────────────────────────────────── */

describe('useCareerBenchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /recommendations/me/benchmark and returns available data', async () => {
    const mockData = {
      available: true,
      sampleSize: 25,
      studentAverageProficiency: 72,
      peerAverageProficiency: 65,
      studentSkillCount: 8,
      peerSkillCount: 6,
      categories: [
        { category: 'PROGRAMMING', studentScore: 80, peerScore: 70, verdict: 'STRONGER' },
      ],
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useCareerBenchmark(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me/benchmark');
    expect(result.current.data).toEqual(mockData);
  });

  it('returns unavailable when sample is insufficient', async () => {
    const mockData = {
      available: false,
      sampleSize: 2,
      unavailableReason: 'Benchmark unavailable due to insufficient data.',
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useCareerBenchmark(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.available).toBe(false);
  });
});

/* ─── useReadinessProgression ─────────────────────────────────────── */

describe('useReadinessProgression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls /recommendations/me/progression with currentScore', async () => {
    const mockData = {
      currentScore: 75,
      previousScore: 65,
      delta: 10,
      contributingFactors: ['Most recent assessment score used as baseline.'],
    };
    mockApiGet.mockResolvedValueOnce(mockData as never);
    const client = makeClient();
    const { result } = renderHook(() => useReadinessProgression(75), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiGet).toHaveBeenCalledWith('/recommendations/me/progression?currentScore=75');
    expect(result.current.data).toEqual(mockData);
  });

  it('does not fetch when currentScore is not a number', async () => {
    const client = makeClient();
    const { result } = renderHook(() => useReadinessProgression(NaN), {
      wrapper: wrapper(client),
    });
    expect(result.current.isLoading).toBe(false);
    expect(mockApiGet).not.toHaveBeenCalled();
  });
});
