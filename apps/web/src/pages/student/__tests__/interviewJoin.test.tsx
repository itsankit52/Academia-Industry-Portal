import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, matchRoutes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StudentInterviews from '../StudentInterviews';
import StudentInterviewDetails from '../StudentInterviewDetails';
import NotFound from '@/pages/public/NotFound';
import { router } from '@/router';
import { renderWithProviders } from '@/test/renderWithProviders';

/**
 * The student side of the interview flow: a company schedules an interview, the
 * student opens the notification and joins.
 *
 * The defect this covers was a missing route, not a missing endpoint.
 * `interviews.service.ts` writes its INTERVIEW_SCHEDULED notification with the
 * link `/student/interviews/<id>`, but the router only ever registered the
 * `interviews` index — so that link matched nothing, fell through to the
 * catch-all `*` NotFound route, and the student never reached a page that could
 * show the meeting link. `GET /interviews/:id` already existed and already
 * refused an interview belonging to someone else.
 *
 * The first block therefore asserts against the REAL route tree exported from
 * `@/router`, so deleting the `interviews/:id` child brings this test down. The
 * rendering blocks mount the two pages behind the same catch-all to check what
 * the student actually sees. Only the HTTP layer is stubbed.
 */
const hoisted = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  apiGet: hoisted.apiGet,
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

const INTERVIEW_ID = '507f1f77bcf86cd799439005';
const APP_ID = '507f1f77bcf86cd799439001';
const MEETING_LINK = 'https://meet.example.com/aip-backend-engineer-round-1';

/** Exactly the string `interviews.service.ts` stores on the notification. */
const NOTIFICATION_LINK = `/student/interviews/${INTERVIEW_ID}`;

/** A row as `GET /interviews/:id` serves it, with the four derived fields. */
const ONLINE_INTERVIEW = {
  id: INTERVIEW_ID,
  applicationId: APP_ID,
  candidateName: 'Asha Menon',
  opportunityTitle: 'Backend Engineer',
  companyName: 'Acme Corp',
  mode: 'ONLINE',
  scheduledAt: '2026-09-01T09:30:00.000Z',
  durationMinutes: 45,
  meetingLink: MEETING_LINK,
  interviewer: 'Ravi Kulkarni',
  status: 'SCHEDULED',
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
};

let interview: Record<string, unknown> = ONLINE_INTERVIEW;

beforeEach(() => {
  hoisted.apiGet.mockReset();
  interview = ONLINE_INTERVIEW;

  hoisted.apiGet.mockImplementation((url: string) => {
    if (url === `/interviews/${INTERVIEW_ID}`) return Promise.resolve(interview);
    if (url.startsWith('/interviews')) {
      return Promise.resolve({
        items: [interview],
        page: 1,
        pageSize: 12,
        total: 1,
        totalPages: 1,
      });
    }
    return Promise.reject(new Error(`unstubbed GET ${url}`));
  });
});

function renderRoute(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/student/interviews" element={<StudentInterviews />} />
      <Route path="/student/interviews/:id" element={<StudentInterviewDetails />} />
      {/* The real router's last resort, and where this link used to land. */}
      <Route path="*" element={<NotFound />} />
    </Routes>,
    { route },
  );
}

describe('the interview notification link the API writes', () => {
  it('resolves to a real student route instead of the 404 catch-all', () => {
    const matches = matchRoutes(router.routes, NOTIFICATION_LINK) ?? [];
    const leaf = matches[matches.length - 1];

    expect(leaf).toBeDefined();
    expect(leaf?.route.path).toBe('interviews/:id');
    expect(leaf?.params.id).toBe(INTERVIEW_ID);
    // The regression: every matched segment used to be the bare `*` route.
    expect(matches.some((m) => m.route.path === '*')).toBe(false);
  });

  it('still sends a genuinely unknown student url to the catch-all', () => {
    // Control case — without it, the assertion above would also pass against a
    // router that matched everything.
    const matches = matchRoutes(router.routes, '/student/no-such-page') ?? [];
    const leaf = matches[matches.length - 1];

    expect(leaf?.route.path).toBe('*');
  });

  it('keeps the interviews index reachable', () => {
    const matches = matchRoutes(router.routes, '/student/interviews') ?? [];
    const leaf = matches[matches.length - 1];

    expect(leaf?.route.path).toBe('interviews');
  });
});

describe('joining a scheduled interview', () => {
  it('offers the meeting link the company saved', async () => {
    renderRoute(NOTIFICATION_LINK);

    const join = await screen.findByRole('link', { name: /join interview/i });

    expect(join).toHaveAttribute('href', MEETING_LINK);
    // A real anchor with these two attributes, so the meeting opens in a new tab
    // rather than being swallowed as a blocked popup.
    expect(join).toHaveAttribute('target', '_blank');
    expect(join.getAttribute('rel')).toContain('noopener');
    expect(hoisted.apiGet).toHaveBeenCalledWith(`/interviews/${INTERVIEW_ID}`);
  });

  it('renders the interview instead of the 404 page', async () => {
    renderRoute(NOTIFICATION_LINK);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Backend Engineer' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('says so rather than offering a dead button when no link was saved', async () => {
    interview = { ...ONLINE_INTERVIEW, meetingLink: undefined };
    renderRoute(NOTIFICATION_LINK);

    expect(await screen.findByText(/has not added a meeting link yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join interview/i })).not.toBeInTheDocument();
  });

  it('withdraws the join control once the interview is cancelled', async () => {
    interview = { ...ONLINE_INTERVIEW, status: 'CANCELLED' };
    renderRoute(NOTIFICATION_LINK);

    expect(await screen.findByText(/was cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join interview/i })).not.toBeInTheDocument();
  });

  it('guides an onsite interview to its location instead of a meeting link', async () => {
    interview = {
      ...ONLINE_INTERVIEW,
      mode: 'ONSITE',
      meetingLink: undefined,
      location: 'Acme Corp, 4th floor, Bengaluru',
    };
    renderRoute(NOTIFICATION_LINK);

    expect(await screen.findByText('Acme Corp, 4th floor, Bengaluru')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /join interview/i })).not.toBeInTheDocument();
  });
});

describe('reaching the interview from the list', () => {
  it('opens the details page from the interviews list', async () => {
    const user = userEvent.setup();
    renderRoute('/student/interviews');

    await user.click(await screen.findByRole('link', { name: 'View details' }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /join interview/i })).toBeInTheDocument(),
    );
    expect(hoisted.apiGet).toHaveBeenCalledWith(`/interviews/${INTERVIEW_ID}`);
  });
});
