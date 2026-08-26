import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MATCH_THRESHOLDS } from '@aip/config';
import MatchBadge from '../MatchBadge';

describe('MatchBadge', () => {
  it('renders Strong Match for score 90', () => {
    const { container } = render(<MatchBadge score={90} />);
    expect(screen.getByText(/strong match/i)).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-emerald-50');
    expect(container.firstChild).toHaveClass('text-emerald-700');
  });

  it('renders Good Match for score 70', () => {
    const { container } = render(<MatchBadge score={70} />);
    expect(screen.getByText(/good match/i)).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-sky-50');
    expect(container.firstChild).toHaveClass('text-sky-700');
  });

  it('renders Partial Match for score 50', () => {
    const { container } = render(<MatchBadge score={50} />);
    expect(screen.getByText(/partial match/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-amber-50');
    expect(container.firstChild).toHaveClass('text-amber-700');
  });

  it('renders Low Match for score 20', () => {
    const { container } = render(<MatchBadge score={20} />);
    expect(screen.getByText(/low match/i)).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('bg-slate-100');
    expect(container.firstChild).toHaveClass('text-slate-600');
  });

  // The badge used to call 80 a strong match while the API called the same score
  // GOOD_MATCH, so the two disagreed for every score from 80 to 84.
  it('agrees with the API thresholds at the STRONG boundary', () => {
    render(<MatchBadge score={MATCH_THRESHOLDS.STRONG - 1} />);
    expect(screen.getByText(/good match/i)).toBeInTheDocument();
  });

  it('renders Strong Match exactly at the STRONG threshold', () => {
    render(<MatchBadge score={MATCH_THRESHOLDS.STRONG} />);
    expect(screen.getByText(/strong match/i)).toBeInTheDocument();
  });
});
