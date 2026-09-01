# Academia-Industry Collaboration Portal

Five-role platform connecting students, faculty, companies, institutions, and placement admins across the full academic-to-industry pipeline. Features AI-powered skill assessments, document verification, aptitude testing, mentorship, PDF completion certificates, collaboration events, and LMS/ERP webhook integration.

![Node 20+](https://img.shields.io/badge/Node-20%2B-brightgreen?logo=node.js&logoColor=white) ![pnpm 9](https://img.shields.io/badge/pnpm-9-orange?logo=pnpm&logoColor=white) ![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white) ![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white) ![License MIT](https://img.shields.io/badge/license-MIT-green) ![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

> Production-quality full-stack monorepo. Runs on Windows 10/11, macOS, and Linux. No Docker required.

---

## Table of Contents

1. [Quick Start (TL;DR)](#quick-start-tldr)
2. [Feature Overview](#feature-overview)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [Data Flow: Key User Journeys](#data-flow-key-user-journeys)
6. [Tech Stack](#tech-stack)
7. [Prerequisites](#prerequisites)
8. [Setup — Windows (PowerShell)](#setup--windows-powershell)
9. [Setup — macOS (Terminal)](#setup--macos-terminal)
10. [Environment Variables Reference](#environment-variables-reference)
11. [Development Commands](#development-commands)
12. [Functional Guide](#functional-guide)
    - [Student Walkthrough](#student-walkthrough)
    - [Company Walkthrough](#company-walkthrough)
    - [Admin Walkthrough](#admin-walkthrough)
    - [Faculty Walkthrough](#faculty-walkthrough)
    - [Institution Walkthrough](#institution-walkthrough)
13. [AI Assessment Feature — Deep Dive](#ai-assessment-feature--deep-dive)
14. [Resume Storage](#resume-storage)
15. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
16. [API Reference (Quick Map)](#api-reference-quick-map)
17. [Testing](#testing)
18. [Production Build](#production-build)
19. [Troubleshooting](#troubleshooting)
20. [Demo Accounts](#demo-accounts)
21. [Repo Scripts](#repo-scripts)
22. [Related Docs](#related-docs)
23. [Contributing](#contributing)
24. [License](#license)

---

## Quick Start (TL;DR)

**macOS / Linux:**

```bash
bash scripts/setup.sh
```

**Windows:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

Both scripts verify Node 20+, install pnpm@9, install all workspace dependencies, copy `.env.example` to `.env`, and print generated JWT secrets to paste in.

**Then complete setup:**

```bash
# 1. Edit .env — set MONGODB_URI and paste the JWT secrets printed above
# 2. Validate your .env is complete
node scripts/check-env.mjs

# 3. Seed reference data (skills catalogue) and start both dev servers
pnpm seed
pnpm dev
```

Open http://localhost:5173. Backend health: http://localhost:4000/api/v1/health.

Register a new account via the signup page — select your actual institution from the list.

```bash
# Verify everything before diving in
pnpm typecheck   # all workspaces green
pnpm test        # unit + integration tests pass
```

---

## Feature Overview

### Student

- Full profile: personal info, academic record (college, branch, CGPA, graduation year), projects, certifications, experience, achievements
- Skills with proficiency levels (BEGINNER / INTERMEDIATE / ADVANCED / EXPERT) and optional evidence URLs
- Resume upload (PDF, up to 5 MB) stored in MongoDB or Cloudinary depending on `RESUME_STORAGE`
- Browse and search jobs and internships with skill / location / work-mode filters
- Deterministic skill-match score and gap analysis on every opportunity
- Apply with a cover letter; track the full application status timeline
- Bookmark opportunities (saved list)
- View and join scheduled interviews
- In-app notifications for application updates, interview invites, and status changes
- Opportunity and training program recommendations based on skill profile
- **AI-powered skill assessments**: Gemini generates short-answer questions from your skill profile, you answer in-browser with autosave, Gemini evaluates and scores each response, result persists in your profile
- **Documents and portfolio**: upload certificates, transcripts, and internship reports for institutional or company verification. Only verified documents appear on the public portfolio at `/portfolio/:studentId`
- **Aptitude tests**: start a timed QUANT / LOGIC / VERBAL / ENGLISH multiple-choice test; passing auto-upgrades skill proficiency for that category
- **Mentorship requests**: request an industry or faculty mentor by sending an initial message; communicate via threaded inbox once accepted
- **Interim reports**: submit weekly progress reports for active internships; feeds the PDF completion certificate on internship end

### Company

- Company profile with logo upload
- Post, edit, draft, publish, and force-close jobs and internships
- Post faculty opportunities: FDPs, consultancy engagements, collaborative research, and faculty internships — targeting FACULTY, STUDENT, or both
- View applicants ranked by skill-match score with full gap details
- Shortlist or reject candidates; view full candidate profile and resume
- Schedule, reschedule, cancel, and complete interviews with feedback notes
- Verify documents submitted by student applicants
- Publish a MentorProfile to accept mentorship requests from students and faculty
- Host collaboration events (WORKSHOP, GUEST_LECTURE, INNOVATION_CHALLENGE, LIVE_PROJECT)
- Notifications on new applications

### Admin

- Dashboard with 6 stat cards and Recharts analytics (applications over time, top skills, placement rate by branch)
- Activate / deactivate student and company accounts
- Verify companies (verified badge via `verifiedAt`)
- Force-close or delete any job or internship
- Manage the shared skill catalog (name, category, status)
- Create and manage training programs
- Industry skill demand trends across all active postings
- Paginated audit log with actor, action, entity, and before/after JSON diff modal
- Manage institutions: create, edit, verify (`verificationStatus: VERIFIED`), and invite institution users
- Curate the aptitude question bank (`/admin/aptitude-questions`) — add, edit, archive questions; `correctIndex` is visible only in this admin view
- Manage verification queue — approve or reject any document from any user across the platform
- Oversight of mentorship pairings and collaboration events platform-wide

### Faculty

- Browse and apply to faculty opportunities: FDPs, industry consultancies, faculty internships, collaborative research
- Upload documents (transcripts, certificates, publications) with verification workflow
- Register for collaboration events (workshops, guest lectures, innovation challenges, live projects)
- Mentor students: accept mentorship requests, communicate via threaded inbox, give feedback and ratings on student interim reports
- Institution-linked profile with department, designation, qualifications, and research interests
- Track application status for all submitted faculty opportunity applications
- Download PDF completion certificates on successfully completed engagements

### Institution

- Institution dashboard scoped to your own students and faculty (admin can override via `?institutionId=`)
- Placement metrics, skill-gap trends, and FDP participation charts for your institution only
- Student directory: browse all students linked to your institution, view individual profiles
- Faculty directory: browse all faculty linked to your institution, view individual profiles
- Create collaboration events (guest lectures, workshops) hosted by the institution
- Post faculty opportunities (faculty internships, collaborative research)
- Verify documents submitted by your own students and faculty
- Institution-scoped ERP student sync via signed webhook (`POST /webhooks/erp/students`)

### Shared platform modules

- **Documents and Verification** — students and faculty upload certificates, transcripts, internship reports, and academic records. Admins, institutions, and companies verify from a shared queue. Only `VERIFIED` documents surface on the public portfolio.
- **Public Portfolio** — `/portfolio/:studentId` renders a public, unauthenticated page with the student's profile, projects, skills, and verified certificates only.
- **Mentorship Engine** — mentors publish a profile (bio, expertise, capacity). Students and faculty request mentorship with an initial message; mentors accept or decline. Active pairs communicate through a threaded message inbox. Capacity is enforced server-side.
- **Interim Reports** — students in `SELECTED` applications submit weekly interim reports (work description, learnings, challenges, hours). Company mentors read and reply with feedback and a rating.
- **Completion Certificates (PDF)** — `POST /applications/:id/certificate` streams a signed PDF certificate for `SELECTED` applications with at least one interim report, generated by pdfkit.
- **Collaboration Events** — companies and institutions publish events (WORKSHOP, GUEST_LECTURE, INNOVATION_CHALLENGE, LIVE_PROJECT) with capacity, deadlines, and target audience. Students and faculty register and unregister; capacity is enforced.
- **Aptitude Tests** — 4 categories (QUANT, LOGIC, VERBAL, ENGLISH). Students start a timed test, answer multiple-choice questions, and submit for scoring. `correctIndex` is never sent to the student client; admin views expose it for question curation. Passing score is 60%; passing triggers an automatic proficiency upgrade for the matching skill category.
- **LMS / ERP Webhooks** — `POST /webhooks/lms/certificate` (creates a verified `Document` from an LMS course completion event) and `POST /webhooks/erp/students` (upserts student profiles from institutional ERP). Both require an HMAC-SHA256 signature in the `x-webhook-signature` header. Each feature is disabled unless the matching secret env var is set.

---

## Architecture

### Monorepo layout

```mermaid
graph TB
  subgraph Monorepo["academia-industry-portal/"]
    subgraph Web["apps/web  React + Vite + TS  :5173"]
      WS[Student pages]
      WC[Company pages]
      WA[Admin pages]
      WF[Faculty pages]
      WI[Institution pages]
      WP[Public portfolio]
    end
    subgraph API["apps/api  Express + TS  :4000"]
      Core["auth · students · companies · skills · jobs · internships\napplications · interviews · recommendations · matching\nnotifications · training · analytics · resumes · ai\nassessments · admin · audit · saved-opportunities"]
      NewMods["institutions · faculty · faculty-opportunities · documents\nportfolio · institution-analytics · mentorship · aptitude\ncollaboration · events · interim-reports · webhooks"]
    end
    subgraph Packages["packages/"]
      C["@aip/config"]
      T["@aip/types"]
      V["@aip/validation"]
    end
  end
  Web -->|"HTTPS + httpOnly cookies"| API
  Web --> C
  Web --> T
  Web --> V
  API --> C
  API --> T
  API --> V
  API -->|Mongoose| DB[(MongoDB Atlas)]
  API -->|SDK| CL[Cloudinary]
  API -->|REST| G[Gemini 2.5 Flash]
  LMS["LMS  Coursera / Udemy"] -->|"HMAC-SHA256  x-webhook-signature"| API
  ERP[Institutional ERP] -->|"HMAC-SHA256  x-webhook-signature"| API
```

**Directory tree:**

```
academia-industry-portal/
├── apps/
│   ├── web/          React 18 + Vite 5 + Tailwind 3 frontend
│   └── api/          Express 4 + Mongoose 8 backend
├── packages/
│   ├── config/       Shared enums and constants  (@aip/config)
│   ├── types/        Shared TypeScript interfaces (@aip/types)
│   └── validation/   Shared Zod schemas           (@aip/validation)
├── scripts/          Bootstrap and utility scripts
└── docs/             Deep-dive documentation
```

**Backend modules** (`apps/api/src/modules/`):

| Module                  | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `auth`                  | JWT register / login / refresh / logout                               |
| `students`              | Student profile CRUD and dashboard summary                            |
| `companies`             | Company profile CRUD                                                  |
| `skills`                | Skill catalog management                                              |
| `jobs`                  | Job posting CRUD                                                      |
| `internships`           | Internship posting CRUD                                               |
| `applications`          | Application lifecycle, status transitions, PDF certificate endpoint   |
| `interviews`            | Interview scheduling and management                                   |
| `recommendations`       | Opportunity and training recommendations                              |
| `matching`              | Skill-matching algorithm (internal service — not mounted as a route)  |
| `notifications`         | In-app notification delivery                                          |
| `training`              | Training program catalog                                              |
| `saved-opportunities`   | Bookmarking                                                           |
| `analytics`             | Admin dashboard aggregation queries                                   |
| `resumes`               | Resume upload and download (DB or Cloudinary)                         |
| `ai`                    | Gemini-powered career assistant                                       |
| `assessments`           | AI assessment generate / answer / submit / evaluate                   |
| `admin`                 | Admin management operations                                           |
| `audit`                 | Audit log queries                                                     |
| `institutions`          | Institution CRUD, verification, public catalog                        |
| `faculty`               | Faculty profile CRUD                                                  |
| `faculty-opportunities` | FDP / consultancy / collaborative research / faculty internship CRUD  |
| `documents`             | Document upload, metadata listing, and verification queue             |
| `portfolio`             | Public student portfolio rendering (unauthenticated)                  |
| `institution-analytics` | Institution-scoped metrics: placements, skill gaps, FDP participation |
| `mentorship`            | MentorProfile CRUD and mentorship request / message lifecycle         |
| `aptitude`              | Aptitude question bank and test lifecycle                             |
| `collaboration`         | Collaboration event CRUD and registration                             |
| `events`                | Event registration management                                         |
| `interim-reports`       | Interim report submission and mentor feedback                         |
| `webhooks`              | LMS certification and ERP student sync (HMAC-SHA256 verified)         |

### Request flow

```mermaid
sequenceDiagram
    participant Br as Browser
    participant CO as CORS MW
    participant AU as Auth MW
    participant RO as Router
    participant CT as Controller
    participant SV as Service
    participant MO as Model
    participant DB as MongoDB Atlas

    Br->>CO: HTTP request + aip_at cookie
    CO->>AU: validate Origin header
    AU->>RO: verify JWT, attach req.user
    RO->>CT: match route, run Zod validation
    CT->>SV: call business logic
    SV->>MO: Mongoose query / aggregate
    MO->>DB: TCP connection to Atlas
    DB-->>MO: document(s)
    MO-->>SV: hydrated document
    SV-->>CT: processed result
    CT-->>Br: JSON envelope response
```

See [`docs/architecture.md`](./docs/architecture.md) for the full middleware stack and module patterns.

---

## Data Model

### Entity-relationship diagram

```mermaid
erDiagram
    USER {
        string email
        string role
        boolean isActive
        date lastLoginAt
    }
    STUDENTPROFILE {
        objectId user
        objectId institution
        string fullName
        string college
        string branch
        number cgpa
        number graduationYear
        array projects
        array certifications
    }
    COMPANYPROFILE {
        objectId user
        string companyName
        string industry
        string location
        string logoUrl
        date verifiedAt
    }
    FACULTYPROFILE {
        objectId user
        objectId institution
        string fullName
        string designation
        string department
        array qualifications
        array researchInterests
        string bio
    }
    INSTITUTION {
        string name
        string code
        string domain
        string city
        string state
        string contactEmail
        string verificationStatus
        date verifiedAt
    }
    SKILL {
        string name
        string category
        string status
    }
    STUDENTSKILL {
        objectId student
        objectId skill
        string proficiency
        number yearsExperience
        string evidenceUrl
    }
    JOB {
        objectId company
        string title
        string workMode
        string employmentType
        object salary
        array requiredSkills
        array preferredSkills
        string status
    }
    INTERNSHIP {
        objectId company
        string title
        string workMode
        number durationMonths
        number stipend
        array requiredSkills
        array preferredSkills
        string status
    }
    FACULTYOPPORTUNITY {
        objectId host
        string hostType
        string opportunityType
        string title
        array targetRoles
        array requiredExpertise
        string mode
        date applicationDeadline
        number openings
        string status
    }
    APPLICATION {
        objectId student
        string opportunityType
        objectId opportunity
        string status
        objectId resume
        string coverLetter
        number matchScore
        array timeline
    }
    SAVEDOPPORTUNITY {
        objectId student
        string opportunityType
        objectId opportunity
    }
    INTERVIEW {
        objectId application
        string mode
        date scheduledAt
        number durationMinutes
        string meetingLink
        string status
    }
    TRAININGPROGRAM {
        string title
        string provider
        array skills
        number durationWeeks
        string registrationUrl
        string status
    }
    NOTIFICATION {
        objectId user
        string type
        string title
        string body
        date readAt
    }
    RESUME {
        objectId student
        string storageMode
        string filename
        buffer data
        string cloudinaryPublicId
        string url
        number sizeBytes
    }
    DOCUMENT {
        objectId user
        string documentType
        string filename
        buffer data
        string title
        string issuer
        date issuedDate
        string verificationStatus
        objectId verifiedBy
        date verifiedAt
    }
    ASSESSMENT {
        objectId student
        string status
        array questions
        array answers
        object evaluation
        number durationMinutes
        date expiresAt
        date submittedAt
        string generatedByModel
    }
    AUDITLOG {
        objectId actor
        string actorEmail
        string action
        string entity
        mixed before
        mixed after
    }
    MENTORPROFILE {
        objectId user
        string bio
        array expertise
        number capacity
        number currentMenteeCount
        boolean isAcceptingRequests
    }
    MENTORSHIPREQUEST {
        objectId mentor
        objectId mentee
        string status
        string message
        string responseMessage
    }
    MENTORSHIPMESSAGE {
        objectId request
        objectId sender
        string body
        date sentAt
    }
    INTERIMREPORT {
        objectId application
        string title
        string workDescription
        string learnings
        string challenges
        number hoursWorked
        string feedback
        number rating
    }
    COLLABORATIONEVENT {
        objectId host
        string hostType
        string eventType
        string title
        number capacity
        date eventDate
        date registrationDeadline
        string status
    }
    EVENTREGISTRATION {
        objectId event
        objectId attendee
        string attendeeRole
        date registeredAt
    }
    APTITUDEQUESTION {
        string text
        array options
        number correctIndex
        string category
        string difficulty
        string explanation
    }
    APTITUDETEST {
        objectId student
        objectId user
        string category
        array questions
        number totalQuestions
        number correctCount
        number score
        number passingScore
        boolean passed
        string status
        date startedAt
        date expiresAt
        date submittedAt
        number durationSeconds
    }

    USER ||--o| STUDENTPROFILE : "has one"
    USER ||--o| COMPANYPROFILE : "has one"
    USER ||--o| FACULTYPROFILE : "has one"
    USER ||--o{ NOTIFICATION : "receives"
    USER ||--o{ AUDITLOG : "authored"
    USER ||--o{ DOCUMENT : "owns"
    STUDENTPROFILE }o--o| INSTITUTION : "belongs to"
    FACULTYPROFILE }|--|| INSTITUTION : "belongs to"
    STUDENTPROFILE ||--o{ STUDENTSKILL : "has"
    STUDENTPROFILE ||--o{ APPLICATION : "submits"
    STUDENTPROFILE ||--o{ SAVEDOPPORTUNITY : "saves"
    STUDENTPROFILE ||--o| RESUME : "has"
    STUDENTPROFILE ||--o{ ASSESSMENT : "takes"
    STUDENTPROFILE ||--o{ APTITUDETEST : "takes"
    SKILL ||--o{ STUDENTSKILL : "assigned via"
    SKILL }o--o{ TRAININGPROGRAM : "covered by"
    SKILL }o--o{ JOB : "required or preferred"
    SKILL }o--o{ INTERNSHIP : "required or preferred"
    SKILL }o--o{ ASSESSMENT : "tested in"
    COMPANYPROFILE ||--o{ JOB : "posts"
    COMPANYPROFILE ||--o{ INTERNSHIP : "posts"
    COMPANYPROFILE ||--o{ FACULTYOPPORTUNITY : "posts"
    COMPANYPROFILE ||--o{ COLLABORATIONEVENT : "hosts"
    INSTITUTION ||--o{ FACULTYOPPORTUNITY : "posts"
    INSTITUTION ||--o{ COLLABORATIONEVENT : "hosts"
    JOB ||--o{ APPLICATION : "receives"
    INTERNSHIP ||--o{ APPLICATION : "receives"
    FACULTYOPPORTUNITY ||--o{ APPLICATION : "receives"
    APPLICATION ||--o| INTERVIEW : "leads to"
    APPLICATION ||--o{ INTERIMREPORT : "has"
    RESUME }o--o| APPLICATION : "attached to"
    MENTORPROFILE ||--o{ MENTORSHIPREQUEST : "receives"
    MENTORSHIPREQUEST ||--o{ MENTORSHIPMESSAGE : "has"
    COLLABORATIONEVENT ||--o{ EVENTREGISTRATION : "has"
    APTITUDEQUESTION }o--o{ APTITUDETEST : "sampled in"
```

> `Application.opportunity` is a plain `ObjectId` with no Mongoose `ref`. The sibling field `opportunityType` discriminates between JOB, INTERNSHIP, PROJECT, APPRENTICESHIP, FACULTY_INTERNSHIP, FDP, CONSULTANCY, and COLLABORATIVE_RESEARCH. Services resolve the correct model and call `.populate()` manually. The same pattern applies to `SavedOpportunity`. By contrast, `FacultyOpportunity.host` uses a proper `refPath: 'hostType'` pointing to either `CompanyProfile` or `Institution`.

### Model reference table

| Model                | Primary purpose                                   | Notable design                                                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`               | Auth identity                                     | `passwordHash` and `refreshTokenVersion` are `select: false`; auth service selects them explicitly                                                                                                                                                                                                                    |
| `StudentProfile`     | Student details                                   | Carries optional`institution` ObjectId for multi-tenancy scoping; embeds `projects`, `certifications`, `experience`, `achievements` arrays; `preferredRoles` and `preferredLocations` arrays                                                                                                                          |
| `CompanyProfile`     | Company details                                   | `verifiedAt` presence indicates verified status; `companyName` indexed                                                                                                                                                                                                                                                |
| `FacultyProfile`     | Faculty details                                   | `institution` (required ObjectId ref to `Institution`); carries `designation`, `department`, `qualifications[]`, `researchInterests[]`                                                                                                                                                                                |
| `Institution`        | Multi-tenancy anchor                              | `code` (uppercase, unique) and `domain` (lowercase, unique) are the natural keys; `verificationStatus: PENDING \| VERIFIED \| REJECTED`; both `StudentProfile` and `FacultyProfile` carry an `institution` ObjectId                                                                                                   |
| `Skill`              | Shared skill catalog                              | Lowercased on write;`status: ACTIVE \| ARCHIVED`; text index on `name`                                                                                                                                                                                                                                                |
| `StudentSkill`       | Student-to-skill junction                         | Compound unique`(student, skill)`; `proficiency: BEGINNER \| INTERMEDIATE \| ADVANCED \| EXPERT`                                                                                                                                                                                                                      |
| `Job`                | Job postings                                      | `salary` is an embedded subdoc with `min`, `max`, `currency`; text index on title, description, location                                                                                                                                                                                                              |
| `Internship`         | Internship postings                               | Uses`durationMonths` and `stipend` instead of salary range                                                                                                                                                                                                                                                            |
| `FacultyOpportunity` | FDP / consultancy / research / faculty internship | `hostType: COMPANY \| INSTITUTION` and `host` ObjectId use `refPath` (not plain ObjectId); `targetRoles[]` can include STUDENT and/or FACULTY; `opportunityType: FACULTY_INTERNSHIP \| FDP \| CONSULTANCY \| COLLABORATIVE_RESEARCH \| PROJECT \| APPRENTICESHIP`; `status: DRAFT \| PUBLISHED \| CLOSED \| ARCHIVED` |
| `Application`        | Unified application record                        | Polymorphic`opportunity` field (plain ObjectId, no `ref`); `opportunityType` discriminates across 8 opportunity types; compound unique `(student, opportunityType, opportunity)`; `timeline[]` records every status change with timestamp                                                                             |
| `SavedOpportunity`   | Bookmarks                                         | Same polymorphic pattern as`Application`; compound unique `(student, opportunityType, opportunity)`                                                                                                                                                                                                                   |
| `Interview`          | Interview scheduling                              | `mode: ONLINE \| OFFLINE \| HYBRID`; linked to `Application`                                                                                                                                                                                                                                                          |
| `TrainingProgram`    | Training catalog                                  | `skills[]` are ObjectId refs to `Skill`                                                                                                                                                                                                                                                                               |
| `Notification`       | In-app notifications                              | `readAt: null` means unread; indexed on `(user, createdAt DESC)`                                                                                                                                                                                                                                                      |
| `Resume`             | PDF storage                                       | `storageMode: DATABASE \| CLOUDINARY`; `data: Buffer` is `select: false`; `cloudinaryPublicId` is sparse unique                                                                                                                                                                                                       |
| `Document`           | User-uploaded credentials                         | `documentType: RESUME \| CERTIFICATE \| INTERNSHIP_REPORT \| ACADEMIC_RECORD`; `data: Buffer` is `select: false` and also stripped in `toJSON` transform; `verificationStatus: PENDING \| VERIFIED \| REJECTED`; `verifiedBy` ref to the reviewing `User`                                                             |
| `Assessment`         | AI skill assessment                               | Embeds`questions[]`, `answers[]`, and an `evaluation` subdoc in a single document; `expiresAt = startedAt + durationMinutes * 60000`; `generatedByModel` records which Gemini model produced the questions                                                                                                            |
| `AuditLog`           | Admin action history                              | `before` and `after` are `Mixed` to accommodate any document shape; indexed on `(createdAt DESC, action)`                                                                                                                                                                                                             |
| `MentorProfile`      | Mentor listing                                    | Published by company employees or senior faculty;`capacity` and `currentMenteeCount` enforce the max concurrent mentees rule server-side                                                                                                                                                                              |
| `MentorshipRequest`  | Mentorship pairing                                | `status: PENDING \| ACCEPTED \| DECLINED`; carries `message` (initial ask) and `responseMessage` (mentor reply)                                                                                                                                                                                                       |
| `MentorshipMessage`  | Threaded inbox                                    | Linked to an accepted`MentorshipRequest`; `sender` ref to `User`                                                                                                                                                                                                                                                      |
| `InterimReport`      | Internship progress log                           | Linked to`Application`; carries `hoursWorked`, `workDescription`, `learnings`, `challenges`; company mentor adds `feedback` and `rating`; feeds PDF certificate generation                                                                                                                                            |
| `CollaborationEvent` | Hosted events                                     | `eventType: WORKSHOP \| GUEST_LECTURE \| INNOVATION_CHALLENGE \| LIVE_PROJECT`; `hostType: COMPANY \| INSTITUTION` with `host` ObjectId; `capacity` is enforced at registration time                                                                                                                                  |
| `EventRegistration`  | Event attendance                                  | `attendeeRole: STUDENT \| FACULTY`; compound unique `(event, attendee)` prevents double registration                                                                                                                                                                                                                  |
| `AptitudeQuestion`   | Question bank entry                               | `correctIndex` (0–3 index into `options[]`) is `select: false` — never sent to student clients; admin routes explicitly select it for question curation                                                                                                                                                               |
| `AptitudeTest`       | Test session                                      | `status: IN_PROGRESS \| SUBMITTED \| EXPIRED`; `expiresAt` is server-authoritative; `passingScore` defaults to 60; `durationSeconds` defaults to 1800 (30 min); `passed` flag triggers student skill proficiency auto-upgrade; indexes on `(user, createdAt DESC)`                                                    |

---

## Data Flow: Key User Journeys

### A. Student or Faculty signup and login

```mermaid
sequenceDiagram
    participant Br as Browser
    participant A as API
    participant DB as MongoDB

    Br->>A: POST /api/v1/auth/register {email, password, role: STUDENT, institutionId?}
    A->>DB: create User + StudentProfile (institutionId stored if provided)
    DB-->>A: saved documents
    A-->>Br: 201 {success: true, data: {user}}

    Note over Br: Faculty registration requires institutionId

    Br->>A: POST /api/v1/auth/register {email, password, role: FACULTY, institutionId}
    A->>DB: create User + FacultyProfile {institution: institutionId}
    DB-->>A: saved documents
    A-->>Br: 201 {success: true, data: {user}}

    Br->>A: POST /api/v1/auth/login {email, password}
    A->>DB: find User, verify bcrypt hash
    DB-->>A: User doc
    A-->>Br: 200 + Set-Cookie: aip_at (15m httpOnly) + aip_rt (7d httpOnly)

    Br->>A: GET /api/v1/students/me/summary
    A->>DB: aggregate applications, interviews, skills, latest assessment
    DB-->>A: summary data
    A-->>Br: 200 {totalApplications, scheduledInterviews, skillCount, latestScore}
    Note over Br: Dashboard renders stat cards and charts
```

### B. Faculty applies to a faculty opportunity

```mermaid
sequenceDiagram
    participant Fa as Faculty Browser
    participant A as API
    participant DB as MongoDB

    Fa->>A: GET /api/v1/faculty-opportunities?status=PUBLISHED
    A->>DB: query FacultyOpportunity {status: PUBLISHED}
    DB-->>A: opportunity list
    A-->>Fa: 200 [{opportunity, host details}]

    Fa->>A: GET /api/v1/faculty-opportunities/:id
    A->>DB: fetch opportunity, populate host via refPath (CompanyProfile or Institution)
    DB-->>A: full opportunity doc
    A-->>Fa: 200 {opportunity}

    Fa->>A: POST /api/v1/applications {opportunityType: FDP, opportunity: id, coverLetter}
    A->>DB: create Application {status: APPLIED, student: facultyProfileId, opportunityType: FDP}
    A->>DB: create Notification for posting company or institution
    A-->>Fa: 201 {application}

    Note over Fa: Faculty tracks status at /faculty/applications

    Fa->>A: GET /api/v1/applications/me
    A->>DB: query applications for this faculty user
    A-->>Fa: 200 [{application with opportunity + host}]
```

### C. Document upload, institution verification, and portfolio surfacing

```mermaid
sequenceDiagram
    participant St as Student Browser
    participant In as Institution Browser
    participant A as API
    participant DB as MongoDB

    St->>A: POST /api/v1/documents (multipart: file + documentType + title + issuer)
    A->>DB: create Document {user, documentType, verificationStatus: PENDING, data: Buffer}
    A-->>St: 201 {document metadata — data field omitted}

    In->>A: GET /api/v1/documents?verificationStatus=PENDING
    A->>DB: query Document {verificationStatus: PENDING} scoped to institution's users
    DB-->>A: pending document list
    A-->>In: 200 [{document metadata}]

    In->>A: PATCH /api/v1/documents/:id/verify {verificationStatus: VERIFIED, notes}
    A->>DB: update Document {verificationStatus: VERIFIED, verifiedBy, verifiedAt, verificationNotes}
    A->>DB: create Notification for document owner
    A-->>In: 200 {updated document}

    Note over St: Verified document now surfaces on public portfolio

    St->>A: GET /api/v1/portfolio/:studentId
    A->>DB: fetch StudentProfile + Documents where verificationStatus=VERIFIED
    A-->>St: 200 {profile, skills, projects, verifiedDocuments}
```

### D. Aptitude test lifecycle

```mermaid
sequenceDiagram
    participant St as Student Browser
    participant A as API
    participant DB as MongoDB

    St->>A: POST /api/v1/aptitude/tests {category: QUANT, count: 10}
    A->>DB: sample 10 AptitudeQuestion docs from QUANT bank (correctIndex excluded by select:false)
    A->>DB: create AptitudeTest {status: IN_PROGRESS, expiresAt: now + durationSeconds}
    A-->>St: 201 {test with questions — correctIndex never included}

    loop Student answers questions
        St->>A: PATCH /api/v1/aptitude/tests/:id/answer {questionId, chosenIndex}
        A->>DB: update questions[i].chosenIndex in AptitudeTest
        A-->>St: 200
    end

    St->>A: POST /api/v1/aptitude/tests/:id/submit
    A->>DB: verify expiresAt not passed
    A->>DB: load AptitudeQuestion correctIndex values for sampled questionIds
    A->>A: count correct answers, compute score, compare to passingScore (60)
    A->>DB: update AptitudeTest {status: SUBMITTED, score, correctCount, passed, submittedAt}
    alt passed = true
        A->>DB: find StudentSkill matching test category, increment proficiency level
    end
    A-->>St: 200 {score, passed, correctCount, totalQuestions}

    Note over St: If expiresAt passes before submit, next request marks status EXPIRED
```

---

## Tech Stack

### Frontend (`apps/web`)

| Dependency            | Version       | Purpose                   |
| --------------------- | ------------- | ------------------------- |
| React                 | 18.3.1        | UI framework              |
| TypeScript            | 5.4.5         | Type safety               |
| Vite                  | 5.4.1         | Dev server and bundler    |
| Tailwind CSS          | 3.4.10        | Utility-first styling     |
| React Router          | 6.26.0        | Client-side routing       |
| TanStack Query        | 5.51.0        | Server state and caching  |
| React Hook Form       | 7.52.1        | Form management           |
| Zod                   | 3.23.8        | Schema validation         |
| Axios                 | 1.7.4         | HTTP client               |
| Zustand               | 4.5.4         | Auth client state         |
| Recharts              | 2.12.7        | Analytics charts          |
| Sonner                | 1.5.0         | Toast notifications       |
| date-fns              | 3.6.0         | Date formatting           |
| react-icons           | 5.2.1         | Icon library              |
| clsx + tailwind-merge | 2.1.1 / 2.5.2 | Conditional class merging |

### Backend (`apps/api`)

| Dependency            | Version        | Purpose                    |
| --------------------- | -------------- | -------------------------- |
| Node.js               | 20+            | Runtime                    |
| Express               | 4.19.2         | HTTP framework             |
| TypeScript            | 5.4.5          | Type safety                |
| Mongoose              | 8.5.1          | MongoDB ODM                |
| Zod                   | 3.23.8         | Request validation         |
| jsonwebtoken          | 9.0.2          | JWT sign and verify        |
| bcryptjs              | 2.4.3          | Password hashing           |
| Helmet                | 7.1.0          | Security headers           |
| cors                  | 2.8.5          | Cross-origin policy        |
| express-rate-limit    | 7.4.0          | Rate limiting              |
| Multer                | 1.4.5-lts.1    | Multipart file upload      |
| pdfkit                | 0.15.x         | PDF certificate generation |
| Pino / pino-http      | 9.3.2 / 10.2.0 | Structured logging         |
| @google/generative-ai | 0.21.0         | Gemini SDK                 |
| cloudinary            | 2.4.0          | Cloud file storage SDK     |
| cookie-parser         | 1.4.6          | httpOnly cookie parsing    |
| dotenv                | 16.4.5         | `.env` file loading        |

### Tooling

| Tool        | Version | Purpose                                  |
| ----------- | ------- | ---------------------------------------- |
| pnpm        | 9.15.0  | Package manager and workspaces           |
| ESLint      | 9.9.0   | Linting (0 warnings policy)              |
| Prettier    | 3.3.3   | Code formatting                          |
| Husky       | 9.1.4   | Pre-commit git hooks                     |
| lint-staged | 15.2.7  | Run checks on staged files               |
| Vitest      | 2.0.5   | Unit and integration tests               |
| Playwright  | 1.46.1  | End-to-end tests                         |
| Supertest   | 7.0.0   | API integration tests                    |
| tsx         | 4.19.0  | TypeScript execution for dev and scripts |

---

## Prerequisites

All platforms:

- **Node.js 20+** — verify with `node -v` — download at [nodejs.org](https://nodejs.org)
- **pnpm 9+** — `npm install -g pnpm@9` or `corepack enable && corepack prepare pnpm@9 --activate`
- **MongoDB Atlas free tier** (or local MongoDB 7+) — [mongodb.com/atlas](https://www.mongodb.com/atlas)
- **Cloudinary free account** — only needed if `RESUME_STORAGE=CLOUDINARY` — [cloudinary.com](https://cloudinary.com)
- **Google AI Studio API key** — only needed for the AI Assessment feature — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **PDF generation** uses `pdfkit` (already declared in `apps/api/package.json`). Running `pnpm install` at the repo root once is sufficient — no separate install step required.

---

## Setup — Windows (PowerShell)

### Step 1: Install prerequisites

```powershell
winget install OpenJS.NodeJS.LTS
npm install -g pnpm@9
```

Verify:

```powershell
node -v    # v20.x.x or newer
pnpm -v    # 9.x.x
```

### Step 2: Clone or unzip, then install

```powershell
cd C:\path\to\workspace
# unzip the archive if distributed as .zip, or git clone
cd academia-industry-portal
pnpm install
```

### Step 3: Configure environment variables

```powershell
copy .env.example .env
node scripts\gen-secrets.mjs      # prints two 96-char JWT secrets
notepad .env                       # paste MONGODB_URI + both JWT secrets
node scripts\check-env.mjs         # validates all required vars are present
```

**What each required variable does:**

| Variable             | Purpose                                                        | Example                                        |
| -------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| `MONGODB_URI`        | Atlas connection string                                        | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `JWT_ACCESS_SECRET`  | Signs 15-minute access tokens (≥32 chars, 96 recommended)      | `<first output from gen-secrets>`              |
| `JWT_REFRESH_SECRET` | Signs 7-day refresh tokens (must differ from access secret)    | `<second output from gen-secrets>`             |
| `FRONTEND_URL`       | CORS allowed origin — must match exactly what the browser sees | `http://localhost:5173`                        |
| `PORT`               | API listen port                                                | `4000`                                         |

Optional variables for specific features:

| Variable                                                               | Feature unlocked                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Resume and logo storage via Cloudinary CDN                                |
| `GEMINI_API_KEY`                                                       | AI Assessment generation and evaluation                                   |
| `GEMINI_MODEL`                                                         | Override the Gemini model — set to`gemini-2.5-flash`                      |
| `WEBHOOK_LMS_SECRET`                                                   | HMAC-SHA256 shared secret for LMS certification webhook (Coursera, Udemy) |
| `WEBHOOK_ERP_SECRET`                                                   | HMAC-SHA256 shared secret for institutional ERP student sync webhook      |

### Step 4: Seed and run

```powershell
pnpm seed
pnpm dev
```

Open http://localhost:5173. Backend health: http://localhost:4000/api/v1/health.

### One-command bootstrap (alternative to steps 1–4)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

> **Windows gotcha:** If PowerShell blocks the script with "cannot be loaded because running scripts is disabled on this system", the `-ExecutionPolicy Bypass` flag in the command above handles it without permanently altering your system policy.

---

## Setup — macOS (Terminal)

### Step 1: Install prerequisites

```bash
brew install node        # Node LTS via Homebrew
npm install -g pnpm@9
```

Or use [nvm](https://github.com/nvm-sh/nvm): `nvm install 20 && nvm use 20`, then `npm install -g pnpm@9`.

### Step 2: Clone or unzip, then install

```bash
cd /path/to/workspace
cd academia-industry-portal
pnpm install
```

### Step 3: Configure environment variables

```bash
cp .env.example .env
node scripts/gen-secrets.mjs    # prints two 96-char JWT secrets
open -e .env                    # opens in TextEdit; or use nano / vim
node scripts/check-env.mjs      # validates
```

### Step 4: Seed and run

```bash
pnpm seed
pnpm dev
```

Open http://localhost:5173.

### One-command bootstrap (alternative)

```bash
bash scripts/setup.sh
```

> **macOS gotcha:** `dotenv` in `apps/api/src/config/env.ts` resolves `.env` from `process.cwd()`, which is `apps/api` when run under `tsx`. If your setup script doesn't symlink `.env` automatically, run:
>
> ```bash
> ln -sf ../../.env apps/api/.env
> ln -sf ../../.env apps/web/.env
> ```

---

## Environment Variables Reference

All variables belong in `.env` at the repo root. The setup scripts symlink it into each app directory.

> **Security rule:** never prefix a secret with `VITE_`. Every `VITE_*` variable is embedded into the browser bundle at build time. `JWT_*`, `MONGODB_*`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`, `WEBHOOK_LMS_SECRET`, and `WEBHOOK_ERP_SECRET` must never have a `VITE_` prefix.

| Variable                  | Required           | Default                    | Purpose                                                                                                                                            | Safe placeholder                                     |
| ------------------------- | ------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `NODE_ENV`                | No                 | `development`              | Runtime mode                                                                                                                                       | `development`                                        |
| `PORT`                    | No                 | `4000`                     | API listen port                                                                                                                                    | `4000`                                               |
| `API_URL`                 | No                 | —                          | Public API base URL                                                                                                                                | `http://localhost:4000`                              |
| `FRONTEND_URL`            | **Yes**            | —                          | CORS allowed origin (exact match)                                                                                                                  | `http://localhost:5173`                              |
| `MONGODB_URI`             | **Yes**            | —                          | MongoDB Atlas connection string                                                                                                                    | `mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/` |
| `MONGODB_DB_NAME`         | No                 | `academia_industry_portal` | Database name                                                                                                                                      | `academia_industry_portal`                           |
| `JWT_ACCESS_SECRET`       | **Yes**            | —                          | Signs access tokens — ≥32 chars; 96 hex recommended                                                                                                | `<output from gen-secrets line 1>`                   |
| `JWT_REFRESH_SECRET`      | **Yes**            | —                          | Signs refresh tokens — must differ from access secret                                                                                              | `<output from gen-secrets line 2>`                   |
| `JWT_ACCESS_EXPIRES_IN`   | No                 | `15m`                      | Access token TTL                                                                                                                                   | `15m`                                                |
| `JWT_REFRESH_EXPIRES_IN`  | No                 | `7d`                       | Refresh token TTL                                                                                                                                  | `7d`                                                 |
| `COOKIE_DOMAIN`           | No                 | `localhost`                | Cookie domain scope                                                                                                                                | `localhost`                                          |
| `COOKIE_SECURE`           | No                 | `false`                    | Require HTTPS for cookies — set`true` in production                                                                                                | `false`                                              |
| `CLOUDINARY_CLOUD_NAME`   | If Cloudinary      | —                          | Your cloud name (short slug, not a URL)                                                                                                            | `my-cloud-name`                                      |
| `CLOUDINARY_API_KEY`      | If Cloudinary      | —                          | Cloudinary API key                                                                                                                                 | `123456789012345`                                    |
| `CLOUDINARY_API_SECRET`   | If Cloudinary      | —                          | Cloudinary API secret                                                                                                                              | `<cloudinary-api-secret>`                            |
| `RESUME_STORAGE`          | No                 | `DATABASE`                 | `DATABASE` stores PDF binary in MongoDB; `CLOUDINARY` uploads to CDN                                                                               | `DATABASE`                                           |
| `GEMINI_API_KEY`          | If AI features     | —                          | Google AI Studio API key                                                                                                                           | `<your-gemini-api-key>`                              |
| `GEMINI_MODEL`            | No                 | `gemini-2.5-flash`         | Gemini model ID — do not use`gemini-1.5-flash`, deprecated in 2025. Change via env only — never hardcoded in code. See `docs/CHANGING_AI_MODEL.md` | `gemini-2.5-flash`                                   |
| `MAX_FILE_SIZE_MB`        | No                 | `5`                        | Max upload size in MB                                                                                                                              | `5`                                                  |
| `RATE_LIMIT_WINDOW_MS`    | No                 | `900000`                   | Rate limit window in ms (15 minutes)                                                                                                               | `900000`                                             |
| `RATE_LIMIT_MAX_REQUESTS` | No                 | `100`                      | Max requests per window per IP                                                                                                                     | `100`                                                |
| `LOG_LEVEL`               | No                 | `info`                     | Pino log level (`trace`, `debug`, `info`, `warn`, `error`)                                                                                         | `info`                                               |
| `WEBHOOK_LMS_SECRET`      | If LMS webhooks    | —                          | HMAC-SHA256 shared secret for LMS certification events (Coursera, Udemy). Feature disabled if unset                                                | `<lms-webhook-secret>`                               |
| `WEBHOOK_ERP_SECRET`      | If ERP sync        | —                          | HMAC-SHA256 shared secret for institutional ERP student sync. Feature disabled if unset                                                            | `<erp-webhook-secret>`                               |
| `VITE_API_URL`            | **Yes (frontend)** | —                          | Backend URL visible to the browser                                                                                                                 | `http://localhost:4000/api/v1`                       |
| `VITE_APP_NAME`           | No                 | —                          | App name in the browser tab                                                                                                                        | `AcadIn.`                                            |

> `RESUME_STORAGE` is not present in `.env.example` because its default (`DATABASE`) requires no additional configuration. Add it explicitly only when switching to Cloudinary.

---

## Development Commands

| Command                          | Effect                                                                                                                                                                                                                                                                               | When to use                |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `pnpm dev`                       | Starts API (:4000) and web (:5173) in parallel                                                                                                                                                                                                                                       | Day-to-day development     |
| `pnpm --filter @aip/api dev`     | Backend only                                                                                                                                                                                                                                                                         | Backend-only work          |
| `pnpm --filter @aip/web dev`     | Frontend only                                                                                                                                                                                                                                                                        | Frontend-only work         |
| `pnpm build`                     | Builds all packages then all apps in dependency order                                                                                                                                                                                                                                | Pre-deployment             |
| `pnpm build:api`                 | Builds backend to`apps/api/dist/`                                                                                                                                                                                                                                                    | Quick API build check      |
| `pnpm build:web`                 | Builds frontend to`apps/web/dist/`                                                                                                                                                                                                                                                   | Quick frontend build check |
| `pnpm typecheck`                 | `tsc --noEmit` across all workspaces                                                                                                                                                                                                                                                 | Before committing          |
| `pnpm lint`                      | ESLint with`--max-warnings 0` across all workspaces                                                                                                                                                                                                                                  | Before committing          |
| `pnpm format`                    | Prettier writes all TS / JSON / MD / YAML                                                                                                                                                                                                                                            | Code hygiene               |
| `pnpm format:check`              | Prettier check only (no writes)                                                                                                                                                                                                                                                      | CI                         |
| `pnpm test`                      | All unit and integration tests                                                                                                                                                                                                                                                       | Before pushing             |
| `pnpm --filter @aip/api test`    | Backend tests only                                                                                                                                                                                                                                                                   | After backend changes      |
| `pnpm --filter @aip/web test`    | Frontend tests only                                                                                                                                                                                                                                                                  | After frontend changes     |
| `pnpm test:e2e`                  | Playwright end-to-end (needs`pnpm dev` and `pnpm seed` running)                                                                                                                                                                                                                      | Feature validation         |
| `pnpm seed`                      | **Deletes every collection**, then seeds only reference data (the skill catalogue). Refused when `NODE_ENV=production`, and refused for a non-local `MONGODB_URI` unless you pass `--force` (or set `SEED_FORCE=1`). Does **not** create demo users, institutions, or business data. | After a DB reset           |
| `pnpm start:api`                 | Runs compiled`apps/api/dist/server.js`                                                                                                                                                                                                                                               | Production API             |
| `pnpm --filter @aip/web preview` | Serves built`apps/web/dist/`                                                                                                                                                                                                                                                         | Production build check     |
| `pnpm clean`                     | Removes all`dist/` and `node_modules/`                                                                                                                                                                                                                                               | Full reset                 |

**Utility scripts:**

| Script            | Command                                                      | What it does                                                                      |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `setup.sh`        | `bash scripts/setup.sh`                                      | macOS/Linux bootstrap: Node check, pnpm install,`.env` copy, gen-secrets          |
| `setup.ps1`       | `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` | Windows equivalent                                                                |
| `gen-secrets.mjs` | `node scripts/gen-secrets.mjs`                               | Prints two 96-char hex secrets for JWT vars                                       |
| `check-env.mjs`   | `node scripts/check-env.mjs`                                 | Validates`.env` completeness and minimum secret length; exits non-zero on failure |

---

## Functional Guide

The walkthroughs below describe each role's full feature set. Register a real account through the signup flow and use your own credentials to follow along.

### Student Walkthrough

1. **Sign in** — the app redirects to `/student/dashboard`.
2. **Dashboard** — stat cards show total applications, scheduled interviews, recommendation count, skill count, and the latest AI assessment score. A Recharts panel shows application history over time.
3. **Profile → Edit Profile** — fill personal info (full name, phone, DOB, gender, city, state), academic info (college, university, degree, branch, CGPA, graduation year), and a bio. Add entries to the Projects, Certifications, Experience, and Achievements arrays via dynamic form rows. Save.
4. **Skills** — click "Add Skill". Pick a skill from the shared catalog, choose a proficiency level, optionally enter years of experience and a link to evidence (e.g. a GitHub repo). The skill chip appears in your list immediately.
5. **Resume** — drag a PDF (≤5 MB) onto the upload zone. A success toast confirms upload. "View" opens the PDF; "Download" triggers a file download — both work whether storage is DATABASE or CLOUDINARY.
6. **Documents** (`/student/documents`) — upload certificates, transcripts, or internship reports. Each document enters a `PENDING` verification queue. Once an admin, institution, or company verifies it, the document's `verificationStatus` becomes `VERIFIED` and it surfaces on your public portfolio automatically.
7. **Public Portfolio** — your portfolio at `/portfolio/:studentId` is accessible without login. Share the URL with recruiters — it shows your profile, skills, projects, and verified documents only.
8. **Jobs** — browse active listings. Use the filter bar (required skill, location, work mode) to narrow results. Click a job card to see the match score chip (0–100), missing skills highlighted, and an "Apply" button. The apply modal requests a cover letter.
9. **Internships** — identical flow to Jobs but for internship listings.
10. **Applications** — each row shows the opportunity, company, current status badge, and a timeline button that expands the full status history (APPLIED → SHORTLISTED → SELECTED or REJECTED) with timestamps.
11. **Interim Reports** — once your application status reaches `SELECTED`, a "Submit Report" button appears on the application detail page. Fill in work description, learnings, challenges, and hours worked. After submitting at least one report, your company mentor can provide feedback and a rating. Enough reports unlock the PDF certificate download.
12. **Interviews** — upcoming interviews show date, time, duration, mode, interviewer name, and a "Join" button (if the company set a meeting link).
13. **Aptitude Tests** (`/student/aptitude`) — choose a category (QUANT, LOGIC, VERBAL, or ENGLISH). A timed multiple-choice test opens; the server-authoritative timer forces submission or auto-expiry at `expiresAt`. On passing (score ≥ 60), the proficiency level for the matching skill category in your skill list upgrades automatically.
14. **Assessments** — Gemini-generated open-answer questions drawn from your own skills. Choose question count (1–10) and duration (5–60 minutes), answer with autosave, submit for AI evaluation. Results show overall score, per-question breakdown, identified strengths and weaknesses.
15. **Mentorship** (`/student/mentorship`) — browse published mentor profiles. Send a request with an initial message. Once accepted, a threaded inbox opens for ongoing communication.
16. **Notifications** — full list of notifications. Click to mark read; "Mark all read" clears the badge.
17. **Skill Gap** — pick any active job or internship from the dropdown to see matched skills (green) vs. missing skills (red) side by side, with linked training programs for each gap.
18. **Recommended** — AI-ranked opportunities and training programs based on your full skill profile.
19. **Saved** — bookmarked jobs and internships with quick-apply links.
20. **Training** — catalog of available training programs, each showing provider, duration, skills covered, and a registration link.

### Company Walkthrough

1. **Sign in** — redirects to `/company/dashboard` with stat cards for active postings, total applicants, interviews today, and shortlisted count.
2. **Company Profile → Edit** — upload a logo, edit description, industry, website, phone, location, company size, and founded year. Save.
3. **Jobs → New Job** — fill in title, description, location, work mode (REMOTE / ONSITE / HYBRID), employment type, salary range (min/max/currency), min CGPA, eligible branches, eligible graduation years, required skills (multi-select from the catalog), and preferred skills. Choose "Save as Draft" to keep it private or "Publish" to make it visible to students.
4. **Internships → New Internship** — same form as Job but with duration in months and stipend instead of salary.
5. **Faculty Opportunities → New Faculty Opportunity** — post an FDP, consultancy, collaborative research, or faculty internship. Set `opportunityType`, required expertise, duration, stipend, application deadline, and `targetRoles` (FACULTY and/or STUDENT). Publish to surface the listing to faculty browsers.
6. **Manage postings** — table of all jobs, internships, and faculty opportunities. Force-close stops new applications without deleting. Edit opens the form pre-filled. Delete removes the posting entirely.
7. **Applicants** — full list across all your postings. Filter by specific opportunity. Each row shows candidate name, match score chip, application date, and status badge. Click a row for the full candidate view: skill list with proficiency, resume link, academic info, projects, and application timeline.
8. **Shortlist / Reject** — click "Shortlist" to move the application to SHORTLISTED; the candidate receives a notification. Click "Reject" to close the application. The same flow applies to faculty applicants.
9. **Document Verification** — from a candidate's profile, view uploaded documents. Verify or reject each; a notification is sent to the candidate.
10. **Schedule Interview** — from a candidate's detail page, click "Schedule Interview". Pick a date/time, mode (ONLINE / OFFLINE / HYBRID), optional meeting link, and interviewer name. Submit creates the interview and notifies the candidate.
11. **Interviews** — view all scheduled, completed, and cancelled interviews. Mark as COMPLETED and add feedback. Reschedule or cancel from the row action menu.
12. **Mentorship** — create a MentorProfile (bio, expertise, capacity) to accept mentorship requests from students and faculty. Review and accept or decline incoming requests. Communicate with active mentees via the threaded inbox.
13. **Collaboration Events** — publish a workshop, guest lecture, innovation challenge, or live project. Set capacity, event date, registration deadline, and target audience. Students and faculty register directly; capacity is enforced.
14. **Shortlisted** — quick view of all candidates currently at SHORTLISTED status across all your postings.
15. **Notifications** — new-application alerts with direct links to each applicant.

### Admin Walkthrough

1. **Sign in** — redirects to `/admin/dashboard` with six stat cards (total students, companies, active jobs, active internships, total applications, placements) and Recharts panels (applications over time, top demanded skills, placement rate by branch).
2. **Students** — paginated table of all student accounts. Toggle active/inactive status. Click a row to view the full profile in read-only mode.
3. **Companies** — paginated table. Click "Verify" to record `verifiedAt` and show the verified badge on all their postings. Toggle active/inactive to control login access.
4. **Jobs / Internships** — full cross-company listings. Force-close any posting that violates policy. Delete if needed.
5. **Applications** — read-only view of all applications across all companies, filterable by status.
6. **Institutions** (`/admin/institutions`) — create new institution records (name, unique code, email domain, address, city, state, contact). Verify or reject pending institutions. Once verified, send an invite to designate an INSTITUTION-role user linked to that record.
7. **Skills** — add new skills to the shared catalog (name, category). Archive outdated skills so they stop appearing in dropdowns but remain in historical records.
8. **Training** — create training programs with title, provider, description, duration in weeks, start/end dates, registration deadline, registration URL, and the skills they cover (multi-select from the catalog).
9. **Aptitude Questions** (`/admin/aptitude-questions`) — add, edit, and archive multiple-choice questions for the QUANT, LOGIC, VERBAL, and ENGLISH banks. The `correctIndex` field is visible only here — students never see it.
10. **Verifications** (`/admin/verifications`) — global queue of all `PENDING` documents from students and faculty across the entire platform. Verify or reject each with optional notes. Verified documents immediately appear on the submitter's public portfolio.
11. **Mentorship** (`/admin/mentorship`) — read-only oversight of all active mentorship pairings and pending requests.
12. **Events** (`/admin/events`) — read-only view of all collaboration events; can force-close any event.
13. **Analytics** — Recharts dashboard for placement analytics. Download panels as CSV via the action button.
14. **Industry Skill Demand** — bar chart of the most-demanded skills across all currently active job and internship postings, re-queried on each page load.
15. **Audit Logs** — paginated table of every significant platform action. Filter by actor, action type, entity type, and date range. Click any row to open a modal showing the before and after JSON diff.

### Faculty Walkthrough

1. **Sign in** — redirects to `/faculty/dashboard` with stat cards for active applications, upcoming events, and pending mentoring requests.
2. **Profile** (`/faculty/profile`) — view your linked institution, designation, department, qualifications, research interests, and bio. Click "Edit Profile" to update any field.
3. **Browse Opportunities** (`/faculty/opportunities`) — list of all published faculty opportunities (FDPs, consultancies, collaborative research, faculty internships). Filter by opportunity type, work mode, and keyword. Click any card for full details: required expertise, duration, stipend, host name.
4. **Apply** — from an opportunity detail page, click "Apply" and enter a cover letter. The application is created with `status: APPLIED`. Only opportunities with `opportunityType` in FACULTY_INTERNSHIP, FDP, CONSULTANCY, COLLABORATIVE_RESEARCH are valid targets — regular JOB and INTERNSHIP postings return a 403 for faculty applicants.
5. **My Applications** (`/faculty/applications`) — table of all submitted applications with status badges. Click a row to view the full timeline and opportunity details.
6. **Documents** — upload academic credentials (certificates, publications, transcripts). Each enters the verification queue; your institution can verify them.
7. **Events** (`/faculty/events`) — browse open collaboration events. Register or unregister; registered count is shown against event capacity.
8. **Mentorship** (`/faculty/mentorship`) — view incoming mentorship requests from students. Accept or decline each with an optional response message. Communicate with active mentees via the threaded inbox. Also submit feedback and ratings on interim reports from your mentees.
9. **Settings** (`/faculty/settings`) — update email, password, and notification preferences.

### Institution Walkthrough

> Institution accounts are admin-invite-only. The admin creates and verifies the institution record, then sends an invite that provisions the INSTITUTION-role user linked to that institution. There is no self-registration path.

1. **Sign in** — redirects to `/institution/dashboard` with metric cards scoped to your institution: total students, total faculty, active placements, skill gap count, and FDP participation count.
2. **Students Directory** (`/institution/students`) — paginated list of all students whose `StudentProfile.institution` matches your institution ObjectId. Click a row to view the full student profile in read-only mode.
3. **Faculty Directory** (`/institution/faculty`) — paginated list of all faculty linked to your institution. Click a row for the full faculty profile including qualifications and research interests.
4. **Skill Gaps** (`/institution/skill-gaps`) — chart comparing the most in-demand skills across active postings against the skills your students actually hold. Identifies training priorities at an institutional level.
5. **Placements** (`/institution/placements`) — placement rate and hired-student breakdown for your institution. Filterable by branch and graduation year.
6. **FDPs** (`/institution/fdps`) — summary of FDP applications submitted by your faculty: counts for applied, shortlisted, selected, and completed, broken down by hosting organization.
7. **Verifications** (`/institution/verifications`) — queue of `PENDING` documents submitted by your own students and faculty only. Verify or reject each with optional notes.
8. **Events** — create and manage collaboration events hosted by your institution (guest lectures, workshops). Set capacity, date, registration deadline, and target audience.

---

## AI Assessment Feature — Deep Dive

The assessment engine uses `gemini-2.5-flash` (or whichever model is set in `GEMINI_MODEL`) to generate and evaluate short-answer technical questions based on a student's own skill profile.

> **Deprecated model warning:** `gemini-1.5-flash` was deprecated by Google in 2025. Set `GEMINI_MODEL=gemini-2.5-flash` in your `.env`. Existing Assessment documents remain valid regardless of which model generated them — only future generations use the updated value. The model ID is never hardcoded in the codebase; changing the env var and restarting the backend is the only step required. See [`docs/CHANGING_AI_MODEL.md`](./docs/CHANGING_AI_MODEL.md).

### How it works

1. Student calls `POST /api/v1/assessments/me/generate` with `questionCount` and `durationMinutes`.
2. Backend loads the student's `StudentSkill` documents and resolves the human-readable `skillNames`.
3. A generation prompt is sent to Gemini asking for exactly `questionCount` short-answer questions as a JSON array.
4. The response is stripped of any markdown fences by an `extractJson()` helper, then Zod-validated.
5. Each question receives a unique ID via `node:crypto` `randomUUID()`.
6. An `Assessment` document is created: `status: GENERATED`, `startedAt: now`, `expiresAt: startedAt + durationMinutes * 60000`.
7. The student answers in the browser; each answer autosaves via `PATCH /api/v1/assessments/me/:id/answers` debounced at 500ms.
8. On Submit (`POST /api/v1/assessments/me/:id/submit`), the backend checks `expiresAt` and sends all Q+A pairs to Gemini with an evaluation prompt.
9. Gemini returns per-question scores, overall feedback, and identified strengths/weaknesses.
10. Backend computes `totalScore = Math.round(rawScore / maxScore * 100)` and stores the `evaluation` subdoc.
11. Assessment status advances to `EVALUATED`. The document is permanent in MongoDB.
12. `GET /api/v1/students/me/summary` returns `latestScore` from the most recent evaluated assessment, shown on the dashboard.

**Rate limiting:** 5 assessment generations per hour per IP via `express-rate-limit` for cost control.

**Timer enforcement:** `expiresAt` is server-authoritative. The frontend countdown is purely for UX — the backend rejects submit calls received after `expiresAt`.

### Assessment lifecycle

```mermaid
sequenceDiagram
    participant Br as Browser
    participant A as API
    participant G as Gemini 2.5 Flash
    participant DB as MongoDB

    Br->>A: POST /assessments/me/generate {questionCount: 10, durationMinutes: 30}
    A->>DB: load StudentSkill, resolve skill names
    A->>G: generation prompt (skill list, N questions, JSON-only format)
    G-->>A: raw response string
    A->>A: extractJson() strips markdown fences
    A->>A: Zod validate, randomUUID() per question
    A->>DB: create Assessment {status: GENERATED, questions[], expiresAt}
    A-->>Br: 201 {assessment}

    loop Answer each question (debounced 500ms)
        Br->>A: PATCH /assessments/me/:id/answers
        A->>DB: upsert in answers[]
        A-->>Br: 200
    end

    Br->>A: POST /assessments/me/:id/submit
    A->>DB: verify not expired, set SUBMITTED
    A->>G: evaluation prompt (all Q+A pairs)
    G-->>A: raw JSON {perQuestion, overallFeedback, strengths, weaknesses}
    A->>A: Zod validate, compute totalScore
    A->>DB: Assessment {status: EVALUATED, evaluation subdoc}
    A-->>Br: 200 {evaluation}
```

### Prompt templates

The following templates reflect the structure used in the assessments module. For exact wording, see [`docs/ai.md`](./docs/ai.md).

**Generation prompt:**

```
You are an expert technical interviewer. The student has the following skills:
{skillNames joined by comma}

Generate exactly {questionCount} short-answer interview questions to assess their knowledge.
Each question should be answerable in 2-4 sentences.

Return ONLY a valid JSON array with no markdown fences and no explanation:
[
  {
    "text": "question text",
    "targetSkills": ["skill1"],
    "expectedConcepts": ["concept1", "concept2"],
    "maxMarks": 10
  }
]
```

**Evaluation prompt:**

```
You are an expert technical evaluator. Evaluate the following interview answers.

{formatted list of questions with student answers}

Return ONLY a valid JSON object with no markdown fences and no explanation:
{
  "perQuestion": [
    { "questionId": "...", "score": 8, "feedback": "..." }
  ],
  "overallFeedback": "...",
  "strengths": "...",
  "weaknesses": "..."
}

Score each answer out of its maxMarks. Be fair and rigorous.
```

---

## Resume Storage

Resume storage mode is controlled by the `RESUME_STORAGE` environment variable.

### DATABASE (default)

- The PDF binary is stored in `Resume.data: Buffer` in MongoDB.
- This field is `select: false` — it is never included in API responses or query results unless explicitly selected.
- `GET /api/v1/students/me/resume/download` reads the buffer and streams it to the client with `Content-Disposition: attachment; filename="resume.pdf"`.
- Requires no external service — works out of the box with any MongoDB connection.

### CLOUDINARY

- Multer buffers the upload in memory; the backend then pipes it to `cloudinary.uploader.upload_stream`.
- `Resume.cloudinaryPublicId` and `Resume.url` (CDN URL) are stored in MongoDB; the binary is not.
- `GET /api/v1/students/me/resume/download` issues a 302 redirect to the Cloudinary CDN URL.
- Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`.

### Trade-offs

|                   | DATABASE                                          | CLOUDINARY                                                                       |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Setup effort      | None                                              | Requires account and 3 env vars                                                  |
| Binary in MongoDB | Yes — counts against Atlas storage quota          | No — Mongo stays lean                                                            |
| CDN delivery      | No — streams through your API server              | Yes — global CDN, instant load                                                   |
| Max file size     | 5 MB (controlled by`MAX_FILE_SIZE_MB`)            | Same 5 MB limit                                                                  |
| Best for          | Development, small deployments                    | Production with many users                                                       |
| Main gotcha       | 512 MB Atlas free tier fills up with many resumes | API key needs`upload` AND `read` permissions — provisioning-only keys return 403 |

> **Cloudinary permission gotcha:** If the backend log shows a Cloudinary error mentioning `actions=[create]`, your API key was provisioned without upload permissions. Go to Cloudinary Console → Settings → Access Keys and generate a full-access key, or set `RESUME_STORAGE=DATABASE` for development.

---

## Role-Based Access Control (RBAC)

Access is enforced via `requireRole(...)` middleware on every protected route. Institution analytics are additionally scoped server-side to the requesting user's linked institution — they cannot query data from other institutions.

| Action                                                     |      STUDENT       |       COMPANY        |     ADMIN      |       FACULTY        |      INSTITUTION       |
| ---------------------------------------------------------- | :----------------: | :------------------: | :------------: | :------------------: | :--------------------: |
| Self-register                                              |        Yes         |         Yes          | No (seed only) |         Yes          | No (admin-invite only) |
| Login                                                      |        Yes         |         Yes          |      Yes       |         Yes          |          Yes           |
| Edit own profile                                           |        Yes         |         Yes          |       No       |         Yes          |          Yes           |
| Post Job / Internship                                      |         No         |      Yes (own)       |      Yes       |          No          |           No           |
| Post FDP / Consultancy / Research / Faculty Internship     |         No         |         Yes          |      Yes       |          No          |          Yes           |
| Apply to Job / Internship                                  |        Yes         |          No          |       No       |          No          |           No           |
| Apply to FDP / Faculty Internship / Consultancy / Research |         No         |          No          |       No       |         Yes          |           No           |
| Register for Collaboration Event                           |        Yes         |          No          |       No       |         Yes          |           No           |
| Create Collaboration Event                                 |         No         |         Yes          |      Yes       |          No          |          Yes           |
| Upload Document                                            |     Yes (own)      |          No          |       No       |      Yes (own)       |           No           |
| Verify Document                                            |         No         | Yes (own applicants) |   Yes (all)    |          No          | Yes (own institution)  |
| View Public Portfolio (`/portfolio/:studentId`)            |       Anyone       |        Anyone        |     Anyone     |        Anyone        |         Anyone         |
| Request Mentorship                                         |        Yes         |          No          |       No       |         Yes          |           No           |
| Publish MentorProfile                                      |         No         |         Yes          |       No       | Yes (senior faculty) |           No           |
| Accept / Decline Mentorship Request                        |         No         |      Yes (own)       |       No       |      Yes (own)       |           No           |
| Generate AI Assessment                                     |        Yes         |          No          |       No       |          No          |           No           |
| Take Aptitude Test                                         |        Yes         |          No          |       No       |          No          |           No           |
| Manage Aptitude Question Bank                              |         No         |          No          |      Yes       |          No          |           No           |
| View Institution Analytics                                 |         No         |          No          |   Yes (all)    |          No          | Yes (own institution)  |
| Verify Institution                                         |         No         |          No          |      Yes       |          No          |           No           |
| Manage Institutions (CRUD)                                 |         No         |          No          |      Yes       |          No          |           No           |
| View All Audit Logs                                        |         No         |          No          |      Yes       |          No          |           No           |
| Schedule Interview                                         |         No         | Yes (own applicants) |      Yes       |          No          |           No           |
| Download PDF Certificate                                   | Yes (own SELECTED) |          No          |      Yes       |  Yes (own SELECTED)  |           No           |
| Submit Interim Report                                      | Yes (own SELECTED) |          No          |       No       |          No          |           No           |
| Review Interim Report / Add Feedback                       |         No         | Yes (own applicants) |       No       | Yes (active mentees) |           No           |
| Manage Skills Catalog                                      |         No         |          No          |      Yes       |          No          |           No           |
| Manage Training Programs                                   |         No         |          No          |      Yes       |          No          |           No           |
| Trigger LMS Webhook                                        |         No         |          No          |       No       |          No          | No (external LMS only) |
| Trigger ERP Webhook                                        |         No         |          No          |       No       |          No          | No (external ERP only) |

---

## API Reference (Quick Map)

Base URL: `http://localhost:4000/api/v1`

| Prefix                              | Module                | Description                                                                              |
| ----------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `/health`                           | health                | Service health check — no auth required                                                  |
| `/auth`                             | auth                  | Register, login, logout, token refresh,`/me`                                             |
| `/students`                         | students              | Student profile CRUD, summary, skills                                                    |
| `/companies`                        | companies             | Company profile CRUD, verification                                                       |
| `/skills`                           | skills                | Shared skill catalog                                                                     |
| `/jobs`                             | jobs                  | Job posting CRUD and listing                                                             |
| `/internships`                      | internships           | Internship posting CRUD and listing                                                      |
| `/applications`                     | applications          | Application lifecycle, status transitions;`POST /:id/certificate` streams PDF via pdfkit |
| `/interviews`                       | interviews            | Interview scheduling and management                                                      |
| `/recommendations`                  | recommendations       | Opportunity and training recommendations                                                 |
| `/notifications`                    | notifications         | In-app notifications                                                                     |
| `/training`                         | training              | Training program catalog                                                                 |
| `/saved-opportunities`              | saved-opportunities   | Bookmarked opportunities                                                                 |
| `/analytics`                        | analytics             | Admin dashboard aggregation queries                                                      |
| `/resumes`                          | resumes               | Resume upload and download                                                               |
| `/ai`                               | ai                    | Gemini-powered career assistant                                                          |
| `/admin`                            | admin                 | Admin management operations                                                              |
| `/audit-logs`                       | audit                 | Audit log queries and filtering                                                          |
| `/assessments`                      | assessments           | AI assessment generate, answer, submit, evaluate                                         |
| `/institutions`                     | institutions          | Public institution catalog; admin CRUD and verification                                  |
| `/faculty`                          | faculty               | Faculty profile CRUD                                                                     |
| `/faculty-opportunities`            | faculty-opportunities | FDP / consultancy / research / faculty internship CRUD and listing                       |
| `/documents`                        | documents             | Multipart upload, metadata list, delete;`PATCH /:id/verify` for verification queue       |
| `/portfolio/:studentId`             | portfolio             | Public student portfolio — no auth required                                              |
| `/institution-analytics/dashboard`  | institution-analytics | Scoped summary metrics for the requesting institution                                    |
| `/institution-analytics/students`   | institution-analytics | Student list and stats scoped to institution                                             |
| `/institution-analytics/faculty`    | institution-analytics | Faculty list and stats scoped to institution                                             |
| `/institution-analytics/skill-gaps` | institution-analytics | Skill gap analysis for institution's students                                            |
| `/institution-analytics/placements` | institution-analytics | Placement breakdown for institution                                                      |
| `/institution-analytics/fdps`       | institution-analytics | FDP participation report for institution's faculty                                       |
| `/mentorship/profiles`              | mentorship            | MentorProfile CRUD — create, update, deactivate                                          |
| `/mentorship/requests`              | mentorship            | Request lifecycle: create, accept, decline, list                                         |
| `/mentorship/messages`              | mentorship            | Threaded inbox for accepted mentorship pairs                                             |
| `/aptitude/questions`               | aptitude              | Question bank CRUD (admin); student list omits`correctIndex`                             |
| `/aptitude/tests`                   | aptitude              | Test lifecycle: start, answer, submit, result                                            |
| `/collaboration/events`             | collaboration         | Collaboration event CRUD and listing                                                     |
| `/collaboration/registrations`      | events                | Event registration and unregistration                                                    |
| `/interim-reports`                  | interim-reports       | Submit report (student), add feedback and rating (mentor)                                |
| `/webhooks/lms/certificate`         | webhooks              | `POST` — HMAC-SHA256 verified; creates a `VERIFIED` Document from LMS course completion  |
| `/webhooks/erp/students`            | webhooks              | `POST` — HMAC-SHA256 verified; upserts student profiles from institutional ERP sync      |

For detailed request/response schemas, see [`docs/api.md`](./docs/api.md).

### Standard response envelopes

**Success:**

```json
{ "success": true, "data": {}, "message": "Operation successful" }
```

**Error:**

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

**Paginated list:**

```json
{ "items": [], "page": 1, "pageSize": 12, "total": 42, "totalPages": 4 }
```

---

## Testing

| Command                                | Coverage area              | Notes                                                                                                                                                 |
| -------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @aip/api test`          | Backend unit + integration | Matching algorithm (deterministic), auth flows, job CRUD, application lifecycle, RBAC. Set`TEST_MONGO_URI` to run integration tests against a real DB |
| `pnpm --filter @aip/web test`          | Frontend unit              | Vitest + React Testing Library — Button, Modal, Pagination, form components                                                                           |
| `pnpm test`                            | All workspaces             | Runs both above                                                                                                                                       |
| `pnpm test:e2e`                        | End-to-end                 | Playwright — requires`pnpm dev` and `pnpm seed` running first                                                                                         |
| `pnpm --filter @aip/api test:coverage` | Backend coverage report    | Output in`apps/api/coverage/`                                                                                                                         |
| `pnpm --filter @aip/web test:coverage` | Frontend coverage report   | Output in`apps/web/coverage/`                                                                                                                         |

See [`docs/testing.md`](./docs/testing.md) for test architecture and how to write new tests.

---

## Production Build

```bash
pnpm build                       # packages first, then apps
pnpm start:api                   # serves compiled apps/api/dist/server.js
pnpm --filter @aip/web preview   # serves built apps/web/dist/
```

**Deployment targets:**

| Layer                       | Recommended hosts                                              |
| --------------------------- | -------------------------------------------------------------- |
| Frontend (`apps/web/dist/`) | Vercel, Netlify, Cloudflare Pages                              |
| Backend (`apps/api/`)       | Render, Railway, Fly.io, any VPS with Node 20                  |
| Database                    | MongoDB Atlas M0 free for dev, M10+ for production             |
| File storage                | Cloudinary free tier for dev, paid plan for production traffic |

In production, set `NODE_ENV=production`, `COOKIE_SECURE=true`, and `COOKIE_DOMAIN` to your actual domain. All `VITE_*` vars must be set at build time in your CI environment.

---

## Troubleshooting

### Installation

| Symptom                                                | Platform | Fix                                                                                                                                                                              |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm: command not found`                              | Both     | `npm install -g pnpm@9` — reopen terminal after install                                                                                                                          |
| `corepack: command not found`                          | Both     | Corepack ships with Node ≥16.9 but some Homebrew builds omit it — use`npm install -g pnpm@9` directly                                                                            |
| `pnpm install` runs for 3+ minutes                     | Both     | Normal on first install (~748 packages). Subsequent runs hit the pnpm content-addressed cache and finish in seconds                                                              |
| `cannot be loaded because running scripts is disabled` | Windows  | Use`powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` — no permanent system policy change needed                                                                       |
| Zip extraction fails with a path-too-long error        | Windows  | Enable long paths: PowerShell as admin:`New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1 -PropertyType DWORD -Force` |

### Backend startup

| Symptom                                     | Platform | Fix                                                                                                                                                        |
| ------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Error: listen EADDRINUSE :::4000`          | Both     | Kill the old process. macOS:`lsof -iTCP:4000 -sTCP:LISTEN -P` then `kill -9 <pid>`. Windows: `netstat -ano \| findstr :4000` then `taskkill /F /PID <pid>` |
| Backend hangs at "Connecting to MongoDB..." | Both     | Verify`MONGODB_URI` in `.env`. Whitelist your IP in Atlas → Network Access. For a rotating IP use `0.0.0.0/0` (development only)                           |
| `Missing required env var: MONGODB_URI`     | Both     | Run`node scripts/check-env.mjs` to see all missing vars. Confirm `.env` exists at repo root                                                                |
| Backend crashes with missing JWT secret     | Both     | Run`node scripts/gen-secrets.mjs`, paste both outputs into `.env` as `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (≥32 chars each)                         |
| Env not loaded — "Cannot find MONGODB_URI"  | macOS    | `dotenv` resolves from `process.cwd()`. Run: `ln -sf ../../.env apps/api/.env && ln -sf ../../.env apps/web/.env`                                          |

### Frontend

| Symptom                                                              | Platform | Fix                                                                                                                                                                                                                |
| -------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Access to XMLHttpRequest blocked by CORS policy` in browser console | Both     | Verify`FRONTEND_URL=http://localhost:5173` (not `127.0.0.1`) in backend `.env` and `VITE_API_URL=http://localhost:4000/api/v1` in frontend env. Restart both servers after editing                                 |
| Login succeeds but subsequent API calls return 401                   | Both     | Cookies are not being attached. Ensure both servers use`http://` not `https://`. Hard-reload: Cmd+Shift+R (macOS) or Ctrl+F5 (Windows)                                                                             |
| Vite HMR stops updating the page                                     | Both     | Restart:`pnpm --filter @aip/web dev`                                                                                                                                                                               |
| Infinite spinner after login                                         | Both     | Auth hydration issue —`useHydrateAuth` calls `/auth/me` on mount; `isBooting` should flip to `false` after the request settles. Clear browser cookies and retry. Check `apps/web/src/store/auth.ts` if it persists |

### Resume upload

| Symptom                                    | Platform | Fix                                                                                                                                                                                                                           |
| ------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Internal server error" toast on upload    | Both     | Check backend logs. If you see a Cloudinary error mentioning`actions=[create]`, your API key lacks upload permissions. Either generate a full-access key in Cloudinary Console or set `RESUME_STORAGE=DATABASE` (the default) |
| "Resume file is required" validation error | Both     | The Axios instance must not set a global`Content-Type: application/json` header on multipart requests — the browser needs to auto-set the `multipart/form-data` boundary. Hard-reload to clear any stale interceptors         |

### AI Assessment

| Symptom                                   | Platform | Fix                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `500` — model not found on generate       | Both     | `gemini-1.5-flash` was deprecated by Google in 2025. Set `GEMINI_MODEL=gemini-2.5-flash` in `.env` and restart the API. The API also prints a `[env] GEMINI_MODEL=… has been retired` warning at startup whenever a key is configured alongside a retired model id, so check the first few lines of the backend log |
| "AI service returned invalid response"    | Both     | Gemini occasionally wraps JSON in markdown fences. The`extractJson()` helper strips them automatically — if this error persists, check the raw Gemini response in backend logs and retry. Usually self-resolving                                                                                                    |
| `429 Too Many Requests` on generate       | Both     | Rate limit of 5 generations per hour per IP is enforced for cost control. Wait an hour. For local dev you can raise`RATE_LIMIT_MAX_REQUESTS` in `.env` temporarily                                                                                                                                                  |
| Assessment score not showing on dashboard | Both     | The summary endpoint returns`latestScore` only for `EVALUATED` assessments. If the student submitted but evaluation failed (Gemini timeout), the status stays `SUBMITTED` — re-submit or generate a new assessment                                                                                                  |

### PDF certificates and documents

| Symptom                                                  | Platform | Fix                                                                                                                                                               |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF certificate download returns 503                     | Both     | `pdfkit` is declared in `apps/api/package.json` but may not be installed if `pnpm install` was skipped. Run `pnpm install` from the repo root and restart the API |
| "Cannot download certificate — no interim reports" error | Both     | At least one interim report must be submitted (and not rejected) for a`SELECTED` application before the certificate endpoint will stream a PDF                    |

### Webhooks

| Symptom                                      | Platform | Fix                                                                                                                                                                                          |
| -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LMS or ERP webhook returns`401 Unauthorized` | Both     | HMAC signature mismatch. Verify that`WEBHOOK_LMS_SECRET` or `WEBHOOK_ERP_SECRET` in `.env` matches the shared secret configured on the sender's side. Restart the API after changing secrets |
| LMS or ERP webhook returns`503`              | Both     | The feature is disabled when the matching secret env var is absent. Set`WEBHOOK_LMS_SECRET` (for LMS) or `WEBHOOK_ERP_SECRET` (for ERP) in `.env` and restart the API                        |

### Institution dashboard

| Symptom                                                                   | Platform | Fix                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Institution dashboard shows zero students or faculty                      | Both     | The institution user must be linked to a verified institution. After login, confirm the user's profile contains a valid institution ObjectId. If the account was just created, wait for an admin to verify the institution record. |
| Institution user cannot see documents from another institution's students | Both     | Intentional — document verification is scoped to the institution's own students and faculty. Only ADMIN users can verify documents cross-institution                                                                               |

### Role restrictions

| Symptom                                             | Platform | Fix                                                                                                                                                                                                         |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Faculty receives 403 when applying to a Job posting | Both     | Intentional — faculty can only apply to opportunities with`opportunityType` in FACULTY_INTERNSHIP, FDP, CONSULTANCY, COLLABORATIVE_RESEARCH. Regular JOB and INTERNSHIP postings are restricted to students |
| INSTITUTION user cannot self-register               | Both     | Intentional — institution accounts are created by an admin who creates the institution record, verifies it, then sends an invite. There is no self-registration path for the INSTITUTION role               |

### Windows-specific

| Symptom                                               | Fix                                                                                                                          |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `warning: LF will be replaced by CRLF` during install | Harmless. Optionally:`git config --global core.autocrlf true`                                                                |
| `winget` not found                                    | Update Windows or install from the Microsoft Store. Alternative: download Node from[nodejs.org](https://nodejs.org) directly |

### macOS-specific

| Symptom                                                  | Fix                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `which node` or `which pnpm` points to the wrong version | Ensure your shell PATH prioritizes Homebrew or nvm: add`eval "$(brew shellenv)"` or the nvm init snippet to `~/.zshrc`, then `source ~/.zshrc` |
| `sed: illegal option -- i` inside scripts                | macOS`sed` requires `-i ''`. Not relevant unless you are modifying the setup scripts themselves                                                |

---

## Getting Started — Accounts

The seed script (`pnpm seed`) creates only reference data (the skill catalogue). There are no pre-seeded demo accounts.

**First-time setup:**

1. Run `pnpm seed` to populate the skill catalogue.
2. Start both servers with `pnpm dev`.
3. Open the registration page at `/register` and create your first account.

**Role-specific onboarding:**

| Role        | How to create an account                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Student     | Self-register at `/register`. Select your institution from the verified list.                             |
| Company     | Self-register at `/register`.                                                                             |
| Faculty     | Self-register at `/register`. Select your institution from the verified list.                             |
| Institution | An admin creates and verifies the institution record first, then provisions the INSTITUTION-role account. |
| Admin       | Create via a direct DB script or promote an existing user's role from a superuser session.                |

> No demo credentials are provided. No demo institutions are pre-loaded. All accounts and institutions must be created through the real registration and admin flows.

---

## Repo Scripts

| Script            | Command                                                      | What it does                                                                                                                                        |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup.sh`        | `bash scripts/setup.sh`                                      | macOS/Linux bootstrap: verifies Node 20+, installs pnpm@9, runs`pnpm install`, copies `.env.example` to `.env`, and calls `gen-secrets`             |
| `setup.ps1`       | `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` | Windows equivalent of`setup.sh`                                                                                                                     |
| `gen-secrets.mjs` | `node scripts/gen-secrets.mjs`                               | Prints two independent 96-char hex strings — paste them as`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in `.env`                                    |
| `check-env.mjs`   | `node scripts/check-env.mjs`                                 | Reads`.env`, verifies all required variables are present and that JWT secrets meet the 32-char minimum. Exits non-zero on failure so it can gate CI |

---

## Related Docs

Deep-dive documentation lives in [`docs/`](./docs/):

| File                                                                   | Contents                                                                                        |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [`docs/architecture.md`](./docs/architecture.md)                       | Full backend and frontend architecture, middleware stack, module patterns, and design decisions |
| [`docs/api.md`](./docs/api.md)                                         | Detailed request/response schemas for every endpoint                                            |
| [`docs/data-model.md`](./docs/data-model.md)                           | Extended ER diagram, index strategy, and data evolution notes                                   |
| [`docs/frontend.md`](./docs/frontend.md)                               | Component structure, routing, state management, and TanStack Query patterns                     |
| [`docs/matching.md`](./docs/matching.md)                               | Skill-matching algorithm: scoring formula, gap analysis, and edge cases                         |
| [`docs/testing.md`](./docs/testing.md)                                 | Test architecture, how to write new tests, and CI configuration                                 |
| [`docs/ai.md`](./docs/ai.md)                                           | Gemini integration details, exact prompt templates, error handling, and cost controls           |
| [`docs/CHANGING_AI_MODEL.md`](./docs/CHANGING_AI_MODEL.md)             | How to switch Gemini models via env only — no code changes required                             |
| [`docs/GETTING_STARTED_WINDOWS.md`](./docs/GETTING_STARTED_WINDOWS.md) | Step-by-step Windows onboarding with Atlas, Cloudinary, and Gemini setup walkthroughs           |
| [`docs/GETTING_STARTED_MAC.md`](./docs/GETTING_STARTED_MAC.md)         | Step-by-step macOS onboarding                                                                   |

---

## Contributing

**Branch naming:** `feat/short-description`, `fix/short-description`, `chore/short-description`, `docs/short-description`

**Commits:** Conventional commit style is preferred (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) but not enforced by CI hooks.

**PR checklist before opening:**

- `pnpm typecheck` — all workspaces must pass with zero errors
- `pnpm test` — all unit and integration tests must pass
- `pnpm lint` — zero ESLint warnings (the `--max-warnings 0` flag is enforced)

**Code style:**

- No `any` — use explicit types or `unknown`
- ESM only — no `require()` or `module.exports`
- Comments only for non-obvious constraints, subtle invariants, or third-party workarounds — not for explaining what the code does
- No multi-line docstrings or block comment headers

---

## License

MIT — see [LICENSE](./LICENSE).
