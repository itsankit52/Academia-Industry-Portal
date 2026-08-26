import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Button from '../Button';

describe('Button', () => {
  it('renders default primary variant', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-indigo-600');
  });

  it.each([
    ['secondary', 'bg-slate-100'],
    ['outline', 'border-slate-300'],
    ['ghost', 'text-slate-700'],
    ['danger', 'bg-rose-600'],
  ] as const)('renders %s variant', (variant, cls) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(cls);
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const handler = vi.fn();
    render(<Button onClick={handler}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders iconLeft and iconRight', () => {
    render(
      <Button
        iconLeft={<span data-testid="icon-left" />}
        iconRight={<span data-testid="icon-right" />}
      >
        Submit
      </Button>,
    );
    expect(screen.getByTestId('icon-left')).toBeInTheDocument();
    expect(screen.getByTestId('icon-right')).toBeInTheDocument();
  });

  it('hides iconLeft while loading', () => {
    render(
      <Button loading iconLeft={<span data-testid="icon-left" />}>
        Save
      </Button>,
    );
    expect(screen.queryByTestId('icon-left')).not.toBeInTheDocument();
  });
});
