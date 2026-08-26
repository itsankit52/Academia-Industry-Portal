#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

echo "==> Checking Node.js"
if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not installed. Install Node 20+ from https://nodejs.org first."
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Current: $(node -v)"
  exit 1
fi
echo "   Node $(node -v) ✓"

echo "==> Checking pnpm"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "   pnpm not found. Installing pnpm@9 globally..."
  npm install -g pnpm@9
fi
echo "   pnpm $(pnpm --version) ✓"

echo "==> Installing dependencies"
pnpm install

echo "==> Setting up .env"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env from .env.example"
  echo ""
  echo "   Generating JWT secrets:"
  node scripts/gen-secrets.mjs
  echo ""
  echo "   ⚠️  Paste the two secrets above into .env"
  echo "   ⚠️  Also fill in MONGODB_URI (get from https://cloud.mongodb.com)"
else
  echo "   .env already exists — skipping"
fi

echo ""
echo "==> Next steps:"
echo "   1. Edit .env — set MONGODB_URI and paste JWT secrets"
echo "   2. Validate: node scripts/check-env.mjs"
echo "   3. Seed database: pnpm seed"
echo "   4. Start dev: pnpm dev"
echo ""
echo "==> Setup complete ✅"
