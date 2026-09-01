/**
 * Phase 10 — Tests for placement UI components.
 *
 * Coverage:
 * - PlacementReadinessCard: loading skeleton, error state, empty state, full
 *   readiness display, compact mode, insufficient-data flag, strengths/blockers
 * - OutcomeFunnel: loading skeleton, error state, empty state, funnel steps,
 *   metric tiles, insufficient data
 * - InstitutionInterventionsPanel: loading, error, empty (no students), all-clear
 *   (no interventions), severity filter, intervention rows
 * - SkillOutcomeChart: loading, error, insufficient-data, chart with data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlacementReadinessCard } from '../PlacementReadinessCard';
import { OutcomeFunnel } from '../OutcomeFunnel';
import { InstitutionInterventionsPanel } from '../InstitutionInterventionsPanel';
import { SkillOutcomeChart } from '../SkillOutcomeChart';
import type {
  PlacementReadiness,
  PlacementOutcomes,
  InstitutionInterventions,
  SkillOutcomeAnalytics,
} from '@aip/types';

/* ─── Fixtures ─────────────────────────────────────────────────── */

const fullReadiness: PlacementReadiness = {
  studentUserId: 'student-1',
  overallScore: 72,
  readinessLevel: 'NEARLY_READY',
  readinessLabel: 'Nearly Ready',
  readinessDescription: 'A few improvements will lock in placement readiness.',
  componentScores: [
    {
      key: 'SKILLS',
      label: 'Skills',
      score: 80,
      weight: 0.3,
      contribution: 24,
      evidence: ['Strong proficiency in React, TypeScript.'],
    },
    {
      key: 'ASSESSMENTS',
      label: 'Assessments',
      score: 65,
      weight: 0.2,
      contribution: 13,
      evidence: ['Average assessment score: 65% across 2 assessments.'],
    },
    {
      key: 'INDUSTRY_ALIGNMENT',
      label: 'Industry Alignment',
      score: 70,
      weight: 0.15,
      contribution: 10.5,
      evidence: ['Aligns with 3 of 10 industry-required skills.'],
    },
    {
      key: 'TRAINING',
      label: 'Training',
      score: 40,
      weight: 0.1,
      contribution: 4,
      evidence: ['No completed trainings yet.'],
    },
    {
      key: 'INTERNSHIP_EXPERIENCE',
      label: 'Internship Experience',
      score: 60,
      weight: 0.1,
      contribution: 6,
      evidence: ['Completed 1 internship.'],
    },
    {
      key: 'CAREER_TARGET',
      label: 'Career Target',
      score: 50,
      weight: 0.1,
      contribution: 5,
      evidence: ['Target role readiness: 50%.'],
    },
    {
      key: 'APPLICATION_HISTORY',
      label: 'Application History',
      score: 20,
      weight: 0.05,
      contribution: 1,
      evidence: ['Only 1 application on file.'],
    },
  ],
  strengths: [
    {
      key: 'skill:react',
      label: 'Strong in React',
      value: '80/100',
      detail: 'Recorded at ADVANCED proficiency.',
    },
    { key: 'component:SKILLS', label: 'Skills is strong', value: '80/100' },
  ],
  blockers: [
    {
      key: 'component:APPLICATION_HISTORY',
      label: 'Application History is below the floor',
      severity: 'HIGH',
      reason: 'Only 1 application on file.',
    },
    {
      key: 'experience:low',
      label: 'Limited industry exposure',
      severity: 'MEDIUM',
      reason: 'No completed trainings and no internship experience on file.',
    },
  ],
  recommendedNextActions: [
    {
      type: 'OPPORTUNITY',
      title: 'Apply to an internship',
      reason: 'Internship experience is one of the strongest placement-readiness signals.',
      ctaPath: '/student/internships',
      ctaLabel: 'Browse internships',
    },
    {
      type: 'TRAINING',
      title: 'Enroll in an industry training program',
      reason: 'Completed trainings add an industry-aligned signal.',
      ctaPath: '/student/training',
      ctaLabel: 'Browse trainings',
    },
  ],
  generatedAt: new Date().toISOString(),
  insufficientData: false,
  insufficientReasons: [],
};

const emptyReadiness: PlacementReadiness = {
  ...fullReadiness,
  overallScore: 0,
  componentScores: [],
};

const insufficientReadiness: PlacementReadiness = {
  ...fullReadiness,
  insufficientData: true,
  insufficientReasons: ['No skills on profile.', 'No evaluated assessments.'],
};

const fullOutcomes: PlacementOutcomes = {
  studentUserId: 'student-1',
  totalApplications: 10,
  shortlistedCount: 3,
  interviewCount: 2,
  selectedCount: 1,
  acceptedCount: 1,
  rejectedCount: 1,
  offerExpiredCount: 0,
  withdrawnCount: 0,
  successRate: 10,
  interviewRate: 20,
  selectionRate: 50,
  funnel: [
    { category: 'APPLIED', label: 'Applied', count: 10 },
    { category: 'SHORTLISTED', label: 'Shortlisted', count: 3 },
    { category: 'INTERVIEW', label: 'Interview', count: 2 },
    { category: 'SELECTED', label: 'Selected', count: 1 },
    { category: 'OFFER_ACCEPTED', label: 'Offer Accepted', count: 1 },
  ],
  generatedAt: new Date().toISOString(),
  insufficientData: false,
};

const zeroOutcomes: PlacementOutcomes = {
  ...fullOutcomes,
  totalApplications: 0,
  funnel: [],
  insufficientData: true,
};

const fullInterventions: InstitutionInterventions = {
  institutionId: 'inst-1',
  totalStudents: 20,
  flaggedCount: 3,
  interventions: [
    {
      studentUserId: 'st-1',
      studentName: 'Alice Smith',
      branch: 'Computer Science',
      readinessScore: 28,
      readinessLevel: 'NOT_READY',
      interventionType: 'LOW_READINESS',
      severity: 'CRITICAL',
      reason: 'Overall placement readiness score is 28 (NOT_READY).',
      recommendedAction:
        'Review the readiness breakdown. Focus on closing the highest-weight gaps first.',
    },
    {
      studentUserId: 'st-2',
      studentName: 'Bob Jones',
      branch: 'Electronics',
      readinessScore: 42,
      readinessLevel: 'NEEDS_IMPROVEMENT',
      interventionType: 'NO_INTERNSHIP',
      severity: 'MEDIUM',
      reason: 'No internship applications or experience on file.',
      recommendedAction: 'Encourage applying to internships to gain industry exposure.',
    },
  ],
  bySeverity: { CRITICAL: 1, HIGH: 0, MEDIUM: 1, LOW: 0 },
  generatedAt: new Date().toISOString(),
};

const emptyInterventions: InstitutionInterventions = {
  institutionId: 'inst-1',
  totalStudents: 20,
  flaggedCount: 0,
  interventions: [],
  bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  generatedAt: new Date().toISOString(),
};

const noStudentsInterventions: InstitutionInterventions = {
  institutionId: 'inst-1',
  totalStudents: 0,
  flaggedCount: 0,
  interventions: [],
  bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  generatedAt: new Date().toISOString(),
};

const fullSkillAnalytics: SkillOutcomeAnalytics = {
  institutionId: 'inst-1',
  metrics: [
    {
      skillId: 'skill-1',
      name: 'React',
      skillDemandCount: 10,
      opportunityCount: 10,
      applicantsWithSkill: 8,
      selectedWithSkill: 5,
      selectionRate: 62.5,
      skillOutcomeStrength: 85,
    },
    {
      skillId: 'skill-2',
      name: 'TypeScript',
      skillDemandCount: 8,
      opportunityCount: 8,
      applicantsWithSkill: 6,
      selectedWithSkill: 3,
      selectionRate: 50,
      skillOutcomeStrength: 70,
    },
    {
      skillId: 'skill-3',
      name: 'Python',
      skillDemandCount: 5,
      opportunityCount: 5,
      applicantsWithSkill: 10,
      selectedWithSkill: 2,
      selectionRate: 20,
      skillOutcomeStrength: 30,
    },
  ],
  insufficientData: false,
  insufficientReasons: [],
  minimumSampleSize: 5,
  generatedAt: new Date().toISOString(),
};

const insufficientSkillAnalytics: SkillOutcomeAnalytics = {
  institutionId: 'inst-1',
  metrics: [],
  insufficientData: true,
  insufficientReasons: ['No application data for any skills.'],
  minimumSampleSize: 5,
  generatedAt: new Date().toISOString(),
};

/* ─── PlacementReadinessCard ─────────────────────────────────────── */

function renderReadinessCard(
  props: Partial<React.ComponentProps<typeof PlacementReadinessCard>> = {},
) {
  return render(
    <MemoryRouter>
      <PlacementReadinessCard
        data={props.data ?? fullReadiness}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        onRetry={props.onRetry ?? vi.fn()}
        compact={props.compact ?? false}
      />
    </MemoryRouter>,
  );
}

describe('PlacementReadinessCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when isLoading', () => {
    renderReadinessCard({ isLoading: true });
    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it('shows error state when isError', () => {
    const onRetry = vi.fn();
    renderReadinessCard({ isError: true, onRetry });
    // ErrorState renders "Please try again" (description) and "Try again" (button)
    expect(screen.getAllByText(/try again/i)).toHaveLength(2);
  });

  it('shows empty state when no score and no components', () => {
    renderReadinessCard({ data: emptyReadiness });
    expect(screen.getByText(/no readiness data/i)).toBeTruthy();
  });

  it('renders overall score and readiness level', () => {
    renderReadinessCard({ data: fullReadiness });
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText('Nearly Ready')).toBeTruthy();
  });

  it('renders component scores', () => {
    renderReadinessCard({ data: fullReadiness });
    expect(screen.getByText('Skills')).toBeTruthy();
    expect(screen.getByText('Assessments')).toBeTruthy();
  });

  it('renders strengths when present', () => {
    renderReadinessCard({ data: fullReadiness });
    expect(screen.getByText((content) => String(content).includes('Strong in React'))).toBeTruthy();
  });

  it('renders blockers with severity', () => {
    renderReadinessCard({ data: fullReadiness });
    expect(
      screen.getByText((content) =>
        String(content).includes('Application History is below the floor'),
      ),
    ).toBeTruthy();
    expect(screen.getByText('HIGH')).toBeTruthy();
  });

  it('renders next actions with CTA paths', () => {
    renderReadinessCard({ data: fullReadiness });
    expect(
      screen.getByText((content) => String(content).includes('Apply to an internship')),
    ).toBeTruthy();
  });

  it('renders insufficient-data badge when flagged', () => {
    renderReadinessCard({ data: insufficientReadiness });
    expect(
      screen.getByText((content) => String(content).includes('Insufficient data')),
    ).toBeTruthy();
  });

  it('compact mode hides breakdown', () => {
    renderReadinessCard({ data: fullReadiness, compact: true });
    // Breakdown section has "Score Breakdown" heading — must not appear in compact mode
    expect(screen.queryByText(/Score Breakdown/i)).toBeNull();
  });
});

/* ─── OutcomeFunnel ─────────────────────────────────────────────── */

function renderFunnel(props: Partial<React.ComponentProps<typeof OutcomeFunnel>> = {}) {
  return render(
    <MemoryRouter>
      <OutcomeFunnel
        data={props.data ?? fullOutcomes}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        onRetry={props.onRetry ?? vi.fn()}
        title={props.title ?? 'Application Funnel'}
        variant={props.variant ?? 'student'}
      />
    </MemoryRouter>,
  );
}

describe('OutcomeFunnel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when isLoading', () => {
    renderFunnel({ isLoading: true });
    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it('shows error state when isError', () => {
    const onRetry = vi.fn();
    renderFunnel({ isError: true, onRetry });
    // ErrorState renders "Please try again" (description) and "Try again" (button)
    expect(screen.getAllByText(/try again/i)).toHaveLength(2);
  });

  it('shows empty state when no applications', () => {
    renderFunnel({ data: zeroOutcomes });
    expect(screen.getByText(/no application data yet/i)).toBeTruthy();
  });

  it('renders funnel steps', () => {
    renderFunnel({ data: fullOutcomes });
    expect(screen.getByText('Applications')).toBeTruthy();
    expect(screen.getByText('Shortlisted')).toBeTruthy();
    expect(screen.getByText('Interview')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByText('Accepted')).toBeTruthy();
  });

  it('renders funnel counts', () => {
    renderFunnel({ data: fullOutcomes });
    expect(screen.getByText('10')).toBeTruthy(); // Applied
    expect(screen.getByText('3')).toBeTruthy(); // Shortlisted
  });

  it('renders rate tiles', () => {
    renderFunnel({ data: fullOutcomes });
    expect(screen.getByText('Success Rate')).toBeTruthy();
    expect(screen.getByText('Interview Rate')).toBeTruthy();
    expect(screen.getByText('Selection Rate')).toBeTruthy();
  });

  it('shows correct default title', () => {
    renderFunnel();
    expect(screen.getByText('Application Funnel')).toBeTruthy();
  });

  it('shows custom title', () => {
    renderFunnel({ title: 'Institution Funnel' });
    expect(screen.getByText('Institution Funnel')).toBeTruthy();
  });
});

/* ─── InstitutionInterventionsPanel ────────────────────────────── */

function renderInterventions(
  props: Partial<React.ComponentProps<typeof InstitutionInterventionsPanel>> = {},
) {
  return render(
    <MemoryRouter>
      <InstitutionInterventionsPanel
        data={props.data ?? fullInterventions}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        onRetry={props.onRetry ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('InstitutionInterventionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when isLoading', () => {
    renderInterventions({ isLoading: true });
    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it('shows error state when isError', () => {
    const onRetry = vi.fn();
    renderInterventions({ isError: true, onRetry });
    // ErrorState renders "Please try again" (description) and "Try again" (button)
    expect(screen.getAllByText(/try again/i)).toHaveLength(2);
  });

  it('shows empty state when no students', () => {
    renderInterventions({ data: noStudentsInterventions });
    expect(screen.getByText(/no students yet/i)).toBeTruthy();
  });

  it('shows all-clear when no interventions but students exist', () => {
    renderInterventions({ data: emptyInterventions });
    expect(screen.getByText(/all clear/i)).toBeTruthy();
  });

  it('renders intervention rows with severity', () => {
    renderInterventions({ data: fullInterventions });
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('CRITICAL')).toBeTruthy();
    // interventionType is formatted with spaces: LOW_READINESS → "LOW READINESS"
    expect(screen.getByText('LOW READINESS')).toBeTruthy();
  });

  it('renders student branch when present', () => {
    renderInterventions({ data: fullInterventions });
    expect(screen.getByText(/Computer Science/i)).toBeTruthy();
  });

  it('renders reason text', () => {
    renderInterventions({ data: fullInterventions });
    expect(screen.getByText(/Overall placement readiness score is 28/i)).toBeTruthy();
  });

  it('renders recommended action', () => {
    renderInterventions({ data: fullInterventions });
    expect(screen.getByText(/Review the readiness breakdown/i)).toBeTruthy();
  });

  it('shows severity filter buttons', () => {
    renderInterventions({ data: fullInterventions });
    expect(screen.getByText('All')).toBeTruthy();
    // CRITICAL has count 1 and MEDIUM has count 1 — rendered as "CRITICAL (1)" and "MEDIUM (1)"
    const critBtns = screen.getAllByText((content) => String(content).includes('CRITICAL'));
    expect(critBtns.length).toBeGreaterThan(0);
  });
});

/* ─── SkillOutcomeChart ──────────────────────────────────────────── */

function renderSkillChart(props: Partial<React.ComponentProps<typeof SkillOutcomeChart>> = {}) {
  return render(
    <MemoryRouter>
      <SkillOutcomeChart
        data={props.data ?? fullSkillAnalytics}
        isLoading={props.isLoading ?? false}
        isError={props.isError ?? false}
        onRetry={props.onRetry ?? vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe('SkillOutcomeChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when isLoading', () => {
    renderSkillChart({ isLoading: true });
    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it('shows error state when isError', () => {
    const onRetry = vi.fn();
    renderSkillChart({ isError: true, onRetry });
    // ErrorState renders "Please try again" (description) and "Try again" (button)
    expect(screen.getAllByText(/try again/i)).toHaveLength(2);
  });

  it('shows insufficient-data state when insufficient', () => {
    renderSkillChart({ data: insufficientSkillAnalytics });
    expect(screen.getByText(/insufficient data/i)).toBeTruthy();
  });

  it('renders chart when data is available', () => {
    renderSkillChart({ data: fullSkillAnalytics });
    expect(screen.getByText('Skill Outcome Intelligence')).toBeTruthy();
    expect(screen.getByText('Top 3 skills')).toBeTruthy();
  });

  it('renders skill names in top-3 tiles', () => {
    renderSkillChart({ data: fullSkillAnalytics });
    expect(screen.getByText('React')).toBeTruthy();
    expect(screen.getByText('TypeScript')).toBeTruthy();
  });

  it('renders association disclaimer', () => {
    renderSkillChart({ data: fullSkillAnalytics });
    // The disclaimer text contains "association" in the text and in the explanation
    expect(
      screen.getAllByText((content) => String(content).toLowerCase().includes('association')),
    ).toHaveLength(2);
  });

  it('renders strength badges for top skills', () => {
    renderSkillChart({ data: fullSkillAnalytics });
    // React has strength 85 → Strong (success)
    // TypeScript has strength 70 → Strong (success)
    // Python has strength 30 → Weak (default)
    expect(screen.getAllByText('Strong')).toHaveLength(2);
  });
});
