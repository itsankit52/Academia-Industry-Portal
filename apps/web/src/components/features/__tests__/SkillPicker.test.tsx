import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@aip/config';
import SkillPicker from '../SkillPicker';
import { renderWithProviders } from '@/test/renderWithProviders';
import { apiGet } from '@/lib/api';
import type { Paginated, Skill } from '@aip/types';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

/**
 * The skill picker, against a fake `/skills` that paginates the way the real one
 * does.
 *
 * The reported symptom was that typing into Required/Preferred Skills produced no
 * options to click, which then made "Select at least one required skill" unavoidable
 * — so these tests exercise the whole path the company user actually walks: fetch
 * the catalogue, type, click an option, and see the selection stick.
 *
 * The fixture is 38 names in alphabetical order, like the seed, because the cause
 * was arithmetic: `/skills` served `DEFAULT_PAGE_SIZE` (12) rows and the picker
 * filters what it was given, so only the first twelve were ever searchable.
 */

const NAMES = [
  // The alphabetically-first twelve — everything the picker used to be able to find.
  'aws', 'azure', 'c++', 'ci/cd', 'communication', 'css',
  'django', 'docker', 'express', 'fastapi', 'flutter', 'gcp',
  // ...and the twenty-six that answered "No skills found."
  'git', 'go', 'graphql', 'html', 'java', 'javascript', 'jenkins', 'kotlin',
  'kubernetes', 'leadership', 'mongodb', 'mysql', 'next.js', 'node.js', 'numpy',
  'pandas', 'postgresql', 'python', 'pytorch', 'react', 'redis', 'rest api',
  'spring boot', 'sql', 'swift', 'typescript',
];

const CATALOGUE: Skill[] = NAMES.map((name, i): Skill => ({
  id: `000000000000000000000${String(i).padStart(3, '0')}`,
  name,
  category: 'PROGRAMMING',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}));

function idOfName(name: string): string {
  const skill = CATALOGUE.find((s) => s.name === name);
  if (!skill) throw new Error(`fixture has no skill named ${name}`);
  return skill.id;
}

/**
 * Stands in for `GET /skills`, including the part that caused the bug: when the
 * caller sends no `pageSize`, `applyPagination` falls back to `DEFAULT_PAGE_SIZE`.
 * Honouring that default here is what makes these regression tests rather than
 * restatements — with the old one-page request they fail.
 *
 * `cap` mimics a server whose maximum page is smaller than the catalogue, so the
 * hook's `totalPages` loop can be exercised too.
 */
function serveSkills(cap = MAX_PAGE_SIZE) {
  return (url: string): Promise<Paginated<Skill>> => {
    const query = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    const params = new URLSearchParams(query);
    const requested = Number(params.get('pageSize') ?? DEFAULT_PAGE_SIZE);
    const pageSize = Math.min(requested, cap);
    const page = Number(params.get('page') ?? 1);
    const start = (page - 1) * pageSize;
    return Promise.resolve({
      items: CATALOGUE.slice(start, start + pageSize),
      page,
      pageSize,
      total: CATALOGUE.length,
      totalPages: Math.ceil(CATALOGUE.length / pageSize),
    });
  };
}

/** A controlled host, because `SkillPicker` owns no selection state of its own. */
function Field({
  label = 'Required Skills',
  onChange,
}: {
  label?: string;
  onChange?: (ids: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <SkillPicker
      label={label}
      value={value}
      onChange={(ids) => {
        setValue(ids);
        onChange?.(ids);
      }}
    />
  );
}

/** The whole accessible name of an option is "<name> <category>". */
function optionNamed(name: string): RegExp {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`, 'i');
}

async function typeInto(label: RegExp | string, text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(label), text);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(apiGet).mockImplementation(serveSkills() as never);
});

describe('SkillPicker — catalogue request', () => {
  it('asks for the whole catalogue instead of taking the default page', async () => {
    renderWithProviders(<Field />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    const url = String(vi.mocked(apiGet).mock.calls[0]![0]);
    // Without an explicit pageSize the server would answer with twelve rows.
    expect(url).toContain(`pageSize=${MAX_PAGE_SIZE}`);
    expect(url).toContain('status=ACTIVE');
  });

  it('follows totalPages when one page cannot hold the catalogue', async () => {
    vi.mocked(apiGet).mockImplementation(serveSkills(10) as never);
    renderWithProviders(<Field />);

    // 38 skills at 10 per page: the first request plus three more.
    await waitFor(() => expect(vi.mocked(apiGet).mock.calls).toHaveLength(4));
    await typeInto(/required skills/i, 'typescript');
    // `typescript` sorts last of the 38, so it only appears if every page was read.
    expect(await screen.findByRole('option', { name: optionNamed('typescript') })).toBeInTheDocument();
  });
});

describe('SkillPicker — searching', () => {
  it('shows matching skills in a dropdown', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    // Nothing is offered until the user types — the panel is gated on the query.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    await typeInto(/required skills/i, 'docker');

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: optionNamed('docker') })).toBeInTheDocument();
  });

  it('finds a skill that lies beyond the default first page', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    // This is the reported symptom, verbatim: `react` is the 33rd name, so the
    // twelve-row response could never contain it and the panel said "No skills
    // found." — leaving the company nothing to click.
    await typeInto(/required skills/i, 'react');

    expect(await screen.findByRole('option', { name: optionNamed('react') })).toBeInTheDocument();
    expect(screen.queryByText(/no skills found/i)).not.toBeInTheDocument();
  });

  it('narrows to every match, not just the first', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'script');

    await screen.findByRole('listbox');
    expect(screen.getAllByRole('option')).toHaveLength(2); // javascript, typescript
  });
});

describe('SkillPicker — selecting', () => {
  it('adds a clicked skill to the form value and keeps it visible', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Field onChange={onChange} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'react');
    await user.click(await screen.findByRole('option', { name: optionNamed('react') }));

    // The form value is what the `.min(1)` rule reads, so this is the assertion
    // that "Select at least one required skill" is satisfied.
    expect(onChange).toHaveBeenCalledWith([idOfName('react')]);
    // And the chip stays on screen after the panel closes.
    expect(await screen.findByRole('button', { name: /remove react/i })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('accumulates several skills rather than replacing the selection', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Field onChange={onChange} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'react');
    await user.click(await screen.findByRole('option', { name: optionNamed('react') }));
    await user.type(screen.getByLabelText(/required skills/i), 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));

    expect(onChange).toHaveBeenCalledWith([idOfName('react'), idOfName('python')]);
    expect(screen.getByRole('button', { name: /remove react/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove python/i })).toBeInTheDocument();
  });

  it('stops offering a skill that is already selected', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'react');
    await user.click(await screen.findByRole('option', { name: optionNamed('react') }));
    await user.type(screen.getByLabelText(/required skills/i), 'react');

    await screen.findByRole('listbox');
    expect(screen.queryByRole('option', { name: optionNamed('react') })).not.toBeInTheDocument();
  });

  it('lets a selected skill be removed again', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'react');
    await user.click(await screen.findByRole('option', { name: optionNamed('react') }));
    await user.click(await screen.findByRole('button', { name: /remove react/i }));

    expect(screen.queryByRole('button', { name: /remove react/i })).not.toBeInTheDocument();
  });
});

describe('SkillPicker — two pickers on one form', () => {
  it('keeps Required and Preferred selections independent', async () => {
    const required = vi.fn();
    const preferred = vi.fn();
    renderWithProviders(
      <>
        <Field label="Required Skills" onChange={required} />
        <Field label="Preferred Skills" onChange={preferred} />
      </>,
    );
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^required skills$/i), 'react');
    await user.click(await screen.findByRole('option', { name: optionNamed('react') }));
    await user.type(screen.getByLabelText(/^preferred skills$/i), 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));

    expect(required).toHaveBeenCalledWith([idOfName('react')]);
    expect(preferred).toHaveBeenCalledWith([idOfName('python')]);
    // Selecting a preferred skill must not disturb the required chip.
    expect(screen.getByRole('button', { name: /remove react/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove python/i })).toBeInTheDocument();
  });
});

describe('SkillPicker — dropdown anchoring', () => {
  it('positions the panel against the picker itself', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await typeInto(/required skills/i, 'react');

    const panel = await screen.findByRole('listbox');
    expect(panel).toHaveClass('absolute');
    // An absolutely-positioned panel resolves against its nearest *positioned*
    // ancestor. Neither `Card` nor `Card.Body` is positioned, so without
    // `relative` here the options were laid out and sized against a far-off box
    // instead of the field. jsdom does no layout, so this checks the containing
    // block is established rather than where the panel lands on screen.
    const root = screen.getByRole('combobox').parentElement;
    expect(root).toHaveClass('relative');
    expect(root!.contains(panel)).toBe(true);
  });
});
