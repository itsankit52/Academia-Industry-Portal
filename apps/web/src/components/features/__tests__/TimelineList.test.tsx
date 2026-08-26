import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { TimelineEntry } from '@aip/types';
import TimelineList from '../TimelineList';

const entries: TimelineEntry[] = [
  { status: 'APPLIED', at: '2026-01-01T10:00:00Z' },
  { status: 'UNDER_REVIEW', at: '2026-01-02T10:00:00Z', note: 'HR is reviewing your profile' },
  { status: 'SHORTLISTED', at: '2026-01-03T10:00:00Z' },
  { status: 'INTERVIEW_SCHEDULED', at: '2026-01-04T10:00:00Z' },
  { status: 'SELECTED', at: '2026-01-05T10:00:00Z' },
];

describe('TimelineList', () => {
  it('renders every entry with its status label', () => {
    render(<TimelineList timeline={entries} />);
    expect(screen.getByText('Applied')).toBeInTheDocument();
    expect(screen.getByText('Under Review')).toBeInTheDocument();
    expect(screen.getByText('Shortlisted')).toBeInTheDocument();
    expect(screen.getByText('Interview Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('renders notes when provided', () => {
    render(<TimelineList timeline={entries} />);
    expect(screen.getByText('HR is reviewing your profile')).toBeInTheDocument();
  });

  it('renders empty when no entries', () => {
    const { container } = render(<TimelineList timeline={[]} />);
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });
});
