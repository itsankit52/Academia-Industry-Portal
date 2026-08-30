/**
 * Phase 9B — Tests for CareerInsightsSection and CareerActionPlanCard components.
 *
 * Coverage:
 * - CareerInsightsSection: readiness state, benchmark, progression, empty state
 * - CareerActionPlanCard: action rendering, priority, CTA, empty state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CareerInsightsSection } from '../CareerInsightsSection';
import { CareerActionPlanCard } from '../CareerActionPlanCard';
import type { CareerInsights, CareerBenchmark, ReadinessProgression, CareerAction } from '@aip/types';

const defaultInsights: CareerInsights = {
  readiness: { readinessScore: 75, level: 'Almost There', description: 'Almost there.' },
  currentLevel: 'Almost There',
  topStrengths: [{ skillId: '1', name: 'React', category: 'FRONTEND', proficiency: 'ADVANCED' }],
  topGaps: [{ id: '1', name: 'Python', category: 'BACKEND', demandScore: 3, priority: 'HIGH', reason: 'High demand', recommendedTrainingIds: [] }],
  recommendedNextAction: { priority: 1, type: 'TRAINING' as const, title: 'Complete Python Training', reason: 'Covers gaps', ctaPath: '/training', ctaLabel: 'Start training' },
  headline: 'Next: Complete Python Training.',
};

const defaultBenchmark: CareerBenchmark = {
  available: true,
  sampleSize: 25,
  studentAverageProficiency: 72,
  peerAverageProficiency: 65,
  studentSkillCount: 8,
  peerSkillCount: 6,
  categories: [{ category: 'PROGRAMMING', studentScore: 80, peerScore: 70, verdict: 'STRONGER' }],
};

const defaultProgression: ReadinessProgression = {
  currentScore: 75,
  previousScore: 65,
  delta: 10,
  contributingFactors: ['Most recent assessment score used as baseline.'],
};

function renderInsights(props: Partial<React.ComponentProps<typeof CareerInsightsSection>> = {}) {
  return render(
    <MemoryRouter>
      <CareerInsightsSection
        insights={props.insights ?? defaultInsights}
        benchmark={props.benchmark ?? defaultBenchmark}
        progression={props.progression ?? defaultProgression}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        onRetry={props.onRetry ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

/* ─── CareerInsightsSection ───────────────────────────────────────── */

describe('CareerInsightsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when isLoading', () => {
    renderInsights({ isLoading: true });
    // SkeletonCard has animate-pulse class
    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    renderInsights({ isError: true, onRetry });
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('renders readiness score and level', () => {
    renderInsights();
    expect(screen.getByText('75')).toBeTruthy();
    expect(screen.getByText('Almost There')).toBeTruthy();
  });

  it('renders headline', () => {
    renderInsights();
    expect(screen.getByText('Next: Complete Python Training.')).toBeTruthy();
  });

  it('renders top strengths', () => {
    renderInsights();
    expect(screen.getByText('React')).toBeTruthy();
  });

  it('renders top gaps', () => {
    renderInsights();
    expect(screen.getByText('Python')).toBeTruthy();
  });

  it('renders recommended next action with CTA', () => {
    renderInsights();
    expect(screen.getByText('Complete Python Training')).toBeTruthy();
    expect(screen.getByText('Start training')).toBeTruthy();
  });

  it('renders benchmark when available', () => {
    renderInsights();
    expect(screen.getByText('Peer Benchmark')).toBeTruthy();
    expect(screen.getByText('72%')).toBeTruthy();
  });

  it('renders benchmark unavailable state', () => {
    renderInsights({
      benchmark: { available: false, sampleSize: 2, unavailableReason: 'Benchmark unavailable due to insufficient data.' },
    });
    expect(screen.getByText('Benchmark unavailable due to insufficient data.')).toBeTruthy();
  });

  it('renders progression delta', () => {
    renderInsights();
    expect(screen.getByText('+10 points')).toBeTruthy();
  });

  it('renders empty state when no profile data', () => {
    renderInsights({
      insights: {
        readiness: { readinessScore: 0, level: 'Not Ready', description: '' },
        currentLevel: 'Not Ready',
        topStrengths: [],
        topGaps: [],
        recommendedNextAction: null,
        headline: 'Build your profile to unlock career insights.',
      },
      benchmark: undefined,
      progression: undefined,
    });
    expect(screen.getByText(/build your profile/i)).toBeTruthy();
  });

  it('renders action plan shortcut', () => {
    renderInsights();
    expect(screen.getByText('View action plan')).toBeTruthy();
  });
});

/* ─── CareerActionPlanCard ─────────────────────────────────────────── */

function renderActionPlan(props: Partial<React.ComponentProps<typeof CareerActionPlanCard>> = {}) {
  const defaultActions: CareerAction[] = [
    { priority: 1, type: 'TRAINING', title: 'Complete React Training', reason: 'Covers 3 gaps', ctaPath: '/training', ctaLabel: 'Start training' },
    { priority: 2, type: 'ASSESSMENT', title: 'Take Python assessment', reason: 'Verify skills', ctaPath: '/assessments', ctaLabel: 'Take assessment' },
    { priority: 3, type: 'MENTOR', title: 'Connect with John', reason: 'Expert in Python', ctaPath: '/mentorship', ctaLabel: 'Find mentor', entityId: 'mentor-1' },
    { priority: 4, type: 'OPPORTUNITY', title: 'Apply to Backend Engineer', reason: 'You match 8/10 skills', ctaPath: '/jobs/123', ctaLabel: 'View opportunity', entityId: 'job-123' },
    { priority: 5, type: 'SKILL', title: 'Add Docker to profile', reason: 'High demand gap', ctaPath: '/skills', ctaLabel: 'Add skill' },
  ];

  return render(
    <MemoryRouter>
      <CareerActionPlanCard
        actions={props.actions ?? defaultActions}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        onRetry={props.onRetry ?? vi.fn()}
        contextLabel={props.contextLabel}
      />
    </MemoryRouter>,
  );
}

describe('CareerActionPlanCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when isLoading', () => {
    renderActionPlan({ isLoading: true });
    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    renderActionPlan({ isError: true, onRetry });
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('renders all actions with priorities', () => {
    renderActionPlan();
    expect(screen.getByText('Complete React Training')).toBeTruthy();
    expect(screen.getByText('Take Python assessment')).toBeTruthy();
    expect(screen.getByText('Connect with John')).toBeTruthy();
    expect(screen.getByText('Apply to Backend Engineer')).toBeTruthy();
    expect(screen.getByText('Add Docker to profile')).toBeTruthy();
  });

  it('renders priority badges', () => {
    renderActionPlan();
    expect(screen.getAllByText('#1')).toBeTruthy();
    expect(screen.getAllByText('#2')).toBeTruthy();
  });

  it('renders action types as badges', () => {
    renderActionPlan();
    expect(screen.getAllByText('Training')).toBeTruthy();
    expect(screen.getAllByText('Assessment')).toBeTruthy();
    expect(screen.getAllByText('Mentor')).toBeTruthy();
    expect(screen.getAllByText('Opportunity')).toBeTruthy();
    expect(screen.getAllByText('Add skill')).toBeTruthy();
  });

  it('renders action reasons', () => {
    renderActionPlan();
    expect(screen.getByText('Covers 3 gaps')).toBeTruthy();
    expect(screen.getByText('Verify skills')).toBeTruthy();
  });

  it('renders CTAs for each action', () => {
    renderActionPlan();
    expect(screen.getAllByText('Start training')).toBeTruthy();
    expect(screen.getAllByText('Take assessment')).toBeTruthy();
  });

  it('renders context label when provided', () => {
    renderActionPlan({ contextLabel: 'Backend Developer' });
    expect(screen.getByText('for Backend Developer')).toBeTruthy();
  });

  it('renders empty state when no actions', () => {
    renderActionPlan({ actions: [] });
    expect(screen.getByText('Your action plan is empty')).toBeTruthy();
    expect(screen.getByText(/add a few skills/i)).toBeTruthy();
  });
});
