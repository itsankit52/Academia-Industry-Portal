/**
 * Google onboarding modal — all four roles, role switching, validation,
 * API errors and duplicate-submit protection.
 *
 * Regression context (ISS-03): the STUDENT branch mounts first and leaves
 * `fullName: ''` / `institutionCode: ''` in react-hook-form state. Those used
 * to fail validation on fields the COMPANY / FACULTY / INSTITUTION branches do
 * not render, so "Create account" silently did nothing for three roles.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GoogleOnboardingModal from '../GoogleOnboardingModal';
import { renderWithProviders } from '@/test/renderWithProviders';
import { ApiClientError } from '@/lib/ApiClientError';

const INSTITUTION_ID = '507f1f77bcf86cd799439011';
const ID_TOKEN = 'header.payload.signature';

const hoisted = vi.hoisted(() => ({
  googleAuth: {
    mutateAsync: vi.fn(),
    isPending: false,
    isSuccess: false,
    error: null as Error | null,
  },
  apiGet: vi.fn(),
}));

vi.mock('@/hooks/mutations/useGoogleAuth', () => ({
  useGoogleAuth: () => hoisted.googleAuth,
}));

vi.mock('@/hooks/queries/useInstitutionsCatalog', () => ({
  useInstitutionsCatalog: () => ({
    data: [{ id: INSTITUTION_ID, name: 'Test Institute' }],
    isLoading: false,
  }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: hoisted.apiGet,
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const pendingData = {
  requiresOnboarding: true as const,
  email: 'new.user@example.test',
  name: 'Google Person',
};

function renderModal(overrides: Partial<Parameters<typeof GoogleOnboardingModal>[0]> = {}) {
  const onClose = vi.fn();
  renderWithProviders(
    <GoogleOnboardingModal
      isOpen
      onClose={onClose}
      pendingData={pendingData}
      idToken={ID_TOKEN}
      {...overrides}
    />,
  );
  return { onClose, user: userEvent.setup() };
}

const createButton = () =>
  screen.getByRole('button', { name: /^(create account|verify institution to continue)$/i });
const pickRole = (user: ReturnType<typeof userEvent.setup>, re: RegExp) =>
  user.click(screen.getByLabelText(re));
const sentPayload = () => hoisted.googleAuth.mutateAsync.mock.calls.at(-1)?.[0];

async function verifyStudentInstitution(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/university \/ institution/i), INSTITUTION_ID);
  await user.type(screen.getByLabelText(/institution code/i), 'AB12345');
  await user.click(screen.getByRole('button', { name: /verify institution code/i }));
  await screen.findByText(/institution verified/i);
}

beforeEach(() => {
  hoisted.googleAuth.mutateAsync.mockReset().mockResolvedValue({ user: { role: 'STUDENT' } });
  hoisted.googleAuth.isPending = false;
  hoisted.googleAuth.isSuccess = false;
  hoisted.googleAuth.error = null;
  hoisted.apiGet.mockReset().mockResolvedValue({
    valid: true,
    institution: { id: INSTITUTION_ID, name: 'Test Institute' },
  });
});

describe('GoogleOnboardingModal — visible fields per role', () => {
  it('shows the STUDENT fields by default', () => {
    renderModal();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/university \/ institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/institution code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument();
  });

  it.each([
    [/^company/i, [/company name/i], [/full name/i, /institution code/i, /institution name/i]],
    [
      /^faculty/i,
      [/full name/i, /university \/ institution/i, /designation/i, /department/i],
      [/company name/i, /institution code/i],
    ],
    [
      /^institution admin/i,
      [/institution name/i, /primary email domain/i, /^address/i, /^city/i, /^state/i],
      [/full name/i, /company name/i, /institution code/i],
    ],
  ])('switching to %s shows only that role’s fields', async (role, shown, hidden) => {
    const { user } = renderModal();
    await pickRole(user, role);
    for (const re of shown) expect(screen.getByLabelText(re)).toBeInTheDocument();
    for (const re of hidden) expect(screen.queryByLabelText(re)).not.toBeInTheDocument();
  });
});

describe('GoogleOnboardingModal — successful submission for all four roles', () => {
  it('STUDENT: submits only student fields after institution verification', async () => {
    const { user } = renderModal();
    await user.type(screen.getByLabelText(/full name/i), '  Jane Student  ');
    expect(createButton()).toBeDisabled();
    await verifyStudentInstitution(user);
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toEqual({
      idToken: ID_TOKEN,
      role: 'STUDENT',
      fullName: 'Jane Student',
      institutionId: INSTITUTION_ID,
      institutionCode: 'AB12345',
    });
  });

  it('STUDENT: a blank Full name falls back to the Google account name', async () => {
    const { user } = renderModal();
    await verifyStudentInstitution(user);
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({ role: 'STUDENT', fullName: 'Google Person' });
  });

  it('COMPANY: submits after the default STUDENT branch was rendered', async () => {
    const { user } = renderModal();
    await pickRole(user, /^company/i);
    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toEqual({ idToken: ID_TOKEN, role: 'COMPANY', companyName: 'Acme Corp' });
  });

  it('FACULTY: submits name, institution, designation and department', async () => {
    const { user } = renderModal();
    await pickRole(user, /^faculty/i);
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Faculty');
    await user.selectOptions(screen.getByLabelText(/university \/ institution/i), INSTITUTION_ID);
    await user.clear(screen.getByLabelText(/designation/i));
    await user.type(screen.getByLabelText(/designation/i), 'Professor');
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toEqual({
      idToken: ID_TOKEN,
      role: 'FACULTY',
      fullName: 'Dr. Faculty',
      institutionId: INSTITUTION_ID,
      designation: 'Professor',
      department: 'General',
    });
  });

  it('INSTITUTION: submits the new institution details only', async () => {
    const { user } = renderModal();
    await pickRole(user, /^institution admin/i);
    await user.type(screen.getByLabelText(/institution name/i), 'Acme Institute');
    await user.type(screen.getByLabelText(/primary email domain/i), 'acme.edu');
    await user.type(screen.getByLabelText(/^address/i), '1 Main Road');
    await user.type(screen.getByLabelText(/^city/i), 'Pune');
    await user.type(screen.getByLabelText(/^state/i), 'MH');
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toEqual({
      idToken: ID_TOKEN,
      role: 'INSTITUTION',
      institutionName: 'Acme Institute',
      institutionDomain: 'acme.edu',
      institutionAddress: '1 Main Road',
      institutionCity: 'Pune',
      institutionState: 'MH',
    });
  });
});

describe('GoogleOnboardingModal — role switching in both directions', () => {
  it('STUDENT → COMPANY: typed student values neither block nor leak into the payload', async () => {
    const { user } = renderModal();
    await user.type(screen.getByLabelText(/full name/i), 'Typed Then Abandoned');
    await user.type(screen.getByLabelText(/institution code/i), 'x');
    await pickRole(user, /^company/i);
    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toEqual({ idToken: ID_TOKEN, role: 'COMPANY', companyName: 'Acme Corp' });
  });

  it('INSTITUTION → STUDENT: institution values are dropped and student rules apply', async () => {
    const { user } = renderModal();
    await pickRole(user, /^institution admin/i);
    await user.type(screen.getByLabelText(/primary email domain/i), 'not a domain');
    await pickRole(user, /^student/i);
    await user.type(screen.getByLabelText(/full name/i), 'Back To Student');
    await verifyStudentInstitution(user);
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toEqual({
      idToken: ID_TOKEN,
      role: 'STUDENT',
      fullName: 'Back To Student',
      institutionId: INSTITUTION_ID,
      institutionCode: 'AB12345',
    });
  });

  it('COMPANY → FACULTY → COMPANY: errors from one role do not linger on another', async () => {
    const { user } = renderModal();
    await pickRole(user, /^company/i);
    await user.click(createButton());
    expect(await screen.findByText(/Please enter your company name\./)).toBeInTheDocument();
    await pickRole(user, /^faculty/i);
    expect(screen.queryByText(/companyName is required/i)).not.toBeInTheDocument();
    await pickRole(user, /^company/i);
    await user.type(screen.getByLabelText(/company name/i), 'Acme');
    await user.click(createButton());
    await waitFor(() => expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1));
  });
});

describe('GoogleOnboardingModal — validation messages', () => {
  it('COMPANY: blank company name shows a field error and sends nothing', async () => {
    const { user } = renderModal();
    await pickRole(user, /^company/i);
    await user.type(screen.getByLabelText(/company name/i), '   ');
    await user.click(createButton());
    expect(await screen.findByText(/Please enter your company name\./)).toBeInTheDocument();
    expect(hoisted.googleAuth.mutateAsync).not.toHaveBeenCalled();
  });

  it('FACULTY: blank name with no Google name to fall back on is reported on Full name', async () => {
    const { user } = renderModal({ pendingData: { ...pendingData, name: undefined } });
    await pickRole(user, /^faculty/i);
    await user.click(createButton());
    expect(await screen.findByText(/Please enter your full name\./)).toBeInTheDocument();
    expect(hoisted.googleAuth.mutateAsync).not.toHaveBeenCalled();
  });

  it('INSTITUTION: every missing field and an invalid domain are reported', async () => {
    const { user } = renderModal();
    await pickRole(user, /^institution admin/i);
    await user.type(screen.getByLabelText(/primary email domain/i), 'https://acme.edu/path');
    await user.click(createButton());
    expect(await screen.findByText(/Please enter the institution name\./)).toBeInTheDocument();
    expect(screen.getByText(/enter a domain like acme\.edu/i)).toBeInTheDocument();
    expect(screen.getByText(/Please enter the institution address\./)).toBeInTheDocument();
    expect(screen.getByText(/Please enter the city\./)).toBeInTheDocument();
    expect(screen.getByText(/Please enter the state\./)).toBeInTheDocument();
    expect(hoisted.googleAuth.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('GoogleOnboardingModal — API errors and submission state', () => {
  it('shows the API error message and pins field errors to their inputs', async () => {
    const apiError = new ApiClientError(
      'CONFLICT',
      'Duplicate value for field: domain',
      [{ path: 'institutionDomain', message: 'This domain is already registered' }],
      409,
    );
    hoisted.googleAuth.mutateAsync.mockRejectedValue(apiError);
    const { user } = renderModal();
    await pickRole(user, /^institution admin/i);
    await user.type(screen.getByLabelText(/institution name/i), 'Acme Institute');
    await user.type(screen.getByLabelText(/primary email domain/i), 'acme.edu');
    await user.type(screen.getByLabelText(/^address/i), '1 Main Road');
    await user.type(screen.getByLabelText(/^city/i), 'Pune');
    await user.type(screen.getByLabelText(/^state/i), 'MH');
    await user.click(createButton());
    expect(await screen.findByText('This domain is already registered')).toBeInTheDocument();
  });

  it('renders the hook error as an alert banner', () => {
    hoisted.googleAuth.error = new Error(
      'Google sign-in session has expired. Please sign in again.',
    );
    renderModal();
    expect(screen.getByRole('alert', { name: '' })).toBeInTheDocument();
    expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
  });

  it('prevents duplicate submissions while the request is in flight', async () => {
    let resolve!: (v: unknown) => void;
    hoisted.googleAuth.mutateAsync.mockImplementation(() => new Promise((r) => (resolve = r)));
    const { user } = renderModal();
    await pickRole(user, /^company/i);
    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await user.click(createButton());
    await waitFor(() => expect(createButton()).toBeDisabled());
    await user.click(createButton());
    await user.keyboard('{Enter}');
    expect(hoisted.googleAuth.mutateAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(/company name/i)).toBeDisabled();
    resolve({ user: { role: 'COMPANY' } });
  });

  it('stays locked after success and while the hook reports pending', () => {
    hoisted.googleAuth.isPending = true;
    renderModal();
    expect(createButton()).toBeDisabled();
    expect(screen.getByLabelText(/full name/i)).toBeDisabled();
  });

  it('cannot be dismissed while a request is in flight', async () => {
    hoisted.googleAuth.isPending = true;
    const { user, onClose } = renderModal();
    expect(screen.getByRole('button', { name: 'Cancel Google sign-up' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ISS-12: an accidental backdrop click or Escape used to throw away the form
// and the Google token. Only the labelled × closes the dialog now.
describe('GoogleOnboardingModal — accidental dismissal (ISS-12)', () => {
  const backdrop = () => document.querySelector('.fixed.inset-0 > [aria-hidden="true"]');

  it('ignores a backdrop click and keeps the entered values', async () => {
    const { user, onClose } = renderModal();
    await pickRole(user, /^company/i);
    await user.type(screen.getByLabelText(/company name/i), 'Acme Labs');

    expect(backdrop()).not.toBeNull();
    await user.click(backdrop() as Element);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toHaveValue('Acme Labs');
  });

  it('ignores Escape, before and after a validation error, and keeps the error', async () => {
    const { user, onClose } = renderModal();
    await user.keyboard('{Escape}');
    await pickRole(user, /^company/i);
    await user.click(createButton());
    const error = await screen.findByText(/Please enter your company name\./);
    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(error).toBeInTheDocument();
  });

  it('closes only through the labelled cancel button, which explains what it does', async () => {
    const { user, onClose } = renderModal();
    expect(
      screen.getByText(/closing this window \(×\) cancels Google sign-up/i),
    ).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Cancel Google sign-up' });
    expect(cancel).toBeEnabled();
    await user.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps keyboard access: Tab reaches the cancel button and fields', async () => {
    const { user } = renderModal();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Cancel Google sign-up' }),
    );
    await user.tab();
    expect(document.activeElement?.tagName).toBe('INPUT');
  });
});

// The shared Select used to auto-select the first institution (its disabled
// placeholder could not stay selected), so FACULTY could be attached to an
// institution the user never chose.
describe('GoogleOnboardingModal — institution must be chosen explicitly', () => {
  const institution = () =>
    screen.getByLabelText(/university \/ institution/i) as HTMLSelectElement;

  it('starts FACULTY on the "Select your institution" placeholder', async () => {
    const { user } = renderModal();
    await pickRole(user, /^faculty/i);
    expect(institution().value).toBe('');
    expect(institution().selectedOptions[0]?.textContent).toBe('Select your institution');
  });

  it('FACULTY without a chosen institution is blocked with a field error', async () => {
    const { user } = renderModal();
    await pickRole(user, /^faculty/i);
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Faculty');
    await user.click(createButton());
    expect(await screen.findByText(/Please select your institution\./)).toBeInTheDocument();
    expect(hoisted.googleAuth.mutateAsync).not.toHaveBeenCalled();
  });
});
