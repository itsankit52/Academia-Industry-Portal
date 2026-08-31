# Phase 15B — SIH Problem Statement Traceability

**Portal**: Academia-Industry Collaboration Portal (AIP)
**Phase**: Phase 15B
**Purpose**: Map each Phase 15B implementation to the Smart India Hackathon (SIH) problem statement requirements and verify complete coverage.

---

## SIH Problem Statements & Phase 15B Coverage

### 1. Student Skill Gap Identification & Training Recommendation

| SIH Requirement                                                       | Implementation                                                                                                                                                     | Files                                                                                                                                                            |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identify skill gaps between student profile and industry requirements | `recommendTrainingsForStudent` in [training.service.ts](apps/api/src/modules/training/training.service.ts) uses skill-gap analysis; `useRecommendedTrainings` hook | [useRecommendedTrainings.ts](apps/web/src/hooks/queries/useRecommendedTrainings.ts), [StudentRecommended.tsx](apps/web/src/pages/student/StudentRecommended.tsx) |
| Recommend relevant training programmes                                | `recommendTrainingsForStudent` returns training programs ranked by skill gap                                                                                       | [training.service.ts](apps/api/src/modules/training/training.service.ts)                                                                                         |
| Track training progress                                               | `TrainingEnrollment.progress` field; `updateTrainingProgress`; progress bar in UI                                                                                  | [StudentMyTrainingDetails.tsx](apps/web/src/pages/student/StudentMyTrainingDetails.tsx)                                                                          |
| Certificate generation on completion                                  | `completeTrainingEnrollment` creates `CERTIFICATE` document via DocumentModel                                                                                      | [trainingEnrollment.service.ts](apps/api/src/modules/training/trainingEnrollment.service.ts)                                                                     |
| Add certificate as portfolio evidence                                 | Document model is already portfolio-integrated (existing system)                                                                                                   | [documents.service.ts](apps/api/src/modules/documents/documents.service.ts)                                                                                      |

### 2. Faculty-Student-Industry Collaboration Opportunities

| SIH Requirement                                                      | Implementation                                                                                                | Files                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Faculty can post opportunities (FDP, consultancy, research, project) | `FacultyOpportunity` model with `opportunityType` enum; `POST /faculty-opportunities`                         | [FacultyOpportunity.ts](apps/api/src/models/FacultyOpportunity.ts)                                              |
| Company and institution can post for students                        | `hostType: COMPANY                                                                                            | INSTITUTION`; `targetRoles: ['STUDENT', 'FACULTY']`                                                             | Same model |
| Students can browse and apply to opportunities                       | `GET /student-faculty-opportunities` with visibility filters; `POST /student-faculty-opportunities/:id/apply` | [student-opportunities.service.ts](apps/api/src/modules/student-opportunities/student-opportunities.service.ts) |
| Students can withdraw applications                                   | `POST /student-faculty-opportunities/:id/withdraw`; blocks after engagement states                            | Same service                                                                                                    |
| Match score based on required expertise                              | `computeExpertiseMatch` — intersection of student skills and required expertise                               | Same service                                                                                                    |
| Notification to host on application                                  | `createNotification` in `applyToOpportunity`                                                                  | Same service                                                                                                    |
| Opportunity deadline enforcement                                     | Server-side `applicationDeadline >= now` filter on list and apply                                             | Same service                                                                                                    |

### 3. In-Platform Training with Modules & Lessons

| SIH Requirement                                    | Implementation                                                           | Files                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin can create training programmes with modules  | `POST /training/:id/modules`; `POST /training/:id/lessons`               | [training.routes.ts](apps/api/src/modules/training/training.routes.ts)                                                                              |
| Module with ordered lessons                        | `TrainingModule.order`, `TrainingLesson.order`; auto-increment on create | [trainingContent.service.ts](apps/api/src/modules/training/trainingContent.service.ts)                                                              |
| Lesson types: VIDEO, ARTICLE, QUIZ, RESOURCE       | `TRAINING_LESSON_TYPES` enum; type-specific rendering in UI              | [TrainingLesson.ts](apps/api/src/models/TrainingLesson.ts), [StudentMyTrainingDetails.tsx](apps/web/src/pages/student/StudentMyTrainingDetails.tsx) |
| Idempotent lesson completion                       | `completedLessons` array check before push; no duplicate on re-call      | [trainingContent.service.ts](apps/api/src/modules/training/trainingContent.service.ts)                                                              |
| Progress auto-calculation                          | `progress = Math.round((completedCount / totalLessons) * 100)`           | Same service                                                                                                                                        |
| Mark training complete (generates certificate)     | `completeTrainingEnrollment`; creates `CERTIFICATE` document             | [trainingEnrollment.service.ts](apps/api/src/modules/training/trainingEnrollment.service.ts)                                                        |
| EXTERNAL training (off-platform) — manual progress | Fallback manual progress input in `StudentMyTrainingDetails`             | [StudentMyTrainingDetails.tsx](apps/web/src/pages/student/StudentMyTrainingDetails.tsx)                                                             |

### 4. Webhook Integration Security

| SIH Requirement                                  | Implementation                                         | Files                                                                          |
| ------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| LMS webhook for external certificate import      | `POST /webhooks/lms/certificate`; HMAC-SHA256 verified | [webhooks.controller.ts](apps/api/src/modules/webhooks/webhooks.controller.ts) |
| ERP webhook for student data sync                | `POST /webhooks/erp/students`; HMAC-SHA256 verified    | Same controller                                                                |
| HMAC-SHA256 signature verification               | `verifySignature` with `timingSafeEqual`               | Same controller                                                                |
| No secret leakage in logs                        | Secrets never passed to logger                         | Same controller                                                                |
| Per-student unique placeholder password (CSPRNG) | `randomBytes(32)` for each imported student            | [webhooks.service.ts](apps/api/src/modules/webhooks/webhooks.service.ts)       |
| Idempotency — LMS certificates                   | In-memory map keyed `email:verificationCode`, 24h TTL  | Same service                                                                   |
| Idempotency — ERP sync                           | In-memory map keyed `institutionId:email`, 24h TTL     | Same service                                                                   |

### 5. Skill Evidence Chain

| SIH Requirement                            | Implementation                                                            | Files                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Training completion adds skill evidence    | Certificate document created, linked to training; evidence in portfolio   | [trainingEnrollment.service.ts](apps/api/src/modules/training/trainingEnrollment.service.ts) |
| No auto-proficiency upgrade                | `completeTrainingEnrollment` does not touch `StudentSkill.proficiency`    | Same service                                                                                 |
| Reassessment recommendation                | `GET /training/enrollments/:enrollmentId/reassess` returns covered skills | [trainingContent.service.ts](apps/api/src/modules/training/trainingContent.service.ts)       |
| Assessment results update verified skills  | Existing assessment system (Phase 9B)                                     | [assessments.service.ts](apps/api/src/modules/assessments/assessments.service.ts)            |
| Portfolio displays verified skill evidence | Existing portfolio system                                                 | [portfolio.service.ts](apps/api/src/modules/portfolio/portfolio.service.ts)                  |

### 6. Four-Role RBAC

| SIH Requirement                                       | Implementation                                                   | Files                                                                                                                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Students can only view/apply to STUDENT-targeted opps | Server-side filter; `requireRole('STUDENT')`                     | [student-opportunities.service.ts](apps/api/src/modules/student-opportunities/student-opportunities.service.ts), [routes](apps/api/src/modules/student-opportunities/student-opportunities.routes.ts) |
| Students can only complete their own enrollments      | `studentProfileId` ownership check in all enrollment functions   | [trainingEnrollment.service.ts](apps/api/src/modules/training/trainingEnrollment.service.ts), [trainingContent.service.ts](apps/api/src/modules/training/trainingContent.service.ts)                  |
| Only ADMIN can create/modify training content         | `requireRole('ADMIN')` on all content management routes          | [training.routes.ts](apps/api/src/modules/training/training.routes.ts)                                                                                                                                |
| Institution isolation                                 | Existing Phase 12 institution isolation — applies to all queries | [requireInstitution.ts](apps/api/src/middleware/requireInstitution.ts)                                                                                                                                |
| Company/institution sees only their own opportunities | Existing Phase 13 `GET /faculty-opportunities/me` filter         | [faculty-opportunities.service.ts](apps/api/src/modules/faculty-opportunities/faculty-opportunities.service.ts)                                                                                       |

---

## Pre-Post 15B Coverage Comparison

| Capability                                          | Before Phase 15B | After Phase 15B                       |
| --------------------------------------------------- | ---------------- | ------------------------------------- |
| In-platform training content (modules/lessons)      | No               | Yes                                   |
| Idempotent lesson completion tracking               | No               | Yes                                   |
| Student opportunity discovery (faculty/institution) | No               | Yes                                   |
| Match score for student opportunities               | No               | Yes                                   |
| Webhook HMAC-SHA256 authentication                  | Basic/no auth    | Full HMAC with timing-safe comparison |
| Webhook idempotency (LMS + ERP)                     | No               | Yes                                   |
| Reassessment recommendations post-training          | No               | Yes                                   |
| Training → certificate → portfolio evidence chain   | Partial          | Complete                              |
| Skill evidence without auto-proficiency             | No               | Yes                                   |

---

## Verification Checklist

- [x] All training content models created with proper Mongoose indexes
- [x] All training content endpoints protected with ADMIN role guard
- [x] Lesson completion is idempotent (verified in test)
- [x] Progress is bounded 0–100 (verified in test)
- [x] Certificate generation reuses Document system
- [x] No auto-proficiency upgrade on training completion
- [x] Student opportunity visibility filter (PUBLISHED, STUDENT target, deadline)
- [x] Application idempotency via unique compound index
- [x] Withdraw blocked after engagement states
- [x] Match score computed server-side
- [x] HMAC-SHA256 on all webhooks
- [x] No secrets in logs
- [x] CSPRNG for placeholder passwords
- [x] 24h TTL idempotency maps
- [x] Reassessment endpoint returns covered skills
- [x] All routes registered in `routes/index.ts`
- [x] All frontend hooks created
- [x] All frontend pages created with routes registered
- [x] Navigation items updated
- [x] Pure logic tests for all critical paths
- [x] Webhook service tests (CSPRNG, idempotency)
- [x] This document created
