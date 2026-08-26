# Production Hardening Report — Academia–Industry Portal

**Date:** 2026-08-25
**Scope:** Phases 1–7 of the hardening brief — job/internship publishing, authentication, real MongoDB data, AI skill-gap analysis, Gemini resilience, end-to-end user flows, and verification.
**Repository:** `C:\P3\academia-industry-portal\academia-industry-portal` (pnpm monorepo: `apps/web`, `apps/api`, `packages/*`)

---

## 1. ROOT CAUSE

There was no single fault. The reported symptoms traced to nine distinct root causes, listed here with the symptom each produced.

**Job and internship publishing returned 422.** The frontend react-hook-form schemas omitted `requiredSkills` entirely. The server schema declares `requiredSkills: z.array(objectIdSchema).min(1)`, so every publish attempt was rejected for a field the form never collected and never displayed an error for. Compounding it, blank optional number inputs (`salaryMin`, `stipend`, `minCgpa`, `openings`) were registered with `valueAsNumber`, which turns `""` into `NaN`; `JSON.stringify` serialises `NaN` as `null`, and the server's `.optional()` fields reject `null`. The client also validated `currency` as `max(3)` where the server requires exactly `length(3)`, so a one- or two-letter code passed the form and failed at the API.

**422 responses were undiagnosable.** The validation middleware returned a generic message without naming the offending path, so the failing field could not be identified from the response.

**Login intermittently returned 401 "Invalid credentials" after a successful signup.** The seed script's `clearAll()` truncated all 27 collections — including `users` — so running `pnpm seed` at any point destroyed every signup-created account. The subsequent 401 was *correct behaviour* reporting a genuinely absent user. The bug was the seed script's blast radius, not the authentication logic. Password verification, bcrypt, and JWT issuance were all found to be working as written.

**Logout did not end the session.** The refresh token was never revoked server-side, so a captured refresh cookie remained valid after logout.

**Refresh rotation caused spurious logouts,** and successful authentication requests consumed the rate-limit budget, so ordinary use could lock a user out.

**Draft opportunities leaked to students.** Public job and internship endpoints did not constrain `status`, and the company-scoped list services returned all statuses regardless of viewer. Separately, the saved-opportunities service filtered on nothing at all, so a posting a company later unpublished stayed on the student's saved page — linking to a detail route that 404s and offering an Apply button that could not succeed.

**Several student pages were permanently blank, and IDs were `undefined` throughout.** Every Mongoose schema in this project carries a `toJSON` transform that sets `ret.id = String(ret._id)` and deletes `_id`. Mongoose runs that transform **only on hydrated documents**. Any query ending in `.lean()` therefore ships a raw `_id` and no `id`. Recommendations, training, and saved opportunities all used `.lean()`, so the React keys, the detail links (`/student/jobs/undefined`), and both the Apply and Unsave buttons were broken. The recommendations page rendered nothing at all.

**The apply request contract was broken,** and neither the application deadline nor the remaining-openings count was enforced server-side.

**Gemini was a silent single point of failure.** Both live `.env` files pinned `GEMINI_MODEL=gemini-1.5-flash`, a model Google retired in 2025 — a value inherited by anyone who followed the documented setup of copying `.env.example`. Every Gemini call 404s, every AI feature falls through to its fallback, and the result is indistinguishable from the AI having nothing useful to add. There was also no deterministic baseline behind the AI path, so an AI failure meant no result rather than a degraded one.

**Every ERP-imported student shared one password.** `handleErpStudentSync` hashed a single placeholder secret *outside* the per-student loop and reused it for the whole batch, so recovering one plaintext would unlock every imported account. That secret was derived from `Date.now()` (guessable) and `Math.random()` (not a CSPRNG). The flaw was latent rather than live, because imported accounts are created `isActive: false` and login rejects inactive users — but activation is the entire point of the import.

---

## 2. FILES CHANGED

Sixty files, grouped by concern. Files marked **new** did not previously exist.

### Publishing and validation (Phase 1)

| File | Change |
| --- | --- |
| `apps/web/src/pages/company/CompanyJobCreate.tsx` | Reference implementation of the form fix |
| `apps/web/src/pages/company/CompanyJobEdit.tsx` | Same fix set |
| `apps/web/src/pages/company/CompanyInternshipCreate.tsx` | Same fix set |
| `apps/web/src/pages/company/CompanyInternshipEdit.tsx` | Same fix set |
| `apps/api/src/middleware/validate.ts` | 422s now name the failing field |
| `apps/api/src/utils/validationMessage.ts` | Field-path formatting |
| `apps/api/src/middleware/errorHandler.ts` | Consistent error envelope |

### Authentication and session (Phase 2)

| File | Change |
| --- | --- |
| `apps/api/src/modules/auth/auth.service.ts` | Logout revocation, refresh rotation, login diagnostics |
| `apps/api/src/modules/auth/auth.controller.ts` | Cookie clearing on logout |
| `apps/api/src/middleware/rateLimit.ts` | Successful auth no longer burns the limit |
| `apps/api/src/middleware/optionalAuth.ts` | Viewer resolution for public endpoints |
| `apps/api/src/db/mongoose.ts` | Connection handling |
| `apps/api/src/__tests__/auth.spec.ts` | Register→login integration coverage |
| `apps/api/src/__tests__/globalSetup.ts`, `apps/api/vitest.config.ts` | Test DB gating |

### Real data and draft visibility (Phase 3)

| File | Change |
| --- | --- |
| `apps/api/src/modules/jobs/jobs.service.ts` | `resolveListStatus`, `assertCanViewJob` |
| `apps/api/src/modules/internships/internships.service.ts` | Same |
| `apps/api/src/modules/jobs/{jobs.controller,jobs.routes}.ts` | `/me/managed` route, guard order |
| `apps/api/src/modules/internships/{internships.controller,internships.routes}.ts` | Same |
| `apps/api/src/modules/saved-opportunities/saved-opportunities.service.ts` | Status filter, serialisation, populate narrowing |
| `apps/api/src/modules/applications/applications.service.ts` | Apply contract, deadline and openings enforcement |
| `apps/api/src/utils/serializeLean.ts` | **new** — `_id` → `id` for `.lean()` reads |
| `apps/api/src/modules/recommendations/recommendations.service.ts` | Serialisation fix |
| `apps/api/src/modules/training/training.service.ts` | Serialisation fix |
| `apps/web/src/hooks/queries/{useCompanyJobs,useCompanyInternships}.ts` | Repointed to `/me/managed` |
| `apps/web/src/hooks/queries/{useAdminJobs,useAdminInternships}.ts` | Scope params |
| `apps/web/src/hooks/queries/{useRecommendations,useRecommendedTrainings,useApplyToOpportunity}.ts` | Contract fixes |
| `apps/web/src/pages/student/{StudentRecommended,StudentTraining}.tsx` | Render real data |
| `apps/web/src/pages/public/{PublicJobDetails,PublicInternshipDetails}.tsx` | Published-only reads |
| `apps/web/src/pages/public/Landing.tsx` | Fabricated statistics removed |
| `apps/web/src/components/features/ApplyModal.tsx` | Corrected payload |
| `apps/web/src/router.tsx` | Route wiring |

### AI skill gap and Gemini resilience (Phases 4–5)

| File | Change |
| --- | --- |
| `apps/api/src/modules/matching/skillGap.ts` | Deterministic baseline; Gemini as enhancement only |
| `apps/api/src/modules/matching/algorithm.ts`, `matching/index.ts` | Set normalisation, match scoring |
| `apps/api/src/modules/ai/ai.service.ts` | Fallback on Gemini failure, backend-only key use |
| `apps/api/src/config/geminiModels.ts` | **new** — retired-model detection, model resolution |
| `apps/api/src/config/env.ts` | Model default and startup warning |
| `apps/web/src/hooks/queries/useSkillGap.ts`, `pages/student/StudentSkillGap.tsx` | Render all five required fields |
| `apps/web/src/components/ui/MatchBadge.tsx` | Match percentage display |
| `apps/web/src/pages/student/StudentAssessments.tsx` | Removed hardcoded model name from UI copy |
| `.env`, `.env.example`, `apps/api/.env`, `apps/api/.env.example` | `gemini-1.5-flash` → `gemini-2.5-flash` |

### Operational safety

| File | Change |
| --- | --- |
| `apps/api/src/scripts/seed.ts` | `assertSafeToWipe()` guard before any connection |
| `apps/api/src/scripts/seedTarget.ts` | **new** — connection-string host inspection |
| `apps/api/src/modules/webhooks/webhooks.service.ts` | Per-account CSPRNG password placeholder |
| `README.md`, `docs/GETTING_STARTED_WINDOWS.md` | Setup and troubleshooting corrections |

### Tests added

`apps/api/src/config/__tests__/geminiModels.test.ts` (new, 22), `modules/saved-opportunities/__tests__/saved-opportunities.service.test.ts` (new, 10), `modules/webhooks/__tests__/webhooks.service.test.ts` (new, 5), `scripts/__tests__/seedTarget.test.ts` (new, 15), `utils/__tests__/serializeLean.test.ts` (new, 11), plus additions to `modules/matching/__tests__/{algorithm,skillGap}.test.ts`, `modules/ai/__tests__/ai.service.test.ts`, `modules/recommendations/__tests__/service.test.ts`, and `apps/web/src/components/ui/__tests__/MatchBadge.test.tsx`.

---

## 3. CHANGES MADE

**Forms now agree with the server schema.** `requiredSkills` was added to all four company form schemas as `z.array(objectIdSchema).min(1)` and wired through react-hook-form's `Controller` to the existing `SkillPicker`, so the field is tracked and its error renders. A `numberFromInput` `setValueAs` helper returns `undefined` for empty, null, and `NaN` inputs, so a blank optional number becomes an absent key rather than `null`; `textFromInput` does the same for optional strings. `currency` moved from `max(3)` to `length(3)`, matching the server. Cross-field rules that the server expresses as `refine` are mirrored in `superRefine` — the salary trio must be filled together with `salaryMax >= salaryMin`, and a stipend requires a currency. No server-side validation was removed; the client was tightened to meet it.

**Authentication was fixed without being weakened.** bcrypt (`bcryptjs`, 10 rounds), JWT issuance, and httpOnly cookies are unchanged. Logout now increments the stored refresh-token version so an outstanding refresh cookie is dead on arrival. Refresh rotation no longer invalidates the session it just renewed. Successful authentication requests no longer count against the rate limiter, so normal use cannot lock a user out. Login failures now log a server-side reason (unknown email, bad password, deactivated account) while the client response stays a uniform "Invalid credentials", so failures are diagnosable without becoming an account-enumeration oracle. The intermittent 401 was resolved at its real source: `assertSafeToWipe()` now refuses to run the seed against any non-local host or under `NODE_ENV=production`, before a connection is opened, with `SEED_FORCE=1` as the explicit operator override.

**Student-facing reads are constrained to `PUBLISHED`.** `resolveListStatus` forces `'PUBLISHED'` for non-admin viewers, and `assertCanViewJob` returns early only for published postings — admins pass, a company passes only for postings it owns, everything else is `AppError.notFound`. In saved opportunities, both list paths were consolidated behind one `fetchVisibleOpportunities()` helper that applies `status: 'PUBLISHED'` inside the database query, so the filter cannot drift apart between endpoints again; `saveOpportunity` checks the same status via `exists({_id, status})` and answers a generic 404, so a guessed ID cannot be used to probe for unpublished postings. Ownership checks (`String(job.company) !== companyId` → `AppError.forbidden`) are untouched, and every mutating company route still sits behind `requireAuth` → `requireRole('COMPANY')`.

**`.lean()` reads are serialised explicitly.** The new `serializeLean` walks a lean row and its populated references, renaming `_id` to `id` and rendering ObjectIds as hex strings while leaving `Date` and `Buffer` values intact. It runs before `normalizeCompanyOn`, which maps a populated company's `companyName` to `name`. This restored the recommendations page, the training page, and the saved page — including the previously dead Apply and Unsave buttons. The saved-opportunities populate was narrowed to `select: 'companyName logoUrl'`, matching `jobs.service`; as a side effect it stops shipping the company's `phone`, `verifiedAt`, and owning `user` ObjectId to students.

**Skill-gap analysis is deterministic first, AI-enhanced second.** The service reads the student's skills and the posting's required skills from MongoDB, computes `matchedSkills = intersection`, `missingSkills = required − student`, and `matchPercentage = matched / required × 100` with case-, whitespace- and duplicate-normalisation, then attempts Gemini for narrative recommendations. On Gemini success the AI result is returned; on any failure the mathematical result is returned and the fallback is logged server-side, without exposing API keys or internal errors to the user. Empty skill sets, missing data, and a zero required-skill denominator are all handled rather than thrown. No skills are invented, and no fake AI result is ever presented as genuine.

**Gemini misconfiguration is now loud instead of silent.** Four env files were corrected to `gemini-2.5-flash`, and `config/env` now takes its default from `RECOMMENDED_GEMINI_MODEL` so the two cannot drift. `resolveGeminiModel` collapses an empty or whitespace-only `GEMINI_MODEL=` line back to the recommended id — a Zod `.default()` fires only on `undefined`, so a bare `GEMINI_MODEL=` would otherwise have reached `getGenerativeModel({ model: '' })` and reintroduced exactly the silent-fallback trap this work removed. A retired id is *not* silently repaired; it triggers a startup `console.warn` naming the value and the fix. The warning is a warning and not a fatal error, because killing the portal over an AI model id would violate the requirement never to fail the whole feature when Gemini is unavailable. The Gemini key is read only in `apps/api`; the sole mention in `apps/web` is an explanatory comment with no value and no import.

**ERP-imported accounts get individual password hashes.** `unusablePlaceholderSecret()` returns `erp-import:` plus 32 CSPRNG bytes and is now called *inside* the per-student loop, so two accounts in one batch cannot collide. The plaintext is passed straight to `hashPassword` and discarded — never returned, never logged. bcrypt is unchanged, `passwordHash` remains `select: false` and is deleted by the model's `toJSON`.

---

## 4. TESTS RUN

Two typechecks and one unit suite were **actually executed** in this environment. The exact commands:

```
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js --noEmit -p /tmp/tsconfig.api.json
node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js --noEmit -p /tmp/tsconfig.web.json
node --preserve-symlinks --preserve-symlinks-main /tmp/run/runner.cjs <9 absolute test paths>
```

The typechecks use synthetic tsconfigs because the workspace `tsconfig` files rely on project references that need a build step. Coverage was verified with `tsc --listFiles | grep`, confirming every changed file is genuinely in the checked set rather than silently excluded.

The unit suite ran through an offline harness (`/tmp/run/runner.cjs`) that transpiles the repo's TypeScript with `ts.transpileModule` and implements the `vitest` API surface the tests use. This was necessary because the real `vitest` binary cannot start here — see Deployment Risks. The harness executes the project's own unmodified test files; no test was altered to make it pass, and two harness gaps encountered mid-run (`toMatchObject`, `not.toHaveProperty`) were fixed in the harness rather than worked around in the tests.

The nine files executed: `config/__tests__/geminiModels.test.ts`, `modules/ai/__tests__/ai.service.test.ts`, `modules/matching/__tests__/algorithm.test.ts`, `modules/matching/__tests__/skillGap.test.ts`, `modules/recommendations/__tests__/service.test.ts`, `modules/saved-opportunities/__tests__/saved-opportunities.service.test.ts`, `modules/webhooks/__tests__/webhooks.service.test.ts`, `scripts/__tests__/seedTarget.test.ts`, `utils/__tests__/serializeLean.test.ts`.

An independent adversarial review of the nine most security-sensitive changed files was also run against the brief's six hard constraints, checking specifically for residual draft exposure, populate fields the frontend still needs, ERP hash collisions, client/server schema divergence, seed-guard bypass, and key leakage toward the frontend.

---

## 5. TEST RESULTS

| Check | Result |
| --- | --- |
| `tsc --noEmit` (API, 554 files in the checked set) | **exit 0** — no errors |
| `tsc --noEmit` (web) | **exit 0** — no errors |
| API unit suite, 9 files | **128 passed, 0 failed** |
| Adversarial constraint review, 9 files | **No violation of any of the six hard constraints** |

Of the 128, sixty-three sit in the five test files added by this work: 22 for Gemini model resolution (`isRetiredGeminiModel` 15, `resolveGeminiModel` 7), 15 for the seed guard (`targetHosts` 7, `isLocalTarget` 8), 11 for lean serialisation, 10 for saved-opportunity visibility (`listSavedGrouped` 6, `listSaved` 2, `saveOpportunity` 2), and 5 for ERP password hashing. The remaining sixty-five are in four pre-existing suites that were extended during this work — `analyzeSkillGap` 16, `recommendJobs` 16, `explainJobMatch` 15, and the matching algorithm 18 (`computeMatch` 12, `idOf` 4, `normalizeIds` 2) — so the pre-existing and added tests in those four cannot be cleanly separated without the original files.

Several of these tests were confirmed to fail against the pre-fix code, so they are genuine regression tests rather than tests written to fit current behaviour. The ERP test asserting `new Set(hashes).size === 3` fails against the old batch-level hash. The saved-opportunities tests assert the literal `{_id: {$in: [...]}, status: 'PUBLISHED'}` filter reaches both models. The `resolveGeminiModel` tests cover `undefined`, `''`, `'   '`, and `'\t\n'` — the case a plain `.default()` misses.

The review confirmed no remaining path by which a student can see or act on a non-published posting across all five saved-opportunity functions; that the narrowed populate drops no field `StudentSaved.tsx`, `JobCard.tsx`, or `InternshipCard.tsx` reads; that the ERP placeholder is unrecoverable and bcrypt is intact; that all four company forms satisfy their server schemas with no reachable `NaN` or `null`; and that the seed guard fails closed on all 25 adversarial connection strings tested, including credential-smuggling attempts like `mongodb://localhost@evil.example.com/db`.

It also found the empty-`GEMINI_MODEL` hole described above, which was fixed and covered by tests before this report was written.

---

## 6. REMAINING ISSUES

**The `.lean()` serialisation bug persists in roughly twenty other service files.** Only the three paths with observed symptoms were fixed. Any other endpoint ending a query in `.lean()` still returns `_id` instead of `id` and will break its consumer the same way. Find them with `grep -rln "\.lean()" --include=*.service.ts apps/api/src`. This is the highest-value follow-up.

**Admin list filters silently do nothing.** `useAdminJobs` and `useAdminInternships` send `scope`, `company`, and `q` query parameters that the corresponding controllers never read, so the admin UI appears to filter but returns unfiltered results.

**Optional fields cannot be cleared through the edit forms.** Emptying an input yields `undefined`, `JSON.stringify` drops the key, and the server's `.partial()` schema reads an absent key as "leave unchanged". A company therefore cannot remove an existing `applicationDeadline`, `stipend`, or `minCgpa` — the old value silently persists. Fixing this needs an explicit `null` plus a server-side `$unset`.

**ERP-imported students cannot log in by any route.** There is no password-reset or self-serve activation endpoint in the API, and the admin `activateUser` route only flips `isActive` without setting a password. The import populates profile data ahead of a credential flow that has not been built. This fails closed, which is the safe direction, but it is a functional dead end; the code comment was corrected to say so.

**Validation bounds disagree across the three layers.** `eligibleGradYears` has a lower bound of 1950 in Zod, 1970 in Mongoose, and 1950 in the form; `description` allows 5 000 characters in Zod and 10 000 in the models. Neither currently breaks a user flow, but the Mongoose layer will reject values the API accepted.

**`GET /jobs` never returns `matchScore`,** so `MatchBadge` never renders on `StudentJobs` despite being wired up.

**`docs/CHANGING_AI_MODEL.md` still recommends `gemini-flash-latest`** rather than the now-canonical `gemini-2.5-flash`.

**Minor:** dead code at the end of the ERP sync loop (`if (isNewUser && !existingProfile) { continue; }` is a no-op, and `createdCount` counts profiles rather than accounts, so its name misleads); an unused `INTERNSHIP_STATUSES` import in `CompanyInternshipCreate.tsx`, mirroring the same unused import in the reference `CompanyJobCreate.tsx`; and the pre-existing literal `DEMO_PASSWORD = 'Demo@1234'` in `seed.ts`, which is documented project-wide and whose blast radius the new seed guard materially reduces.

---

## 7. DEPLOYMENT RISKS

**Five verification gates could not be executed here, and all five trace to one cause:** `node_modules` was installed on Windows, while this sandbox is Linux. Each was attempted and failed for a confirmed reason.

Real `vitest` cannot start: only `@esbuild/win32-x64@0.21.5` and `@0.28.2` are present, so esbuild dies with `ERR_MODULE_NOT_FOUND` on Linux. `vite build` fails identically, so **the production bundle has never been built** — the web app is verified only by `tsc`, which does not exercise Vite resolution, asset handling, or the Tailwind pipeline. ESLint crashes loading `eslint/lib/rules/utils/lazy-loading-rule-map.js:7`, so **lint has not run** against any changed file. The eight DB-backed integration specs in `apps/api/src/__tests__/` are all wrapped in `describe.skipIf(!hasTestDb)` and skipped cleanly: no `mongod` or `mongosh` binary is present, `mongodb-memory-server` is not installed, and there is no network access to reach Atlas. **No test therefore touched a real database, real Mongoose validation, or a real HTTP round trip.** The five Playwright specs (`auth`, `student-apply`, `company-post-and-shortlist`, `skill-gap`, `admin-manage`) and any live browser flow need installed browsers and running servers, so **Phase 6 was verified by reading and unit-testing the code paths, not by driving the UI.** The ten `apps/web` unit test files also did not run, for the same vitest reason.

The consequences worth weighing before deploying: the service layer is well covered by mock-based unit tests, but **Mongoose schema validation, index behaviour, and the populate-and-serialise round trip are only verified against stubs.** The saved-opportunities and recommendations fixes in particular are about the shape of data crossing the `.lean()` boundary — exactly the thing a stub can misrepresent. A real-database run of the eight integration specs is the single highest-value check remaining.

**The Gemini path is untested against the live API.** `GEMINI_API_KEY` is empty in both live `.env` files, so every AI feature currently serves its deterministic fallback by design. That is the intended degradation and the portal is fully functional without it, but the AI-success branch has been exercised only against mocks. When a key is added, watch the first request: if the model id is wrong the new startup warning will say so, and the fallback will absorb the failure quietly.

**Operational notes.** `pnpm seed` now refuses non-local targets, but `SEED_FORCE=1` overrides that — do not set it in any deployment script. `COOKIE_SECURE` must be `true` in production or refresh cookies travel unencrypted. `apps/api/.env` and the root `.env` both exist and both define overlapping keys; confirm which one the deployed process actually loads. Reinstalling dependencies on the target platform (`pnpm install --force`) is required before any build or test command will work on Linux or in CI.

---

## 8. FINAL STATUS

**NOT READY** — for production deployment, on verification grounds rather than known defects.

Every defect identified across Phases 1–5 has been fixed in the existing files, the changes typecheck cleanly on both apps, 128 unit tests pass with none failing, and an independent adversarial review found no violation of any of the six hard security constraints: authentication and authorization remain enabled, company ownership is still enforced, drafts are not exposed to students, no credentials are hardcoded, the Gemini key stays backend-only, and no validation was removed to make a request pass.

What blocks a READY verdict is that four gates never ran in this environment — the production build, ESLint, the database-backed integration suite, and the browser end-to-end flows. Since the brief requires that no test be claimed as passing unless it was actually executed, the honest position is that the code is verified as far as static analysis and unit testing can reach, and no further.

To close the gap, on Windows with MongoDB running:

```
pnpm install --force
pnpm -w typecheck && pnpm -w lint && pnpm -w build
pnpm --filter @aip/api test          # the 8 integration specs will now execute
pnpm --filter @aip/web test
pnpm --filter @aip/web test:e2e      # after starting both servers
```

If those five commands pass, this report's verdict becomes **READY**. The expectation is that they will: the failures seen here were all platform artifacts, not code errors. But that is a prediction, not a result, and it should not be treated as one.
