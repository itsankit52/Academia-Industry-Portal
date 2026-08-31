# AI Integration

Related: [architecture.md](./architecture.md) | [matching.md](./matching.md) | [api.md](./api.md)

---

## Overview

The platform integrates Google Gemini for three AI-assisted features. In every case the AI provides **narrative output only**. Numeric scores, eligibility checks, and recommendations are computed deterministically before Gemini is ever invoked.

---

## File Locations

```
apps/api/src/
  config/
    gemini.ts                 Initialises the Gemini SDK from GEMINI_API_KEY env var.
                              Exports a pre-configured model instance used by ai.service.ts.
                              Throws at startup if the key is missing (caught and turned into 503).
  modules/ai/
    ai.routes.ts              Three POST endpoints; all behind requireAuth.
    ai.controller.ts          Thin controller: validates input, calls service, sends envelope.
    ai.service.ts             All Gemini SDK calls and prompt construction.
                              explainJobMatch() — receives MatchResult; returns prose narrative.
```

---

## Endpoints

### POST /api/v1/ai/resume-analyze

**Auth**: any authenticated user (`STUDENT` role enforced)

**Body**:

```typescript
{
  text?: string;   // raw resume text pasted by the user
  url?:  string;   // publicly accessible resume URL (Cloudinary URL accepted)
}
```

At least one of `text` or `url` must be provided (validated by `resumeAnalyzeSchema`).

**What happens**:

1. The controller passes `text` or the fetched content from `url` to `ai.service.ts`.
2. The service sends a structured prompt to Gemini instructing it to extract skill names from the resume text.
3. Gemini returns a list of skill strings.
4. The service returns them as `extractedSkills`.

**Success response (200)**:

```json
{
  "success": true,
  "data": {
    "extractedSkills": ["TypeScript", "React", "Node.js", "MongoDB"]
  }
}
```

**Errors**: 422 `VALIDATION_ERROR` (neither `text` nor `url` provided), 503 `SERVICE_UNAVAILABLE` (Gemini unconfigured).

---

### POST /api/v1/ai/job-match

**Auth**: `STUDENT`

**Body**:

```typescript
{
  opportunityType: 'JOB' | 'INTERNSHIP';
  opportunityId: string; // MongoDB ObjectId
}
```

**What happens**:

1. The service loads the student's `StudentSkill` records and resolves the skill IDs.
2. The service loads the Job or Internship document (using `opportunityType` to select the model) and reads `requiredSkills` and `preferredSkills`.
3. `computeMatch()` from `apps/api/src/modules/matching/algorithm.ts` is called — this produces the deterministic `MatchResult`.
4. The `MatchResult` plus job context (title, description excerpt, company name) is passed to `ai.service.ts::explainJobMatch()`.
5. Gemini receives the score, matched skills, missing skills, and level as structured JSON in a system prompt. It writes a 2-3 sentence prose explanation.
6. The response merges `MatchResult` with the `narrative` field.

**Success response (200)**:

```json
{
  "success": true,
  "data": {
    "score": 64,
    "level": "GOOD_MATCH",
    "matchedSkills": ["react", "typescript", "node.js", "mongodb"],
    "missingSkills": ["aws"],
    "preferredMatched": [],
    "extraSkills": [],
    "recommendation": "Good fit — you meet most core requirements.",
    "narrative": "You have a strong foundation in the core web stack this role requires. The main gap is AWS experience; even basic familiarity with S3 and EC2 would strengthen your application significantly."
  }
}
```

**Errors**: 404 `NOT_FOUND` (opportunity does not exist), 503 `SERVICE_UNAVAILABLE`.

---

### POST /api/v1/ai/chat

**Auth**: any authenticated role (`STUDENT`, `COMPANY`, `ADMIN`)

**Body**:

```typescript
{
  message:   string;    // user's question or message
  context?:  string;    // optional additional context (e.g. current page, recent search)
}
```

**What happens**:

The service sends the message to Gemini with a system prompt that:

- Identifies the assistant as a career guidance tool for the AcadIn.
- Instructs the model to use only information present in the provided context; it must not fabricate job listings, company names, or skill data.
- Instructs the model to respond with "I don't have that information" when asked about data not present in the context.
- Keeps responses concise and actionable.

The conversation is **stateless** — each POST is an independent request. There is no session or message history stored on the server.

**Success response (200)**:

```json
{
  "success": true,
  "data": {
    "reply": "Based on your current skill profile, roles in backend development align well with your TypeScript and Node.js experience. Consider adding cloud certifications to broaden your options."
  }
}
```

**Errors**: 422 `VALIDATION_ERROR` (empty `message`), 503 `SERVICE_UNAVAILABLE`.

---

## Security Posture

### API key isolation

```
GEMINI_API_KEY
  └── lives in apps/api/.env only
      loaded once in apps/api/src/config/gemini.ts
      never imported by apps/web/
      never included in any API response
```

The frontend never sees the key. There is no proxy that forwards the key to the client. All Gemini calls originate from the server process.

### Error rewriting

```typescript
// apps/api/src/modules/ai/ai.service.ts
try {
  const result = await model.generateContent(prompt);
  return result.response.text();
} catch (err) {
  throw AppError.internal('AI request failed');
}
```

Raw Gemini error messages (which may include quota details, model identifiers, or prompt excerpts) are discarded. The client receives a generic 500 `INTERNAL_ERROR` with the message `"AI request failed"`.

### 503 when unconfigured

```typescript
// apps/api/src/config/gemini.ts
if (!process.env.GEMINI_API_KEY) {
  // ai.service.ts checks for null model and throws SERVICE_UNAVAILABLE
}
```

Deploying without `GEMINI_API_KEY` does not crash the server. Only the three AI endpoints are affected; all other routes continue normally.

### Rate limiting

The global rate limiter and `authLimiter` both apply to AI endpoints. In production, an additional per-user AI-specific bucket is recommended to prevent a single user from exhausting the Gemini quota. This would be implemented as a separate `express-rate-limit` instance keyed on `req.user.id` mounted before AI route handlers.

---

## Prompt Design Principles

All prompts in `ai.service.ts` follow these rules:

1. **Grounded context only.** The prompt passes real data from the database (skill names, job title, match score). The model is instructed not to invent data.
2. **Deferral on uncertainty.** Every system prompt includes an instruction to respond with "I don't have that information" rather than speculating about unavailable data.
3. **No PII in prompts.** Student names, emails, and phone numbers are never included in Gemini requests. Prompts contain only skill IDs (resolved to names), job context, and match results.
4. **Structured input, prose output.** Gemini receives structured JSON context and is asked to produce natural-language output only. It is never asked to output JSON or make programmatic decisions.
5. **Separation of concerns.** The match score and level come from `computeMatch()`; Gemini's role is explanation, not evaluation.
