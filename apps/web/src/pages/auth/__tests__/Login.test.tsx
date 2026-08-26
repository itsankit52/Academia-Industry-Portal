import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Login from '../Login';
import { renderWithProviders } from '@/test/renderWithProviders';

const hoisted = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/hooks/mutations/useLogin', () => ({
  useLogin: () => ({ mutate: hoisted.mutate, isPending: false, error: null }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('Login page', () => {
  beforeEach(() => {
    hoisted.mutate.mockReset();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(hoisted.mutate).not.toHaveBeenCalled();
  });

  it('calls useLogin mutation with valid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1));
    expect(hoisted.mutate).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password1!',
    });
  });
});
