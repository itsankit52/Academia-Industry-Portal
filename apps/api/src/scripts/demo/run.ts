/**
 * Demo seed orchestration: guard → connect → credentials → seed → report.
 * Imported dynamically by ../seedDemo.ts after the chosen env file is loaded.
 */
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { connectDB, disconnectDB } from '../../db/mongoose';
import { User } from '../../models';
import { demoAccounts, seedAccounts, type PasswordBook } from './accounts';
import { seedActivity } from './activity';
import { SeedAbort, SeedContext } from './context';
import {
  credentialsPath,
  generatePassword,
  readCredentials,
  writeCredentials,
  type CredentialEntry,
} from './credentials';
import { seedEngagement } from './engagement';
import { assessTarget } from './guard';

export interface RunOptions {
  apply: boolean;
  confirmTarget?: string;
}

export async function runDemoSeed(opts: RunOptions): Promise<number> {
  const guard = assessTarget({
    uri: env.MONGODB_URI,
    dbNameEnv: env.MONGODB_DB_NAME,
    nodeEnv: env.NODE_ENV,
    apply: opts.apply,
    confirmTarget: opts.confirmTarget,
    approvedTargets: process.env['DEMO_SEED_APPROVED_TARGETS'],
  });

  console.info(
    `\nTarget   : ${guard.targetId}  (${guard.local ? 'local' : 'REMOTE'}, NODE_ENV=${env.NODE_ENV})`,
  );
  if (guard.refusal) {
    console.error(`Refused  : ${guard.refusal}\nNothing was written.`);
    return 1;
  }
  console.info(
    `Mode     : ${guard.mode === 'apply' ? 'APPLY — will write missing demo records' : 'DRY RUN — read-only, nothing will be written'}`,
  );
  if (guard.mode === 'dry-run') {
    console.info(
      `To write : --apply --confirm-target="${guard.targetId}"${guard.local ? '' : ' (and list it in DEMO_SEED_APPROVED_TARGETS)'}`,
    );
  }

  await connectDB();
  try {
    const actualDb = mongoose.connection.name;
    if (guard.dbName && actualDb !== guard.dbName) {
      throw new SeedAbort(`Connected to "${actualDb}" but expected "${guard.dbName}"`);
    }
    const ctx = new SeedContext(guard.mode === 'apply');
    // Unique indexes back the idempotency checks, so they must exist before
    // the first write (a no-op where the API has already built them).
    if (ctx.apply) await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
    const passwords: PasswordBook = new Map();
    const credFile = credentialsPath(guard.targetId);

    // Passwords are settled — and written to disk — before any account is
    // created, so a crash mid-run can never leave an account nobody can log into.
    const entries: CredentialEntry[] = [];
    if (ctx.apply) {
      const known = readCredentials(credFile);
      for (const { role, email } of demoAccounts()) {
        const exists = await User.exists({ email });
        const remembered = known.get(email);
        if (!exists) {
          const password = remembered ?? generatePassword();
          passwords.set(email, password);
          entries.push({ role, email, password });
        } else {
          entries.push(
            remembered
              ? { role, email, password: remembered }
              : {
                  role,
                  email,
                  password: null,
                  note: 'Account pre-dates this file; password unknown and NOT reset.',
                },
          );
        }
      }
      writeCredentials(credFile, {
        target: guard.targetId,
        updatedAt: new Date().toISOString(),
        loginUrl: `${env.FRONTEND_URL.replace(/\/$/, '')}/login`,
        accounts: entries,
      });
    }

    const ids = await seedAccounts(ctx, passwords);
    const act = await seedActivity(ctx, ids);
    await seedEngagement(ctx, ids, act);

    console.info('\nCollection                          existing  created  planned');
    for (const [label, t] of ctx.tallies) {
      console.info(
        `${label.padEnd(36)}${String(t.existing).padStart(8)}${String(t.created).padStart(9)}${String(t.planned).padStart(9)}`,
      );
    }
    if (ctx.apply) {
      const unknown = entries.filter((e) => !e.password).length;
      console.info(`\nDemo credentials written to (gitignored): ${credFile}`);
      if (unknown)
        console.info(
          `${unknown} existing demo account(s) have no recorded password; they were left unchanged.`,
        );
    } else {
      console.info('\nDry run complete. No records, passwords or files were written.');
    }
    return 0;
  } catch (err) {
    if (err instanceof SeedAbort) {
      console.error(`\nAborted: ${err.message}`);
      return 1;
    }
    throw err;
  } finally {
    await disconnectDB();
  }
}
