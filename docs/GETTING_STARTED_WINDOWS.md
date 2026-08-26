node 

# Getting Started on Windows

Complete step-by-step guide for a teammate who is starting from **zero** on a Windows 10 or 11 machine.

Estimated time: **20–30 minutes** (most of it waiting on downloads and MongoDB signup).

---

## What you will end up with

- Both dev servers running:
  - **Backend API** at [http://localhost:4000](http://localhost:4000)
  - **Frontend Web** at [http://localhost:5173](http://localhost:5173)
- Pre-seeded demo data (1 admin, 3 companies, 6 students, jobs, internships, applications)
- You logged in as admin / company / student to explore all three roles

---

## Prerequisites (install these once per machine)

### 1. Install Node.js 20 or newer

1. Go to [https://nodejs.org](https://nodejs.org)
2. Download the **LTS installer** (v20 or v22, both work)
3. Run the installer, click Next through all defaults
4. **Close and reopen** any PowerShell windows so PATH picks up Node

**Verify:**

```powershell
node -v
```

You should see `v20.x.x` or higher. If you see `command not found`, restart the terminal (or your PC).

### 2. Install Git for Windows

If you already have Git, skip this.

1. Go to [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Download and run the installer
3. Click Next through defaults (accept the recommended text editor if unsure)

**Verify:**

```powershell
git --version
```

### 3. Install pnpm (package manager)

```powershell
npm install -g pnpm@9
```

**Verify:**

```powershell
pnpm --version
```

Should print `9.x.x`.

**If you get "npm : execution of scripts is disabled"**, open PowerShell **as Administrator** once and run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Then retry `npm install -g pnpm@9`.

---

## Get the project code

**If you were given a Git URL:**

```powershell
cd $HOME\Documents
git clone <the-repo-url> academia-industry-portal
cd academia-industry-portal
```

**If you were given a zip file:**

1. Extract it to `%USERPROFILE%\Documents\academia-industry-portal`
2. Open PowerShell and run:

```powershell
cd $HOME\Documents\academia-industry-portal
```

**Sanity check** — you should see files like `package.json`, `pnpm-workspace.yaml`, `README.md`:

```powershell
ls
```

---

## Get a free MongoDB Atlas cluster

This is your database. Free tier is more than enough for development.

### Signup + cluster

1. Open [https://cloud.mongodb.com](https://cloud.mongodb.com) and sign up (Google login works fine).
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

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

This will:

- Confirm Node 20+ is installed
- Confirm pnpm is installed
- Install all dependencies (takes **3–5 minutes** the first time — 748 packages)
- Copy `.env.example` → `.env`
- Print two JWT secrets — **copy both lines**

---

## Configure `.env`

Open `.env` in Notepad or VS Code:

```powershell
notepad .env
```

Update these values:

| Variable               | Value                                                           |
| ---------------------- | --------------------------------------------------------------- |
| `MONGODB_URI`        | Your Atlas string from above (with password +`/aip` inserted) |
| `JWT_ACCESS_SECRET`  | Paste the first secret from setup output                        |
| `JWT_REFRESH_SECRET` | Paste the second secret from setup output                       |

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

```powershell
node scripts\check-env.mjs
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

```powershell
pnpm seed
```

You should see log lines like:

```
Seeded 1 admin, 3 companies, 6 students, 38 skills, 8 jobs, 6 internships, 5 trainings, 10 applications, 2 interviews, 23 notifications
```

**If this fails with `MongoServerError: bad auth`** — your password in `MONGODB_URI` is wrong. Re-copy from Atlas.

---

## Start the app

```powershell
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

## Log in and explore

Open [http://localhost:5173](http://localhost:5173) in your browser.

Click **Login** in the top-right and use any of these accounts (password is `Demo@1234` for all three):

| Role              | Email                | See what they see                                            |
| ----------------- | -------------------- | ------------------------------------------------------------ |
| **Admin**   | `admin@aip.demo`   | Analytics dashboard, all students/companies/jobs, audit logs |
| **Company** | `hr@demotech.demo` | Post jobs, view applicants, shortlist, schedule interviews   |
| **Student** | `arya@demo.edu`    | Browse jobs, apply, view match scores, track applications    |

---

## Verify everything works (optional but recommended)

In a **second** PowerShell window (leave `pnpm dev` running in the first):

```powershell
cd $HOME\Documents\academia-industry-portal

# All 6 workspaces should typecheck cleanly
pnpm typecheck

# 69 tests should pass (51 frontend + 18 backend)
pnpm test

# Quick API health check
curl http://localhost:4000/api/v1/health
```

---

## Stopping the app

- Press **Ctrl+C** in the PowerShell running `pnpm dev`.
- Type `Y` if it asks about terminating the batch job.

## Restarting later

Every subsequent time you just need:

```powershell
cd $HOME\Documents\academia-industry-portal
pnpm dev
```

(no reinstall, no reseed unless you dropped the DB)

---

## Troubleshooting (Windows-specific)

### `pnpm : cannot be loaded because running scripts is disabled`

Open PowerShell **as Administrator** once and run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Close and reopen your normal PowerShell.

### `Error: MONGODB_URI is not set`

Your `.env` file is missing or MONGODB_URI is empty. Re-run `node scripts\check-env.mjs` — it will tell you exactly what's wrong.

### Port 4000 already in use

Some other process is holding the port. Find and stop it:

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess
Stop-Process -Id <PID>
```

Or change `PORT=4001` in `.env`.

### Port 5173 already in use

Same as above but replace 4000 with 5173.

### `MongoServerError: bad auth`

The password in `MONGODB_URI` is wrong. Common cause: your Atlas password has special characters that need URL-encoding. Regenerate the password in Atlas (Database Access → user → Edit → Autogenerate) and copy again.

### `Cannot GET /api/v1/...`

Backend didn't start. Look at the `apps/api dev:` lines in the terminal — the error will be there. Usually a bad `.env` value.

### `pnpm install` hangs at "resolving..."

Corporate proxy or network issue. Try:

```powershell
pnpm config set registry https://registry.npmjs.org/
pnpm install
```

### The web page loads but everything says "Unauthorized"

Cookies aren't being sent. Check that `FRONTEND_URL` in `.env` **exactly** matches the URL in your browser (`http://localhost:5173`, not `http://127.0.0.1:5173`).

### `docker: command not found`

Good — you don't need Docker for this project. Skip.

---

## What to send back if you get stuck

Paste **all of these** into chat/email:

1. Output of `node -v` and `pnpm -v`
2. Output of `node scripts\check-env.mjs`
3. Last 30 lines of the `pnpm dev` terminal
4. Browser DevTools → Network tab → screenshot of any failing request (right-click → Copy → Copy as cURL)
