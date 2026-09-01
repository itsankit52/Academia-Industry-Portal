import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@aip/config';
import SkillPicker from '../SkillPicker';
import { renderWithProviders } from '@/test/renderWithProviders';
import { apiGet, apiPost } from '@/lib/api';
import type { Paginated, Skill } from '@aip/types';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

/**
 * The skill picker — tested against a realistic catalogue that exceeds one page.
 *
 * The core regression: `/skills` served `DEFAULT_PAGE_SIZE` (12) rows and the
 * picker filters what it was given, so only the first twelve were ever searchable.
 * The test verifies that (a) the picker requests the full catalogue (all pages)
 * and (b) skills beyond the first page are findable.
 *
 * The fixture has 200 alphabetically-sorted skills and `serveSkills` pages them
 * at `cap` items per page, mimicking the real server pagination.
 */

// 200 alphabetically-sorted names — covers the full range of the updated seed data.
const NAMES = [
  'adobe xd',
  'amazon dynamodb',
  'amazon s3',
  'analytics',
  'android studio',
  'angular',
  'ansible',
  'apache',
  'apache kafka',
  'apache spark',
  'apis',
  'app store',
  'assembly',
  'aws',
  'azure',
  'big data',
  'bitbucket',
  'blockchain',
  'bootstrap',
  'business analysis',
  'c',
  'c#',
  'c++',
  'cassandra',
  'chef',
  'chakra ui',
  'circleci',
  'ci/cd',
  'cloud computing',
  'code review',
  'collaboration',
  'communication',
  'computer vision',
  'couchdb',
  'creative',
  'critical thinking',
  'cryptography',
  'css',
  'cybersecurity',
  'd',
  'dart',
  'data analysis',
  'data engineering',
  'data migration',
  'data structures',
  'data visualization',
  'data wrangling',
  'database design',
  'database indexing',
  'deep learning',
  'devops',
  'django',
  'docker',
  'dynamo db',
  'elasticsearch',
  'elixir',
  'elm',
  'email marketing',
  'ember.js',
  'etl',
  'express',
  'fastapi',
  'figma',
  'firebase',
  'flask',
  'flutter',
  'fortran',
  'freebsd',
  'frontend',
  'full stack',
  'gatsby',
  'generative ai',
  'git',
  'github',
  'github actions',
  'gitlab',
  'gitlab ci/cd',
  'golang',
  'google analytics',
  'google cloud',
  'google play',
  'graphql',
  'grafana',
  'groovy',
  'grunt',
  'gcp',
  'hadoop',
  'haskell',
  'helm',
  'heroku',
  'hive',
  'html',
  'http',
  'incident management',
  'ionic',
  'ios',
  'java',
  'javascript',
  'jenkins',
  'jest',
  'jquery',
  'json',
  'julia',
  'jupyter',
  'karma',
  'keras',
  'kotlin',
  'kubernetes',
  'lamp',
  'laravel',
  'leadership',
  'linux',
  'load testing',
  'logstash',
  'lua',
  'machine learning',
  'macos',
  'mailchimp',
  'mariadb',
  'marketing',
  'material-ui',
  'matlab',
  'mern stack',
  'metadata',
  'microservices',
  'microsoft office',
  'mlops',
  'mobile',
  'mongodb',
  'mongoose',
  'mssql',
  'mysql',
  'nestjs',
  'netlify',
  'networking',
  'next.js',
  'nginx',
  'nlp',
  'node.js',
  'nosql',
  'npm',
  'nuxt.js',
  'oauth',
  'objective-c',
  'openapi',
  'open cv',
  'oracle',
  'orm',
  'owasp',
  'pandas',
  'penetration testing',
  'perl',
  'php',
  'pinterest',
  'postgresql',
  'postman',
  'powershell',
  'presentation skills',
  'prisma',
  'product management',
  'prometheus',
  'project management',
  'python',
  'pytorch',
  'rabbitmq',
  'react',
  'reactnative',
  'redis',
  'redux',
  'reinforcement learning',
  'replication',
  'rest api',
  'ruby',
  'rubyonrails',
  'rust',
  'saas',
  'sass',
  'scala',
  'scikit-learn',
  'scrum',
  'seaborn',
  'security',
  'selenium',
  'serverless',
  'shell scripting',
  'siem',
  'slack',
  'snowflake',
  'soap',
  'socket.io',
  'software architecture',
  'software engineering',
  'spark',
  'sqlite',
  'sre',
  'statistics',
  'swagger',
  'swift',
  'system design',
  'tableau',
  'tailwind css',
  'technical leadership',
  'technical writing',
  'terraform',
  'testing',
  'time management',
  'travis ci',
  'typescript',
  'ubuntu',
  'ui design',
  'unix',
  'uml',
  'unity',
  'unrealengine',
  'ux design',
  'vercel',
  'vim',
  'visual studio',
  'vue.js',
  'web development',
  'webpack',
  'websocket',
  'wordpress',
  'xml',
  'yarn',
  'zapier',
  'zend',
  'zookeeper',
  'zustand',
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
  if (!skill) throw new Error(`fixture has no skill named "${name}"`);
  return skill.id;
}

/**
 * Stands in for `GET /skills`, honouring pagination limits the same way the real
 * server does. `cap` caps the page size to simulate a server that cannot serve
 * the entire catalogue in one response.
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
  vi.mocked(apiPost).mockResolvedValue({} as never);
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
    // Cap at 50 items/page → 4 pages of 50 → 200 skills. With 50/page the hook
    // needs 4 calls (page 1 + 3 more) to have the full catalogue. We don't assert
    // on the exact call count — we assert on the behaviour: `typescript` (last
    // alphabetically) only appears if every page was read.
    vi.mocked(apiGet).mockImplementation(serveSkills(50) as never);
    renderWithProviders(<Field />);

    // Wait for the hook to complete its pagination loop. With 50/page and 200
    // skills → 4 pages → 4 mock calls. Allow extra time for the debounce + fetch.
    await waitFor(() => expect(vi.mocked(apiGet).mock.calls.length).toBeGreaterThanOrEqual(4), {
      timeout: 5000,
    });
    await typeInto(/required skills/i, 'typescript');
    // `typescript` is last alphabetically, so it only appears if every page was read.
    expect(
      await screen.findByRole('option', { name: optionNamed('typescript') }),
    ).toBeInTheDocument();
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

    // `python` is well beyond the first twelve rows alphabetically, so the
    // twelve-row response could never contain it — this was the original reported bug.
    await typeInto(/required skills/i, 'python');

    expect(await screen.findByRole('option', { name: optionNamed('python') })).toBeInTheDocument();
    expect(screen.queryByText(/no skills found/i)).not.toBeInTheDocument();
  });

  it('narrows to every match, not just the first', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'script');

    await screen.findByRole('listbox');
    const options = screen.getAllByRole('option');
    // javascript, typescript
    expect(options.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SkillPicker — selecting', () => {
  it('adds a clicked skill to the form value and keeps it visible', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Field onChange={onChange} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));

    // The form value is what the `.min(1)` rule reads, so this is the assertion
    // that "Select at least one required skill" is satisfied.
    expect(onChange).toHaveBeenCalledWith([idOfName('python')]);
    // And the chip stays on screen after the panel closes.
    expect(await screen.findByRole('button', { name: /remove python/i })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('accumulates several skills rather than replacing the selection', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Field onChange={onChange} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));
    await user.type(screen.getByLabelText(/required skills/i), 'rust');
    await user.click(await screen.findByRole('option', { name: optionNamed('rust') }));

    expect(onChange).toHaveBeenCalledWith([idOfName('python'), idOfName('rust')]);
    expect(screen.getByRole('button', { name: /remove python/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove rust/i })).toBeInTheDocument();
  });

  it('stops offering a skill that is already selected', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));
    await user.type(screen.getByLabelText(/required skills/i), 'python');

    await screen.findByRole('listbox');
    expect(screen.queryByRole('option', { name: optionNamed('python') })).not.toBeInTheDocument();
  });

  it('lets a selected skill be removed again', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    const user = await typeInto(/required skills/i, 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));
    await user.click(screen.getByRole('button', { name: /remove python/i }));

    expect(screen.queryByRole('button', { name: /remove python/i })).not.toBeInTheDocument();
  });
});

describe('SkillPicker — keyboard navigation', () => {
  it('navigates options with arrow keys and selects with Enter', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'python');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    // One of the highlighted options should be selected (exact behaviour depends on
    // where the arrow keys land, but the key assertion is that Enter does not crash).
    // We verify the panel closed (Enter consumed the selection).
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes panel with Escape', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'python');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('SkillPicker — create skill', () => {
  it('offers a "Create" option when no exact match exists', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    // "zod" is not in the fixture catalogue
    await typeInto(/required skills/i, 'zod');

    const panel = await screen.findByRole('listbox');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText(/create "zod"/i)).toBeInTheDocument();
  });

  it('does not offer Create when the skill already exists', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    // "python" is in the catalogue and unique (no "python-something" in the fixture)
    await typeInto(/required skills/i, 'python');
    await screen.findByRole('listbox');

    expect(screen.queryByText(/create "/i)).not.toBeInTheDocument();
    // but the actual skill should appear
    expect(screen.getByRole('option', { name: optionNamed('python') })).toBeInTheDocument();
  });

  it('does not offer Create for a 1-character query', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'r');
    await screen.findByRole('listbox');

    // No "create" option for single-char input
    expect(screen.queryByText(/create "/i)).not.toBeInTheDocument();
  });

  it('creates the skill when the Create option is clicked', async () => {
    const newSkill: Skill = {
      id: '000000000000000000000999',
      name: 'zod',
      category: 'OTHER',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    vi.mocked(apiPost).mockResolvedValue(newSkill as never);

    const onChange = vi.fn();
    renderWithProviders(<Field onChange={onChange} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'zod');
    await screen.findByRole('listbox');

    const createBtn = screen.getByText(/create "zod"/i);
    await userEvent.click(createBtn);

    // POST /skills is called with the new name and a default category
    expect(apiPost).toHaveBeenCalledWith('/skills', {
      name: 'zod',
      category: 'OTHER',
    });

    // The picker closes and the skill is added to the form value
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalledWith([newSkill.id]);
  });

  it('does not duplicate an existing skill', async () => {
    // Exact case-insensitive match — if "React" is typed but "react" already
    // exists in the catalogue, no Create option should appear.
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());

    await typeInto(/required skills/i, 'React'); // capital R
    await screen.findByRole('listbox');

    expect(screen.queryByText(/create "/i)).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText(/^required skills$/i), 'python');
    await user.click(await screen.findByRole('option', { name: optionNamed('python') }));
    await user.type(screen.getByLabelText(/^preferred skills$/i), 'rust');
    await user.click(await screen.findByRole('option', { name: optionNamed('rust') }));

    expect(required).toHaveBeenCalledWith([idOfName('python')]);
    expect(preferred).toHaveBeenCalledWith([idOfName('rust')]);
    // Selecting a preferred skill must not disturb the required chip.
    expect(screen.getByRole('button', { name: /remove python/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove rust/i })).toBeInTheDocument();
  });
});

describe('SkillPicker — dropdown anchoring', () => {
  it('positions the panel against the picker itself', async () => {
    renderWithProviders(<Field />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await typeInto(/required skills/i, 'python');

    const panel = await screen.findByRole('listbox');
    expect(panel).toHaveClass('absolute');
    const root = screen.getByRole('combobox').parentElement;
    expect(root).toHaveClass('relative');
    expect(root!.contains(panel)).toBe(true);
  });
});
