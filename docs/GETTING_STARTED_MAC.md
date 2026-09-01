# Getting Started on macOS

Complete step-by-step guide for a teammate who is starting from **zero** on macOS (Intel or Apple Silicon).

Estimated time: **20–30 minutes** (most of it waiting on downloads and MongoDB signup).

---

## What you will end up with

- Both dev servers running:
  - **Backend API** at <http://localhost:4000>
  - **Frontend Web** at <http://localhost:5173>
- Reference data (skill catalogue) seeded and ready
- You can register your first real account and start exploring

---

## Prerequisites (install these once per machine)

### 1. Install Homebrew (if you don't have it)

Open **Terminal** (`Cmd+Space` → type "Terminal") and paste:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the prompts. After it finishes it will print two `eval` commands (Apple Silicon) — run those so `brew` becomes available in your current terminal.

**Verify:**

```bash
brew --version
```

### 2. Install Node.js 20 or newer

```bash
brew install node@20
brew link node@20 --force
```

Or, alternatively (any of these works — pick one):

- Direct installer from <https://nodejs.org> (LTS)
- Version manager: `brew install nvm` then `nvm install 20 && nvm use 20`

**Verify:**

```bash
node -v      # v20.x.x or newer
```

### 3. Install Git (if not installed)

Usually macOS already has it. Check:

```bash
git --version
```

If not installed, macOS will prompt you to install the Xcode Command Line Tools automatically — accept.

### 4. Install pnpm (package manager)

```bash
npm install -g pnpm@9
```

**Verify:**

```bash
pnpm --version    # 9.x.x
```

If you get `EACCES` permission errors, prefix with `sudo`:

```bash
sudo npm install -g pnpm@9
```

---

## Get the project code

**If you were given a Git URL:**

```bash
cd ~/Developer 2>/dev/null || cd ~
git clone <the-repo-url> academia-industry-portal
cd academia-industry-portal
```

**If you were given a zip file:**

1. Unzip it into `~/Developer/academia-industry-portal` (or anywhere convenient)
2. In Terminal:

```bash
cd ~/Developer/academia-industry-portal
```

**Sanity check** — you should see `package.json`, `pnpm-workspace.yaml`, `README.md`:

```bash
ls
```

---

## Get a free MongoDB Atlas cluster

This is your database. Free tier is more than enough for development.

### Signup + cluster

1. Open <https://cloud.mongodb.com> and sign up (Google login works fine).
2. When asked, choose **Build a Database** → **M0 (Free)**.
3. Pick any cloud provider (AWS is fine) and any region close to you.
4. Click **Create**.

### Database user (username + password)

1. In the left sidebar, click **Database Access**.
2. **Add New Database User**.
3. Authentication Method: **Password**.
4. Username: e.g. `aipuser`
5. Password: click **Autogenerate Secure Password**, then **Copy** it and save somewhere safe.
6. Under **Database User Privileges**, select **Read and write to any database**.
7. **Add User**.

### Network access (allow your machine)

1. In the left sidebar, click **Network Access**.
2. **Add IP Address**.
3. Click **Allow Access from Anywhere** (for development).
4. **Confirm**.

### Get the connection string

1. In the left sidebar, click **Database**.
2. Next to your cluster, click **Connect**.
3. Choose **Drivers**.
4. Copy the connection string. It looks like:
   ```
   mongodb+srv://aipuser:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Replace `<password>`** with the password you saved earlier.
6. Add a database name after `.net/` — use `aip`:
   ```
   mongodb+srv://aipuser:MyPass123@cluster0.abcde.mongodb.net/aip?retryWrites=true&w=majority
   ```
   Keep this string handy — you will paste it into `.env` next.

---

## One-command setup

Run this from the `academia-industry-portal` folder:

```bash
bash scripts/setup.sh
```

This will:

- Confirm Node 20+ is installed
- Confirm pnpm is installed
- Install all dependencies (takes **3–5 minutes** the first time — 748 packages)
- Copy `.env.example` → `.env`
- Print two JWT secrets — **copy both lines**

---

## Configure `.env`

Open `.env` in your editor:

```bash
# VS Code (if installed)
code .env

# Or nano
nano .env

# Or TextEdit (be sure to set format to Plain Text)
open -e .env
```

Update these values:

| Variable             | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| `MONGODB_URI`        | Your Atlas string from above (with password + `/aip` inserted) |
| `JWT_ACCESS_SECRET`  | Paste the first secret from setup output                       |
| `JWT_REFRESH_SECRET` | Paste the second secret from setup output                      |

**These four should already have sensible defaults** — leave them:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:4000/api/v1
```

**Optional features** (leave empty if you don't need them):

- `CLOUDINARY_*` — needed only for resume/logo uploads
- `GEMINI_API_KEY` — needed only for AI features (skill extraction, chat)

Save and close.

### Validate `.env`

```bash
node scripts/check-env.mjs
```

Expected output:

```
✅ .env has all required variables
   Required: 6/6 set
   Optional: 0/13 set
```

If it errors, fix `.env` and re-run.

---

## Seed the database

```bash
pnpm seed
```

You should see output confirming the skill catalogue was seeded (38 skills):

```
✓ Skills seeded (38 reference skills)
Seed complete — reference data only.
```

**If this fails with `MongoServerError: bad auth`** — your password in `MONGODB_URI` is wrong. Re-copy from Atlas.

---

## Start the app

```bash
pnpm dev
```

You should see **two servers boot in parallel**:

```
apps/api dev: {"level":30,"msg":"API listening on http://localhost:4000"}
apps/web dev:   VITE v5.4.x  ready in ...
apps/web dev:   ➜  Local:   http://localhost:5173/
```

Leave this terminal open — it's running the app.

---

## Create your account and explore

Open <http://localhost:5173> in your browser.

Click **Register** to create a new account. Select your role (Student, Company, Faculty, or Institution Admin) and fill in your details. Students and faculty must select their institution from the list.

Once registered, sign in and explore the platform with your real account.

---

## Verify everything works (optional but recommended)

In a **second** Terminal tab (leave `pnpm dev` running in the first):

```bash
cd ~/Developer/academia-industry-portal   # or wherever you cloned

# All 6 workspaces should typecheck cleanly
pnpm typecheck

# 69 tests should pass (51 frontend + 18 backend)
pnpm test

# Quick API health check
curl http://localhost:4000/api/v1/health
```

---

## Stopping the app

- Press **Ctrl+C** in the terminal running `pnpm dev`.

## Restarting later

Every subsequent time you just need:

```bash
cd ~/Developer/academia-industry-portal
pnpm dev
```

(no reinstall, no reseed unless you dropped the DB)

---

## Troubleshooting (macOS-specific)

### `zsh: command not found: pnpm`

`pnpm` global install went to a directory not on your PATH. Fix:

```bash
echo 'export PATH="$(npm config get prefix)/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### `EACCES: permission denied` on `npm install -g`

Prefix with `sudo`, or fix npm's global directory permanently:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

### Apple Silicon: `bad CPU type in executable`

You have an Intel-only binary. For Node this shouldn't happen — reinstall via `brew install node@20`. For other tools try `arch -arm64 brew install <tool>`.

### `Error: MONGODB_URI is not set`

Your `.env` file is missing or MONGODB_URI is empty. Re-run `node scripts/check-env.mjs` — it tells you exactly what's wrong.

### Port 4000 already in use

```bash
lsof -i :4000
kill -9 <PID>
```

Or change `PORT=4001` in `.env`.

### Port 5173 already in use

Same as above but for port 5173.

### `MongoServerError: bad auth`

The password in `MONGODB_URI` is wrong. Common cause: your Atlas password has special characters that need URL-encoding. Regenerate in Atlas (Database Access → user → Edit → Autogenerate) and copy again.

### `Cannot GET /api/v1/...`

Backend didn't start. Scroll up in the `pnpm dev` terminal — the error will be there. Usually a bad `.env` value.

### The web page loads but everything says "Unauthorized"

Cookies aren't being sent. Check that `FRONTEND_URL` in `.env` **exactly** matches the URL in your browser (`http://localhost:5173`, not `http://127.0.0.1:5173`).

### `pnpm install` fails with SSL errors

Corporate proxy or VPN interference. Try:

```bash
pnpm config set registry https://registry.npmjs.org/
pnpm install
```

Or disable VPN temporarily.

### `docker: command not found`

Good — you don't need Docker for this project. Skip.

---

## What to send back if you get stuck

Paste **all of these** into chat/email:

1. Output of `node -v` and `pnpm -v`
2. Output of `node scripts/check-env.mjs`
3. Last 30 lines of the `pnpm dev` terminal
4. Browser DevTools → Network tab → screenshot of any failing request (right-click → Copy → Copy as cURL)
