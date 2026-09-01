# Testing Guide

Related: [architecture.md](./architecture.md)

---

## Overview

The project has three test layers:

| Layer               | Runner       | Scope                               | Location                                      |
| ------------------- | ------------ | ----------------------------------- | --------------------------------------------- |
| Backend unit        | Vitest       | Pure logic, services with mocked DB | `apps/api/src/modules/**/__tests__/*.test.ts` |
| Backend integration | Vitest       | Full Mongoose + real MongoDB        | `apps/api/src/__tests__/*.spec.ts`            |
| Frontend unit       | Vitest + RTL | Components, stores, forms           | `apps/web/src/**/__tests__/*.test.tsx`        |
| E2E                 | Playwright   | Full browser flows                  | `apps/web/e2e/specs/`                         |

---

## Backend — Vitest

### Running tests

```bash
# Unit tests only (no TEST_MONGO_URI needed)
pnpm --filter @aip/api test

# With coverage report
pnpm --filter @aip/api test:coverage

# Watch mode during development
pnpm --filter @aip/api test --watch
```

### Unit tests

Located alongside their module under `__tests__/`:

```
apps/api/src/modules/
  matching/__tests__/algorithm.test.ts
  auth/__tests__/auth.service.test.ts
  jobs/__tests__/jobs.service.test.ts
  …
```

Unit tests mock Mongoose models and external clients (Cloudinary, Gemini). They verify business logic in isolation: scoring formulas, status-transition guards, error-throwing behaviour.

### Integration tests

Located under `apps/api/src/__tests__/`:

```
apps/api/src/__tests__/
  auth.spec.ts
  applications.spec.ts
  jobs.spec.ts
  …
```

Integration suites spin up a real Express app connected to a real MongoDB instance. They **auto-skip** when `TEST_MONGO_URI` is not set in the environment:

```typescript
// Pattern used in every .spec.ts
const MONGO_URI = process.env.TEST_MONGO_URI;
if (!MONGO_URI) {
  describe.skip('integration (TEST_MONGO_URI not set)', () => {});
  // file exits early
}
```

This means `pnpm --filter @aip/api test` is always safe to run locally without a database. Integration tests run in CI only when the `TEST_MONGO_URI` secret is available (see [ci.yml](../.github/workflows/ci.yml)).

### Coverage

```bash
pnpm --filter @aip/api test:coverage
```

Vitest generates a coverage report under `apps/api/coverage/`. The CI pipeline does not enforce a coverage threshold gate but the report is available as an artifact.

---

## Frontend — Vitest + React Testing Library

### Running tests

```bash
# All frontend unit tests
pnpm --filter @aip/web test

# Watch mode
pnpm --filter @aip/web test --watch
```

### Configuration

Frontend tests run in a **jsdom** environment configured in `apps/web/vite.config.ts` (or a dedicated `vitest.config.ts`). React Testing Library is used for component rendering and user interaction simulation.

### What is tested

| Test type       | Examples                                                                |
| --------------- | ----------------------------------------------------------------------- |
| Component tests | Button variants, form field error display, Badge colour mapping         |
| Store tests     | Zustand auth slice: login sets user, logout clears it                   |
| Form tests      | RHF + Zod schema integration: required fields, email format, min-length |
| Hook tests      | `useAuth`, query hook error states                                      |

### File layout

```
apps/web/src/
  components/ui/__tests__/
    Button.test.tsx
    Badge.test.tsx
    …
  store/__tests__/
    auth.store.test.ts
  pages/student/__tests__/
    StudentSkills.test.tsx
```

---

## E2E — Playwright

### Prerequisites

E2E tests require:

1. A running backend: `pnpm --filter @aip/api dev`
2. A running frontend: `pnpm --filter @aip/web dev`
3. Seeded data: `pnpm seed` (populates MongoDB with reference data — skill catalogue only; no demo users, jobs, or institutions)

### Running E2E tests

```bash
# From repo root — requires dev servers already running
pnpm --filter @aip/web test:e2e
```

### Spec location

```
apps/web/e2e/specs/
  auth.spec.ts          register, login, logout, refresh
  apply.spec.ts         student browses jobs, applies, views application status
  company.spec.ts       company posts job, reviews applicants, schedules interview
  admin.spec.ts         admin verifies company, manages users, views analytics
  skill-gap.spec.ts     student views skill-gap page and recommended training
```

### Playwright configuration

`playwright.config.ts` in `apps/web/` sets:

- `baseURL`: `http://localhost:5173` (Vite dev server)
- `use.storageState`: auth state saved per-role to skip repeated login in most specs
- Retries: 1 retry on CI, 0 locally
- Reporter: `html` for local runs; `github` in CI

### E2E in CI

E2E tests are gated behind a pull request label. The `test-e2e` job in `.github/workflows/ci.yml` only runs when the PR carries the label `ready-for-e2e`. This prevents expensive browser tests on every commit while still allowing on-demand verification before merge.

---

## CI Summary

```
push / PR
  │
  ├── install            pnpm install --frozen-lockfile
  ├── lint               pnpm lint
  ├── typecheck          pnpm typecheck
  ├── test-api-unit      pnpm --filter @aip/api test        (no DB needed)
  ├── test-web-unit      pnpm --filter @aip/web test
  ├── build              pnpm build
  │
  ├── test-api-integration   (only if secrets.TEST_MONGO_URI is set)
  │     pnpm --filter @aip/api test  with TEST_MONGO_URI env var
  │
  └── test-e2e               (only on PRs labelled 'ready-for-e2e')
        starts api + web dev servers, runs pnpm --filter @aip/web test:e2e
```

See [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) for the full workflow definition.
