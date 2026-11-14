/**
 * seed.ts — Reference data seeder
 *
 * This script seeds system reference data required for the application to
 * function:
 *   - Skills (canonical technology and soft-skill catalogue)
 *   - Aptitude questions (technical aptitude test bank)
 *
 * It does NOT create demo users, demo companies, demo students, demo faculty,
 * demo institutions, demo jobs, demo internships, demo applications, or any
 * other demo/sample business data. The database is left usable from zero:
 * institutions are created through the real registration flow, and students
 * join those institutions with the code the admin sees in their dashboard.
 *
 * Production behaviour: NODE_ENV=production causes an immediate exit so this
 * script can never be run against live data by accident.
 *
 * Remote DB safety: a non-local MONGODB_URI is rejected unless SEED_FORCE=1
 * or --force is passed.
 *
 * WARNING: clearAll() deletes every collection first. Any accounts created via
 * the real signup form will be removed. This is intentional for a clean dev
 * environment but must never run against production or shared staging data.
 */

import { connectDB, disconnectDB } from '../db/mongoose';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import {
  Application,
  AptitudeQuestion,
  AptitudeTest,
  Assessment,
  AuditLog,
  CollaborationEvent,
  CompanyProfile,
  DocumentModel,
  EventRegistration,
  FacultyOpportunity,
  FacultyProfile,
  Institution,
  InterimReport,
  Internship,
  Interview,
  Job,
  MentorProfile,
  MentorshipMessage,
  MentorshipRequest,
  Notification,
  PlacementDrive,
  PlacementParticipant,
  Resume,
  SavedOpportunity,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
  User,
} from '../models';
import { isLocalTarget, targetHosts } from './seedTarget';
import type { AptitudeCategory } from '@aip/config';
import { ALL_APTITUDE_QUESTIONS } from './seedData/aptitude';
import { SKILL_SEEDS } from './seedData/skills';

// ---------------------------------------------------------------------------
// Safety guards
// ---------------------------------------------------------------------------

/**
 * Refuse to run on production or an unconfirmed remote database target.
 * clearAll() wipes every collection — it must never reach real data.
 */
function assertSafeToWipe(): void {
  const target = {
    hosts: targetHosts(env.MONGODB_URI),
    db: env.MONGODB_DB_NAME ?? '(from connection string)',
  };

  if (env.NODE_ENV === 'production') {
    logger.error(
      target,
      'Refusing to seed: NODE_ENV=production. This script deletes every collection, including all real user accounts.',
    );
    process.exit(1);
  }

  const confirmed = process.env['SEED_FORCE'] === '1' || process.argv.includes('--force');
  if (!isLocalTarget(env.MONGODB_URI) && !confirmed) {
    logger.error(
      target,
      'Refusing to seed: MONGODB_URI does not point at a local database. ' +
        'This script deletes every collection, including all real user accounts. ' +
        'Re-run with SEED_FORCE=1 (or --force) if that is genuinely what you want.',
    );
    process.exit(1);
  }

  logger.warn(
    target,
    'Seeding will delete every collection first, including any accounts created through signup',
  );
}

// ---------------------------------------------------------------------------
// Collection wipe
// ---------------------------------------------------------------------------

async function clearAll(): Promise<void> {
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    CompanyProfile.deleteMany({}),
    FacultyProfile.deleteMany({}),
    FacultyOpportunity.deleteMany({}),
    Institution.deleteMany({}),
    Skill.deleteMany({}),
    StudentSkill.deleteMany({}),
    Job.deleteMany({}),
    Internship.deleteMany({}),
    Application.deleteMany({}),
    SavedOpportunity.deleteMany({}),
    Interview.deleteMany({}),
    TrainingProgram.deleteMany({}),
    Notification.deleteMany({}),
    Resume.deleteMany({}),
    AuditLog.deleteMany({}),
    Assessment.deleteMany({}),
    DocumentModel.deleteMany({}),
    MentorProfile.deleteMany({}),
    MentorshipRequest.deleteMany({}),
    MentorshipMessage.deleteMany({}),
    InterimReport.deleteMany({}),
    CollaborationEvent.deleteMany({}),
    EventRegistration.deleteMany({}),
    PlacementDrive.deleteMany({}),
    PlacementParticipant.deleteMany({}),
    AptitudeQuestion.deleteMany({}),
    AptitudeTest.deleteMany({}),
  ]);
}

// ---------------------------------------------------------------------------
// Skills — canonical reference catalogue lives in ./seedData/skills so the
// demo seeder can reuse it (this module runs on import and cannot be shared).
// ---------------------------------------------------------------------------

async function seedSkills(): Promise<number> {
  const docs = await Skill.insertMany(
    SKILL_SEEDS.map((s) => ({
      name: s.name.toLowerCase(),
      category: s.category,
      description: s.description,
      status: 'ACTIVE',
    })),
  );
  return docs.length;
}

/**
 * Seeds the aptitude question bank so students can take aptitude tests on first run.
 */
async function seedAptitudeQuestions(): Promise<number> {
  const existing = await AptitudeQuestion.countDocuments();
  if (existing > 0) {
    logger.info({ count: existing }, 'Aptitude questions already exist, skipping');
    return existing;
  }
  const docs = ALL_APTITUDE_QUESTIONS.map(
    (q: {
      category: string;
      question: string;
      options: string[];
      correctIndex: number;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      explanation: string;
      tags?: string[];
    }) => ({
      category: q.category as AptitudeCategory,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      difficulty: q.difficulty,
      explanation: q.explanation,
      tags: q.tags ?? [],
      status: 'ACTIVE',
    }),
  );
  const inserted = await AptitudeQuestion.insertMany(docs);
  logger.info({ count: inserted.length }, 'Aptitude questions seeded');
  return inserted.length;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

async function summary(): Promise<Record<string, number>> {
  const [skills, aptitudeQuestions, institutions] = await Promise.all([
    Skill.countDocuments(),
    AptitudeQuestion.countDocuments(),
    Institution.countDocuments(),
  ]);
  return { skills, aptitudeQuestions, institutions };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  // Check before connecting so an unsafe target fails fast.
  assertSafeToWipe();
  await connectDB();

  try {
    logger.info('Clearing existing collections');
    await clearAll();

    logger.info('Seeding skills (reference data)');
    const skillCount = await seedSkills();
    logger.info({ skillCount }, 'Skills seeded');

    logger.info('Seeding aptitude question bank');
    const aptitudeCount = await seedAptitudeQuestions();

    const counts = await summary();
    logger.info(
      { counts },
      'Seed complete — reference data only. ' +
        'No demo users, companies, students, faculty, institutions, ' +
        'jobs, internships, or applications were created. ' +
        'Institutions are created through the real registration flow; ' +
        'students and faculty join them using the institution code.',
    );
  } finally {
    await disconnectDB();
  }
}

run().catch((err: unknown) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
