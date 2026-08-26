# API Reference

Base URL: `/api/v1`

All responses conform to the envelope described in [architecture.md](./architecture.md#response-envelope).

**Common error codes** used throughout:

| Code | HTTP |
|------|------|
| `UNAUTHORIZED` | 401 |
| `TOKEN_EXPIRED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `VALIDATION_ERROR` | 422 |
| `INTERNAL_ERROR` | 500 |
| `SERVICE_UNAVAILABLE` | 503 |

---

## Health

### GET /api/v1/health

**Auth**: none

**Response** (200):

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "ts": "2025-08-23T10:00:00.000Z",
    "uptime": 3721.4
  }
}
```

---

## Auth

### POST /api/v1/auth/register

**Auth**: none (rate-limited by `authLimiter`)

**Body**:

```json
{
  "email": "string",
  "password": "string",
  "role": "STUDENT | COMPANY"
}
```

**Response** (201):

```json
{
  "success": true,
  "data": { "user": { "id": "string", "email": "string", "role": "STUDENT", "isActive": true } },
  "message": "Registered successfully"
}
```

Sets `aip_at` and `aip_rt` cookies.

**Errors**: 409 `CONFLICT` (email already registered), 422 `VALIDATION_ERROR`

---

### POST /api/v1/auth/login

**Auth**: none (rate-limited by `authLimiter`)

**Body**:

```json
{
  "email": "string",
  "password": "string"
}
```

**Response** (200):

```json
{
  "success": true,
  "data": { "user": { "id": "string", "email": "string", "role": "STUDENT", "isActive": true } },
  "message": "Logged in"
}
```

Sets `aip_at` and `aip_rt` cookies.

**Errors**: 401 `INVALID_CREDENTIALS`

---

### POST /api/v1/auth/logout

**Auth**: none (clears cookies regardless)

**Body**: none

**Response** (200):

```json
{ "success": true, "data": null, "message": "Logged out" }
```

Clears `aip_at` and `aip_rt` cookies.

---

### POST /api/v1/auth/refresh

**Auth**: reads `aip_rt` cookie (no `requireAuth` middleware)

**Body**: none

**Response** (200):

```json
{
  "success": true,
  "data": { "user": { "id": "string", "email": "string", "role": "STUDENT" } }
}
```

Rotates both `aip_at` and `aip_rt` cookies.

**Errors**: 401 `UNAUTHORIZED` (invalid or expired refresh token)

---

### GET /api/v1/auth/me

**Auth**: `requireAuth` (any role)

**Response** (200):

```json
{
  "success": true,
  "data": { "user": { "id": "string", "email": "string", "role": "COMPANY", "isActive": true, "lastLoginAt": "string" } }
}
```

**Errors**: 401 `UNAUTHORIZED`

---

## Students

### GET /api/v1/students/me

**Auth**: `STUDENT`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "string",
      "user": "string",
      "fullName": "string",
      "phone": "string",
      "college": "string",
      "degree": "string",
      "branch": "string",
      "semester": 6,
      "graduationYear": 2026,
      "cgpa": 8.5,
      "bio": "string",
      "projects": [],
      "certifications": [],
      "experience": [],
      "achievements": [],
      "preferredRoles": [],
      "preferredLocations": []
    }
  }
}
```

**Errors**: 401, 403, 404 `NOT_FOUND`

---

### PUT /api/v1/students/me

**Auth**: `STUDENT`

**Body**:

```json
{
  "fullName": "string",
  "phone": "string",
  "dob": "ISO date string",
  "gender": "MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY",
  "city": "string",
  "state": "string",
  "address": "string",
  "college": "string",
  "university": "string",
  "degree": "string",
  "branch": "string",
  "semester": "number (1–12)",
  "graduationYear": "number",
  "cgpa": "number (0–10)",
  "bio": "string",
  "projects": "array",
  "certifications": "array",
  "experience": "array",
  "achievements": "array",
  "preferredRoles": "string[]",
  "preferredLocations": "string[]"
}
```

All fields optional (partial update).

**Response** (200):

```json
{ "success": true, "data": { "profile": { "...updated fields" } }, "message": "Profile updated" }
```

**Errors**: 401, 403, 422 `VALIDATION_ERROR`

---

### GET /api/v1/students/me/summary

**Auth**: `STUDENT`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "applicationCount": 5,
    "interviewCount": 2,
    "savedCount": 8,
    "skillCount": 12,
    "recentApplications": []
  }
}
```

**Errors**: 401, 403

---

### GET /api/v1/students/

**Auth**: `ADMIN`

**Query**:

```
page?:     number
pageSize?: number
```

**Response** (200): `Paginated<StudentProfile>`

**Errors**: 401, 403

---

### GET /api/v1/students/:id

**Auth**: `ADMIN | COMPANY`

**Params**: `id` — MongoDB ObjectId

**Response** (200):

```json
{ "success": true, "data": { "profile": { "...StudentProfile fields" } } }
```

**Errors**: 401, 403, 404 `NOT_FOUND`, 422 `VALIDATION_ERROR` (invalid ObjectId)

---

## Companies

### GET /api/v1/companies/me

**Auth**: `COMPANY`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "string",
      "user": "string",
      "companyName": "string",
      "description": "string",
      "industry": "string",
      "website": "string",
      "location": "string",
      "companySize": "string",
      "foundedYear": 2010,
      "logoUrl": "string",
      "verifiedAt": "string | null"
    }
  }
}
```

**Errors**: 401, 403

---

### PUT /api/v1/companies/me

**Auth**: `COMPANY`

**Body**:

```json
{
  "companyName": "string",
  "description": "string",
  "industry": "string",
  "website": "string",
  "phone": "string",
  "location": "string",
  "companySize": "string",
  "foundedYear": "number"
}
```

All fields optional.

**Response** (200):

```json
{ "success": true, "data": { "profile": { "...updated fields" } }, "message": "Profile updated" }
```

**Errors**: 401, 403, 422

---

### POST /api/v1/companies/me/logo

**Auth**: `COMPANY`

**Body**: `multipart/form-data`, field name `file`

Accepted MIME types: `image/png`, `image/jpeg`, `image/webp`, `image/gif`. Max size: 2 MB.

**Response** (200):

```json
{ "success": true, "data": { "logoUrl": "https://res.cloudinary.com/..." }, "message": "Logo uploaded" }
```

**Errors**: 401, 403, 422 (invalid file type or size)

---

### GET /api/v1/companies/

**Auth**: `ADMIN`

**Query**: `page?`, `pageSize?`

**Response** (200): `Paginated<CompanyProfile>`

**Errors**: 401, 403

---

### GET /api/v1/companies/:id

**Auth**: none (public)

**Params**: `id` — MongoDB ObjectId

**Response** (200):

```json
{ "success": true, "data": { "profile": { "...CompanyProfile fields" } } }
```

**Errors**: 404 `NOT_FOUND`, 422

---

## Skills Catalog

### GET /api/v1/skills/

**Auth**: none

**Query**: `page?`, `pageSize?`, `category?` (SKILL_CATEGORIES enum), `q?` (text search)

**Response** (200): `Paginated<Skill>`

---

### POST /api/v1/skills/

**Auth**: `ADMIN`

**Body**:

```json
{
  "name": "string",
  "category": "PROGRAMMING | FRONTEND | BACKEND | DATABASE | CLOUD | DEVOPS | DATA_SCIENCE | AI_ML | MOBILE | CYBERSECURITY | SOFT_SKILLS | OTHER",
  "description": "string (optional)"
}
```

**Response** (201):

```json
{ "success": true, "data": { "skill": { "id": "string", "name": "string", "category": "string" } }, "message": "Skill created" }
```

**Errors**: 401, 403, 409 `CONFLICT` (name already exists), 422

---

### PATCH /api/v1/skills/:id

**Auth**: `ADMIN`

**Params**: `id`

**Body**:

```json
{
  "name": "string (optional)",
  "category": "string (optional)",
  "description": "string (optional)",
  "status": "ACTIVE | ARCHIVED (optional)"
}
```

**Response** (200):

```json
{ "success": true, "data": { "skill": { "...updated" } } }
```

**Errors**: 401, 403, 404, 422

---

### DELETE /api/v1/skills/:id

**Auth**: `ADMIN`

**Params**: `id`

**Response** (200):

```json
{ "success": true, "data": null, "message": "Skill deleted" }
```

**Errors**: 401, 403, 404, 422

---

### GET /api/v1/skills/me/student-skills

**Auth**: `STUDENT`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "skills": [
      { "id": "string", "skill": { "id": "string", "name": "react", "category": "FRONTEND" }, "proficiency": "ADVANCED", "yearsExperience": 2 }
    ]
  }
}
```

**Errors**: 401, 403

---

### POST /api/v1/skills/me/student-skills

**Auth**: `STUDENT`

**Body**:

```json
{
  "skillId": "string (ObjectId)",
  "proficiency": "BEGINNER | INTERMEDIATE | ADVANCED | EXPERT",
  "yearsExperience": "number (optional, 0–50)",
  "evidenceUrl": "string (optional)"
}
```

**Response** (201):

```json
{ "success": true, "data": { "studentSkill": { "...fields" } }, "message": "Skill added" }
```

**Errors**: 401, 403, 409 `CONFLICT` (skill already added), 422

---

### PATCH /api/v1/skills/me/student-skills/:id

**Auth**: `STUDENT`

**Params**: `id` — StudentSkill document ID

**Body**:

```json
{
  "proficiency": "string (optional)",
  "yearsExperience": "number (optional)",
  "evidenceUrl": "string (optional)"
}
```

**Response** (200):

```json
{ "success": true, "data": { "studentSkill": { "...updated" } } }
```

**Errors**: 401, 403, 404, 422

---

### DELETE /api/v1/skills/me/student-skills/:id

**Auth**: `STUDENT`

**Params**: `id`

**Response** (200):

```json
{ "success": true, "data": null, "message": "Skill removed" }
```

**Errors**: 401, 403, 404, 422

---

### GET /api/v1/skills/students/:studentId/skills

**Auth**: `ADMIN | COMPANY`

**Params**: `studentId` — StudentProfile ObjectId

**Response** (200):

```json
{
  "success": true,
  "data": {
    "skills": [ { "...StudentSkill with populated Skill" } ]
  }
}
```

**Errors**: 401, 403, 404, 422

---

## Jobs

### GET /api/v1/jobs/

**Auth**: none

**Query**:

```
page?:         number
pageSize?:     number
q?:            string  (text search on title, description, location)
workMode?:     REMOTE | HYBRID | ONSITE
employmentType?: FULL_TIME | PART_TIME | CONTRACT
status?:       PUBLISHED (default for public; ADMIN can query others)
```

**Response** (200): `Paginated<Job>`

---

### GET /api/v1/jobs/me/managed

**Auth**: `COMPANY`

**Query**: `page?`, `pageSize?`, `status?`

**Response** (200): `Paginated<Job>` (only jobs posted by the calling company)

**Errors**: 401, 403

---

### GET /api/v1/jobs/:id

**Auth**: none

**Params**: `id`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "string",
      "company": { "...CompanyProfile" },
      "title": "string",
      "description": "string",
      "location": "string",
      "workMode": "REMOTE",
      "employmentType": "FULL_TIME",
      "salary": { "min": 600000, "max": 1200000, "currency": "INR" },
      "requiredSkills": [],
      "preferredSkills": [],
      "applicationDeadline": "string",
      "openings": 3,
      "status": "PUBLISHED"
    }
  }
}
```

**Errors**: 404, 422

---

### POST /api/v1/jobs/

**Auth**: `COMPANY`

**Body**:

```json
{
  "title": "string (3–200 chars)",
  "description": "string (20–10000 chars)",
  "location": "string",
  "workMode": "REMOTE | HYBRID | ONSITE",
  "employmentType": "FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP",
  "salary": { "min": "number", "max": "number", "currency": "string (optional, default INR)" },
  "experienceMin": "number (optional)",
  "experienceMax": "number (optional)",
  "minCgpa": "number (optional, 0–10)",
  "eligibleBranches": "string[] (optional)",
  "eligibleGradYears": "number[] (optional)",
  "requiredSkills": "ObjectId[] (optional)",
  "preferredSkills": "ObjectId[] (optional)",
  "applicationDeadline": "ISO date string (optional)",
  "openings": "number (optional, default 1)"
}
```

New jobs are created with `status: 'DRAFT'`. Publish by calling PUT with `status: 'PUBLISHED'`.

**Response** (201):

```json
{ "success": true, "data": { "job": { "...Job fields" } }, "message": "Job created" }
```

**Errors**: 401, 403, 422

---

### PUT /api/v1/jobs/:id

**Auth**: `COMPANY` (must own the job)

**Params**: `id`

**Body**: same fields as POST; all optional

**Response** (200):

```json
{ "success": true, "data": { "job": { "...updated" } }, "message": "Job updated" }
```

**Errors**: 401, 403, 404, 422

---

### PATCH /api/v1/jobs/:id/close

**Auth**: `COMPANY` (must own the job)

**Params**: `id`

**Body**: none

**Response** (200):

```json
{ "success": true, "data": { "job": { "status": "CLOSED" } }, "message": "Job closed" }
```

**Errors**: 401, 403, 404, 422

---

### DELETE /api/v1/jobs/:id

**Auth**: `ADMIN`

**Params**: `id`

**Response** (200):

```json
{ "success": true, "data": null, "message": "Job deleted" }
```

**Errors**: 401, 403, 404, 422

---

## Internships

Internships mirror the jobs module. Key differences: `durationMonths` and `stipend` replace `employmentType` and `salary`.

### GET /api/v1/internships/

**Auth**: none

**Query**: `page?`, `pageSize?`, `q?`, `workMode?`, `status?`

**Response** (200): `Paginated<Internship>`

---

### GET /api/v1/internships/me/managed

**Auth**: `COMPANY`

**Response** (200): `Paginated<Internship>` (company's own listings)

---

### GET /api/v1/internships/:id

**Auth**: none

**Response** (200):

```json
{
  "success": true,
  "data": {
    "internship": {
      "id": "string",
      "company": { "...CompanyProfile" },
      "title": "string",
      "durationMonths": 6,
      "stipend": 15000,
      "currency": "INR",
      "workMode": "HYBRID",
      "requiredSkills": [],
      "status": "PUBLISHED"
    }
  }
}
```

**Errors**: 404, 422

---

### POST /api/v1/internships/

**Auth**: `COMPANY`

**Body**:

```json
{
  "title": "string",
  "description": "string",
  "location": "string",
  "workMode": "REMOTE | HYBRID | ONSITE",
  "durationMonths": "number (1–24)",
  "stipend": "number (optional)",
  "currency": "string (optional, default INR)",
  "minCgpa": "number (optional)",
  "eligibleBranches": "string[] (optional)",
  "eligibleGradYears": "number[] (optional)",
  "requiredSkills": "ObjectId[] (optional)",
  "preferredSkills": "ObjectId[] (optional)",
  "applicationDeadline": "ISO date string (optional)",
  "openings": "number (optional)"
}
```

**Response** (201): `{ "success": true, "data": { "internship": {...} } }`

---

### PUT /api/v1/internships/:id

**Auth**: `COMPANY`

**Response** (200): updated internship

---

### PATCH /api/v1/internships/:id/close

**Auth**: `COMPANY`

**Response** (200): `{ "status": "CLOSED" }`

---

### DELETE /api/v1/internships/:id

**Auth**: `ADMIN`

**Response** (200): `{ "success": true, "data": null }`

---

## Applications

### POST /api/v1/applications/

**Auth**: `STUDENT`

**Body**:

```json
{
  "opportunityType": "JOB | INTERNSHIP",
  "opportunityId": "ObjectId",
  "resumeId": "ObjectId (optional)",
  "coverLetter": "string (optional, max 5000 chars)"
}
```

Match score is computed at submission time by `computeMatch()` and stored on the document.

**Response** (201):

```json
{
  "success": true,
  "data": {
    "application": {
      "id": "string",
      "status": "APPLIED",
      "matchScore": 64,
      "opportunityType": "JOB",
      "opportunity": "ObjectId"
    }
  },
  "message": "Application submitted"
}
```

**Errors**: 401, 403, 409 `CONFLICT` (already applied), 422

---

### GET /api/v1/applications/

**Auth**: any authenticated user

Behaviour differs by role:

- `STUDENT` — returns own applications
- `COMPANY` — returns applications for the company's listings
- `ADMIN` — returns all applications

**Query**: `page?`, `pageSize?`, `status?`, `opportunityType?`

**Response** (200): `Paginated<Application>`

---

### GET /api/v1/applications/me/count-by-status

**Auth**: `STUDENT`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "counts": {
      "APPLIED": 3,
      "UNDER_REVIEW": 1,
      "SHORTLISTED": 1,
      "INTERVIEW_SCHEDULED": 0,
      "SELECTED": 0,
      "REJECTED": 0,
      "WITHDRAWN": 0
    }
  }
}
```

---

### GET /api/v1/applications/:id

**Auth**: any authenticated user (access scoped by role in service layer)

**Params**: `id`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "application": {
      "id": "string",
      "student": { "...StudentProfile" },
      "opportunityType": "JOB",
      "opportunity": { "...Job or Internship" },
      "status": "SHORTLISTED",
      "matchScore": 64,
      "coverLetter": "string",
      "timeline": [ { "status": "APPLIED", "at": "string" } ]
    }
  }
}
```

---

### PATCH /api/v1/applications/:id/status

**Auth**: `COMPANY | ADMIN`

**Params**: `id`

**Body**:

```json
{
  "status": "UNDER_REVIEW | SHORTLISTED | INTERVIEW_SCHEDULED | SELECTED | REJECTED",
  "note": "string (optional)"
}
```

Status change is appended to the `timeline` array.

**Response** (200):

```json
{ "success": true, "data": { "application": { "status": "SHORTLISTED", "timeline": [] } }, "message": "Status updated" }
```

**Errors**: 401, 403, 404, 422

---

## Interviews

### POST /api/v1/interviews/

**Auth**: `COMPANY | ADMIN`

**Body**:

```json
{
  "applicationId": "ObjectId",
  "mode": "ONLINE | ONSITE | PHONE",
  "scheduledAt": "ISO datetime string",
  "durationMinutes": "number (15–480, default 60)",
  "meetingLink": "string (optional)",
  "location": "string (optional)",
  "interviewer": "string (optional)",
  "notes": "string (optional)"
}
```

**Response** (201):

```json
{ "success": true, "data": { "interview": { "...Interview fields" } }, "message": "Interview scheduled" }
```

**Errors**: 401, 403, 404, 422

---

### GET /api/v1/interviews/

**Auth**: any authenticated user

Scoped by role:

- `STUDENT` — interviews linked to the student's applications
- `COMPANY` — interviews for the company's listings
- `ADMIN` — all interviews

**Response** (200): `Paginated<Interview>`

---

### GET /api/v1/interviews/:id

**Auth**: any authenticated user

**Response** (200): `{ "success": true, "data": { "interview": { "...populated" } } }`

---

### PATCH /api/v1/interviews/:id

**Auth**: `COMPANY | ADMIN`

**Body**:

```json
{
  "mode": "string (optional)",
  "scheduledAt": "string (optional)",
  "durationMinutes": "number (optional)",
  "meetingLink": "string (optional)",
  "location": "string (optional)",
  "interviewer": "string (optional)",
  "notes": "string (optional)",
  "feedback": "string (optional)",
  "status": "SCHEDULED | COMPLETED | CANCELLED | RESCHEDULED (optional)"
}
```

**Response** (200): `{ "success": true, "data": { "interview": { "...updated" } } }`

---

### DELETE /api/v1/interviews/:id

**Auth**: `ADMIN`

**Response** (200): `{ "success": true, "data": null }`

---

## Recommendations

All recommendation endpoints require `STUDENT` auth.

### GET /api/v1/recommendations/jobs

Returns published jobs sorted by descending match score for the calling student.

**Query**: `page?`, `pageSize?`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "items": [
      { "job": { "...Job" }, "matchResult": { "score": 80, "level": "GOOD_MATCH", "...MatchResult" } }
    ],
    "page": 1,
    "pageSize": 12,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### GET /api/v1/recommendations/internships

Same as jobs endpoint but for internships.

**Response** (200): paginated list of `{ internship, matchResult }`

---

### GET /api/v1/recommendations/trainings

Returns active training programs that cover skills the student is missing.

**Response** (200): `Paginated<TrainingProgram>`

---

### GET /api/v1/recommendations/skills-gap

Returns skills the student is missing across all published jobs/internships they have applied to or matched against.

**Response** (200):

```json
{
  "success": true,
  "data": {
    "missingSkills": [
      { "skill": { "id": "string", "name": "aws", "category": "CLOUD" }, "frequency": 7 }
    ]
  }
}
```

---

## Notifications

All endpoints require authentication (any role). Notifications are scoped to the calling user automatically.

### GET /api/v1/notifications/

**Query**: `page?`, `pageSize?`

**Response** (200): `Paginated<Notification>`

---

### GET /api/v1/notifications/unread-count

**Response** (200):

```json
{ "success": true, "data": { "count": 4 } }
```

---

### PATCH /api/v1/notifications/read-all

**Response** (200):

```json
{ "success": true, "data": null, "message": "All notifications marked read" }
```

---

### PATCH /api/v1/notifications/:id/read

**Params**: `id`

**Response** (200):

```json
{ "success": true, "data": { "notification": { "readAt": "ISO datetime" } } }
```

**Errors**: 404

---

## Training Programs

### GET /api/v1/training/

**Auth**: none

**Query**: `page?`, `pageSize?`, `status?`

**Response** (200): `Paginated<TrainingProgram>`

---

### GET /api/v1/training/recommended/me

**Auth**: `STUDENT`

Returns active training programs that cover the student's missing skills.

**Response** (200): `Paginated<TrainingProgram>`

---

### GET /api/v1/training/:id

**Auth**: none

**Response** (200):

```json
{
  "success": true,
  "data": {
    "training": {
      "id": "string",
      "title": "string",
      "description": "string",
      "provider": "string",
      "skills": [],
      "durationWeeks": 8,
      "startDate": "string",
      "registrationDeadline": "string",
      "registrationUrl": "string",
      "status": "ACTIVE"
    }
  }
}
```

---

### POST /api/v1/training/

**Auth**: `ADMIN`

**Body**:

```json
{
  "title": "string (3–200 chars)",
  "description": "string (20–10000 chars)",
  "provider": "string",
  "skills": "ObjectId[] (optional)",
  "durationWeeks": "number (1–104)",
  "startDate": "ISO date (optional)",
  "endDate": "ISO date (optional)",
  "registrationDeadline": "ISO date (optional)",
  "registrationUrl": "string (required)"
}
```

**Response** (201): `{ "success": true, "data": { "training": {...} } }`

---

### PATCH /api/v1/training/:id

**Auth**: `ADMIN`

**Body**: same fields as POST; all optional. Also accepts `"status": "ACTIVE | ARCHIVED"`.

**Response** (200): updated training program

---

### DELETE /api/v1/training/:id

**Auth**: `ADMIN`

**Response** (200): `{ "success": true, "data": null }`

---

## Saved Opportunities

All endpoints require `STUDENT` auth.

### GET /api/v1/saved-opportunities/

**Response** (200):

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "string", "opportunityType": "JOB", "opportunity": { "...populated Job or Internship" } }
    ]
  }
}
```

---

### POST /api/v1/saved-opportunities/

**Body**:

```json
{
  "opportunityType": "JOB | INTERNSHIP",
  "opportunityId": "ObjectId"
}
```

**Response** (201): `{ "success": true, "data": { "saved": {...} }, "message": "Saved" }`

**Errors**: 409 `CONFLICT` (already saved)

---

### DELETE /api/v1/saved-opportunities/by-opportunity

**Body**:

```json
{
  "opportunityType": "JOB | INTERNSHIP",
  "opportunityId": "ObjectId"
}
```

Removes a saved entry by opportunity reference rather than by the SavedOpportunity document ID.

**Response** (200): `{ "success": true, "data": null }`

---

### DELETE /api/v1/saved-opportunities/:id

**Params**: `id` — SavedOpportunity document ID

**Response** (200): `{ "success": true, "data": null }`

---

## Resumes

All endpoints require `STUDENT` auth.

### POST /api/v1/resumes/me

**Body**: `multipart/form-data`, field name `file`

Accepted MIME types: PDF, DOC, DOCX. Max size: 5 MB.

The file is uploaded to Cloudinary and a new Resume document is created. `version` auto-increments based on the student's previous uploads.

**Response** (201):

```json
{
  "success": true,
  "data": {
    "resume": {
      "id": "string",
      "url": "https://res.cloudinary.com/...",
      "mimeType": "application/pdf",
      "sizeBytes": 204800,
      "version": 2
    }
  },
  "message": "Resume uploaded"
}
```

---

### GET /api/v1/resumes/me

Returns the student's most recent resume.

**Response** (200): `{ "success": true, "data": { "resume": { "...Resume fields" } } }`

**Errors**: 404 (no resume uploaded yet)

---

### GET /api/v1/resumes/me/history

Returns all of the student's resume versions in reverse chronological order.

**Response** (200): `{ "success": true, "data": { "resumes": [] } }`

---

### DELETE /api/v1/resumes/:id

**Params**: `id`

Deletes the Resume document and removes the file from Cloudinary.

**Response** (200): `{ "success": true, "data": null, "message": "Resume deleted" }`

**Errors**: 404

---

## AI

See [ai.md](./ai.md) for full prompt and security details.

### POST /api/v1/ai/resume-analyze

**Auth**: `STUDENT`

**Body**:

```json
{
  "text": "string (optional)",
  "url":  "string (optional)"
}
```

At least one of `text` or `url` is required.

**Response** (200):

```json
{ "success": true, "data": { "extractedSkills": ["TypeScript", "React"] } }
```

**Errors**: 422, 503 `SERVICE_UNAVAILABLE`

---

### POST /api/v1/ai/job-match

**Auth**: `STUDENT`

**Body**:

```json
{
  "opportunityType": "JOB | INTERNSHIP",
  "opportunityId": "ObjectId"
}
```

**Response** (200):

```json
{
  "success": true,
  "data": {
    "score": 64,
    "level": "GOOD_MATCH",
    "matchedSkills": [],
    "missingSkills": [],
    "preferredMatched": [],
    "extraSkills": [],
    "recommendation": "string",
    "narrative": "string"
  }
}
```

**Errors**: 404, 422, 503

---

### POST /api/v1/ai/chat

**Auth**: any authenticated role

**Body**:

```json
{
  "message": "string",
  "context": "string (optional)"
}
```

**Response** (200):

```json
{ "success": true, "data": { "reply": "string" } }
```

**Errors**: 422, 503

---

## Analytics

All analytics endpoints require `ADMIN` auth.

### GET /api/v1/analytics/dashboard

Returns aggregate counts for the admin overview.

**Response** (200):

```json
{
  "success": true,
  "data": {
    "totalStudents": 420,
    "totalCompanies": 38,
    "totalJobs": 112,
    "totalInternships": 67,
    "totalApplications": 890,
    "totalPlacements": 54
  }
}
```

---

### GET /api/v1/analytics/applications-over-time

**Query**: `from?` (ISO date), `to?` (ISO date)

**Response** (200): `{ "data": { "series": [ { "date": "string", "count": number } ] } }`

---

### GET /api/v1/analytics/placements-over-time

Same shape as applications-over-time; counts applications with `status: 'SELECTED'`.

---

### GET /api/v1/analytics/jobs-by-category

**Response** (200): `{ "data": { "series": [ { "category": "string", "count": number } ] } }`

---

### GET /api/v1/analytics/internships-by-category

Same shape as jobs-by-category.

---

### GET /api/v1/analytics/students-by-branch

**Response** (200): `{ "data": { "series": [ { "branch": "string", "count": number } ] } }`

---

### GET /api/v1/analytics/industry-skill-demand

**Response** (200):

```json
{
  "success": true,
  "data": {
    "skills": [ { "name": "string", "category": "string", "demandCount": 23 } ]
  }
}
```

---

### GET /api/v1/analytics/company-participation

**Response** (200): `{ "data": { "series": [ { "company": "string", "jobCount": number, "applicationCount": number } ] } }`

---

## Admin

All admin endpoints require `ADMIN` auth.

### GET /api/v1/admin/users

**Query**: `page?`, `pageSize?`, `role?`, `isActive?`

**Response** (200): `Paginated<User>`

---

### PATCH /api/v1/admin/users/:id/activate

**Params**: `id` — User ObjectId

Sets `isActive: true`. Writes an audit log entry with action `USER_UPDATED`.

**Response** (200): `{ "success": true, "data": { "user": { "isActive": true } } }`

**Errors**: 404

---

### PATCH /api/v1/admin/users/:id/deactivate

**Params**: `id`

Sets `isActive: false`. Writes an audit log entry with action `USER_DEACTIVATED`.

**Response** (200): `{ "success": true, "data": { "user": { "isActive": false } } }`

---

### DELETE /api/v1/admin/users/:id

**Params**: `id`

Permanently deletes the user document. Writes audit log.

**Response** (200): `{ "success": true, "data": null }`

---

### PATCH /api/v1/admin/companies/:id/verify

**Params**: `id` — CompanyProfile ObjectId

Sets `verifiedAt` to the current timestamp. Writes audit log.

**Response** (200): `{ "success": true, "data": { "profile": { "verifiedAt": "string" } } }`

---

### PATCH /api/v1/admin/jobs/:id/force-close

**Params**: `id` — Job ObjectId

Sets `status: 'CLOSED'` regardless of owner. Writes audit log with action `JOB_CLOSED`.

**Response** (200): `{ "success": true, "data": { "job": { "status": "CLOSED" } } }`

---

### PATCH /api/v1/admin/internships/:id/force-close

**Params**: `id` — Internship ObjectId

Sets `status: 'CLOSED'`. Writes audit log with action `INTERNSHIP_CLOSED`.

**Response** (200): `{ "success": true, "data": { "internship": { "status": "CLOSED" } } }`

---

## Audit Logs

Both endpoints require `ADMIN` auth.

### GET /api/v1/audit-logs/

**Query**: `page?`, `pageSize?`, `action?` (AUDIT_ACTIONS enum), `from?`, `to?`

**Response** (200): `Paginated<AuditLog>`

---

### GET /api/v1/audit-logs/:id

**Params**: `id`

**Response** (200):

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "string",
      "actor": "ObjectId",
      "actorEmail": "string",
      "role": "ADMIN",
      "action": "JOB_CLOSED",
      "entity": "Job",
      "entityId": "string",
      "before": {},
      "after": {},
      "ip": "string",
      "createdAt": "string"
    }
  }
}
```

**Errors**: 404
