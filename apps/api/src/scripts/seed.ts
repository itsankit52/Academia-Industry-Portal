/**
 * seed.ts — Reference data seeder
 *
 * This script seeds ONLY system reference data required for the application to
 * function:
 *   - Skills (canonical technology and soft-skill catalogue)
 *
 * It does NOT create demo users, demo institutions, demo companies, demo
 * students, demo faculty, demo jobs, demo internships, demo applications, or
 * any other demo/sample business data.
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
import type { SkillCategory } from '@aip/config';

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
// Skills — canonical reference catalogue
// ---------------------------------------------------------------------------

interface SkillSeed {
  name: string;
  category: SkillCategory;
  description: string;
}

/**
 * Canonical skill catalogue used by matching, assessments, skill-gap analysis,
 * job/internship requirements, and student skill profiles.
 *
 * This is legitimate reference/system data — NOT demo data.
 */
const SKILL_SEEDS: SkillSeed[] = [
  // Programming languages
  {
    name: 'JavaScript',
    category: 'PROGRAMMING',
    description: 'Dynamic scripting language for web and server-side development.',
  },
  {
    name: 'TypeScript',
    category: 'PROGRAMMING',
    description: 'Typed superset of JavaScript that compiles to plain JS.',
  },
  {
    name: 'Python',
    category: 'PROGRAMMING',
    description: 'General-purpose language popular in data, ML, and scripting.',
  },
  {
    name: 'Java',
    category: 'PROGRAMMING',
    description: 'Object-oriented language widely used in enterprise systems.',
  },
  {
    name: 'C++',
    category: 'PROGRAMMING',
    description: 'Systems language known for performance and control.',
  },
  // Frontend
  {
    name: 'HTML',
    category: 'FRONTEND',
    description: 'Standard markup language for web page structure.',
  },
  {
    name: 'CSS',
    category: 'FRONTEND',
    description: 'Style sheet language for describing presentation of web pages.',
  },
  {
    name: 'React',
    category: 'FRONTEND',
    description: 'Component-based JavaScript library for building UIs.',
  },
  {
    name: 'Next.js',
    category: 'FRONTEND',
    description: 'React framework with SSR, routing, and edge features.',
  },
  {
    name: 'Vue',
    category: 'FRONTEND',
    description: 'Progressive JavaScript framework for building UIs.',
  },
  // Backend
  {
    name: 'Node.js',
    category: 'BACKEND',
    description: 'JavaScript runtime for building scalable server applications.',
  },
  {
    name: 'Express',
    category: 'BACKEND',
    description: 'Minimalist web framework for Node.js APIs.',
  },
  {
    name: 'Django',
    category: 'BACKEND',
    description: 'High-level Python web framework with batteries included.',
  },
  {
    name: 'FastAPI',
    category: 'BACKEND',
    description: 'Modern Python web framework for building fast APIs.',
  },
  // Databases
  {
    name: 'MongoDB',
    category: 'DATABASE',
    description: 'Document-oriented NoSQL database.',
  },
  {
    name: 'PostgreSQL',
    category: 'DATABASE',
    description: 'Powerful open-source relational database.',
  },
  {
    name: 'MySQL',
    category: 'DATABASE',
    description: 'Widely used open-source relational database.',
  },
  {
    name: 'Redis',
    category: 'DATABASE',
    description: 'In-memory data store used as cache and message broker.',
  },
  // Cloud
  { name: 'AWS', category: 'CLOUD', description: 'Amazon Web Services cloud platform.' },
  { name: 'GCP', category: 'CLOUD', description: 'Google Cloud Platform.' },
  { name: 'Azure', category: 'CLOUD', description: 'Microsoft Azure cloud services.' },
  // DevOps
  {
    name: 'Docker',
    category: 'DEVOPS',
    description: 'Container platform for packaging and running applications.',
  },
  {
    name: 'Kubernetes',
    category: 'DEVOPS',
    description: 'Orchestration platform for containerized workloads.',
  },
  { name: 'Git', category: 'DEVOPS', description: 'Distributed version control system.' },
  {
    name: 'CI/CD',
    category: 'DEVOPS',
    description: 'Continuous integration and delivery practices and tooling.',
  },
  // AI / ML
  {
    name: 'TensorFlow',
    category: 'AI_ML',
    description: 'Open-source machine learning framework by Google.',
  },
  {
    name: 'PyTorch',
    category: 'AI_ML',
    description: 'Deep learning framework focused on flexibility and speed.',
  },
  {
    name: 'scikit-learn',
    category: 'AI_ML',
    description: 'Python library for classical machine learning algorithms.',
  },
  // Data science
  {
    name: 'Pandas',
    category: 'DATA_SCIENCE',
    description: 'Python library for data manipulation and analysis.',
  },
  {
    name: 'NumPy',
    category: 'DATA_SCIENCE',
    description: 'Fundamental package for numerical computing in Python.',
  },
  // Mobile
  {
    name: 'React Native',
    category: 'MOBILE',
    description: 'Framework for building native mobile apps with React.',
  },
  {
    name: 'Flutter',
    category: 'MOBILE',
    description: 'Google framework for cross-platform mobile apps in Dart.',
  },
  {
    name: 'Kotlin',
    category: 'MOBILE',
    description: 'Modern JVM language commonly used for Android development.',
  },
  // Cybersecurity
  {
    name: 'OWASP',
    category: 'CYBERSECURITY',
    description: 'Application security guidance and tooling standards.',
  },
  // Soft skills
  {
    name: 'Communication',
    category: 'SOFT_SKILLS',
    description: 'Verbal and written communication skills.',
  },
  {
    name: 'Teamwork',
    category: 'SOFT_SKILLS',
    description: 'Collaborating effectively within diverse teams.',
  },
  {
    name: 'Problem Solving',
    category: 'SOFT_SKILLS',
    description: 'Analytical approach to breaking down and solving problems.',
  },
  {
    name: 'Leadership',
    category: 'SOFT_SKILLS',
    description: 'Guiding, motivating, and coordinating a team toward outcomes.',
  },
];

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

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

async function summary(): Promise<Record<string, number>> {
  const [skills] = await Promise.all([Skill.countDocuments()]);
  return { skills };
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

    const counts = await summary();
    logger.info(
      { counts },
      'Seed complete — reference data only. ' +
        'No demo users, institutions, companies, students, faculty, ' +
        'jobs, internships, or applications were created. ' +
        'Users and institutions are created through the real registration flow.',
    );
  } finally {
    await disconnectDB();
  }
}

run().catch((err: unknown) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
