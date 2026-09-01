import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Register from '../Register';
import { renderWithProviders } from '@/test/renderWithProviders';

const hoisted = vi.hoisted(() => ({ mutate: vi.fn() }));

const INSTITUTION_ID = '507f1f77bcf86cd799439011';

vi.mock('@/hooks/mutations/useRegister', () => ({
  useRegister: () => ({ mutate: hoisted.mutate, isPending: false, error: null }),
}));

// The real hook reads from the mocked api client and would resolve to undefined,
// leaving the Institution select with nothing but its disabled placeholder — so a
// STUDENT signup could never satisfy the required institutionId.
vi.mock('@/hooks/queries/useInstitutionsCatalog', () => ({
  useInstitutionsCatalog: () => ({
    data: [{ id: INSTITUTION_ID, name: 'Test Institute', code: 'TI' }],
    isLoading: false,
  }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('Register page', () => {
  beforeEach(() => {
    hoisted.mutate.mockReset();
  });

  it('renders role selector with STUDENT and COMPANY options', () => {
    renderWithProviders(<Register />);
    // Anchored, because the FACULTY option's label ("Faculty — mentor students
    // & collaborate") also contains the word "students".
    expect(screen.getByLabelText(/^student/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^company/i)).toBeInTheDocument();
  });

  it('shows fullName field when STUDENT is selected', () => {
    renderWithProviders(<Register />);
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument();
  });

  it('shows companyName field when COMPANY is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.click(screen.getByLabelText(/company/i));
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
  });

  it('shows Zod validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
    expect(hoisted.mutate).not.toHaveBeenCalled();
  });

  it('calls useRegister mutation with valid data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.type(screen.getByLabelText(/full name/i), 'Jane Smith');
    await user.selectOptions(screen.getByLabelText(/university \/ institution/i), INSTITUTION_ID);
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1));
    expect(hoisted.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        fullName: 'Jane Smith',
        role: 'STUDENT',
      }),
    );
  });

  // Regression: selecting COMPANY unmounts the Full name input and the Institution
  // select, but react-hook-form keeps their '' values. Those two are optional in
  // registerSchema and `.optional()` does not admit '', so validation failed on
  // fields the company form does not render — no error was visible and no request
  // was made. Company signup was impossible through the UI.
  it('submits a COMPANY signup after the role was switched away from STUDENT', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    // Land on STUDENT first, so both student-only inputs mount and register ''.
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/university \/ institution/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/company/i));
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/university \/ institution/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/email address/i), 'hiring@acme.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1));
    // Exactly the company contract — no leftover keys from the student branch.
    expect(hoisted.mutate).toHaveBeenCalledWith({
      role: 'COMPANY',
      companyName: 'Acme Corp',
      email: 'hiring@acme.com',
      password: 'Password1!',
    });
  });

  it('shows the company-name error on the company form when it is left blank', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await user.click(screen.getByLabelText(/company/i));
    await user.type(screen.getByLabelText(/email address/i), 'hiring@acme.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // The point is that the error is attached to a field that is on screen,
    // rather than to the unmounted fullName/institutionId.
    expect(await screen.findByText(/companyName is required for COMPANY/i)).toBeInTheDocument();
    expect(hoisted.mutate).not.toHaveBeenCalled();
  });

  it('renders the INSTITUTION radio option', () => {
    renderWithProviders(<Register />);
    expect(screen.getByLabelText(/institution admin/i)).toBeInTheDocument();
  });

  it('shows institution-name, code, domain, address, city, state fields when INSTITUTION is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    await user.click(screen.getByLabelText(/institution admin/i));

    expect(screen.getByLabelText(/institution name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/institution code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/primary email domain/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^address$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^city$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^state$/i)).toBeInTheDocument();

    // STUDENT/COMPANY/FACULTY fields must not be visible.
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/company name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/university \/ institution/i)).not.toBeInTheDocument();
  });

  it('submits the correct INSTITUTION registration payload', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    await user.click(screen.getByLabelText(/institution admin/i));
    await user.type(screen.getByLabelText(/institution name/i), 'Mumbai Institute of Technology');
    await user.type(screen.getByLabelText(/institution code/i), 'MITBOM');
    await user.type(screen.getByLabelText(/primary email domain/i), 'mitbom.edu');
    await user.type(screen.getByLabelText(/^address$/i), '123 MG Road');
    await user.type(screen.getByLabelText(/^city$/i), 'Mumbai');
    await user.type(screen.getByLabelText(/^state$/i), 'Maharashtra');
    await user.type(screen.getByLabelText(/email address/i), 'admin@mitbom.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1));
    expect(hoisted.mutate).toHaveBeenCalledWith({
      role: 'INSTITUTION',
      institutionName: 'Mumbai Institute of Technology',
      institutionCode: 'MITBOM',
      institutionDomain: 'mitbom.edu',
      institutionAddress: '123 MG Road',
      institutionCity: 'Mumbai',
      institutionState: 'Maharashtra',
      email: 'admin@mitbom.edu',
      password: 'Password1!',
    });
  });

  it('shows validation errors when INSTITUTION required fields are missing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);

    await user.click(screen.getByLabelText(/institution admin/i));
    await user.type(screen.getByLabelText(/email address/i), 'admin@mitbom.edu');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // At least one of the required institution fields should show an error.
    const errors = await screen.findAllByRole('alert');
    expect(errors.length).toBeGreaterThan(0);
    expect(hoisted.mutate).not.toHaveBeenCalled();
  });
});
