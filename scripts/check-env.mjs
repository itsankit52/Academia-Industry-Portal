#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = ['NODE_ENV', 'PORT', 'FRONTEND_URL', 'MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const OPTIONAL = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'VITE_API_URL', 'VITE_APP_NAME', 'MAX_FILE_SIZE_MB', 'RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS', 'LOG_LEVEL', 'COOKIE_DOMAIN', 'COOKIE_SECURE'];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(ROOT, '.env');

if (!existsSync(envPath)) {
  console.error('❌ .env file not found at', envPath);
  console.error('   Run: cp .env.example .env');
  process.exit(1);
}

const raw = readFileSync(envPath, 'utf-8');
const parsed = new Map();
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  parsed.set(key, value);
}

const missing = REQUIRED.filter((k) => !parsed.get(k));
const weak = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'].filter((k) => {
  const v = parsed.get(k);
  return v && v.length < 32;
});
const configuredOptional = OPTIONAL.filter((k) => parsed.get(k));

if (missing.length) {
  console.error('❌ Missing required environment variables:');
  for (const key of missing) console.error(`   - ${key}`);
  console.error('\nFill these in .env before running pnpm dev or pnpm seed.');
  process.exit(1);
}

if (weak.length) {
  console.error('⚠️  JWT secrets are too short (min 32 chars). Regenerate with:');
  console.error('   node scripts/gen-secrets.mjs');
  for (const key of weak) console.error(`   - ${key} is only ${parsed.get(key).length} chars`);
  process.exit(1);
}

console.log('✅ .env has all required variables');
console.log(`   Required: ${REQUIRED.length}/${REQUIRED.length} set`);
console.log(`   Optional: ${configuredOptional.length}/${OPTIONAL.length} set${configuredOptional.length ? ` (${configuredOptional.join(', ')})` : ''}`);
if (configuredOptional.length < OPTIONAL.length) {
  const skipped = OPTIONAL.filter((k) => !parsed.get(k));
  console.log(`   Skipped features: ${skipped.join(', ')}`);
}
