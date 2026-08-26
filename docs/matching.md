# Skill Matching Algorithm

Related: [architecture.md](./architecture.md) | [ai.md](./ai.md) | [data-model.md](./data-model.md)

---

## Location

```
apps/api/src/modules/matching/algorithm.ts
```

The file is pure TypeScript with no database imports. It accepts plain string arrays and returns a plain object. This makes it trivially testable and reusable from any service layer.

---

## Function Signature

```typescript
import { MATCHING_WEIGHTS, MATCH_THRESHOLDS, type MatchLevel } from '@aip/config';
import type { MatchResult } from '@aip/types';

export function computeMatch(
  studentSkillIds: string[],
  requiredSkillIds: string[],
  preferredSkillIds: string[],
): MatchResult
```

All three parameters are arrays of MongoDB ObjectId strings (serialised as plain strings). The function converts them to `Set<string>` internally for O(1) lookup.

---

## Return Shape

```typescript
// packages/types/src/index.ts
interface MatchResult {
  score: number;               // 0–100, integer (Math.round applied)
  matchedSkills: string[];     // required skill IDs the student has
  missingSkills: string[];     // required skill IDs the student lacks
  extraSkills: string[];       // student skills not in required OR preferred
  preferredMatched: string[];  // preferred skill IDs the student has
  level: MatchLevel;           // 'STRONG_MATCH' | 'GOOD_MATCH' | 'PARTIAL_MATCH' | 'LOW_MATCH'
  recommendation: string;      // human-readable one-liner
}
```

---

## Scoring Formula

```
reqRatio   = matchedSkills.length  / Math.max(1, requiredSkillIds.length)
prefRatio  = preferredMatched.length / Math.max(1, preferredSkillIds.length)

raw   = reqRatio  × MATCHING_WEIGHTS.REQUIRED   (80)
      + prefRatio × MATCHING_WEIGHTS.PREFERRED  (20)

score = Math.round(raw)   // integer in [0, 100]
```

Constants from `packages/config/src/constants.ts`:

```typescript
export const MATCHING_WEIGHTS  = { REQUIRED: 80, PREFERRED: 20 } as const;
export const MATCH_THRESHOLDS  = { STRONG: 85, GOOD: 60, PARTIAL: 40 } as const;
```

`Math.max(1, n)` in both denominators prevents division-by-zero when a listing has no required skills or no preferred skills.

---

## Level Thresholds

| Score range | Level | `recommendation` text |
|-------------|-------|-----------------------|
| ≥ 85 | `STRONG_MATCH` | Excellent fit — you meet nearly all requirements. |
| ≥ 60, < 85 | `GOOD_MATCH` | Good fit — you meet most core requirements. |
| ≥ 40, < 60 | `PARTIAL_MATCH` | Partial fit — consider building the missing skills. |
| < 40 | `LOW_MATCH` | Low fit — significant skill gaps to address. |

Thresholds are compared in descending order: STRONG first, then GOOD, then PARTIAL, then LOW as the fallback.

---

## Algorithm Step-by-Step

```typescript
// 1. Build sets
const studentSet  = new Set(studentSkillIds.map(String));
const requiredSet = new Set(requiredSkillIds.map(String));
const preferredSet = new Set(preferredSkillIds.map(String));

// 2. Required skill pass: matched vs missing
for (const id of requiredSet) {
  if (studentSet.has(id)) matchedSkills.push(id);
  else                     missingSkills.push(id);
}

// 3. Preferred skill pass
for (const id of preferredSet) {
  if (studentSet.has(id)) preferredMatched.push(id);
}

// 4. Extra skills (not required AND not preferred)
for (const id of studentSet) {
  if (!requiredSet.has(id) && !preferredSet.has(id)) extraSkills.push(id);
}

// 5. Score
const reqRatio  = matchedSkills.length   / Math.max(1, requiredSet.size);
const prefRatio = preferredMatched.length / Math.max(1, preferredSet.size);
const score     = Math.round(reqRatio * 80 + prefRatio * 20);

// 6. Level
if      (score >= 85) level = 'STRONG_MATCH';
else if (score >= 60) level = 'GOOD_MATCH';
else if (score >= 40) level = 'PARTIAL_MATCH';
else                  level = 'LOW_MATCH';
```

Time complexity: O(r + p + s) where r = required count, p = preferred count, s = student skill count. All three passes are single iterations over sets.

---

## Worked Example 1 — GOOD_MATCH

**Scenario:** A student applying to a senior Node.js role.

```
Student skills:  [React, TypeScript, Node.js, MongoDB]
Required skills: [React, TypeScript, Node.js, MongoDB, AWS]
Preferred skills:[Docker]
```

Step-by-step:

```
requiredSet  = {React, TypeScript, Node.js, MongoDB, AWS}   → size 5
preferredSet = {Docker}                                      → size 1

matchedSkills    = [React, TypeScript, Node.js, MongoDB]     → length 4
missingSkills    = [AWS]                                     → length 1
preferredMatched = []                                        → length 0
extraSkills      = []                                        → length 0

reqRatio   = 4 / max(1, 5) = 4/5 = 0.80
prefRatio  = 0 / max(1, 1) = 0/1 = 0.00

raw   = 0.80 × 80 + 0.00 × 20 = 64 + 0 = 64
score = Math.round(64) = 64
level = GOOD_MATCH   (64 ≥ 60 and < 85)
```

Result:

```json
{
  "score": 64,
  "matchedSkills": ["React", "TypeScript", "Node.js", "MongoDB"],
  "missingSkills": ["AWS"],
  "extraSkills": [],
  "preferredMatched": [],
  "level": "GOOD_MATCH",
  "recommendation": "Good fit — you meet most core requirements."
}
```

---

## Worked Example 2 — STRONG_MATCH (exact + preferred)

**Scenario:** A student with all required skills and the preferred skill too.

```
Student skills:  [React, TypeScript, Node.js, MongoDB, AWS, Docker]
Required skills: [React, TypeScript, Node.js, MongoDB, AWS]
Preferred skills:[Docker]
```

```
matchedSkills    = [React, TypeScript, Node.js, MongoDB, AWS]  → length 5
missingSkills    = []
preferredMatched = [Docker]                                     → length 1
extraSkills      = []

reqRatio   = 5 / max(1, 5) = 1.00
prefRatio  = 1 / max(1, 1) = 1.00

raw   = 1.00 × 80 + 1.00 × 20 = 100
score = 100
level = STRONG_MATCH
```

---

## Worked Example 3 — No preferred skills defined

**Scenario:** A listing that specifies only required skills.

```
Student skills:  [Python, SQL]
Required skills: [Python, SQL, TensorFlow]
Preferred skills:[]
```

```
requiredSet  = {Python, SQL, TensorFlow}  → size 3
preferredSet = {}                          → size 0

matchedSkills    = [Python, SQL]
missingSkills    = [TensorFlow]
preferredMatched = []
extraSkills      = []

reqRatio   = 2 / max(1, 3) = 0.667
prefRatio  = 0 / max(1, 0) = 0 / 1 = 0.00   ← denominator clamped to 1

raw   = 0.667 × 80 + 0.00 × 20 = 53.33
score = Math.round(53.33) = 53
level = PARTIAL_MATCH   (53 ≥ 40 and < 60)
```

When `preferredSkillIds` is empty the preferred term contributes zero and the score is determined entirely by the required ratio. The maximum possible score when no preferred skills are defined is 80 (student has all required skills; gets full 80 from the required term).

---

## Design Rationale

### Deterministic and auditable

Every score is fully reproducible from the same inputs. There is no model state, no randomness, and no network call. Given the student's skill IDs and the listing's required/preferred IDs, anyone can re-derive the score by running the formula. This matters for fairness: students know exactly which skills are missing and why their score changed.

### Fast

Set intersection is O(n). Even with hundreds of skills the function completes in microseconds. Recommendations can score every published listing for a student in a single API call without pagination or caching concerns.

### AI narrative as a separate layer

The score and level are computed before Gemini is ever invoked. In `apps/api/src/modules/ai/ai.service.ts::explainJobMatch`, the `MatchResult` is passed to Gemini as structured context in the prompt. Gemini writes a paragraph explaining the result in plain English. It cannot change the `score` or `level` fields. If the AI service is unavailable the listing still returns the numeric match; the `narrative` field is simply absent.

---

## Where computeMatch Is Called

| Caller | Purpose |
|--------|---------|
| `recommendations.service.ts` | Score all published jobs/internships for a student; sort by score descending |
| `ai.service.ts::explainJobMatch` | Compute match for one specific listing before sending to Gemini for narrative |
| `applications.service.ts` | Store `matchScore` on the Application document at submission time |

---

## How to Extend

### Weighted proficiency scoring

Currently all matched skills count equally. To reward EXPERT proficiency over BEGINNER, replace the binary `has/doesn't have` check with a weight lookup:

```typescript
const proficiencyWeight = { BEGINNER: 0.5, INTERMEDIATE: 0.75, ADVANCED: 0.9, EXPERT: 1.0 };
// sum weights instead of counting booleans
```

This requires passing `StudentSkill` objects (with `proficiency`) rather than plain string IDs.

### Semantic skill aliases

Two skills like "JS" and "JavaScript" are treated as distinct IDs. A skill-alias lookup table (stored in a new `SkillAlias` collection or as a field on `Skill`) could pre-expand `studentSkillIds` before calling `computeMatch`.

### Tier-2 preferred bucket

Add a third `niceToHaveSkillIds` array with a smaller weight (e.g. 5 points) so the formula becomes:

```
score = reqRatio × 75 + prefRatio × 20 + niceRatio × 5
```

The function signature and `MatchResult` shape would need a corresponding `niceToHaveMatched` field.

### Location and CGPA filters

`computeMatch` intentionally does not handle eligibility filters (CGPA threshold, eligible branches, graduation year). Those checks happen in the service layer before `computeMatch` is called, so the algorithm stays focused on skill overlap.
