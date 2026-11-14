/**
 * Demo account passwords. Generated locally, written only to a gitignored file
 * under apps/api/.demo-credentials/, never logged and never bundled.
 *
 * A password is only ever *known* for an account this seeder created. If an
 * account already exists and the file has no entry for it, its password is
 * reported as unknown — bcrypt hashes cannot be reversed and the seeder never
 * resets an existing password.
 */
import { randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^*-_=+';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

const pick = (set: string) => set[randomInt(set.length)] as string;

/** 20 chars from a CSPRNG, guaranteed to contain every character class. */
export function generatePassword(length = 20): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}

export interface CredentialEntry {
  role: string;
  email: string;
  password: string | null;
  note?: string;
}

export interface CredentialsFile {
  target: string;
  updatedAt: string;
  loginUrl: string;
  accounts: CredentialEntry[];
}

export const CREDENTIALS_DIR = path.resolve(process.cwd(), '.demo-credentials');

export function credentialsPath(targetId: string): string {
  const safe = targetId.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return path.join(CREDENTIALS_DIR, `${safe}.json`);
}

export function readCredentials(file: string): Map<string, string> {
  const known = new Map<string, string>();
  if (!fs.existsSync(file)) return known;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as CredentialsFile;
  for (const a of parsed.accounts ?? []) if (a.password) known.set(a.email, a.password);
  return known;
}

export function writeCredentials(file: string, content: CredentialsFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  // A second guard in case the repo-level ignore rule is ever removed.
  const ignore = path.join(path.dirname(file), '.gitignore');
  if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '*\n');
  fs.writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`, { mode: 0o600 });
}
