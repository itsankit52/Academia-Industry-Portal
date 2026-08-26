# Data Model

Related: [architecture.md](./architecture.md) | [matching.md](./matching.md) | [api.md](./api.md)

---

## Entity Relationship Diagram

```
User ──────────────────────────────────────────────┐
 │  1:1                                             │ 1:N
 ├──► StudentProfile ──────────────────────────┐   │
 │       │  1:N                                │   │
 │       ├──► StudentSkill ──► Skill           │   │
 │       │  1:N                                │   │
 │       ├──► Resume                           │   │
 │       │  1:N                                │   │
 │       ├──► Application ──────────────────── ┼───┼──► Job ◄────┐
 │       │       │ 1:1                         │   │  (or)       │
 │       │       └──► Interview                │   │             │ N:1
 │       │  1:N                                │   │    Internship│
 │       └──► SavedOpportunity ────────────────┘   │             │
 │                                                  │             │
 └──► CompanyProfile ──────────────────────────────┘─────────────┘
 │       1:N Job / 1:N Internship
 │
 └──► Notification  (user ref)
 └──► AuditLog      (actor ref, nullable)

TrainingProgram ──► Skill[] (many-to-many via embedded array)
```

> `Application.opportunity` is a plain `ObjectId` with no `refPath`. See the [Application](#application) section for why.

---

## All 14 Models

### User

File: `apps/api/src/models/User.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `_id` | ObjectId | primary | Exposed as `id` in JSON |
| `email` | String | unique, index | lowercase, trimmed |
| `passwordHash` | String | — | `select: false`; never returned in queries |
| `role` | String (enum) | — | `ROLES` = `['STUDENT', 'COMPANY', 'ADMIN']` |
| `isActive` | Boolean | — | default `true`; admins can deactivate |
| `refreshTokenVersion` | Number | — | `select: false`; incremented on logout/password-change to invalidate tokens |
| `lastLoginAt` | Date | — | set on successful login |
| `createdAt` | Date | — | Mongoose timestamps |
| `updatedAt` | Date | — | Mongoose timestamps |

The `toJSON` transform strips `_id`, `__v`, `passwordHash`, and `refreshTokenVersion` so secrets are never serialised.

---

### StudentProfile

File: `apps/api/src/models/StudentProfile.ts`

1-to-1 with User (`user` ref is `unique: true`).

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `user` | ObjectId → User | unique, index | FK to User |
| `fullName` | String | — | 1–120 chars, required |
| `phone` | String | — | optional |
| `dob` | Date | — | optional |
| `gender` | String (enum) | — | `GENDERS` = `['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']` |
| `city` | String | — | |
| `state` | String | — | |
| `address` | String | — | |
| `college` | String | — | |
| `university` | String | — | |
| `degree` | String | — | |
| `branch` | String | — | |
| `semester` | Number | — | 1–12 |
| `graduationYear` | Number | — | 1970–2100 |
| `cgpa` | Number | — | 0–10 |
| `bio` | String | — | max 2000 chars |
| `projects` | `ProjectSchema[]` | — | `{ title, description, techStack[], link }` |
| `certifications` | `CertificationSchema[]` | — | `{ title, issuer, issuedAt, credentialUrl }` |
| `experience` | `ExperienceSchema[]` | — | `{ title, organization, startDate, endDate, description }` |
| `achievements` | `AchievementSchema[]` | — | `{ title, description, date }` |
| `preferredRoles` | String[] | — | e.g. `['Backend Developer']` |
| `preferredLocations` | String[] | — | e.g. `['Bangalore', 'Remote']` |
| `createdAt` / `updatedAt` | Date | — | timestamps |

Embedded sub-documents (`projects`, `certifications`, `experience`, `achievements`) use `{ _id: false }` — they have no individual ObjectIds.

---

### CompanyProfile

File: `apps/api/src/models/CompanyProfile.ts`

1-to-1 with User (`user` ref is `unique: true`).

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `user` | ObjectId → User | unique, index | FK to User |
| `companyName` | String | index | 1–200 chars, required |
| `description` | String | — | max 5000 chars |
| `industry` | String | — | |
| `website` | String | — | |
| `phone` | String | — | |
| `location` | String | — | |
| `companySize` | String | — | e.g. `'50-200'` |
| `foundedYear` | Number | — | 1800–2100 |
| `logoUrl` | String | — | Cloudinary secure_url |
| `verifiedAt` | Date | — | `null` until an admin verifies; acts as boolean flag |
| `createdAt` / `updatedAt` | Date | — | timestamps |

---

### Skill

File: `apps/api/src/models/Skill.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `name` | String | unique, index, text | stored lowercase; text index for search |
| `category` | String (enum) | — | `SKILL_CATEGORIES` (12 values, see below) |
| `description` | String | — | max 500 chars |
| `status` | String (enum) | — | `'ACTIVE' \| 'ARCHIVED'`, default `'ACTIVE'` |
| `createdAt` / `updatedAt` | Date | — | timestamps |

`SKILL_CATEGORIES`:

```
PROGRAMMING, FRONTEND, BACKEND, DATABASE, CLOUD, DEVOPS,
DATA_SCIENCE, AI_ML, MOBILE, CYBERSECURITY, SOFT_SKILLS, OTHER
```

Uniqueness is on the lowercase `name` field, so "React" and "react" are the same skill.

An additional text index `{ name: 'text' }` enables `$text` search queries.

---

### StudentSkill

File: `apps/api/src/models/StudentSkill.ts`

Join document between StudentProfile and Skill with proficiency metadata.

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `student` | ObjectId → StudentProfile | index | |
| `skill` | ObjectId → Skill | index | |
| `proficiency` | String (enum) | — | `PROFICIENCY_LEVELS` = `['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']` |
| `yearsExperience` | Number | — | 0–50, optional |
| `evidenceUrl` | String | — | link to portfolio/certificate |
| `createdAt` / `updatedAt` | Date | — | timestamps |

**Compound unique index**: `{ student: 1, skill: 1 }` — a student cannot add the same skill twice.

---

### Job

File: `apps/api/src/models/Job.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `company` | ObjectId → CompanyProfile | index | |
| `title` | String | index, text | 3–200 chars, required |
| `description` | String | text | 20–10000 chars |
| `location` | String | text | required |
| `workMode` | String (enum) | — | `WORK_MODES` = `['REMOTE', 'HYBRID', 'ONSITE']` |
| `employmentType` | String (enum) | — | `EMPLOYMENT_TYPES` = `['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']` |
| `salary` | `SalarySchema` | — | `{ min, max, currency (default 'INR') }`, optional |
| `experienceMin` | Number | — | years |
| `experienceMax` | Number | — | years |
| `minCgpa` | Number | — | 0–10 |
| `eligibleBranches` | String[] | — | |
| `eligibleGradYears` | Number[] | — | |
| `requiredSkills` | ObjectId[] → Skill | — | used by matching algorithm |
| `preferredSkills` | ObjectId[] → Skill | — | |
| `applicationDeadline` | Date | — | |
| `openings` | Number | — | min 1, default 1 |
| `status` | String (enum) | index | `JOB_STATUSES` = `['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']`, default `'DRAFT'` |
| `createdAt` / `updatedAt` | Date | — | timestamps |

**Indexes**:

- Text index on `{ title, description, location }` for full-text search
- Compound index `{ status: 1, createdAt: -1 }` for efficient paginated listing of published jobs

---

### Internship

File: `apps/api/src/models/Internship.ts`

Mirrors Job with two differences in the opportunity-specific fields:

| Field | Type | Notes |
|-------|------|-------|
| `durationMonths` | Number | 1–24, **required** (replaces `employmentType`) |
| `stipend` | Number | optional (replaces `salary` sub-document) |
| `currency` | String | default `'INR'` |

All other fields (`company`, `title`, `description`, `location`, `workMode`, `requiredSkills`, `preferredSkills`, `status`, etc.) are identical to Job.

Same indexes: `{ title: 'text', description: 'text', location: 'text' }` and `{ status: 1, createdAt: -1 }`.

Statuses from `INTERNSHIP_STATUSES` = `['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED']`.

---

### Application

File: `apps/api/src/models/Application.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `student` | ObjectId → StudentProfile | index | |
| `opportunityType` | String (enum) | — | `['JOB', 'INTERNSHIP']` |
| `opportunity` | ObjectId | — | **plain ObjectId, no ref** (see below) |
| `status` | String (enum) | index | `APPLICATION_STATUSES` (7 values), default `'APPLIED'` |
| `resume` | ObjectId → Resume | — | optional; snapshot at time of application |
| `coverLetter` | String | — | max 5000 chars |
| `matchScore` | Number | — | 0–100; computed by `computeMatch()` at submission |
| `timeline` | `TimelineEntry[]` | — | `{ status, at, note }` — append-only history |
| `createdAt` / `updatedAt` | Date | — | timestamps |

`APPLICATION_STATUSES`:
```
APPLIED, UNDER_REVIEW, SHORTLISTED, INTERVIEW_SCHEDULED, SELECTED, REJECTED, WITHDRAWN
```

**Compound unique index**: `{ student: 1, opportunityType: 1, opportunity: 1 }` — one application per student per opportunity.

**Compound index**: `{ status: 1, createdAt: -1 }` — dashboard queries.

#### Why `opportunity` is not `refPath`

Mongoose's `refPath` feature requires that the discriminator values match the model name strings exactly. Here:

- `opportunityType` values: `'JOB'`, `'INTERNSHIP'`
- Model names: `'Job'`, `'Internship'`

These do not match (`'JOB' !== 'Job'`), so `refPath` would silently fail to populate. Instead, `opportunity` is declared as a plain `Schema.Types.ObjectId` with no `ref`. The service layer reads `opportunityType`, selects the correct model (`Job` or `Internship`), and calls `.populate()` manually:

```typescript
const Model = doc.opportunityType === 'JOB' ? Job : Internship;
const populated = await Model.findById(doc.opportunity);
```

This keeps the schema simple and the populate logic explicit.

---

### SavedOpportunity

File: `apps/api/src/models/SavedOpportunity.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `student` | ObjectId → StudentProfile | index | |
| `opportunityType` | String (enum) | — | `['JOB', 'INTERNSHIP']` |
| `opportunity` | ObjectId | — | plain ObjectId, same rationale as Application |
| `createdAt` / `updatedAt` | Date | — | timestamps |

**Compound unique index**: `{ student: 1, opportunityType: 1, opportunity: 1 }` — a student cannot save the same listing twice.

---

### Interview

File: `apps/api/src/models/Interview.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `application` | ObjectId → Application | index | |
| `mode` | String (enum) | — | `INTERVIEW_MODES` = `['ONLINE', 'ONSITE', 'PHONE']` |
| `scheduledAt` | Date | index | allows chronological queries |
| `durationMinutes` | Number | — | 15–480, default 60 |
| `meetingLink` | String | — | optional; used for ONLINE mode |
| `location` | String | — | optional; used for ONSITE mode |
| `interviewer` | String | — | optional name/title |
| `notes` | String | — | max 5000 chars; pre-interview notes |
| `feedback` | String | — | max 5000 chars; post-interview feedback |
| `status` | String (enum) | index | `INTERVIEW_STATUSES` = `['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']`, default `'SCHEDULED'` |
| `createdAt` / `updatedAt` | Date | — | timestamps |

---

### TrainingProgram

File: `apps/api/src/models/TrainingProgram.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `title` | String | — | 3–200 chars, required |
| `description` | String | — | 20–10000 chars, required |
| `provider` | String | — | required (e.g. organisation or platform name) |
| `skills` | ObjectId[] → Skill | — | skills this program covers; used for gap-based recommendations |
| `durationWeeks` | Number | — | 1–104, required |
| `startDate` | Date | — | optional |
| `endDate` | Date | — | optional |
| `registrationDeadline` | Date | — | optional |
| `registrationUrl` | String | — | required external URL |
| `status` | String (enum) | index | `'ACTIVE' \| 'ARCHIVED'`, default `'ACTIVE'` |
| `createdAt` / `updatedAt` | Date | — | timestamps |

---

### Notification

File: `apps/api/src/models/Notification.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `user` | ObjectId → User | index | recipient |
| `type` | String (enum) | — | `NOTIFICATION_TYPES` (8 values, see below) |
| `title` | String | — | max 200 chars |
| `body` | String | — | max 2000 chars |
| `link` | String | — | optional in-app URL |
| `readAt` | Date | — | `null` = unread |
| `createdAt` / `updatedAt` | Date | — | timestamps |

`NOTIFICATION_TYPES`:
```
NEW_MATCHING_JOB, APPLICATION_STATUS_CHANGED, INTERVIEW_SCHEDULED,
INTERVIEW_UPDATED, APPLICATION_SELECTED, APPLICATION_REJECTED,
NEW_INTERNSHIP, ANNOUNCEMENT
```

**Compound index**: `{ user: 1, createdAt: -1 }` — efficient per-user notification listing in reverse chronological order.

---

### Resume

File: `apps/api/src/models/Resume.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `student` | ObjectId → StudentProfile | index | |
| `cloudinaryPublicId` | String | unique | used for deletion via Cloudinary API |
| `url` | String | — | Cloudinary `secure_url` |
| `mimeType` | String | — | e.g. `'application/pdf'` |
| `sizeBytes` | Number | — | min 0 |
| `parsedSkills` | String[] | — | skill names extracted by AI (optional) |
| `version` | Number | — | auto-incremented per student; min 1, default 1 |
| `createdAt` / `updatedAt` | Date | — | timestamps |

`cloudinaryPublicId` is unique to ensure each Cloudinary asset maps to exactly one database record, preventing orphaned files.

---

### AuditLog

File: `apps/api/src/models/AuditLog.ts`

| Field | Type | Index | Notes |
|-------|------|-------|-------|
| `actor` | ObjectId → User | — | nullable; system actions have no actor |
| `actorEmail` | String | — | denormalised snapshot; survives user deletion |
| `role` | String | — | denormalised role at time of action |
| `action` | String (enum) | index | `AUDIT_ACTIONS` (22 values, see below) |
| `entity` | String | — | model name e.g. `'Job'`, `'User'` |
| `entityId` | String | — | ObjectId string of the affected document |
| `before` | Mixed | — | document state before change (optional) |
| `after` | Mixed | — | document state after change (optional) |
| `ip` | String | — | client IP from `req.ip` |
| `userAgent` | String | — | `User-Agent` header |
| `createdAt` | Date | index | descending for chronological queries |

`AUDIT_ACTIONS` (22 values):
```
USER_REGISTERED, USER_LOGIN, USER_LOGOUT, USER_UPDATED, USER_DEACTIVATED,
JOB_CREATED, JOB_UPDATED, JOB_CLOSED, JOB_DELETED,
INTERNSHIP_CREATED, INTERNSHIP_UPDATED, INTERNSHIP_CLOSED, INTERNSHIP_DELETED,
APPLICATION_CREATED, APPLICATION_STATUS_UPDATED,
INTERVIEW_CREATED, INTERVIEW_UPDATED,
SKILL_CREATED, SKILL_UPDATED, SKILL_DELETED,
TRAINING_CREATED, TRAINING_UPDATED, TRAINING_DELETED
```

`actorEmail` and `role` are stored as denormalised strings so audit records remain meaningful even if the User document is deleted later.

---

## Index Summary

| Model | Index |
|-------|-------|
| User | `email` unique |
| StudentProfile | `user` unique |
| CompanyProfile | `user` unique, `companyName` |
| Skill | `name` unique + text |
| StudentSkill | `{ student, skill }` unique compound |
| Job | `{ title, description, location }` text; `{ status, createdAt }` compound |
| Internship | `{ title, description, location }` text; `{ status, createdAt }` compound |
| Application | `{ student, opportunityType, opportunity }` unique compound; `{ status, createdAt }` |
| SavedOpportunity | `{ student, opportunityType, opportunity }` unique compound |
| Interview | `scheduledAt`, `status` |
| Notification | `user`; `{ user, createdAt }` compound |
| Resume | `cloudinaryPublicId` unique |
| AuditLog | `action`; `createdAt` |
