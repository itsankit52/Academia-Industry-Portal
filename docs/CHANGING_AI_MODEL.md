# Changing the Gemini AI Model or API Key

Agar AI features (Assessment / Skill Gap Analysis) fail hone lage, is guide se easily switch kar sakte ho.

**Code mein kuch nahi badalna. Sirf `.env` ke 2 lines.**

---

## Kab is guide ki zaroorat padegi

- AI Assessment "AI request failed" dikha raha ho
- Skill Gap Analysis "Analysis failed" dikha raha ho
- Backend log mein error: `no longer available` / `not found` / `deprecated` / `429 quota exceeded`

---

## Step 1 — Naya API key le lo (agar chahiye)

Free key: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)

- Google account se login karo
- **Create API key** click karo
- Key copy kar lo (format: `AIza...` ya `AQ.Ab...`)

---

## Step 2 — Check karo konse model available hain

**macOS / Linux terminal:**

```bash
KEY="<YOUR-KEY>"
curl -s "https://generativelanguage.googleapis.com/v1beta/models?key=${KEY}" \
  | python3 -c "import sys,json; [print(m['name']) for m in json.load(sys.stdin).get('models',[])]"
```

**Windows PowerShell:**

```powershell
$KEY = "<YOUR-KEY>"
(Invoke-RestMethod "https://generativelanguage.googleapis.com/v1beta/models?key=$KEY").models.name
```

Output me `models/gemini-flash-latest`, `models/gemini-pro-latest`, etc. dikhenge.

---

## Step 3 — Test karo konsa model kaam karta hai (before changing .env)

**macOS / Linux:**

```bash
KEY="<YOUR-KEY>"
MODEL="gemini-flash-latest"
curl -s "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"reply PONG"}]}]}'
```

**Windows PowerShell:**

```powershell
$KEY = "<YOUR-KEY>"
$MODEL = "gemini-flash-latest"
Invoke-RestMethod "https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=$KEY" `
  -Method Post -ContentType "application/json" `
  -Body '{"contents":[{"parts":[{"text":"reply PONG"}]}]}'
```

**Response me `"PONG"` dikhe** → model kaam karta hai, use kar lo. **404 aaye** → next model try karo.

---

## Step 4 — Recommended fallback order

| # | Model                        | Kyun                                              |
| - | ---------------------------- | ------------------------------------------------- |
| 1 | `gemini-flash-latest`      | ✅ Currently working. Auto-alias — future-proof. |
| 2 | `gemini-pro-latest`        | Slower but reliable fallback.                     |
| 3 | `gemini-3.5-flash`         | Explicit version.                                 |
| 4 | `gemini-3.6-flash`         | Google ka own suggestion in deprecation errors.   |
| 5 | `gemini-flash-lite-latest` | Fastest + cheapest.                               |

---

## Step 5 — `.env` update karo

Project root me `.env` open karo:

```env
GEMINI_API_KEY=<naya key>
GEMINI_MODEL=<Step 3 me jo model PONG return kiya>
```

Save karo.

---

## Step 6 — Backend restart karo

Terminal me `Ctrl+C` phir:

```bash
pnpm dev
```

`[INFO]: API listening` dikhne par backend ready hai.

---

## Step 7 — Browser me test karo

1. `http://localhost:5173/student/skill-gap` → Opportunity select → **Analyze Gap** → result render hona chahiye
2. `http://localhost:5173/student/assessments` → **Generate Assessment** → questions aana chahiye

---

## Troubleshooting

**"AI is not configured"** → `.env` me `GEMINI_API_KEY` khali hai. Fill karo.

**"Analysis failed" occasionally** → Google's transient 503. Code me already 3 retries built-in. **Try again** button click karo — usually 2nd/3rd attempt success.

**Sab models fail ho rahe** → Purani key rate-limited/suspended. Step 1 se naya key generate karo. Dashboard: [https://aistudio.google.com](https://aistudio.google.com).

**Restart ke baad bhi purana model use ho raha** → Node process kill nahi hua:

- **macOS/Linux:** `lsof -tiTCP:4000 | xargs -r kill -9 && pnpm dev`
- **Windows:** `Get-Process -Name node | Stop-Process -Force; pnpm dev`

---

## Cost aur limits (free tier)

- 15 requests/minute per model
- 1500 requests/day per model
- Assessment feature ~5-10 API calls per attempt — jaldi limit hit ho sakta hai
- Paid tier: [https://aistudio.google.com](https://aistudio.google.com)

---

## Links

- Docs: [https://ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs)
- Get key: [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Model list: [https://ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models)
