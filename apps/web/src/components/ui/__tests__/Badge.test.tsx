import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Badge from '../Badge';

describe('Badge', () => {
  it.each([
    ['default', 'bg-slate-100'],
    ['success', 'bg-emerald-50'],
    ['warning', 'bg-amber-50'],
    ['danger', 'bg-rose-50'],
    ['info', 'bg-sky-50'],
  ] as const)('renders %s variant with expected class', (variant, cls) => {
    render(<Badge variant={variant}>label</Badge>);
    expect(screen.getByText('label')).toHaveClass(cls);
  });

  it('applies small size classes', () => {
    render(<Badge size="sm">tag</Badge>);
    const el = screen.getByText('tag');
    expect(el).toHaveClass('px-2');
    expect(el).toHaveClass('text-xs');
  });

  it('applies medium size by default', () => {
    render(<Badge>tag</Badge>);
    expect(screen.getByText('tag')).toHaveClass('px-2.5');
  });

  it('merges custom className', () => {
    render(<Badge className="uppercase">tag</Badge>);
    expect(screen.getByText('tag')).toHaveClass('uppercase');
  });
});
