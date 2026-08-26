# Scripts

Convenience scripts for local development. Cross-platform where possible; Windows PowerShell and POSIX bash versions provided for setup.

| Script | Purpose | How to run |
|---|---|---|
| `setup.sh` | One-command setup for macOS/Linux: verifies Node, installs pnpm if missing, installs deps, seeds `.env` | `bash scripts/setup.sh` |
| `setup.ps1` | Same, for Windows PowerShell | `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1` |
| `gen-secrets.mjs` | Prints two 96-char hex JWT secrets — paste into `.env` | `node scripts/gen-secrets.mjs` |
| `check-env.mjs` | Validates `.env` has all required vars and secrets meet minimum length | `node scripts/check-env.mjs` |

## Typical fresh-clone flow

**macOS / Linux:**
```bash
bash scripts/setup.sh
# edit .env with MongoDB URI + paste JWT secrets
node scripts/check-env.mjs
pnpm seed
pnpm dev
```

**Windows PowerShell:**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# edit .env with MongoDB URI + paste JWT secrets
node scripts\check-env.mjs
pnpm seed
pnpm dev
```

## Regenerating JWT secrets

If you leaked a secret or just want to rotate:
```bash
node scripts/gen-secrets.mjs >> .env.new
# review .env.new, then merge the two JWT lines into .env manually
```

## Notes

- Application-level scripts (seed, tests, build) live in each workspace's `package.json`; run them via `pnpm --filter @aip/api <script>` or `pnpm <root-script>`.
- The database seed script itself is at `apps/api/src/scripts/seed.ts` and invoked via `pnpm seed` from repo root.
