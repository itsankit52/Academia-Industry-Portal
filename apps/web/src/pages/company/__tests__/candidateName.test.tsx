import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CompanyApplicants from '../CompanyApplicants';
import CompanyApplicantDetails from '../CompanyApplicantDetails';
import CompanyShortlisted from '../CompanyShortlisted';
import CompanyInterviews from '../CompanyInterviews';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * The company hiring flow, driven by payloads shaped exactly as the API serves
 * them — the applicants list, the candidate detail page, the shortlist and the
 * interviews board.
 *
 * Two defects live here. The list rendered every candidate as "—" because the
 * applicant arrived as a bare id and `getStudentName()` had no name to read; and
 * the detail page destructured a `studentProfile` key that
 * `GET /applications/:id/candidate` has never returned, so it died on
 * `Cannot read properties of undefined (reading 'fullName')` before painting
 * anything. Only the HTTP layer is stubbed, so the hooks, the shared helpers and
 * the pages all run for real.
 */
const hoisted = vi.hoisted(() => ({ apiGet: vi.fn(), apiPatch: vi.fn(), apiPost: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  apiGet: hoisted.apiGet,
  apiPost: hoisted.apiPost,
  apiPatch: hoisted.apiPatch,
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const APP_ID = '507f1f77bcf86cd799439001';
const STUDENT_ID = '507f1f77bcf86cd799439002';
const JOB_ID = '507f1f77bcf86cd799439003';
const COMPANY_ID = '507f1f77bcf86cd799439004';

/** A row as `GET /applications?scope=company` now serves it. */
const APPLICATION_ROW = {
  id: APP_ID,
  student: { id: STUDENT_ID, fullName: 'Asha Menon', email: 'asha.menon@example.edu' },
  opportunityType: 'JOB',
  opportunity: {
    id: JOB_ID,
    title: 'Backend Engineer',
    company: { id: COMPANY_ID, name: 'Acme Corp' },
  },
  status: 'SHORTLISTED',
  matchScore: 82,
  timeline: [{ status: 'APPLIED', at: '2026-08-01T10:00:00.000Z' }],
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
};

/** `GET /applications/:id/candidate` — mirrors `CandidateDetailsView` on the API. */
const CANDIDATE_DETAILS = {
  id: APP_ID,
  student: {
    id: STUDENT_ID,
    fullName: 'Asha Menon',
    email: 'asha.menon@example.edu',
    college: 'Alpha Institute of Technology',
    branch: 'Computer Science',
    cgpa: 8.7,
    projects: [
      { title: 'Campus Placement Tracker', description: 'Tracks offers', techStack: ['React'] },
    ],
    certifications: [],
    experience: [
      {
        title: 'Backend Intern',
        organization: 'Beta Labs',
        startDate: '2025-06-01T00:00:00.000Z',
        endDate: '2025-08-31T00:00:00.000Z',
      },
    ],
    achievements: [],
    preferredRoles: [],
    preferredLocations: [],
  },
  skills: [{ id: 's1', name: 'TypeScript', category: 'LANGUAGE', proficiency: 'ADVANCED' }],
  opportunity: {
    id: JOB_ID,
    title: 'Backend Engineer',
    type: 'JOB',
    company: { id: COMPANY_ID, name: 'Acme Corp' },
  },
  application: {
    id: APP_ID,
    status: 'SHORTLISTED',
    coverLetter: 'I would like to apply.',
    matchScore: 82,
    matchedSkills: ['TypeScript'],
    missingSkills: ['Kubernetes'],
    resume: { url: 'https://files.example.com/asha.pdf', mimeType: 'application/pdf' },
    timeline: [{ status: 'APPLIED', at: '2026-08-01T10:00:00.000Z' }],
    createdAt: '2026-08-01T10:00:00.000Z',
  },
};

/** `GET /interviews?scope=company` — the four fields the API now derives. */
const INTERVIEW_ROW = {
  id: '507f1f77bcf86cd799439005',
  applicationId: APP_ID,
  candidateName: 'Asha Menon',
  opportunityTitle: 'Backend Engineer',
  companyName: 'Acme Corp',
  mode: 'ONLINE',
  scheduledAt: '2026-09-01T09:30:00.000Z',
  durationMinutes: 45,
  status: 'SCHEDULED',
};

function page<T>(items: T[]) {
  return { items, page: 1, pageSize: 12, total: items.length, totalPages: 1 };
}

let applicationRows: Record<string, unknown>[] = [];
let candidateDetails: Record<string, unknown> = CANDIDATE_DETAILS;

beforeEach(() => {
  hoisted.apiGet.mockReset();
  hoisted.apiPatch.mockReset();
  applicationRows = [APPLICATION_ROW];
  candidateDetails = CANDIDATE_DETAILS;

  hoisted.apiGet.mockImplementation((url: string) => {
    if (url.startsWith('/applications?')) return Promise.resolve(page(applicationRows));
    if (url.endsWith('/candidate')) return Promise.resolve(candidateDetails);
    if (url.includes('/interim-reports')) return Promise.resolve(page([]));
    if (url.startsWith('/interviews')) return Promise.resolve(page([INTERVIEW_ROW]));
    return Promise.reject(new Error(`unstubbed GET ${url}`));
  });
});

function renderFlow(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/company/applicants" element={<CompanyApplicants />} />
      <Route path="/company/applicants/:id" element={<CompanyApplicantDetails />} />
      <Route path="/company/shortlisted" element={<CompanyShortlisted />} />
      <Route path="/company/interviews" element={<CompanyInterviews />} />
    </Routes>,
    { route },
  );
}

describe('Applicants list', () => {
  it("shows the candidate's real name and email instead of a placeholder", async () => {
    renderFlow('/company/applicants');

    expect(await screen.findByText('Asha Menon')).toBeInTheDocument();
    expect(screen.getByText('asha.menon@example.edu')).toBeInTheDocument();
    // The regression: the Candidate column used to be "—" on every row.
    const candidateCell = screen.getByText('Asha Menon').closest('td');
    expect(candidateCell?.textContent).not.toContain('—');
  });

  it('falls back to the placeholder only when the applicant really is unresolved', async () => {
    // A deleted profile is the one case where there is genuinely no name to show,
    // and it must not stop the rest of the row rendering.
    applicationRows = [{ ...APPLICATION_ROW, student: STUDENT_ID }];
    renderFlow('/company/applicants');

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Asha Menon')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('reads a faculty applicant out of the other applicant slot', async () => {
    // FDPs and consultancy postings put a faculty profile in the applicant slot.
    applicationRows = [
      {
        ...APPLICATION_ROW,
        student: undefined,
        faculty: { id: STUDENT_ID, fullName: 'Dr. Rao', email: 'dr.rao@example.edu' },
        opportunityType: 'FDP',
      },
    ];
    renderFlow('/company/applicants');

    expect(await screen.findByText('Dr. Rao')).toBeInTheDocument();
    expect(screen.getByText('dr.rao@example.edu')).toBeInTheDocument();
  });
});

describe('Applicants → Candidate Details', () => {
  it('opens the candidate page from the row without crashing', async () => {
    const user = userEvent.setup();
    renderFlow('/company/applicants');

    await user.click(await screen.findByText('Asha Menon'));

    // The page header is the candidate's name; reaching it at all means the
    // `studentProfile` TypeError is gone.
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Asha Menon' })).toBeInTheDocument(),
    );
    expect(screen.getByText('Applied for Backend Engineer')).toBeInTheDocument();
    expect(hoisted.apiGet).toHaveBeenCalledWith(`/applications/${APP_ID}/candidate`);
  });

  it('renders the profile, skills, projects and experience from the real payload', async () => {
    renderFlow(`/company/applicants/${APP_ID}`);

    expect(await screen.findByText('asha.menon@example.edu')).toBeInTheDocument();
    expect(screen.getByText('Alpha Institute of Technology')).toBeInTheDocument();
    expect(screen.getByText(/Computer Science/)).toBeInTheDocument();
    // The Skills card is fed by the top-level `skills` array, not by anything under
    // the candidate; the proficiency suffix only appears there, so it distinguishes
    // that card from the matched-skills chips of the same name above it.
    expect(screen.getByText('· ADVANCED')).toBeInTheDocument();
    expect(screen.getByText('Campus Placement Tracker')).toBeInTheDocument();
    expect(screen.getByText('Backend Intern')).toBeInTheDocument();
  });

  it('reads the match breakdown and resume off the application', async () => {
    renderFlow(`/company/applicants/${APP_ID}`);

    expect(await screen.findByText('Matched Skills')).toBeInTheDocument();
    expect(screen.getByText('Missing Skills')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    const download = screen.getByText('Download Resume').closest('a');
    expect(download).toHaveAttribute('href', 'https://files.example.com/asha.pdf');
  });

  it('still renders a candidate with no resume, projects or experience', async () => {
    candidateDetails = {
      ...CANDIDATE_DETAILS,
      student: { ...CANDIDATE_DETAILS.student, projects: [], experience: [] },
      skills: [],
      application: { ...CANDIDATE_DETAILS.application, resume: undefined },
    };
    renderFlow(`/company/applicants/${APP_ID}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Asha Menon' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Download Resume')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });
});

describe('Shortlisted and Interviews', () => {
  it('names the candidate on each shortlisted card', async () => {
    renderFlow('/company/shortlisted');

    expect(await screen.findByText('Asha Menon')).toBeInTheDocument();
    expect(screen.getByText('asha.menon@example.edu')).toBeInTheDocument();
  });

  it('names the posting and the company on each interview card', async () => {
    // These two came back blank because the API never derived them.
    renderFlow('/company/interviews');

    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('names the candidate in the cancel confirmation', async () => {
    // The only place the interviews page shows `candidateName`; it used to read
    // "Cancel the interview with undefined?".
    const user = userEvent.setup();
    renderFlow('/company/interviews');

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Cancel the interview with Asha Menon?')).toBeInTheDocument();
  });
});
