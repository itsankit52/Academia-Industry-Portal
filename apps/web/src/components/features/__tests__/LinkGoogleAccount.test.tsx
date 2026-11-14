/**
 * ISS-08: linking a Google account from Settings. Google Identity Services is
 * replaced by a button that hands over a token, exactly as the real
 * GoogleSignInButton's onToken does; the HTTP layer is stubbed at apiPost.
 */
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicUser } from '@aip/types';
import LinkGoogleAccount from '../LinkGoogleAccount';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ApiClientError } from '@/lib/ApiClientError';
import { useAuthStore } from '@/store/auth';

const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
const ID_TOKEN = `${b64url({ alg: 'RS256' })}.${b64url({ email: 'me@gmail.test' })}.sig`;
const PASSWORD = 'Secret@123';

const hoisted = vi.hoisted(() => ({ apiPost: vi.fn() }));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: hoisted.apiPost,
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('@/components/ui/GoogleSignInButton', () => ({
  default: ({ onToken, disabled }: { onToken: (t: string) => void; disabled?: boolean }) => (
    <button type="button" disabled={disabled} onClick={() => onToken(ID_TOKEN)}>
      Continue with Google
    </button>
  ),
}));

const baseUser: PublicUser = {
  id: 'u1',
  email: 'me@acadin.test',
  role: 'STUDENT',
  isActive: true,
  authProvider: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setUser(user: PublicUser | null) {
  act(() => {
    if (user) useAuthStore.getState().setUser(user);
    else useAuthStore.getState().clearUser();
  });
}

function renderCard() {
  renderWithProviders(<LinkGoogleAccount />);
  return userEvent.setup();
}

const linkButton = () => screen.getByRole('button', { name: 'Link Google account' });
const passwordInput = () => screen.getByLabelText(/current password/i);

async function chooseGoogle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
  await screen.findByText('me@gmail.test');
}

async function submitWith(user: ReturnType<typeof userEvent.setup>, password = PASSWORD) {
  await chooseGoogle(user);
  if (password) await user.type(passwordInput(), password);
  await user.click(linkButton());
}

const apiError = (status: number, message: string) =>
  new ApiClientError('X', message, undefined, status);

beforeEach(() => {
  hoisted.apiPost.mockReset();
  setUser(baseUser);
});

describe('LinkGoogleAccount', () => {
  it('explains linking and needs a Google account before it can submit', () => {
    renderCard();
    expect(
      screen.getByText(/sign in to AcadIn with your Google account as well as your password/i),
    ).toBeInTheDocument();
    expect(linkButton()).toBeDisabled();
  });

  it('links: sends the token and current password, updates the session user, shows success', async () => {
    hoisted.apiPost.mockResolvedValue({ user: { ...baseUser, authProvider: 'both' } });
    const user = renderCard();
    await submitWith(user);

    expect(hoisted.apiPost).toHaveBeenCalledTimes(1);
    expect(hoisted.apiPost).toHaveBeenCalledWith('/auth/google/link', {
      idToken: ID_TOKEN,
      currentPassword: PASSWORD,
    });
    expect(await screen.findByText(/google account linked/i)).toBeInTheDocument();
    expect(useAuthStore.getState().user?.authProvider).toBe('both');
    expect(screen.getByText(/Google sign-in is linked/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  it('missing current password: field error, no request', async () => {
    const user = renderCard();
    await submitWith(user, '');
    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
    expect(hoisted.apiPost).not.toHaveBeenCalled();
  });

  it('server 400 for a missing password lands on the password field', async () => {
    hoisted.apiPost.mockRejectedValue(
      apiError(400, 'currentPassword is required to link a Google account'),
    );
    const user = renderCard();
    await submitWith(user);
    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
  });

  it('incorrect password: field error, Google choice kept for a retry', async () => {
    hoisted.apiPost
      .mockRejectedValueOnce(apiError(403, 'Password confirmation failed'))
      .mockResolvedValueOnce({ user: { ...baseUser, authProvider: 'both' } });
    const user = renderCard();
    await submitWith(user, 'wrong');

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
    expect(screen.getByText('me@gmail.test')).toBeInTheDocument();

    await user.clear(passwordInput());
    await user.type(passwordInput(), PASSWORD);
    await user.click(linkButton());
    await waitFor(() => expect(hoisted.apiPost).toHaveBeenCalledTimes(2));
    expect(hoisted.apiPost.mock.calls[1]![1]).toEqual({
      idToken: ID_TOKEN,
      currentPassword: PASSWORD,
    });
  });

  it.each([
    ['expired token', 401, 'Google sign-in session has expired. Please sign in again.'],
    ['invalid token', 401, 'Google sign-in failed. Please try again.'],
    [
      'already-linked account',
      409,
      'Your AcadIn account is already linked to a different Google account.',
    ],
    [
      'identity owned by another user',
      409,
      'This Google account is already linked to a different AcadIn account.',
    ],
  ])('%s: shows the reason and asks for Google again', async (_label, status, message) => {
    hoisted.apiPost.mockRejectedValue(apiError(status, message));
    const user = renderCard();
    await submitWith(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('me@gmail.test')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(useAuthStore.getState().user?.authProvider).toBe('local');
  });

  it.each([
    ['ended session', 401, 'Authentication required', /session has ended/i],
    ['rate limit', 429, 'Too many requests', /too many attempts/i],
    ['wrong content type', 415, 'Unsupported Media Type', /expected format/i],
    ['rejected origin', 403, 'Cross-origin request rejected', /cross-origin request rejected/i],
  ])('%s: shows a clear message', async (_label, status, message, shown) => {
    hoisted.apiPost.mockRejectedValue(apiError(status, message));
    const user = renderCard();
    await submitWith(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(shown);
  });

  it('prevents duplicate submissions while the request is in flight', async () => {
    let resolve!: (v: unknown) => void;
    hoisted.apiPost.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = renderCard();
    await submitWith(user);

    await waitFor(() => expect(linkButton()).toBeDisabled());
    expect(passwordInput()).toBeDisabled();
    await user.click(linkButton());
    await user.type(passwordInput(), '{Enter}');
    expect(hoisted.apiPost).toHaveBeenCalledTimes(1);

    await act(async () => resolve({ user: { ...baseUser, authProvider: 'both' } }));
  });

  it('shows linked status and no form for an account that already has Google', () => {
    setUser({ ...baseUser, authProvider: 'both' });
    renderCard();
    expect(screen.getByText(/Google sign-in is linked/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Link Google account' })).not.toBeInTheDocument();
  });

  it('renders nothing without an authenticated session', () => {
    setUser(null);
    renderCard();
    expect(screen.queryByRole('button', { name: 'Link Google account' })).not.toBeInTheDocument();
    expect(screen.queryByText(/linking lets you/i)).not.toBeInTheDocument();
  });
});
