# System Architecture

## High-Level Diagram

```
                    ┌──────────────────────────────────────────┐
                    │             Browser (Client)              │
                    │   React 18 SPA, bundled with Vite         │
                    └────────────────┬─────────────────────────┘
                                     │  HTTPS
                                     │  Cookie: aip_at (access token)
                                     │  Axios withCredentials
                                     ▼
                    ┌──────────────────────────────────────────┐
                    │           Express API Server              │
                    │   apps/api — Node.js + TypeScript         │
                    │                                           │
                    │  middleware chain:                        │
                    │    cors → helmet → cookieParser           │
                    │    → authLimiter (auth routes only)       │
                    │    → requireAuth → requireRole            │
                    │    → validate (Zod) → controller          │
                    │                                           │
                    │  18 module routers                        │
                    └────┬────────────────┬────────────────────┘
                         │                │
              Mongoose   │                │  upload_stream / SDK
                         ▼                ▼
          ┌──────────────────┐   ┌─────────────────────────────┐
          │   MongoDB Atlas   │   │     External Services        │
          │                  │   │                             │
          │  14 collections  │   │  Cloudinary                 │
          │  (primary store) │   │    resumes + logos          │
          └──────────────────┘   │                             │
                                 │  Google Gemini              │
                                 │    AI narrative only        │
                                 │    apps/api/src/modules/ai/ │
                                 └─────────────────────────────┘
```

**Cloudinary** stores binary files (student resumes, company logos). Multer holds the upload in memory; the buffer is piped through `upload_stream`. Only the resulting `cloudinaryPublicId` and `url` are written to MongoDB.

**Google Gemini** is invoked exclusively from the `apps/api/src/modules/ai/` module. It generates prose explanations on top of scores that the deterministic algorithm already computed. It has no write path to any model.

---

## Monorepo Structure

```
academia-industry-portal/
├── apps/
│   ├── api/                         Express + Mongoose backend
│   │   └── src/
│   │       ├── config/              DB, Cloudinary, Gemini initialisation
│   │       ├── middleware/
│   │       │   ├── requireAuth.ts
│   │       │   ├── requireRole.ts
│   │       │   ├── validate.ts      Zod wrapper
│   │       │   ├── upload.ts        multer (memoryStorage)
│   │       │   ├── audit.ts         audit-log middleware factory
│   │       │   └── rateLimit.ts     authLimiter, globalLimiter
│   │       ├── models/              14 Mongoose schemas
│   │       ├── modules/
│   │       │   ├── ai/
│   │       │   ├── admin/
│   │       │   ├── analytics/
│   │       │   ├── applications/
│   │       │   ├── audit/
│   │       │   ├── auth/
│   │       │   ├── companies/
│   │       │   ├── internships/
│   │       │   ├── interviews/
│   │       │   ├── jobs/
│   │       │   ├── matching/        algorithm.ts — pure TS, no DB
│   │       │   ├── notifications/
│   │       │   ├── recommendations/
│   │       │   ├── resumes/
│   │       │   ├── saved-opportunities/
│   │       │   ├── skills/
│   │       │   ├── students/
│   │       │   └── training/
│   │       ├── routes/
│   │       │   ├── index.ts         mounts all module routers under /api/v1
│   │       │   └── health.ts
│   │       └── utils/               apiResponse helpers (ok, created, noContent)
│   │
│   └── web/                         Vite + React 18 frontend
│       └── src/
│           ├── components/
│           │   └── ui/              28 primitive components
│           ├── hooks/
│           │   └── queries/         TanStack Query hooks + queryKeys factory
│           ├── layouts/             PublicLayout, StudentLayout, CompanyLayout, AdminLayout
│           ├── pages/
│           │   ├── public/
│           │   ├── auth/
│           │   ├── student/
│           │   ├── company/
│           │   └── admin/
│           ├── routes/
│           │   └── guards/          RequireAuth, RequireRole
│           ├── store/               Zustand auth slice
│           └── router.tsx           createBrowserRouter definition
│
├── packages/
│   ├── config/
│   │   └── src/
│   │       ├── enums.ts             ROLES, JOB_STATUSES, MATCH_LEVELS, SKILL_CATEGORIES, …
│   │       └── constants.ts         COOKIE_NAMES, MATCH_THRESHOLDS, MATCHING_WEIGHTS, FILE_LIMITS
│   ├── types/
│   │   └── src/
│   │       └── api.ts               ApiSuccess, ApiError, ApiResponse, Paginated, PaginationQuery
│   ├── validation/                  Zod schemas shared by API validate middleware
│   └── eslint-config/               Shared ESLint flat config
│
├── pnpm-workspace.yaml
└── package.json                     Root scripts: lint, typecheck, build, dev
```

### Why pnpm workspaces?

Packages reference each other with the workspace protocol:

```json
"@aip/config": "workspace:*"
```

Benefits:

- **No publish step.** Edits to `packages/config` are visible in `apps/api` and `apps/web` instantly via symlinks.
- **Single lockfile.** `pnpm-lock.yaml` pins the full dependency graph. `--frozen-lockfile` in CI enforces reproducible installs.
- **Filtered commands.** `pnpm --filter @aip/api test` runs only the API suite without touching other packages.
- **Disk efficiency.** pnpm's content-addressable store hard-links identical files across projects, cutting CI cache size.

---

## Request Lifecycle

A typical authenticated request travels through these layers in order:

```
1.  HTTP request arrives
    Cookie: aip_at=<signed-jwt>

2.  requireAuth middleware                      apps/api/src/middleware/requireAuth.ts
    ├── Reads aip_at from req.cookies
    ├── Verifies JWT signature with ACCESS_TOKEN_SECRET
    ├── Checks token expiry
    ├── Loads User from MongoDB, compares refreshTokenVersion claim
    ├── FAIL → 401 UNAUTHORIZED or 401 TOKEN_EXPIRED
    └── PASS → attaches req.user = { id, email, role }

3.  requireRole('STUDENT' | 'COMPANY' | 'ADMIN')
    ├── Reads req.user.role
    ├── FAIL → 403 FORBIDDEN
    └── PASS → next()

4.  validate(zodSchema, target?)                target: 'body' (default) | 'params' | 'query'
    ├── Parses req[target] through the Zod schema
    ├── FAIL → 422 VALIDATION_ERROR + per-field details array
    └── PASS → req[target] is typed and coerced in place

5.  Controller                                  apps/api/src/modules/<domain>/<domain>.controller.ts
    ├── Extracts validated inputs from req
    ├── Calls one or more service functions
    └── Sends response via ok() / created() helpers

6.  Service                                     apps/api/src/modules/<domain>/<domain>.service.ts
    ├── Runs Mongoose queries
    ├── Applies business logic
    ├── May invoke matching algorithm, dispatch notifications, or write audit log
    └── Throws AppError on domain errors (NOT_FOUND, CONFLICT, etc.)

7.  Mongoose Model
    └── MongoDB wire protocol; toJSON transform strips _id, __v, passwordHash, refreshTokenVersion

8.  Response leaves the server
    2xx  { success: true,  data: T, message? }
    4xx  { success: false, error: { code, message, details? } }
    5xx  { success: false, error: { code: 'INTERNAL_ERROR', message } }
```

Unhandled `AppError` instances and Zod validation failures are converted in the central Express error handler before reaching the response.

---

## Response Envelope

All responses conform to `ApiResponse<T>` in `packages/types/src/api.ts`.

### Success (2xx)

```typescript
{
  "success": true,
  "data": T,
  "message": "Logged in"   // optional
}
```

### Error (4xx / 5xx)

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [                            // present on 422 only
      { "path": "email", "message": "Invalid email" }
    ]
  }
}
```

### Paginated lists

```typescript
{
  "success": true,
  "data": {
    "items": T[],
    "page": 1,
    "pageSize": 12,
    "total": 47,
    "totalPages": 4
  }
}
```

`DEFAULT_PAGE_SIZE = 12`, `MAX_PAGE_SIZE = 100` (from `@aip/config`).

### Common error codes

| Code | HTTP | Trigger |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `TOKEN_EXPIRED` | 401 | Access token expired; client should call refresh |
| `FORBIDDEN` | 403 | Authenticated but wrong role |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource (e.g. duplicate application) |
| `VALIDATION_ERROR` | 422 | Zod schema rejection; `details` array is populated |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | External dependency offline (e.g. Gemini unconfigured) |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password on login |

---

## Cookie-Based JWT Authentication

### Cookie pair

| Cookie | Name | Path | HttpOnly | SameSite | Purpose |
|--------|------|------|----------|----------|---------|
| Access token | `aip_at` | `/` | true | Strict | Verified on every protected request |
| Refresh token | `aip_rt` | `/api/v1/auth` | true | Strict | Used only to issue a new access token |

The `path=/api/v1/auth` restriction on `aip_rt` means the browser sends the refresh cookie only to the auth prefix, limiting its exposure to a narrow surface area.

### Auth flow

```
POST /api/v1/auth/register   → 201; sets aip_at + aip_rt
POST /api/v1/auth/login      → 200; sets aip_at + aip_rt
GET  /api/v1/auth/me         → reads aip_at; returns current user
POST /api/v1/auth/refresh    → reads aip_rt; rotates both cookies
POST /api/v1/auth/logout     → clears both cookies; returns 200
```

### Refresh rotation

1. A protected request returns 401 `TOKEN_EXPIRED`.
2. The Axios interceptor in `apps/web` catches the 401, sets a `_retry` flag on the original config to prevent loops, then calls `POST /api/v1/auth/refresh`.
3. The server reads `aip_rt`, verifies it, and checks that the `version` claim in the token matches `User.refreshTokenVersion` in the database.
4. New `aip_at` and `aip_rt` cookies are issued and overwrite the old ones.
5. The original request is retried.

`refreshTokenVersion` is incremented on logout, which immediately invalidates all outstanding refresh tokens for that user without requiring a deny-list.

---

## Role Model

```typescript
// packages/config/src/enums.ts
export const ROLES = ['STUDENT', 'COMPANY', 'ADMIN'] as const;
```

| Role | Who | Core capabilities |
|------|-----|------------------|
| `STUDENT` | University student | Browse and apply to jobs/internships; manage skills, resume, saved listings; view recommendations and skill-gap analysis |
| `COMPANY` | Industry partner | Post and manage jobs/internships; review applicants; schedule interviews; upload company logo |
| `ADMIN` | Platform staff | Full user management; company verification; skill catalog; force-close listings; analytics dashboards; audit logs |

`requireRole` is variadic: `requireRole('ADMIN', 'COMPANY')` allows either role; `requireRole('STUDENT')` is student-only.

---

## File Storage

```
POST /api/v1/resumes/me            (multipart, field: "file")
POST /api/v1/companies/me/logo     (multipart, field: "file")
         │
         ▼
multer (memoryStorage)
  ├── validates MIME type against FILE_LIMITS allow-list
  ├── rejects files over size limit (5 MB for resumes, 2 MB for logos)
  └── exposes buffer as req.file.buffer — no disk write
         │
         ▼
cloudinary.uploader.upload_stream(options, callback)
  └── streams buffer; returns { public_id, secure_url, … }
         │
         ▼
Model persistence
  Resume:         { cloudinaryPublicId, url, mimeType, sizeBytes, version }
  CompanyProfile: logoUrl (secure_url only)
```

Allowed MIME types (from `packages/config/src/constants.ts`):

```typescript
ALLOWED_RESUME_MIME: [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
ALLOWED_IMAGE_MIME: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
```

---

## AI Boundary

Gemini is strictly isolated to the server-side AI module. The boundary is enforced by code structure and environment variables.

```
apps/api/src/
  config/
    gemini.ts            Initialises Gemini client from GEMINI_API_KEY env var
  modules/ai/
    ai.routes.ts         Three POST endpoints; all requireAuth
    ai.controller.ts     Request/response shaping; no business logic
    ai.service.ts        Gemini SDK calls, prompt construction
                         explainJobMatch() — receives pre-computed score; returns prose only
```

Security constraints enforced in the codebase:

- `GEMINI_API_KEY` lives only in `apps/api/.env`; it is never referenced in `apps/web/`.
- All Gemini errors are caught in `ai.service.ts` and re-thrown as `AppError.internal('AI request failed')`. Raw SDK error messages never reach the HTTP response.
- When `GEMINI_API_KEY` is absent at startup, all three AI endpoints return 503 `SERVICE_UNAVAILABLE`.

### AI + matching separation

```
Request to POST /api/v1/ai/job-match
  │
  ▼
apps/api/src/modules/matching/algorithm.ts
  computeMatch(studentSkillIds, requiredSkillIds, preferredSkillIds)
  → MatchResult { score, matchedSkills, missingSkills, level, … }
  │
  ▼
apps/api/src/modules/ai/ai.service.ts
  explainJobMatch(matchResult, jobContext)
  → passes score + skill lists to Gemini as structured context
  → Gemini returns prose narrative only
  │
  ▼
Response: { ...matchResult, narrative: string }
```

The numeric score is immutable by the time Gemini is invoked.

See [matching.md](./matching.md) for the scoring algorithm and [ai.md](./ai.md) for the full AI integration spec.

---

## Deterministic Matching

The matching algorithm in `apps/api/src/modules/matching/algorithm.ts` uses pure Set intersection. It is synchronous, has no database dependency, and is called from both the recommendations service and the AI job-match endpoint.

Formula:

```
score = (matchedRequired / max(1, totalRequired)) × 80
      + (matchedPreferred / max(1, totalPreferred)) × 20
```

Weights `80` and `20` come from `MATCHING_WEIGHTS` in `@aip/config`. Thresholds for STRONG / GOOD / PARTIAL / LOW come from `MATCH_THRESHOLDS`. The result is rounded to the nearest integer.

See [matching.md](./matching.md) for worked examples, threshold table, and extension guidance.
