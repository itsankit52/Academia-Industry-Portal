# Frontend Architecture

Related: [architecture.md](./architecture.md) | [api.md](./api.md)

---

## Route Inventory

Routes are defined in `apps/web/src/router.tsx` using `createBrowserRouter`. All protected routes are nested under `<RequireAuth />` which renders `<PageSkeleton />` while the auth session boots, then redirects to `/login` if unauthenticated. Role mismatches are caught by `<RequireRole />` which renders `<ForbiddenPage />` inline.

Every page component is lazy-loaded via `React.lazy()` and wrapped in `<Suspense fallback={<PageSkeleton />}>` by the `s()` helper defined at the top of `router.tsx`.

### Public routes

Served under `<PublicLayout />`. No auth required.

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Landing` | Marketing landing page |
| `/about` | `About` | Platform about page |
| `/contact` | `Contact` | Contact form |
| `/login` | `Login` | Email + password login form |
| `/register` | `Register` | Registration form (role selector: Student / Company) |
| `/jobs` | `PublicJobs` | Browsable job listings (unauthenticated) |
| `/jobs/:id` | `PublicJobDetails` | Public job detail page |
| `/internships` | `PublicInternships` | Browsable internship listings |
| `/internships/:id` | `PublicInternshipDetails` | Public internship detail page |
| `*` | `NotFound` | 404 fallback |

### Student routes

Served under `<RequireAuth /> > <RequireRole role="STUDENT"> > <StudentLayout />`.

| Path | Component | Description |
|------|-----------|-------------|
| `/student/dashboard` | `StudentDashboard` | Overview: application counts, recent activity, quick links |
| `/student/profile` | `StudentProfile` | View own profile |
| `/student/profile/edit` | `StudentEditProfile` | Edit profile form |
| `/student/skills` | `StudentSkills` | Manage skill list with proficiency levels |
| `/student/resume` | `StudentResume` | Upload, view, and delete resume versions |
| `/student/recommended` | `StudentRecommended` | AI + deterministic job and internship recommendations |
| `/student/jobs` | `StudentJobs` | Browse all published jobs with filters |
| `/student/internships` | `StudentInternships` | Browse all published internships with filters |
| `/student/saved` | `StudentSaved` | Saved jobs and internships |
| `/student/applications` | `StudentApplications` | List of submitted applications with status badges |
| `/student/applications/:id` | `StudentApplicationDetails` | Application detail: status timeline, interview info |
| `/student/interviews` | `StudentInterviews` | Upcoming and past interviews |
| `/student/notifications` | `StudentNotifications` | Notification inbox |
| `/student/skill-gap` | `StudentSkillGap` | Skill gap analysis against applied/recommended listings |
| `/student/training` | `StudentTraining` | Training program recommendations |
| `/student/settings` | `StudentSettings` | Account settings (password, preferences) |

### Company routes

Served under `<RequireAuth /> > <RequireRole role="COMPANY"> > <CompanyLayout />`.

| Path | Component | Description |
|------|-----------|-------------|
| `/company/dashboard` | `CompanyDashboard` | Overview: posted listings, applicant counts, recent activity |
| `/company/profile` | `CompanyProfile` | View company profile |
| `/company/profile/edit` | `CompanyEditProfile` | Edit company info and upload logo |
| `/company/jobs` | `CompanyJobs` | List own job postings |
| `/company/jobs/new` | `CompanyJobCreate` | Create a new job posting |
| `/company/jobs/:id/edit` | `CompanyJobEdit` | Edit an existing job posting |
| `/company/jobs/manage` | `CompanyJobManage` | Bulk status management for job listings |
| `/company/internships` | `CompanyInternships` | List own internship postings |
| `/company/internships/new` | `CompanyInternshipCreate` | Create a new internship |
| `/company/internships/:id/edit` | `CompanyInternshipEdit` | Edit an existing internship |
| `/company/internships/manage` | `CompanyInternshipManage` | Bulk status management for internship listings |
| `/company/applicants` | `CompanyApplicants` | All applicants across all listings |
| `/company/applicants/:id` | `CompanyApplicantDetails` | Applicant detail: profile, skills, match score, resume |
| `/company/shortlisted` | `CompanyShortlisted` | Filtered view: SHORTLISTED applications only |
| `/company/interviews` | `CompanyInterviews` | Schedule and manage interviews |
| `/company/notifications` | `CompanyNotifications` | Notification inbox |
| `/company/settings` | `CompanySettings` | Account settings |

### Admin routes

Served under `<RequireAuth /> > <RequireRole role="ADMIN"> > <AdminLayout />`.

| Path | Component | Description |
|------|-----------|-------------|
| `/admin/dashboard` | `AdminDashboard` | Platform KPIs: total users, placements, active listings |
| `/admin/students` | `AdminStudents` | Browse and manage student accounts |
| `/admin/companies` | `AdminCompanies` | Browse, verify, and manage company accounts |
| `/admin/jobs` | `AdminJobs` | Platform-wide job listing management |
| `/admin/internships` | `AdminInternships` | Platform-wide internship management |
| `/admin/applications` | `AdminApplications` | All applications across the platform |
| `/admin/skills` | `AdminSkills` | Skill catalog CRUD |
| `/admin/training` | `AdminTraining` | Training program CRUD |
| `/admin/analytics` | `AdminAnalytics` | Charts: applications over time, placements, company participation |
| `/admin/industry-skill-demand` | `AdminIndustrySkillDemand` | Skill demand heatmap from job/internship postings |
| `/admin/audit-logs` | `AdminAuditLogs` | Paginated audit log with action/date filters |
| `/admin/settings` | `AdminSettings` | Platform-level settings |

---

## Design System

All primitives live in `apps/web/src/components/ui/`. They are unstyled wrappers or thin compositions over Tailwind classes with no third-party component library dependency.

| Component | Role |
|-----------|------|
| `Avatar` | Circular image or initials fallback for user/company avatars |
| `Badge` | Coloured pill label; used for statuses, roles, skill categories |
| `Button` | Primary, secondary, ghost, destructive variants; supports `loading` state |
| `Card` | Padded container with optional header and footer sections |
| `Checkbox` | Accessible checkbox with label; integrates with RHF `Controller` |
| `ConfirmDialog` | Modal that prompts "are you sure?" before destructive actions |
| `Drawer` | Slide-in panel from the right; used for filters and detail views on mobile |
| `EmptyState` | Centred illustration + message for empty list pages |
| `ErrorState` | Error boundary fallback UI with retry button |
| `FileDrop` | Drag-and-drop file input with MIME/size validation; used for resume + logo upload |
| `Filters` | Collapsible filter bar that composes Select/Checkbox/Input primitives |
| `FormField` | Wraps a label, input, and error message into a consistent form row |
| `Input` | Text input with error, disabled, and prefix/suffix slot variants |
| `MatchBadge` | Specialised badge that maps `MatchLevel` to colour (green/blue/yellow/red) |
| `Modal` | Accessible dialog with backdrop; used for creation forms and confirmations |
| `PageHeader` | Page title + optional subtitle + breadcrumb + action button slot |
| `PageSkeleton` | Full-page shimmer loader; shown by route-level `<Suspense>` and `RequireAuth` |
| `Pagination` | Page number controls with prev/next; driven by `Paginated<T>` metadata |
| `ProgressBar` | Horizontal bar for match score and profile completion indicators |
| `RadioGroup` | Accessible radio group with label; integrates with RHF |
| `Select` | Native `<select>` with consistent styling; used for enum fields |
| `Skeleton` | Inline shimmer placeholder for individual loading fields |
| `SkillChip` | Compact tag showing a skill name with optional remove button |
| `Spinner` | Inline loading spinner; used inside `Button` and standalone |
| `StatCard` | Metric card showing a number, label, and optional trend indicator; used in dashboards |
| `Table` | Responsive table with sortable column headers and row hover |
| `Tabs` | Horizontal tab bar with active state; used for profile sections and application views |
| `Textarea` | Multi-line text input with character count; integrates with RHF |

---

## State Layers

The frontend uses three distinct state mechanisms for different concerns.

### Server state — TanStack Query

All API data is managed by TanStack Query (`@tanstack/react-query`).

Default configuration (set in `QueryClient` instantiation):

```typescript
{
  defaultOptions: {
    queries: {
      staleTime: 60_000,     // 60 seconds before refetch on window focus
      gcTime:    300_000,    // 5 minutes before cache garbage collection
      retry:     1,          // one automatic retry on failure
    }
  }
}
```

Data is fetched by custom hooks in `apps/web/src/hooks/queries/`. Each hook wraps `useQuery` or `useMutation` and uses keys from the `queryKeys` factory.

### Client session state — Zustand

Auth session (current user object, loading flag) is stored in a Zustand store at `apps/web/src/store/`. The store is populated on app load by calling `GET /api/v1/auth/me`. On logout it is cleared. Components read `useAuthStore()` to get `user`, `isLoading`, `setUser`, `clearUser`.

The auth store is the only Zustand slice in the application. All other state is either component-local (`useState`) or server state (TanStack Query).

### Form state — React Hook Form + Zod

Forms are built with `react-hook-form` and validated by Zod schemas imported from `@aip/validation`. The integration uses `@hookform/resolvers/zod`:

```typescript
const form = useForm<CreateJobInput>({
  resolver: zodResolver(createJobSchema),
  defaultValues: { ... }
});
```

`<FormField />` from the UI library bridges RHF's `Controller` API to the labelled input layout.

---

## Axios Setup

Axios is configured once in `apps/web/src/lib/axios.ts` (or equivalent):

```typescript
const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,   // sends aip_at and aip_rt cookies on every request
});
```

### Refresh interceptor

```typescript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const code = error.response?.data?.error?.code;

    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      await api.post('/auth/refresh');   // rotates both cookies
      return api(original);             // retry original request
    }

    return Promise.reject(error);
  }
);
```

The `_retry` flag prevents infinite loops when the refresh itself fails (e.g. the refresh token has also expired). In that case the interceptor rejects, TanStack Query surfaces the error, and the `RequireAuth` guard redirects to `/login`.

---

## Query Key Convention

Query keys follow a factory pattern in `apps/web/src/hooks/queries/queryKeys.ts`:

```typescript
export const queryKeys = {
  auth:          { me: ['auth', 'me'] },
  jobs:          {
    list:  (params: JobsQuery)   => ['jobs', 'list', params],
    detail:(id: string)          => ['jobs', 'detail', id],
    managed:                       ['jobs', 'managed'],
  },
  applications:  {
    list:  (params: AppQuery)    => ['applications', 'list', params],
    detail:(id: string)          => ['applications', 'detail', id],
    counts:                        ['applications', 'counts'],
  },
  // … one entry per domain
};
```

This structure supports **prefix invalidation**: after submitting an application, calling `queryClient.invalidateQueries({ queryKey: ['applications'] })` invalidates both `list` and `counts` without enumerating every key manually.

---

## Route Guards

### RequireAuth

Located at `apps/web/src/routes/guards/RequireAuth.tsx`.

```
mount
  │
  ├── isLoading (auth store booting)  → render <PageSkeleton />
  ├── user is null                    → redirect to /login
  └── user is set                     → render <Outlet />
```

All three protected layout branches (`/student`, `/company`, `/admin`) are children of `<RequireAuth />`.

### RequireRole

Located at `apps/web/src/routes/guards/RequireRole.tsx`.

Accepts a single `role` prop. If `user.role !== role`, renders `<ForbiddenPage />` inline (no redirect). This means a company user who manually navigates to `/student/dashboard` sees a 403 page rather than being silently redirected.

```typescript
<RequireRole role="STUDENT">
  <StudentLayout />
</RequireRole>
```

---

## Layout Stack

There are four layout components, each with a `Sidebar` + `Navbar` + `<Outlet />` structure:

| Layout | Used by | Notable sidebar items |
|--------|---------|----------------------|
| `PublicLayout` | `/`, `/jobs`, `/login`, etc. | Nav links + login/register CTA |
| `StudentLayout` | `/student/*` | Dashboard, Jobs, Internships, Skills, Resume, Applications, Interviews, Skill Gap, Training, Notifications, Settings |
| `CompanyLayout` | `/company/*` | Dashboard, Jobs, Internships, Applicants, Shortlisted, Interviews, Notifications, Settings |
| `AdminLayout` | `/admin/*` | Dashboard, Students, Companies, Jobs, Internships, Applications, Skills, Training, Analytics, Industry Skill Demand, Audit Logs, Settings |

Each layout renders `<Outlet />` as its main content area, which React Router fills with the matched child route component.

---

## Recharts Usage

Analytics charts on `AdminAnalytics` and `AdminIndustrySkillDemand` use Recharts components:

- `<AreaChart />` / `<LineChart />` — applications and placements over time (time-series from `/analytics/applications-over-time`)
- `<BarChart />` — jobs/internships by category, students by branch
- `<PieChart />` — company participation share

The pattern used across all chart pages:

```typescript
const { data } = useQuery({
  queryKey: queryKeys.analytics.applicationsOverTime,
  queryFn: () => api.get('/analytics/applications-over-time').then(r => r.data.data.series),
});

return (
  <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data ?? []}>
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Area dataKey="count" />
    </AreaChart>
  </ResponsiveContainer>
);
```

`<ResponsiveContainer />` handles width/height scaling so charts adapt to the sidebar layout without fixed pixel dimensions.
