import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Register from '../Register';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * The sibling `Register.test.tsx` mocks `useInstitutionsCatalog` outright, so the
 * Institution select's real data path — hook, `apiGet`, envelope unwrapping — had
 * no coverage at all. That is the path behind "the dropdown opens but there is
 * nothing in it": whenever it yielded `undefined` or `[]`, the page rendered the
 * same disabled placeholder it shows while loading, with no error anywhere.
 *
 * These tests use the real hook and only stub the HTTP layer, so each of the
 * three states the select can be in is asserted on separately.
 */
const hoisted = vi.hoisted(() => ({ mutate: vi.fn(), apiGet: vi.fn() }));

vi.mock('@/hooks/mutations/useRegister', () => ({
  useRegister: () => ({ mutate: hoisted.mutate, isPending: false, error: null }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: hoisted.apiGet,
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const INSTITUTIONS = [
  { id: '507f1f77bcf86cd799439011', name: 'Alpha Institute of Technology' },
  { id: '507f1f77bcf86cd799439012', name: 'Beta University' },
  { id: '507f1f77bcf86cd799439013', name: 'Gamma College of Engineering' },
];

function institutionSelect(): HTMLSelectElement {
  // Matches the "University / Institution" select label (not the "Institution Admin" radio).
  return screen.getByLabelText(/university \/ institution/i) as HTMLSelectElement;
}

describe('Register — Institution select data path', () => {
  beforeEach(() => {
    hoisted.mutate.mockReset();
    hoisted.apiGet.mockReset();
    hoisted.apiGet.mockResolvedValue(INSTITUTIONS);
  });

  it('reads the catalogue from the public institutions endpoint', async () => {
    renderWithProviders(<Register />);
    await waitFor(() => expect(hoisted.apiGet).toHaveBeenCalledWith('/institutions/public'));
  });

  it('renders every institution the API returns as a selectable option', async () => {
    renderWithProviders(<Register />);

    await screen.findByRole('option', { name: 'Alpha Institute of Technology' });
    expect(screen.getByRole('option', { name: 'Beta University' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Gamma College of Engineering' }),
    ).toBeInTheDocument();

    const options = Array.from(institutionSelect().querySelectorAll('option'));
    // The placeholder plus one option per institution. The placeholder is an
    // empty-valued hidden option (not `disabled`: a disabled placeholder made
    // the browser select the first institution instead).
    expect(options.length).toBe(INSTITUTIONS.length + 1);
    expect(options[0]!.value).toBe('');
    expect(options[0]!.hidden).toBe(true);
    expect(options.filter((o) => o.disabled).length).toBe(0);
    expect(institutionSelect().disabled).toBe(false);
  });

  it('keeps the chosen institution selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Beta University' });

    await user.selectOptions(institutionSelect(), INSTITUTIONS[1]!.id);
    expect(institutionSelect().value).toBe(INSTITUTIONS[1]!.id);
  });

  it('never renders an institution code in any option label', async () => {
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Alpha Institute of Technology' });

    const labels = Array.from(institutionSelect().querySelectorAll('option')).map(
      (o) => o.textContent ?? '',
    );
    // No institution code, no parens-with-code, no ALPHATECH-style string in
    // any label. The catalogue the public API returns deliberately omits
    // `code` for the same reason.
    expect(labels.join('|')).not.toMatch(/ALPHATECH|BETAUNIV|GAMMACOE/);
    expect(labels.join('|')).not.toMatch(/\([A-Z0-9]+\)/);
  });

  it('reports a failed request instead of looking like an empty catalogue', async () => {
    hoisted.apiGet.mockRejectedValue(new Error('Network Error'));
    renderWithProviders(<Register />);

    const notice = await screen.findByText(/could not load the institution list/i);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toContain('Network Error');
  });

  /**
   * `apiGet` returns `envelope.data`, so a 200 whose body is not this API's
   * envelope resolves to `undefined` without throwing — which is what a static
   * host serving `index.html` for the XHR does when `VITE_API_URL` is missing
   * from the build. That used to be completely silent.
   */
  it('reports a 200 that did not carry the API envelope', async () => {
    hoisted.apiGet.mockResolvedValue(undefined);
    renderWithProviders(<Register />);

    const notice = await screen.findByText(/could not load the institution list/i);
    expect(notice.textContent).toContain('missing from the API response');
  });

  it('says so when the endpoint answers with an empty catalogue', async () => {
    hoisted.apiGet.mockResolvedValue([]);
    renderWithProviders(<Register />);

    expect(
      await screen.findByText(/no verified institutions are currently available/i),
    ).toBeInTheDocument();
    // An empty catalogue is not an error, so no error styling is applied.
    expect(screen.queryByText(/could not load the institution list/i)).not.toBeInTheDocument();
  });

  it('leaves the FACULTY branch on the same working select', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Beta University' });

    await user.click(screen.getByLabelText(/^faculty/i));
    expect(institutionSelect()).toBeInTheDocument();
    await user.selectOptions(institutionSelect(), INSTITUTIONS[0]!.id);
    expect(institutionSelect().value).toBe(INSTITUTIONS[0]!.id);
    expect(screen.getByLabelText(/designation/i)).toBeInTheDocument();
  });

  it('leaves the COMPANY branch without an Institution field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Beta University' });

    await user.click(screen.getByLabelText(/^company/i));
    expect(screen.queryByLabelText(/university \/ institution/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/company name/i), 'Acme Corp');
    await user.type(screen.getByLabelText(/email address/i), 'hiring@acme.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1));
    expect(hoisted.mutate).toHaveBeenCalledWith({
      role: 'COMPANY',
      companyName: 'Acme Corp',
      email: 'hiring@acme.com',
      password: 'Password1!',
    });
  });

  it('still blocks a STUDENT submit while no institution is chosen', async () => {
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Beta University' });

    // The submit button is disabled for STUDENT until the institution code is verified.
    // The blocking is the disabled button, not a Zod validation error shown after
    // submission — the form cannot be submitted until verification completes.
    const submitButton = screen.getByRole('button', { name: /create account/i });
    expect(submitButton).toBeDisabled();
    expect(hoisted.mutate).not.toHaveBeenCalled();
  });
});

// The placeholder used to be `disabled`, so once the catalogue arrived the
// browser selected the first institution on its own: a FACULTY user who never
// touched the field was registered at "Alpha Institute of Technology".
describe('Register — institution must be chosen explicitly', () => {
  beforeEach(() => {
    hoisted.mutate.mockReset();
    hoisted.apiGet.mockReset();
    hoisted.apiGet.mockResolvedValue(INSTITUTIONS);
  });

  async function fillFaculty(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByLabelText(/^faculty/i));
    await user.type(screen.getByLabelText(/full name/i), 'Dr. Faculty');
    await user.type(screen.getByLabelText(/email address/i), 'faculty@uni.test');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1!');
  }

  it('keeps the placeholder selected after the institutions load', async () => {
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Alpha Institute of Technology' });
    expect(institutionSelect().value).toBe('');
    expect(institutionSelect().selectedOptions[0]?.textContent).toBe(
      'Select your university / institution',
    );
  });

  it('FACULTY without a chosen institution is blocked with a field error', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Beta University' });
    await fillFaculty(user);
    expect(institutionSelect().value).toBe('');

    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/Please select your institution\./)).toBeInTheDocument();
    expect(hoisted.mutate).not.toHaveBeenCalled();
  });

  it('FACULTY with an explicitly chosen institution sends that institution', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Register />);
    await screen.findByRole('option', { name: 'Beta University' });
    await fillFaculty(user);
    await user.selectOptions(institutionSelect(), INSTITUTIONS[1]!.id);

    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(hoisted.mutate).toHaveBeenCalledTimes(1));
    expect(hoisted.mutate.mock.calls[0]![0]).toMatchObject({
      role: 'FACULTY',
      fullName: 'Dr. Faculty',
      institutionId: INSTITUTIONS[1]!.id,
    });
  });
});
