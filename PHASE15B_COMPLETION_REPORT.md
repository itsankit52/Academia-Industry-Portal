# Phase 15B — Completion Report

**Date**: 2026-08-31
**Portal**: Academia-Industry Collaboration Portal (AIP)
**Phase**: Phase 15B — Student Opportunity Discovery, Training Content Hardening & Skill Development Loop

---

## Executive Summary

Phase 15B builds three interlocking systems: (1) an **in-platform training content system** with modules and lessons that students consume and mark complete, (2) **student-facing faculty/institution opportunity discovery** so students can browse and apply to opportunities posted by companies and institutions, and (3) a **webhook security and idempotency hardening** layer protecting external LMS and ERP integrations. All three converge on a single goal: giving students a closed skill-development loop — discover opportunity → enroll in training → complete lessons → earn certificate → evidence in portfolio → reassess skills.

---

## A — In-Platform Training Content System

### Models

| Model                         | File                                                               | Purpose                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `TrainingModule`              | [TrainingModule.ts](apps/api/src/models/TrainingModule.ts)         | Groups lessons into sections; unique compound index on (training, order)                                   |
| `TrainingLesson`              | [TrainingLesson.ts](apps/api/src/models/TrainingLesson.ts)         | Atomic unit: VIDEO / ARTICLE / QUIZ / RESOURCE; unique compound index on (module, order)                   |
| `TrainingProgram` extended    | [TrainingProgram.ts](apps/api/src/models/TrainingProgram.ts)       | Added `contentType` (INTERNAL / EXTERNAL / HYBRID), `difficulty`, `estimatedHours`, `certificateAvailable` |
| `TrainingEnrollment` extended | [TrainingEnrollment.ts](apps/api/src/models/TrainingEnrollment.ts) | Added `completedLessons[]`, `currentLesson`, `totalLessons`                                                |

### Service Layer

| File                                                                                         | Key Functions                                                                                                  |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [trainingContent.service.ts](apps/api/src/modules/training/trainingContent.service.ts)       | `getTrainingContent` (modules + lessons tree), `completeLesson` (idempotent), `getReassessmentRecommendations` |
| [trainingContent.controller.ts](apps/api/src/modules/training/trainingContent.controller.ts) | HTTP handlers for all content endpoints                                                                        |
| [trainingEnrollment.service.ts](apps/api/src/modules/training/trainingEnrollment.service.ts) | `enrollStudentInTraining`, `dropEnrollment`, `updateTrainingProgress`, `completeTrainingEnrollment`            |

### API Endpoints

| Method   | Path                                           | Auth        | Description                                  |
| -------- | ---------------------------------------------- | ----------- | -------------------------------------------- |
| GET      | `/training/:id/content`                        | Public      | Full module + lesson tree for a training     |
| POST     | `/training/:id/modules`                        | ADMIN       | Create module                                |
| PATCH    | `/training/:id/modules/:moduleId`              | ADMIN       | Update module                                |
| DELETE   | `/training/:id/modules/:moduleId`              | ADMIN       | Delete module (cascades lessons)             |
| POST     | `/training/:id/lessons`                        | ADMIN       | Create lesson                                |
| PATCH    | `/training/lessons/:lessonId`                  | ADMIN       | Update lesson                                |
| DELETE   | `/training/lessons/:lessonId`                  | ADMIN       | Delete lesson                                |
| GET      | `/training/modules/:moduleId/lessons`          | Public      | Lessons for a module                         |
| GET      | `/training/lessons/:lessonId`                  | Public      | Single lesson                                |
| **POST** | **`/training/:id/lessons/complete`**           | **STUDENT** | **Idempotent lesson completion**             |
| GET      | `/training/enrollments/:enrollmentId/reassess` | STUDENT     | Reassessment recommendations post-completion |
| POST     | `/training/:id/enroll`                         | STUDENT     | Enroll in training                           |
| GET      | `/training/enrollments/mine`                   | STUDENT     | List my enrollments                          |
| GET      | `/training/enrollments/:enrollmentId`          | STUDENT     | Enrollment detail                            |
| PATCH    | `/training/enrollments/:enrollmentId/progress` | STUDENT     | Manual progress update                       |
| POST     | `/training/enrollments/:enrollmentId/complete` | STUDENT     | Mark training complete, generate certificate |
| DELETE   | `/training/enrollments/:enrollmentId`          | STUDENT     | Drop enrollment                              |

### Key Design Decisions

1. **Idempotent lesson completion**: `completeLesson` checks `completedLessons` array before adding; duplicate calls are no-ops (progress unchanged, no error thrown).
2. **Progress auto-calculation**: Each completed lesson recalculates `progress = Math.round((completedCount / totalLessons) * 100)` clamped to 100.
3. **Auto-transition ENROLLED → IN_PROGRESS**: First lesson completion triggers the status transition.
4. **Certificate reuse**: Training completion calls `DocumentModel.create` with `documentType='CERTIFICATE'` — the same document system already used for internship certificates, so download URLs, access controls, and the documents page are all shared.
5. **No auto-proficiency upgrade**: `completeTrainingEnrollment` does NOT touch `StudentSkill` proficiency. Evidence is created but proficiency is left for the reassessment step.
6. **Reassessment**: `GET /training/enrollments/:enrollmentId/reassess` returns covered skills (from the training's linked Skill documents) and a message guiding the student to take an assessment.

### Frontend

| File                                                                                    | Description                                                                       |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [useTrainingContent.ts](apps/web/src/hooks/queries/useTrainingContent.ts)               | Hooks: `useTrainingContent`, `useCompleteLesson`, `useReassessmentRecommendation` |
| [StudentMyTrainingDetails.tsx](apps/web/src/pages/student/StudentMyTrainingDetails.tsx) | Enhanced with module/lesson browser, mark-done buttons, reassessment card         |
| [StudentTraining.tsx](apps/web/src/pages/student/StudentTraining.tsx)                   | Existing catalog page; filters by skills; shows recommended                       |

---

## B — Student → Faculty/Institution Opportunity Discovery

### Architecture

No new model created. The existing `FacultyOpportunity` model already supports `targetRoles: ['STUDENT', 'FACULTY']`. A dedicated service/router pair (`studentOpportunities`) applies STUDENT-specific visibility filters.

### Service Layer

| File                                                                                                                  | Key Functions                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| [student-opportunities.service.ts](apps/api/src/modules/student-opportunities/student-opportunities.service.ts)       | `listOpportunitiesForStudent`, `getOpportunityForStudent`, `applyToOpportunity`, `withdrawApplication`, `listMyApplications` |
| [student-opportunities.controller.ts](apps/api/src/modules/student-opportunities/student-opportunities.controller.ts) | HTTP handlers                                                                                                                |
| [student-opportunities.routes.ts](apps/api/src/modules/student-opportunities/student-opportunities.routes.ts)         | All routes, all guarded with `requireRole('STUDENT')`                                                                        |

### API Endpoints

| Method | Path                                               | Description                                                                                     |
| ------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/student-faculty-opportunities`                   | List visible opportunities with filters (q, opportunityType, hostType, mode, requiredExpertise) |
| GET    | `/student-faculty-opportunities/:id`               | Single opportunity detail                                                                       |
| POST   | `/student-faculty-opportunities/:id/apply`         | Apply (idempotent via unique index)                                                             |
| POST   | `/student-faculty-opportunities/:id/withdraw`      | Withdraw application                                                                            |
| GET    | `/student-faculty-opportunities/-/my-applications` | Student's own applications                                                                      |

### Visibility Rules (enforced server-side)

- `status === 'PUBLISHED'`
- `targetRoles` includes `'STUDENT'`
- `applicationDeadline >= now`

### Match Score

`computeExpertiseMatch`: computed as `(skillHits / requiredSkills) * 100`, case-insensitive, 0 if no required skills. Shown on list cards and detail pages.

### Frontend

| File                                                                                                    | Description                                                                            |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [useStudentFacultyOpportunities.ts](apps/web/src/hooks/queries/useStudentFacultyOpportunities.ts)       | All hooks: list, detail, apply, withdraw, my-applications                              |
| [StudentFacultyOpportunities.tsx](apps/web/src/pages/student/StudentFacultyOpportunities.tsx)           | Browse + filter + my-applications tab                                                  |
| [StudentFacultyOpportunityDetails.tsx](apps/web/src/pages/student/StudentFacultyOpportunityDetails.tsx) | Full detail, apply form, withdraw button                                               |
| `/student/faculty-opportunities`                                                                        | Route registered in [router.tsx](apps/web/src/router.tsx)                              |
| Nav item                                                                                                | "Faculty Opps" in [StudentNavItems.ts](apps/web/src/components/nav/StudentNavItems.ts) |

---

## C — Webhook Security & Integration Hardening

### HMAC-SHA256 Signature Verification

All LMS and ERP webhooks require a valid HMAC-SHA256 signature:

```typescript
// webhooks.controller.ts — verifySignature
function verifySignature(
  rawBody: Buffer,
  headerValue: string | undefined,
  secret: string,
): boolean {
  if (!headerValue) return false;
  const provided = headerValue.startsWith('sha256=') ? headerValue.slice(7) : headerValue;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (provided.length !== computed.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(computed, 'hex'));
}
```

- Timing-safe comparison via `crypto.timingSafeEqual` — no timing side-channel
- Header format: `sha256=<hex>` or bare hex
- Rejects missing/invalid signature with **401 Unauthorized** before any processing
- Secrets read from `process.env.WEBHOOK_LMS_SECRET` and `process.env.WEBHOOK_ERP_SECRET`
- **Secrets are never logged**

### Idempotency

| Webhook          | Idempotency Key          | TTL      |
| ---------------- | ------------------------ | -------- |
| LMS Certificate  | `email:verificationCode` | 24 hours |
| ERP Student Sync | `institutionId:email`    | 24 hours |

Both use in-memory `Map` with periodic TTL sweep. On duplicate detection, the existing record is returned (not re-created).

### Placeholder Password Security

Imported student accounts use a CSPRNG-generated placeholder secret (never returned, logged, or stored in plaintext):

```typescript
// webhooks.service.ts — unusablePlaceholderSecret
function unusablePlaceholderSecret(): string {
  return `erp-import:${randomBytes(32).toString('base64url')}`;
}
```

Accounts are created with `isActive: false`, requiring admin activation before use.

---

## D — Training → Skill Development Loop

- **Evidence on completion**: `completeTrainingEnrollment` creates a `CERTIFICATE` document linked to the training.
- **No auto-proficiency upgrade**: Training completion is evidence of participation, not mastery. Proficiency stays unchanged.
- **Reassessment recommendation**: `GET /training/enrollments/:enrollmentId/reassess` returns covered skills and directs the student to assessments.
- **Skill evidence chain**: Training evidence → assessment score → portfolio display (existing system, no changes needed).

---

## Testing

| File                                                                                                              | Coverage                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [trainingContent.test.ts](apps/api/src/modules/training/__tests__/trainingContent.test.ts)                        | Progress calculation, lesson idempotency, status transitions, lesson type validation, content type validation |
| [trainingEnrollment.test.ts](apps/api/src/modules/training/__tests__/trainingEnrollment.test.ts)                  | Certificate generation, filename sanitization, progress bounds, enrollment status transitions                 |
| [studentOpportunities.test.ts](apps/api/src/modules/student-opportunities/__tests__/studentOpportunities.test.ts) | Visibility filters, expertise match scoring, application status transitions, application idempotency          |
| [webhooks.service.test.ts](apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts)                      | Per-student CSPRNG password hashes, isActive=false, idempotency                                               |

---

## Security Summary

| Concern                        | Mitigation                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Webhook replay attacks         | HMAC-SHA256 signature with timing-safe comparison                                  |
| Duplicate certificate creation | Idempotency map keyed by email+verificationCode                                    |
| Duplicate student import       | Idempotency map keyed by institutionId+email                                       |
| Secret leakage in logs         | No secrets logged anywhere                                                         |
| Student sees non-target opps   | Server-side filter: `status=PUBLISHED`, `targetRoles=STUDENT`, deadline not passed |
| Unauthorized lesson completion | `requireRole('STUDENT')` + ownership check on enrollment                           |
| Unauthorized enrollment access | `requireRole('STUDENT')` + `studentProfileId` match on enrollment document         |

---

## Files Created / Modified This Phase

### Backend (API)

| Action   | File                                                                                                     |
| -------- | -------------------------------------------------------------------------------------------------------- |
| Created  | `apps/api/src/modules/student-opportunities/student-opportunities.service.ts`                            |
| Created  | `apps/api/src/modules/student-opportunities/student-opportunities.controller.ts`                         |
| Created  | `apps/api/src/modules/student-opportunities/student-opportunities.routes.ts`                             |
| Created  | `apps/api/src/modules/training/trainingContent.controller.ts`                                            |
| Created  | `apps/api/src/modules/training/trainingContent.service.ts`                                               |
| Created  | `apps/api/src/modules/training/__tests__/trainingContent.test.ts`                                        |
| Created  | `apps/api/src/modules/student-opportunities/__tests__/studentOpportunities.test.ts`                      |
| Created  | `apps/api/src/modules/webhooks/__tests__/webhooks.service.test.ts`                                       |
| Extended | `apps/api/src/models/TrainingProgram.ts` (contentType, difficulty, estimatedHours, certificateAvailable) |
| Extended | `apps/api/src/models/TrainingEnrollment.ts` (completedLessons, currentLesson, totalLessons)              |
| Extended | `apps/api/src/routes/index.ts` (studentOpportunitiesRouter mounted at `/student-faculty-opportunities`)  |

### Frontend (Web)

| Action   | File                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------ |
| Created  | `apps/web/src/hooks/queries/useStudentFacultyOpportunities.ts`                                   |
| Created  | `apps/web/src/hooks/queries/useTrainingContent.ts`                                               |
| Created  | `apps/web/src/pages/student/StudentFacultyOpportunities.tsx`                                     |
| Created  | `apps/web/src/pages/student/StudentFacultyOpportunityDetails.tsx`                                |
| Enhanced | `apps/web/src/pages/student/StudentMyTrainingDetails.tsx` (module/lesson browser + reassessment) |
| Extended | `apps/web/src/router.tsx` (added student opportunity discovery routes)                           |
| Extended | `apps/web/src/components/nav/StudentNavItems.ts` (Faculty Opps nav item)                         |

### Documentation

| Action  | File                            |
| ------- | ------------------------------- |
| Created | `PHASE15B_COMPLETION_REPORT.md` |
| Created | `PHASE15B_SIH_TRACEABILITY.md`  |
