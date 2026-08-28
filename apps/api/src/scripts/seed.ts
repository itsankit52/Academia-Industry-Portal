import type { Types } from 'mongoose';
import { connectDB, disconnectDB } from '../db/mongoose';
import { env } from '../config/env';
import { hashPassword } from '../utils/password';
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
  Resume,
  SavedOpportunity,
  Skill,
  StudentProfile,
  StudentSkill,
  TrainingProgram,
  User,
} from '../models';
import { computeMatch } from '../modules/matching/algorithm';
import { isLocalTarget, targetHosts } from './seedTarget';
import type {
  ApplicationStatus,
  EmploymentType,
  JobStatus,
  Proficiency,
  SkillCategory,
  WorkMode,
} from '@aip/config';

type SkillMap = Map<string, Types.ObjectId>;

const DEMO_PASSWORD = 'Demo@1234';

/**
 * `clearAll` deletes every collection, including `users` — so re-running the
 * seed destroys accounts that were created through the real signup form, and
 * the next login for one of those accounts correctly answers
 * `401 Invalid credentials` because the account genuinely no longer exists.
 * That is fine on a local throwaway database and unacceptable anywhere else,
 * so a remote target now has to be confirmed explicitly and production is
 * refused outright.
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
      'Refusing to seed: MONGODB_URI does not point at a local database. This script deletes every collection, including all real user accounts. Re-run with SEED_FORCE=1 (or --force) if that is genuinely what you want.',
    );
    process.exit(1);
  }

  logger.warn(
    target,
    'Seeding will delete every collection first, including any accounts created through signup',
  );
}

function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

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
    AptitudeQuestion.deleteMany({}),
    AptitudeTest.deleteMany({}),
  ]);
}

interface SkillSeed {
  name: string;
  category: SkillCategory;
  description: string;
}

const SKILL_SEEDS: SkillSeed[] = [
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
  { name: 'MongoDB', category: 'DATABASE', description: 'Document-oriented NoSQL database.' },
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
  { name: 'AWS', category: 'CLOUD', description: 'Amazon Web Services cloud platform.' },
  { name: 'GCP', category: 'CLOUD', description: 'Google Cloud Platform.' },
  { name: 'Azure', category: 'CLOUD', description: 'Microsoft Azure cloud services.' },
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
  {
    name: 'OWASP',
    category: 'CYBERSECURITY',
    description: 'Application security guidance and tooling standards.',
  },
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

async function seedSkills(): Promise<SkillMap> {
  const docs = await Skill.insertMany(
    SKILL_SEEDS.map((s) => ({
      name: s.name.toLowerCase(),
      category: s.category,
      description: s.description,
      status: 'ACTIVE',
    })),
  );
  const map: SkillMap = new Map();
  for (const doc of docs) {
    map.set(String(doc.name), doc._id as Types.ObjectId);
  }
  return map;
}

function skillId(map: SkillMap, name: string): Types.ObjectId {
  const id = map.get(name.toLowerCase());
  if (!id) throw new Error(`Missing skill: ${name}`);
  return id;
}

function skillIdsOf(map: SkillMap, names: string[]): Types.ObjectId[] {
  return names.map((n) => skillId(map, n));
}

interface CompanySeed {
  email: string;
  companyName: string;
  industry: string;
  companySize: string;
  hqLocation: string;
  website?: string;
  foundedYear: number;
  description: string;
  verifiedAt?: Date;
}

const COMPANY_SEEDS: CompanySeed[] = [
  {
    email: 'hr@demotech.demo',
    companyName: 'Demo Technologies',
    industry: 'Software & IT Services',
    companySize: '201-500',
    hqLocation: 'Bengaluru, India',
    website: 'https://demotech.demo',
    foundedYear: 2015,
    description:
      'Demo Technologies is a mid-sized product engineering company partnering with global clients to deliver secure, scalable web platforms. Our teams span frontend, backend, cloud, and data engineering with a strong focus on developer experience.',
    verifiedAt: new Date(),
  },
  {
    email: 'careers@democloud.demo',
    companyName: 'Demo Cloud Systems',
    industry: 'Cloud Computing',
    companySize: '51-200',
    hqLocation: 'Hyderabad, India',
    website: 'https://democloud.demo',
    foundedYear: 2018,
    description:
      'Demo Cloud Systems helps enterprises modernize workloads on AWS, GCP, and Azure with a platform-engineering-first approach. We build reference architectures and reusable landing zones for regulated industries.',
    verifiedAt: new Date(),
  },
  {
    email: 'hiring@demofintech.demo',
    companyName: 'Demo FinTech Labs',
    industry: 'Financial Services',
    companySize: '11-50',
    hqLocation: 'Mumbai, India',
    website: 'https://demofintech.demo',
    foundedYear: 2020,
    description:
      'Demo FinTech Labs designs risk, compliance, and payments products for emerging markets. Small teams, high ownership, and a strong bias toward measurable customer outcomes over vanity engineering.',
    verifiedAt: new Date(),
  },
];

interface StudentSeed {
  email: string;
  fullName: string;
  branch: string;
  graduationYear: number;
  cgpa: number;
  degree: string;
  semester: number;
  college: string;
  city: string;
  state: string;
  bio: string;
  preferredRoles: string[];
  preferredLocations: string[];
  skills: Array<{ name: string; proficiency: Proficiency; years: number }>;
}

const STUDENT_SEEDS: StudentSeed[] = [
  {
    email: 'arya@demo.edu',
    fullName: 'Demo Arya Sharma',
    branch: 'Computer Science',
    graduationYear: 2025,
    cgpa: 8.7,
    degree: 'B.Tech',
    semester: 7,
    college: 'Demo Institute of Technology',
    city: 'Bengaluru',
    state: 'Karnataka',
    bio: 'Frontend-heavy full-stack engineer who enjoys building fast, accessible React apps with strong type safety and clean API design.',
    preferredRoles: ['Frontend Engineer', 'Full-Stack Developer'],
    preferredLocations: ['Bengaluru, India', 'Remote'],
    skills: [
      { name: 'React', proficiency: 'ADVANCED', years: 3 },
      { name: 'TypeScript', proficiency: 'ADVANCED', years: 3 },
      { name: 'Node.js', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'MongoDB', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'JavaScript', proficiency: 'EXPERT', years: 4 },
      { name: 'Git', proficiency: 'ADVANCED', years: 3 },
      { name: 'Communication', proficiency: 'ADVANCED', years: 3 },
    ],
  },
  {
    email: 'rohan@demo.edu',
    fullName: 'Demo Rohan Patel',
    branch: 'Information Technology',
    graduationYear: 2025,
    cgpa: 8.2,
    degree: 'B.E.',
    semester: 7,
    college: 'Demo Institute of Technology',
    city: 'Pune',
    state: 'Maharashtra',
    bio: 'Backend developer focused on Node.js and Python APIs, with hands-on experience running services in Docker and AWS.',
    preferredRoles: ['Backend Engineer', 'Platform Engineer'],
    preferredLocations: ['Pune, India', 'Hyderabad, India'],
    skills: [
      { name: 'Node.js', proficiency: 'ADVANCED', years: 3 },
      { name: 'Express', proficiency: 'ADVANCED', years: 2 },
      { name: 'Python', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'PostgreSQL', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Docker', proficiency: 'INTERMEDIATE', years: 1 },
      { name: 'AWS', proficiency: 'INTERMEDIATE', years: 1 },
      { name: 'Git', proficiency: 'ADVANCED', years: 3 },
      { name: 'Teamwork', proficiency: 'ADVANCED', years: 3 },
    ],
  },
  {
    email: 'priya@demo.edu',
    fullName: 'Demo Priya Iyer',
    branch: 'Electronics & Communication',
    graduationYear: 2026,
    cgpa: 9.1,
    degree: 'B.Tech',
    semester: 5,
    college: 'Demo National Institute',
    city: 'Chennai',
    state: 'Tamil Nadu',
    bio: 'Aspiring ML engineer with strong math foundations and applied experience in signal processing and computer vision projects.',
    preferredRoles: ['ML Engineer', 'Data Scientist'],
    preferredLocations: ['Chennai, India', 'Bengaluru, India', 'Remote'],
    skills: [
      { name: 'Python', proficiency: 'ADVANCED', years: 3 },
      { name: 'TensorFlow', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'PyTorch', proficiency: 'INTERMEDIATE', years: 1 },
      { name: 'scikit-learn', proficiency: 'ADVANCED', years: 2 },
      { name: 'Pandas', proficiency: 'ADVANCED', years: 2 },
      { name: 'NumPy', proficiency: 'ADVANCED', years: 2 },
      { name: 'Git', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Problem Solving', proficiency: 'EXPERT', years: 4 },
    ],
  },
  {
    email: 'sneha@demo.edu',
    fullName: 'Demo Sneha Reddy',
    branch: 'Computer Science',
    graduationYear: 2024,
    cgpa: 7.8,
    degree: 'M.Tech',
    semester: 4,
    college: 'Demo Institute of Technology',
    city: 'Hyderabad',
    state: 'Telangana',
    bio: 'Full-stack developer with recent experience building internal tools using Django and React.',
    preferredRoles: ['Full-Stack Developer', 'Backend Engineer'],
    preferredLocations: ['Hyderabad, India'],
    skills: [
      { name: 'Django', proficiency: 'ADVANCED', years: 2 },
      { name: 'Python', proficiency: 'ADVANCED', years: 3 },
      { name: 'React', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'PostgreSQL', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Git', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Teamwork', proficiency: 'ADVANCED', years: 3 },
    ],
  },
  {
    email: 'karan@demo.edu',
    fullName: 'Demo Karan Mehta',
    branch: 'Mechanical Engineering',
    graduationYear: 2025,
    cgpa: 7.5,
    degree: 'B.Tech',
    semester: 7,
    college: 'Demo Engineering College',
    city: 'Ahmedabad',
    state: 'Gujarat',
    bio: 'Mechanical design engineer with hands-on experience in CAD tools and simulation, complemented by scripting in C++ and Python.',
    preferredRoles: ['Mechanical Design Engineer', 'CAD Engineer'],
    preferredLocations: ['Ahmedabad, India', 'Pune, India'],
    skills: [
      { name: 'C++', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Python', proficiency: 'BEGINNER', years: 1 },
      { name: 'Git', proficiency: 'BEGINNER', years: 1 },
      { name: 'Communication', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Problem Solving', proficiency: 'ADVANCED', years: 3 },
      { name: 'Teamwork', proficiency: 'ADVANCED', years: 3 },
    ],
  },
  {
    email: 'divya@demo.edu',
    fullName: 'Demo Divya Nair',
    branch: 'Data Science',
    graduationYear: 2026,
    cgpa: 8.9,
    degree: 'B.Tech',
    semester: 5,
    college: 'Demo Institute of Technology',
    city: 'Kochi',
    state: 'Kerala',
    bio: 'Data science undergraduate building strong foundations in statistics, SQL, and Python-based data pipelines.',
    preferredRoles: ['Data Scientist', 'Data Analyst'],
    preferredLocations: ['Kochi, India', 'Bengaluru, India', 'Remote'],
    skills: [
      { name: 'Python', proficiency: 'ADVANCED', years: 2 },
      { name: 'Pandas', proficiency: 'ADVANCED', years: 2 },
      { name: 'NumPy', proficiency: 'ADVANCED', years: 2 },
      { name: 'scikit-learn', proficiency: 'INTERMEDIATE', years: 1 },
      { name: 'PostgreSQL', proficiency: 'INTERMEDIATE', years: 1 },
      { name: 'MySQL', proficiency: 'INTERMEDIATE', years: 1 },
      { name: 'Git', proficiency: 'INTERMEDIATE', years: 2 },
      { name: 'Communication', proficiency: 'ADVANCED', years: 2 },
    ],
  },
];

function studentRichProfile(seed: StudentSeed) {
  return {
    fullName: seed.fullName,
    phone: '+91 90000 00000',
    dob: new Date(2003, 5, 15),
    gender: 'PREFER_NOT_TO_SAY' as const,
    city: seed.city,
    state: seed.state,
    college: seed.college,
    degree: seed.degree,
    branch: seed.branch,
    semester: seed.semester,
    graduationYear: seed.graduationYear,
    cgpa: seed.cgpa,
    bio: seed.bio,
    projects: [
      {
        title: `${seed.fullName.split(' ')[1] ?? 'Demo'} Portfolio Site`,
        description:
          'Personal portfolio built with a modern stack, showcasing recent projects and coursework.',
        techStack: ['HTML', 'CSS', 'JavaScript'],
        link: 'https://portfolio.demo/example',
      },
      {
        title: 'Demo Capstone Project',
        description:
          'A team capstone exploring a real-world problem end-to-end from requirements to deployment.',
        techStack: ['Python', 'Docker'],
        link: 'https://github.com/demo/capstone',
      },
    ],
    certifications: [
      {
        title: 'Demo Foundations Certificate',
        issuer: 'Demo Institute of Technology',
        issuedAt: daysAgo(180),
        credentialUrl: 'https://certs.demo/example',
      },
    ],
    experience: [
      {
        title: 'Demo Summer Intern',
        organization: 'Demo Technologies',
        startDate: daysAgo(365),
        endDate: daysAgo(270),
        description:
          'Contributed to internal tooling and documentation as part of the platform team.',
      },
    ],
    achievements: [
      {
        title: 'Demo Hackathon Finalist',
        description: 'Reached the finals of the annual campus hackathon among 100+ teams.',
        date: daysAgo(240),
      },
      {
        title: 'Demo Merit Scholarship',
        description: 'Awarded for consistent academic performance in the department.',
        date: daysAgo(500),
      },
    ],
    preferredRoles: seed.preferredRoles,
    preferredLocations: seed.preferredLocations,
  };
}

interface JobSeed {
  companyIndex: number;
  title: string;
  description: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  salary?: { min: number; max: number; currency: string };
  minCgpa?: number;
  eligibleBranches: string[];
  eligibleGradYears: number[];
  requiredSkills: string[];
  preferredSkills: string[];
  status: JobStatus;
  deadlineDays: number;
}

const JOB_SEEDS: JobSeed[] = [
  {
    companyIndex: 0,
    title: 'Demo Frontend Engineer',
    description:
      'Join the Demo Technologies web platform team to build accessible, high-performance React applications that serve tens of thousands of daily users. You will collaborate with designers and backend engineers to ship features across our product surface, own frontend architecture decisions, and mentor interns and junior engineers on modern web practices, testing, and observability. Strong TypeScript, React, and CSS fundamentals are essential.',
    location: 'Bengaluru, India',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salary: { min: 900000, max: 1600000, currency: 'INR' },
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology', 'Data Science'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['React', 'TypeScript', 'JavaScript', 'HTML', 'CSS'],
    preferredSkills: ['Node.js', 'Git'],
    status: 'PUBLISHED',
    deadlineDays: 45,
  },
  {
    companyIndex: 0,
    title: 'Demo Backend Engineer',
    description:
      'Design and operate Node.js and Python services backing our SaaS product, with a focus on API ergonomics, database performance, and safe deployment. You will own end-to-end features from schema design and API contracts to rollout, on-call, and postmortems. We value engineers who care about correctness, tests, and clear communication as much as raw throughput.',
    location: 'Bengaluru, India',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salary: { min: 1000000, max: 1800000, currency: 'INR' },
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['Node.js', 'Express', 'MongoDB', 'JavaScript'],
    preferredSkills: ['TypeScript', 'Docker', 'AWS'],
    status: 'PUBLISHED',
    deadlineDays: 60,
  },
  {
    companyIndex: 0,
    title: 'Demo Full-Stack Developer',
    description:
      'Ship customer-facing features across the stack in a small, senior team. You will move fluidly between React, Node.js, and MongoDB, and take ownership of quality, testing, and observability for the surfaces you touch. Ideal for engineers who enjoy both crafting UIs and reasoning about data models.',
    location: 'Bengaluru, India',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    salary: { min: 1100000, max: 1900000, currency: 'INR' },
    minCgpa: 7.5,
    eligibleBranches: ['Computer Science', 'Information Technology', 'Data Science'],
    eligibleGradYears: [2024, 2025],
    requiredSkills: ['React', 'Node.js', 'MongoDB', 'TypeScript'],
    preferredSkills: ['Express', 'Docker', 'AWS'],
    status: 'PUBLISHED',
    deadlineDays: 50,
  },
  {
    companyIndex: 1,
    title: 'Demo Cloud Engineer',
    description:
      'Design and build multi-cloud landing zones and reference platforms for regulated customers. You will work with Terraform, Kubernetes, and CI/CD pipelines to help teams ship safely on AWS, GCP, and Azure. Comfort switching between infrastructure, developer platforms, and customer engagements is important.',
    location: 'Hyderabad, India',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salary: { min: 1200000, max: 2000000, currency: 'INR' },
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
    preferredSkills: ['GCP', 'Azure', 'Python'],
    status: 'PUBLISHED',
    deadlineDays: 60,
  },
  {
    companyIndex: 1,
    title: 'Demo Data Scientist',
    description:
      'Partner with product and engineering to explore, model, and ship data-driven features. You will work on the full lifecycle from problem framing and dataset construction to model evaluation and monitoring in production. Curiosity, rigor, and clear writing matter as much as modeling depth.',
    location: 'Hyderabad, India',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salary: { min: 1200000, max: 2200000, currency: 'INR' },
    minCgpa: 7.5,
    eligibleBranches: ['Computer Science', 'Data Science', 'Electronics & Communication'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['Python', 'Pandas', 'NumPy', 'scikit-learn'],
    preferredSkills: ['PyTorch', 'TensorFlow', 'PostgreSQL'],
    status: 'PUBLISHED',
    deadlineDays: 75,
  },
  {
    companyIndex: 1,
    title: 'Demo ML Engineer',
    description:
      'Productionize machine learning models and build the infrastructure that trains, serves, and monitors them. You will collaborate closely with data scientists and platform teams to define reliable pipelines and clear SLOs for model quality and latency in customer-facing products.',
    location: 'Hyderabad, India',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    salary: { min: 1400000, max: 2400000, currency: 'INR' },
    minCgpa: 8.0,
    eligibleBranches: ['Computer Science', 'Data Science', 'Electronics & Communication'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['Python', 'PyTorch', 'TensorFlow', 'scikit-learn'],
    preferredSkills: ['AWS', 'Docker', 'Pandas'],
    status: 'PUBLISHED',
    deadlineDays: 90,
  },
  {
    companyIndex: 2,
    title: 'Demo Mechanical Design Engineer',
    description:
      'Own mechanical design of hardware modules used in payment terminals and edge devices. You will collaborate with electrical, firmware, and manufacturing teams to iterate from prototype through production, balancing manufacturability, cost, and reliability constraints throughout the lifecycle.',
    location: 'Ahmedabad, India',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    minCgpa: 7.0,
    eligibleBranches: ['Mechanical Engineering'],
    eligibleGradYears: [2025],
    requiredSkills: ['C++', 'Problem Solving', 'Teamwork'],
    preferredSkills: ['Python', 'Git'],
    status: 'DRAFT',
    deadlineDays: 40,
  },
  {
    companyIndex: 2,
    title: 'Demo FinTech Software Engineer',
    description:
      'Build the core services powering our payments and risk platform. You will contribute to safe, well-tested Node.js and Python services with strict reliability and audit requirements, and work directly with product owners on features that impact customer money and trust.',
    location: 'Mumbai, India',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salary: { min: 1300000, max: 2100000, currency: 'INR' },
    minCgpa: 7.5,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL'],
    preferredSkills: ['Redis', 'Docker', 'AWS'],
    status: 'CLOSED',
    deadlineDays: 30,
  },
];

interface InternshipSeed {
  companyIndex: number;
  title: string;
  description: string;
  location: string;
  workMode: WorkMode;
  durationMonths: number;
  stipend: number;
  minCgpa?: number;
  eligibleBranches: string[];
  eligibleGradYears: number[];
  requiredSkills: string[];
  preferredSkills: string[];
  deadlineDays: number;
}

const INTERNSHIP_SEEDS: InternshipSeed[] = [
  {
    companyIndex: 0,
    title: 'Demo Frontend Intern',
    description:
      'Work with the Demo Technologies frontend team on real product features using React and TypeScript. You will pair with senior engineers, own scoped tasks, and receive structured feedback focused on your growth.',
    location: 'Bengaluru, India',
    workMode: 'HYBRID',
    durationMonths: 3,
    stipend: 25000,
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['React', 'JavaScript', 'HTML', 'CSS'],
    preferredSkills: ['TypeScript', 'Git'],
    deadlineDays: 30,
  },
  {
    companyIndex: 0,
    title: 'Demo Backend Intern',
    description:
      'Contribute to the Node.js and MongoDB services powering the Demo Technologies product. Expect real code review, ownership of a small subsystem, and mentorship on backend fundamentals.',
    location: 'Bengaluru, India',
    workMode: 'REMOTE',
    durationMonths: 6,
    stipend: 30000,
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['Node.js', 'Express', 'MongoDB'],
    preferredSkills: ['TypeScript', 'Docker'],
    deadlineDays: 45,
  },
  {
    companyIndex: 1,
    title: 'Demo Data Science Intern',
    description:
      'Support ongoing data science projects by exploring datasets, running experiments, and preparing evaluation reports. You will work in Python with Pandas, NumPy, and scikit-learn on real customer problems.',
    location: 'Hyderabad, India',
    workMode: 'HYBRID',
    durationMonths: 4,
    stipend: 28000,
    minCgpa: 7.5,
    eligibleBranches: ['Computer Science', 'Data Science', 'Electronics & Communication'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['Python', 'Pandas', 'NumPy'],
    preferredSkills: ['scikit-learn', 'PostgreSQL'],
    deadlineDays: 40,
  },
  {
    companyIndex: 1,
    title: 'Demo Cloud DevOps Intern',
    description:
      'Learn cloud platform engineering by helping build reusable Terraform modules, CI/CD pipelines, and container images used across customer landing zones on AWS and GCP.',
    location: 'Hyderabad, India',
    workMode: 'ONSITE',
    durationMonths: 6,
    stipend: 30000,
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['AWS', 'Docker', 'CI/CD'],
    preferredSkills: ['Kubernetes', 'GCP'],
    deadlineDays: 50,
  },
  {
    companyIndex: 2,
    title: 'Demo Mobile Developer Intern',
    description:
      'Build features on our React Native mobile clients used by customer-facing merchant tools. You will collaborate with backend and design to ship polished, well-tested screens.',
    location: 'Mumbai, India',
    workMode: 'REMOTE',
    durationMonths: 3,
    stipend: 20000,
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['React Native', 'JavaScript'],
    preferredSkills: ['TypeScript', 'Git'],
    deadlineDays: 30,
  },
  {
    companyIndex: 2,
    title: 'Demo Cybersecurity Intern',
    description:
      'Assist the security team with vulnerability triage, OWASP-style code review, and internal awareness content. Great fit for students curious about applied security in a fintech context.',
    location: 'Mumbai, India',
    workMode: 'HYBRID',
    durationMonths: 4,
    stipend: 22000,
    minCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    eligibleGradYears: [2025, 2026],
    requiredSkills: ['OWASP', 'Problem Solving'],
    preferredSkills: ['Python', 'Communication'],
    deadlineDays: 35,
  },
];

interface TrainingSeed {
  title: string;
  description: string;
  provider: string;
  skills: string[];
  durationWeeks: number;
  startDays: number;
  endDays: number;
  registrationDeadlineDays: number;
  registrationUrl: string;
}

const TRAINING_SEEDS: TrainingSeed[] = [
  {
    title: 'Demo AWS Fundamentals',
    description:
      'Practical introduction to AWS core services, IAM, networking, and cost fundamentals with hands-on labs.',
    provider: 'Demo Cloud Academy',
    skills: ['AWS', 'CI/CD'],
    durationWeeks: 4,
    startDays: 14,
    endDays: 42,
    registrationDeadlineDays: 10,
    registrationUrl: 'https://training.demo/register/aws-fundamentals',
  },
  {
    title: 'Demo React Advanced Patterns',
    description:
      'Deep-dive into advanced React patterns: composition, hooks, performance profiling, and testing.',
    provider: 'Demo Frontend Guild',
    skills: ['React', 'TypeScript', 'JavaScript'],
    durationWeeks: 6,
    startDays: 21,
    endDays: 63,
    registrationDeadlineDays: 14,
    registrationUrl: 'https://training.demo/register/react-advanced',
  },
  {
    title: 'Demo Python for Data Science',
    description:
      'Applied Python for data science covering Pandas, NumPy, scikit-learn, and end-to-end notebook workflows.',
    provider: 'Demo Data School',
    skills: ['Python', 'Pandas', 'NumPy', 'scikit-learn'],
    durationWeeks: 8,
    startDays: 30,
    endDays: 86,
    registrationDeadlineDays: 21,
    registrationUrl: 'https://training.demo/register/python-ds',
  },
  {
    title: 'Demo DevOps with Docker & Kubernetes',
    description:
      'Hands-on DevOps program covering Docker, Kubernetes, and CI/CD pipelines on a cloud environment.',
    provider: 'Demo Platform Academy',
    skills: ['Docker', 'Kubernetes', 'CI/CD'],
    durationWeeks: 6,
    startDays: 20,
    endDays: 62,
    registrationDeadlineDays: 12,
    registrationUrl: 'https://training.demo/register/devops-dk',
  },
  {
    title: 'Demo Communication Skills for Engineers',
    description:
      'Workshop-style program on written, verbal, and cross-team communication tailored for engineering contexts.',
    provider: 'Demo Career Studio',
    skills: ['Communication', 'Teamwork', 'Leadership'],
    durationWeeks: 3,
    startDays: 10,
    endDays: 31,
    registrationDeadlineDays: 7,
    registrationUrl: 'https://training.demo/register/communication',
  },
];

interface CreatedUser {
  userId: Types.ObjectId;
  email: string;
}

interface CreatedCompany extends CreatedUser {
  companyId: Types.ObjectId;
}

interface CreatedStudent extends CreatedUser {
  studentId: Types.ObjectId;
  seed: StudentSeed;
  skillIds: Types.ObjectId[];
}

interface FacultySeed {
  email: string;
  fullName: string;
  designation: string;
  department: string;
  qualifications: string[];
  researchInterests: string[];
  bio: string;
  city: string;
  state: string;
}

const FACULTY_SEEDS: FacultySeed[] = [
  {
    email: 'dr.sharma@demo.edu',
    fullName: 'Dr. Anita Sharma',
    designation: 'Professor',
    department: 'CSE',
    qualifications: ['Ph.D. Computer Science', 'M.Tech CSE'],
    researchInterests: ['Distributed Systems', 'Machine Learning', 'Databases'],
    bio: 'Professor of Computer Science with 15+ years of teaching and industry-linked research experience.',
    city: 'Bengaluru',
    state: 'Karnataka',
  },
  {
    email: 'dr.iyer@demo.edu',
    fullName: 'Dr. Rajesh Iyer',
    designation: 'Associate Professor',
    department: 'Mechanical',
    qualifications: ['Ph.D. Mechanical Engineering', 'M.E. Design Engineering'],
    researchInterests: ['Robotics', 'Manufacturing Systems', 'CAD Automation'],
    bio: 'Associate Professor with an active research agenda in robotics and manufacturing systems.',
    city: 'Bengaluru',
    state: 'Karnataka',
  },
];

interface CreatedFaculty extends CreatedUser {
  facultyProfileId: Types.ObjectId;
}

async function seedInstitution(): Promise<Types.ObjectId> {
  const doc = await Institution.create({
    name: 'Demo University',
    code: 'DEMOUNIV',
    domain: 'demo.edu',
    address: '123 Demo Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    contactEmail: 'registrar@demo.edu',
    verificationStatus: 'VERIFIED',
    verifiedAt: new Date(),
  });
  return doc._id as Types.ObjectId;
}

async function seedUsers(
  passwordHash: string,
  institutionId: Types.ObjectId,
): Promise<{
  admin: CreatedUser;
  companies: CreatedCompany[];
  students: CreatedStudent[];
  faculty: CreatedFaculty[];
  institutionUser: CreatedUser;
}> {
  const admin = await User.create({
    email: 'admin@aip.demo',
    passwordHash,
    role: 'ADMIN',
    isActive: true,
  });

  const companies: CreatedCompany[] = [];
  for (const seed of COMPANY_SEEDS) {
    const user = await User.create({
      email: seed.email,
      passwordHash,
      role: 'COMPANY',
      isActive: true,
    });
    const profile = await CompanyProfile.create({
      user: user._id,
      companyName: seed.companyName,
      description: seed.description,
      industry: seed.industry,
      website: seed.website,
      location: seed.hqLocation,
      companySize: seed.companySize,
      foundedYear: seed.foundedYear,
      verifiedAt: seed.verifiedAt,
    });
    companies.push({
      userId: user._id as Types.ObjectId,
      email: user.email as string,
      companyId: profile._id as Types.ObjectId,
    });
  }

  const students: CreatedStudent[] = [];
  for (const seed of STUDENT_SEEDS) {
    const user = await User.create({
      email: seed.email,
      passwordHash,
      role: 'STUDENT',
      isActive: true,
    });
    const profile = await StudentProfile.create({
      user: user._id,
      institution: institutionId,
      ...studentRichProfile(seed),
    });
    students.push({
      userId: user._id as Types.ObjectId,
      email: user.email as string,
      studentId: profile._id as Types.ObjectId,
      seed,
      skillIds: [],
    });
  }

  const faculty: CreatedFaculty[] = [];
  for (const seed of FACULTY_SEEDS) {
    const user = await User.create({
      email: seed.email,
      passwordHash,
      role: 'FACULTY',
      isActive: true,
      institution: institutionId,
    });
    const profile = await FacultyProfile.create({
      user: user._id,
      institution: institutionId,
      fullName: seed.fullName,
      designation: seed.designation,
      department: seed.department,
      qualifications: seed.qualifications,
      researchInterests: seed.researchInterests,
      bio: seed.bio,
      city: seed.city,
      state: seed.state,
    });
    faculty.push({
      userId: user._id as Types.ObjectId,
      email: user.email as string,
      facultyProfileId: profile._id as Types.ObjectId,
    });
  }

  const institutionUser = await User.create({
    email: 'registrar@demo.edu',
    passwordHash,
    role: 'INSTITUTION',
    isActive: true,
    institution: institutionId,
  });

  return {
    admin: { userId: admin._id as Types.ObjectId, email: admin.email as string },
    companies,
    students,
    faculty,
    institutionUser: {
      userId: institutionUser._id as Types.ObjectId,
      email: institutionUser.email as string,
    },
  };
}

async function seedStudentSkills(students: CreatedStudent[], skills: SkillMap): Promise<void> {
  const rows: Array<{
    student: Types.ObjectId;
    skill: Types.ObjectId;
    proficiency: Proficiency;
    yearsExperience: number;
  }> = [];
  for (const s of students) {
    const owned: Types.ObjectId[] = [];
    for (const sk of s.seed.skills) {
      const id = skillId(skills, sk.name);
      owned.push(id);
      rows.push({
        student: s.studentId,
        skill: id,
        proficiency: sk.proficiency,
        yearsExperience: sk.years,
      });
    }
    s.skillIds = owned;
  }
  await StudentSkill.insertMany(rows);
}

interface CreatedJob {
  jobId: Types.ObjectId;
  companyIndex: number;
  seed: JobSeed;
  requiredIds: Types.ObjectId[];
  preferredIds: Types.ObjectId[];
}

async function seedJobs(companies: CreatedCompany[], skills: SkillMap): Promise<CreatedJob[]> {
  const created: CreatedJob[] = [];
  for (const seed of JOB_SEEDS) {
    const requiredIds = skillIdsOf(skills, seed.requiredSkills);
    const preferredIds = skillIdsOf(skills, seed.preferredSkills);
    const doc = await Job.create({
      company: companies[seed.companyIndex]!.companyId,
      title: seed.title,
      description: seed.description,
      location: seed.location,
      workMode: seed.workMode,
      employmentType: seed.employmentType,
      salary: seed.salary,
      minCgpa: seed.minCgpa,
      eligibleBranches: seed.eligibleBranches,
      eligibleGradYears: seed.eligibleGradYears,
      requiredSkills: requiredIds,
      preferredSkills: preferredIds,
      applicationDeadline: daysFromNow(seed.deadlineDays),
      openings: 3,
      status: seed.status,
    });
    created.push({
      jobId: doc._id as Types.ObjectId,
      companyIndex: seed.companyIndex,
      seed,
      requiredIds,
      preferredIds,
    });
  }
  return created;
}

interface CreatedInternship {
  internshipId: Types.ObjectId;
  companyIndex: number;
  seed: InternshipSeed;
  requiredIds: Types.ObjectId[];
  preferredIds: Types.ObjectId[];
}

async function seedInternships(
  companies: CreatedCompany[],
  skills: SkillMap,
): Promise<CreatedInternship[]> {
  const created: CreatedInternship[] = [];
  for (const seed of INTERNSHIP_SEEDS) {
    const requiredIds = skillIdsOf(skills, seed.requiredSkills);
    const preferredIds = skillIdsOf(skills, seed.preferredSkills);
    const doc = await Internship.create({
      company: companies[seed.companyIndex]!.companyId,
      title: seed.title,
      description: seed.description,
      location: seed.location,
      workMode: seed.workMode,
      durationMonths: seed.durationMonths,
      stipend: seed.stipend,
      currency: 'INR',
      minCgpa: seed.minCgpa,
      eligibleBranches: seed.eligibleBranches,
      eligibleGradYears: seed.eligibleGradYears,
      requiredSkills: requiredIds,
      preferredSkills: preferredIds,
      applicationDeadline: daysFromNow(seed.deadlineDays),
      openings: 2,
      status: 'PUBLISHED',
    });
    created.push({
      internshipId: doc._id as Types.ObjectId,
      companyIndex: seed.companyIndex,
      seed,
      requiredIds,
      preferredIds,
    });
  }
  return created;
}

async function seedTrainings(skills: SkillMap): Promise<void> {
  const rows = TRAINING_SEEDS.map((t) => ({
    title: t.title,
    description: t.description,
    provider: t.provider,
    skills: skillIdsOf(skills, t.skills),
    durationWeeks: t.durationWeeks,
    startDate: daysFromNow(t.startDays),
    endDate: daysFromNow(t.endDays),
    registrationDeadline: daysFromNow(t.registrationDeadlineDays),
    registrationUrl: t.registrationUrl,
    status: 'ACTIVE',
  }));
  await TrainingProgram.insertMany(rows);
}

interface ApplicationBlueprint {
  studentEmail: string;
  jobTitle?: string;
  internshipTitle?: string;
  status: ApplicationStatus;
  note?: string;
  timelineStatuses: ApplicationStatus[];
}

const APPLICATION_BLUEPRINTS: ApplicationBlueprint[] = [
  {
    studentEmail: 'arya@demo.edu',
    jobTitle: 'Demo Frontend Engineer',
    status: 'SHORTLISTED',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'],
  },
  {
    studentEmail: 'arya@demo.edu',
    internshipTitle: 'Demo Cloud DevOps Intern',
    status: 'INTERVIEW_SCHEDULED',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED'],
  },
  {
    studentEmail: 'rohan@demo.edu',
    jobTitle: 'Demo Backend Engineer',
    status: 'UNDER_REVIEW',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW'],
  },
  {
    studentEmail: 'priya@demo.edu',
    jobTitle: 'Demo ML Engineer',
    status: 'SELECTED',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'SELECTED'],
  },
  {
    studentEmail: 'priya@demo.edu',
    internshipTitle: 'Demo Data Science Intern',
    status: 'INTERVIEW_SCHEDULED',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW', 'INTERVIEW_SCHEDULED'],
  },
  {
    studentEmail: 'divya@demo.edu',
    internshipTitle: 'Demo Data Science Intern',
    status: 'APPLIED',
    timelineStatuses: ['APPLIED'],
  },
  {
    studentEmail: 'sneha@demo.edu',
    jobTitle: 'Demo Full-Stack Developer',
    status: 'REJECTED',
    note: 'Thanks for applying — team already filled the role for this cycle.',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW', 'REJECTED'],
  },
  {
    studentEmail: 'rohan@demo.edu',
    internshipTitle: 'Demo Backend Intern',
    status: 'SHORTLISTED',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'],
  },
  {
    studentEmail: 'divya@demo.edu',
    jobTitle: 'Demo Data Scientist',
    status: 'UNDER_REVIEW',
    timelineStatuses: ['APPLIED', 'UNDER_REVIEW'],
  },
  {
    studentEmail: 'karan@demo.edu',
    internshipTitle: 'Demo Cybersecurity Intern',
    status: 'APPLIED',
    timelineStatuses: ['APPLIED'],
  },
];

interface CreatedApplication {
  appId: Types.ObjectId;
  studentUserId: Types.ObjectId;
  studentId: Types.ObjectId;
  opportunityTitle: string;
  companyIndex: number;
  status: ApplicationStatus;
}

async function seedApplications(
  students: CreatedStudent[],
  jobs: CreatedJob[],
  internships: CreatedInternship[],
): Promise<CreatedApplication[]> {
  const created: CreatedApplication[] = [];

  for (const bp of APPLICATION_BLUEPRINTS) {
    const student = students.find((s) => s.email === bp.studentEmail);
    if (!student) throw new Error(`Missing student: ${bp.studentEmail}`);

    let opportunityType: 'JOB' | 'INTERNSHIP';
    let opportunityId: Types.ObjectId;
    let requiredIds: Types.ObjectId[];
    let preferredIds: Types.ObjectId[];
    let opportunityTitle: string;
    let companyIndex: number;

    if (bp.jobTitle) {
      const job = jobs.find((j) => j.seed.title === bp.jobTitle);
      if (!job) throw new Error(`Missing job: ${bp.jobTitle}`);
      opportunityType = 'JOB';
      opportunityId = job.jobId;
      requiredIds = job.requiredIds;
      preferredIds = job.preferredIds;
      opportunityTitle = job.seed.title;
      companyIndex = job.companyIndex;
    } else if (bp.internshipTitle) {
      const intern = internships.find((i) => i.seed.title === bp.internshipTitle);
      if (!intern) throw new Error(`Missing internship: ${bp.internshipTitle}`);
      opportunityType = 'INTERNSHIP';
      opportunityId = intern.internshipId;
      requiredIds = intern.requiredIds;
      preferredIds = intern.preferredIds;
      opportunityTitle = intern.seed.title;
      companyIndex = intern.companyIndex;
    } else {
      throw new Error('Blueprint missing jobTitle/internshipTitle');
    }

    const match = computeMatch(
      student.skillIds.map(String),
      requiredIds.map(String),
      preferredIds.map(String),
    );

    const spanDays = Math.max(1, bp.timelineStatuses.length - 1) * 2;
    const timeline = bp.timelineStatuses.map((status, idx) => ({
      status,
      at: daysAgo(spanDays - idx * 2),
      ...(status === 'REJECTED' && bp.note ? { note: bp.note } : {}),
    }));

    const appDoc = await Application.create({
      student: student.studentId,
      opportunityType,
      opportunity: opportunityId,
      status: bp.status,
      matchScore: match.score,
      timeline,
    });

    created.push({
      appId: appDoc._id as Types.ObjectId,
      studentUserId: student.userId,
      studentId: student.studentId,
      opportunityTitle,
      companyIndex,
      status: bp.status,
    });
  }

  return created;
}

async function seedInterviews(applications: CreatedApplication[]): Promise<number> {
  const scheduled = applications.filter((a) => a.status === 'INTERVIEW_SCHEDULED');
  let count = 0;
  for (const app of scheduled) {
    await Interview.create({
      application: app.appId,
      mode: 'ONLINE',
      scheduledAt: daysFromNow(5),
      durationMinutes: 45,
      meetingLink: `https://meet.demo/${String(app.appId).slice(-6)}`,
      interviewer: 'Demo Recruiter',
      notes: 'Please join 5 minutes early; interview covers fundamentals and one applied problem.',
      status: 'SCHEDULED',
    });
    count += 1;
  }
  return count;
}

async function seedNotifications(
  applications: CreatedApplication[],
  companies: CreatedCompany[],
  students: CreatedStudent[],
): Promise<number> {
  const notifs: Array<Record<string, unknown>> = [];

  for (const app of applications) {
    const companyUserId = companies[app.companyIndex]!.userId;
    notifs.push({
      user: companyUserId,
      type: 'ANNOUNCEMENT',
      title: 'New application received',
      body: `A student applied to ${app.opportunityTitle}.`,
      // Must match the real route: `/company/applicants/:id`, not `/company/applications/:id`.
      link: `/company/applicants/${String(app.appId)}`,
      readAt: null,
    });
    notifs.push({
      user: app.studentUserId,
      type: 'APPLICATION_STATUS_CHANGED',
      title: 'Application update',
      body: `Your application for ${app.opportunityTitle} is now ${app.status}.`,
      link: `/student/applications/${String(app.appId)}`,
      readAt: app.status === 'REJECTED' ? daysAgo(1) : null,
    });
    if (app.status === 'INTERVIEW_SCHEDULED') {
      notifs.push({
        user: app.studentUserId,
        type: 'INTERVIEW_SCHEDULED',
        title: 'Interview scheduled',
        body: `An interview has been scheduled for ${app.opportunityTitle}.`,
        link: `/student/applications/${String(app.appId)}`,
        readAt: null,
      });
    }
  }

  for (const s of students.slice(0, 3)) {
    notifs.push({
      user: s.userId,
      type: 'NEW_MATCHING_JOB',
      title: 'New job matches your profile',
      body: 'A new role has been posted matching your skills. Take a look and apply.',
      link: '/student/recommendations/jobs',
      readAt: daysAgo(3),
    });
  }

  const valid = notifs.filter((n) => {
    const type = n.type as string;
    return [
      'NEW_MATCHING_JOB',
      'APPLICATION_STATUS_CHANGED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_UPDATED',
      'APPLICATION_SELECTED',
      'APPLICATION_REJECTED',
      'NEW_INTERNSHIP',
      'ANNOUNCEMENT',
    ].includes(type);
  });

  await Notification.insertMany(valid);
  return valid.length;
}

interface DemoDocSeed {
  documentType: 'CERTIFICATE' | 'INTERNSHIP_REPORT' | 'ACADEMIC_RECORD';
  title: string;
  issuer: string;
  issuedDaysAgo: number;
}

const ARYA_DOC_SEEDS: DemoDocSeed[] = [
  {
    documentType: 'CERTIFICATE',
    title: 'AWS Cloud Practitioner',
    issuer: 'Amazon Web Services',
    issuedDaysAgo: 120,
  },
  {
    documentType: 'CERTIFICATE',
    title: 'React Advanced Patterns',
    issuer: 'Demo Frontend Guild',
    issuedDaysAgo: 90,
  },
  {
    documentType: 'INTERNSHIP_REPORT',
    title: 'Demo Technologies Summer Internship Report',
    issuer: 'Demo Technologies',
    issuedDaysAgo: 200,
  },
  {
    documentType: 'ACADEMIC_RECORD',
    title: 'Semester 6 Transcript',
    issuer: 'Demo Institute of Technology',
    issuedDaysAgo: 60,
  },
];

async function seedDemoDocuments(students: CreatedStudent[], admin: CreatedUser): Promise<number> {
  const arya = students.find((s) => s.email === 'arya@demo.edu');
  if (!arya) return 0;

  const rows = ARYA_DOC_SEEDS.map((d) => ({
    user: arya.userId,
    documentType: d.documentType,
    filename: `${d.title.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`,
    data: Buffer.from(`Demo ${d.documentType} for ${arya.seed.fullName}: ${d.title}`, 'utf-8'),
    mimeType: 'text/plain',
    sizeBytes: Buffer.byteLength(
      `Demo ${d.documentType} for ${arya.seed.fullName}: ${d.title}`,
      'utf-8',
    ),
    title: d.title,
    issuer: d.issuer,
    issuedDate: daysAgo(d.issuedDaysAgo),
    verificationStatus: 'VERIFIED' as const,
    verifiedBy: admin.userId,
    verifiedAt: daysAgo(Math.max(1, d.issuedDaysAgo - 7)),
  }));

  await DocumentModel.insertMany(rows);
  return rows.length;
}

async function seedMentorshipData(
  admin: CreatedUser,
  companies: CreatedCompany[],
  students: CreatedStudent[],
  faculty: CreatedFaculty[],
): Promise<{ mentors: number; requests: number }> {
  const demoTechHr = companies[0];
  const drSharma = faculty.find((f) => f.email === 'dr.sharma@demo.edu');
  if (!demoTechHr || !drSharma) return { mentors: 0, requests: 0 };

  await MentorProfile.insertMany([
    {
      user: demoTechHr.userId,
      bio: 'Senior engineering leader at Demo Technologies with a passion for mentoring early-career engineers on product engineering craft.',
      expertise: ['react', 'typescript', 'node.js', 'system design'],
      yearsExperience: 12,
      mentorshipCapacity: 4,
      availability: 'AVAILABLE',
    },
    {
      user: drSharma.userId,
      bio: 'Professor of Computer Science mentoring students on research, distributed systems, and academic project work.',
      expertise: ['distributed systems', 'databases', 'machine learning', 'research methodology'],
      yearsExperience: 18,
      mentorshipCapacity: 5,
      availability: 'AVAILABLE',
    },
    {
      user: admin.userId,
      bio: 'Platform administrator available for guidance on careers, portal usage, and general mentorship.',
      expertise: ['career guidance', 'portfolio review'],
      yearsExperience: 8,
      mentorshipCapacity: 3,
      availability: 'AVAILABLE',
    },
  ]);

  const arya = students.find((s) => s.email === 'arya@demo.edu');
  const rohan = students.find((s) => s.email === 'rohan@demo.edu');
  if (!arya || !rohan) return { mentors: 3, requests: 0 };

  const aryaReq = await MentorshipRequest.create({
    mentee: arya.userId,
    menteeRole: 'STUDENT',
    mentor: drSharma.userId,
    status: 'ACTIVE',
    initialMessage:
      'Hi Dr. Sharma, I would love your guidance on a distributed systems capstone project I am starting this semester.',
    goals: 'Learn how to design a fault-tolerant service and receive weekly feedback on progress.',
    startedAt: daysAgo(10),
  });
  await MentorshipRequest.create({
    mentee: rohan.userId,
    menteeRole: 'STUDENT',
    mentor: demoTechHr.userId,
    status: 'REQUESTED',
    initialMessage:
      'Hi, I am a backend engineering student and would appreciate mentorship on Node.js production practices and career guidance.',
    goals: 'Get feedback on my open-source projects and career direction.',
  });

  await MentorshipMessage.insertMany([
    {
      request: aryaReq._id,
      sender: arya.userId,
      body: 'Thanks for accepting! Here is a rough outline of the capstone I would like your feedback on.',
    },
    {
      request: aryaReq._id,
      sender: drSharma.userId,
      body: 'Happy to help. Send over the outline and we can review it in our first session.',
    },
  ]);

  return { mentors: 3, requests: 2 };
}

async function seedInterimReports(
  applications: CreatedApplication[],
  students: CreatedStudent[],
): Promise<number> {
  const selected = applications.find((a) => a.status === 'SELECTED');
  if (!selected) return 0;
  const student = students.find((s) => String(s.studentId) === String(selected.studentId));
  if (!student) return 0;

  const rows = [
    {
      weekNumber: 1,
      periodStart: daysAgo(21),
      periodEnd: daysAgo(14),
      workDescription:
        'Onboarding, dev environment setup, and initial pairing on a small evaluation task.',
      learnings: 'Learned the internal CI pipeline and coding standards.',
      challenges: 'Getting familiar with a large codebase took longer than expected.',
      hoursSpent: 40,
    },
    {
      weekNumber: 2,
      periodStart: daysAgo(14),
      periodEnd: daysAgo(7),
      workDescription: 'Contributed a first feature spike behind a flag with test coverage.',
      learnings: 'Practiced writing focused unit and integration tests.',
      challenges: 'Reasoning about async race conditions in the pipeline.',
      hoursSpent: 42,
    },
    {
      weekNumber: 3,
      periodStart: daysAgo(7),
      periodEnd: daysAgo(0),
      workDescription:
        'Shipped the flagged feature to production and monitored dashboards during rollout.',
      learnings: 'Observability practices during a rollout and rollback protocol.',
      challenges: 'Interpreting noisy latency metrics under low traffic.',
      hoursSpent: 38,
    },
  ];

  await InterimReport.insertMany(
    rows.map((r) => ({
      application: selected.appId,
      student: student.studentId,
      ...r,
      submittedAt: r.periodEnd,
    })),
  );
  return rows.length;
}

interface CreatedEvent {
  eventId: Types.ObjectId;
  title: string;
}

async function seedCollaborationEvents(
  admin: CreatedUser,
  companies: CreatedCompany[],
  institutionId: Types.ObjectId,
  institutionUser: CreatedUser,
): Promise<CreatedEvent[]> {
  const [demoTech, demoCloud, demoFintech] = companies;
  if (!demoTech || !demoCloud || !demoFintech) return [];
  void admin;
  const events = await CollaborationEvent.insertMany([
    {
      title: 'Modern React Patterns Workshop',
      description:
        'Hands-on workshop covering advanced React patterns, performance profiling, and TypeScript integration. Bring a laptop.',
      eventType: 'WORKSHOP',
      hostType: 'COMPANY',
      host: demoTech.companyId,
      postedBy: demoTech.userId,
      startAt: daysFromNow(14),
      endAt: daysFromNow(14),
      location: 'Bengaluru, India',
      mode: 'ONSITE',
      capacity: 40,
      registeredCount: 0,
      registrationDeadline: daysFromNow(10),
      targetAudience: ['STUDENT', 'FACULTY'],
      tags: ['react', 'frontend', 'typescript'],
      status: 'PUBLISHED',
    },
    {
      title: 'Guest Lecture: Distributed Systems in Practice',
      description:
        'Guest lecture by a Demo University faculty member on real-world distributed systems, tradeoffs, and case studies from industry.',
      eventType: 'GUEST_LECTURE',
      hostType: 'INSTITUTION',
      host: institutionId,
      postedBy: institutionUser.userId,
      startAt: daysFromNow(21),
      endAt: daysFromNow(21),
      location: 'Online',
      mode: 'ONLINE',
      meetingLink: 'https://meet.demo/lecture-distsys',
      capacity: 200,
      registeredCount: 0,
      registrationDeadline: daysFromNow(18),
      targetAudience: ['STUDENT', 'FACULTY'],
      tags: ['distributed-systems', 'guest-lecture'],
      status: 'PUBLISHED',
    },
    {
      title: 'Fintech Innovation Challenge',
      description:
        'Two-day innovation challenge on payments and risk. Compete in small teams to design and demo a working prototype for a real customer problem.',
      eventType: 'INNOVATION_CHALLENGE',
      hostType: 'COMPANY',
      host: demoFintech.companyId,
      postedBy: demoFintech.userId,
      startAt: daysFromNow(30),
      endAt: daysFromNow(31),
      location: 'Mumbai, India',
      mode: 'HYBRID',
      capacity: 60,
      registeredCount: 0,
      registrationDeadline: daysFromNow(25),
      targetAudience: ['STUDENT', 'FACULTY'],
      tags: ['fintech', 'innovation', 'hackathon'],
      status: 'PUBLISHED',
    },
    {
      title: 'Live Project: Cloud Migration for a Nonprofit',
      description:
        'Live client engagement to help a nonprofit migrate their legacy stack to a modern cloud environment. Mentored by Demo Cloud engineers.',
      eventType: 'LIVE_PROJECT',
      hostType: 'COMPANY',
      host: demoCloud.companyId,
      postedBy: demoCloud.userId,
      startAt: daysFromNow(7),
      endAt: daysFromNow(45),
      location: 'Remote',
      mode: 'ONLINE',
      meetingLink: 'https://meet.demo/live-project-nonprofit',
      capacity: 10,
      registeredCount: 0,
      registrationDeadline: daysFromNow(5),
      targetAudience: ['STUDENT'],
      tags: ['cloud', 'live-project', 'aws'],
      status: 'PUBLISHED',
    },
  ]);
  return events.map((e) => ({ eventId: e._id as Types.ObjectId, title: String(e.title) }));
}

async function seedEventRegistrations(
  events: CreatedEvent[],
  students: CreatedStudent[],
): Promise<number> {
  if (events.length === 0) return 0;
  const arya = students.find((s) => s.email === 'arya@demo.edu');
  const rohan = students.find((s) => s.email === 'rohan@demo.edu');
  const registrations: Array<{ event: Types.ObjectId; user: Types.ObjectId }> = [];
  if (arya && events[0]) {
    registrations.push({ event: events[0].eventId, user: arya.userId });
  }
  if (rohan && events[2]) {
    registrations.push({ event: events[2].eventId, user: rohan.userId });
  }
  if (registrations.length === 0) return 0;
  await EventRegistration.insertMany(registrations);
  for (const reg of registrations) {
    await CollaborationEvent.updateOne({ _id: reg.event }, { $inc: { registeredCount: 1 } });
  }
  return registrations.length;
}

async function seedAptitude(
  students: CreatedStudent[],
): Promise<{ questions: number; tests: number }> {
  const { ALL_APTITUDE_QUESTIONS } = await import('../seedData/aptitude');
  const inserted = await AptitudeQuestion.insertMany(
    ALL_APTITUDE_QUESTIONS.map((q) => ({
      category: q.category,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      difficulty: q.difficulty,
      explanation: q.explanation,
      tags: q.tags ?? [],
      status: 'ACTIVE' as const,
    })),
  );

  const arya = students.find((s) => s.email === 'arya@demo.edu');
  if (!arya) return { questions: inserted.length, tests: 0 };

  const quantQuestions = inserted.filter((q) => (q.category as string) === 'QUANT').slice(0, 15);
  if (quantQuestions.length === 0) return { questions: inserted.length, tests: 0 };

  const total = quantQuestions.length;
  const correctCount = Math.round((73 / 100) * total);
  const answered = quantQuestions.map((q, i) => {
    const isRight = i < correctCount;
    return {
      questionId: q._id,
      chosenIndex: isRight ? Number(q.correctIndex) : (Number(q.correctIndex) + 1) % 4,
      correct: isRight,
    };
  });

  const startedAt = daysAgo(3);
  const submittedAt = new Date(startedAt.getTime() + 25 * 60 * 1000);
  await AptitudeTest.create({
    student: arya.studentId,
    user: arya.userId,
    category: 'QUANT',
    questions: answered,
    totalQuestions: total,
    correctCount,
    score: 73,
    passingScore: 60,
    passed: true,
    status: 'SUBMITTED',
    startedAt,
    expiresAt: new Date(startedAt.getTime() + 30 * 60 * 1000),
    submittedAt,
    durationSeconds: 1800,
  });

  return { questions: inserted.length, tests: 1 };
}

async function summary(): Promise<Record<string, number>> {
  const [
    users,
    studentProfiles,
    companyProfiles,
    facultyProfiles,
    institutions,
    skills,
    studentSkills,
    jobs,
    internships,
    applications,
    savedOpportunities,
    interviews,
    trainings,
    notifications,
    resumes,
    auditLogs,
    documents,
    mentors,
    mentorshipRequests,
    interimReports,
    events,
    eventRegistrations,
    aptitudeQuestions,
    aptitudeTests,
    facultyOpportunities,
  ] = await Promise.all([
    User.countDocuments(),
    StudentProfile.countDocuments(),
    CompanyProfile.countDocuments(),
    FacultyProfile.countDocuments(),
    Institution.countDocuments(),
    Skill.countDocuments(),
    StudentSkill.countDocuments(),
    Job.countDocuments(),
    Internship.countDocuments(),
    Application.countDocuments(),
    SavedOpportunity.countDocuments(),
    Interview.countDocuments(),
    TrainingProgram.countDocuments(),
    Notification.countDocuments(),
    Resume.countDocuments(),
    AuditLog.countDocuments(),
    DocumentModel.countDocuments(),
    MentorProfile.countDocuments(),
    MentorshipRequest.countDocuments(),
    InterimReport.countDocuments(),
    CollaborationEvent.countDocuments(),
    EventRegistration.countDocuments(),
    AptitudeQuestion.countDocuments(),
    AptitudeTest.countDocuments(),
    FacultyOpportunity.countDocuments(),
  ]);
  return {
    users,
    studentProfiles,
    companyProfiles,
    facultyProfiles,
    institutions,
    skills,
    studentSkills,
    jobs,
    internships,
    applications,
    savedOpportunities,
    interviews,
    trainings,
    notifications,
    resumes,
    auditLogs,
    documents,
    mentors,
    mentorshipRequests,
    interimReports,
    events,
    eventRegistrations,
    aptitudeQuestions,
    aptitudeTests,
    facultyOpportunities,
  };
}

interface CreatedFacultyOpp {
  oppId: Types.ObjectId;
  title: string;
  hostType: 'COMPANY' | 'INSTITUTION';
}

async function seedFacultyOpportunities(
  companies: CreatedCompany[],
  institutionId: Types.ObjectId,
  institutionUser: CreatedUser,
): Promise<CreatedFacultyOpp[]> {
  const demoTech = companies[0];
  if (!demoTech) throw new Error('Missing Demo Technologies company');

  const seeds: Array<{
    title: string;
    description: string;
    opportunityType: 'FDP' | 'CONSULTANCY' | 'FACULTY_INTERNSHIP' | 'COLLABORATIVE_RESEARCH';
    hostType: 'COMPANY' | 'INSTITUTION';
    host: Types.ObjectId;
    postedBy: Types.ObjectId;
    requiredExpertise: string[];
    preferredQualifications: string[];
    durationWeeks?: number;
    stipend?: { amount: number; currency: string };
    location: string;
    mode: 'REMOTE' | 'HYBRID' | 'ONSITE';
    deadlineDays: number;
    openings: number;
    targetRoles: Array<'STUDENT' | 'FACULTY'>;
    status: 'PUBLISHED';
  }> = [
    {
      title: 'Demo FDP on Cloud-Native Systems',
      description:
        'A 4-week Faculty Development Program delivered by Demo Technologies engineers covering cloud-native architecture, container orchestration, and CI/CD pipelines. Includes hands-on labs and applied case studies.',
      opportunityType: 'FDP',
      hostType: 'COMPANY',
      host: demoTech.companyId,
      postedBy: demoTech.userId,
      requiredExpertise: ['Cloud', 'Distributed Systems'],
      preferredQualifications: ['Ph.D. in Computer Science or related field'],
      durationWeeks: 4,
      stipend: { amount: 25000, currency: 'INR' },
      location: 'Bengaluru, India',
      mode: 'HYBRID',
      deadlineDays: 45,
      openings: 20,
      targetRoles: ['FACULTY'],
      status: 'PUBLISHED',
    },
    {
      title: 'Demo Industry Consultancy — AI Adoption',
      description:
        'Short-term consultancy engagement for faculty to advise on AI adoption strategy across Demo Technologies product surfaces. Weekly working sessions with product and platform teams.',
      opportunityType: 'CONSULTANCY',
      hostType: 'COMPANY',
      host: demoTech.companyId,
      postedBy: demoTech.userId,
      requiredExpertise: ['Machine Learning', 'Product Strategy'],
      preferredQualifications: ['5+ years faculty experience', 'Prior industry collaborations'],
      durationWeeks: 12,
      stipend: { amount: 150000, currency: 'INR' },
      location: 'Remote',
      mode: 'REMOTE',
      deadlineDays: 30,
      openings: 3,
      targetRoles: ['FACULTY'],
      status: 'PUBLISHED',
    },
    {
      title: 'Demo University Faculty Internship — Industry Immersion',
      description:
        'Six-month faculty internship at Demo University partner labs enabling immersion in current research areas. Structured mentorship and access to lab infrastructure included.',
      opportunityType: 'FACULTY_INTERNSHIP',
      hostType: 'INSTITUTION',
      host: institutionId,
      postedBy: institutionUser.userId,
      requiredExpertise: ['Research Methodology'],
      preferredQualifications: ['Active publication record'],
      durationWeeks: 24,
      location: 'Bengaluru, India',
      mode: 'ONSITE',
      deadlineDays: 60,
      openings: 5,
      targetRoles: ['FACULTY'],
      status: 'PUBLISHED',
    },
    {
      title: 'Demo University Collaborative Research on Robotics',
      description:
        'Joint research collaboration on robotics and manufacturing systems. Faculty investigators partner with Demo University research teams for a 6-month engagement.',
      opportunityType: 'COLLABORATIVE_RESEARCH',
      hostType: 'INSTITUTION',
      host: institutionId,
      postedBy: institutionUser.userId,
      requiredExpertise: ['Robotics', 'Manufacturing Systems'],
      preferredQualifications: ['Prior grant experience'],
      durationWeeks: 26,
      stipend: { amount: 200000, currency: 'INR' },
      location: 'Bengaluru, India',
      mode: 'HYBRID',
      deadlineDays: 90,
      openings: 4,
      targetRoles: ['FACULTY'],
      status: 'PUBLISHED',
    },
  ];

  const created: CreatedFacultyOpp[] = [];
  for (const seed of seeds) {
    const doc = await FacultyOpportunity.create({
      title: seed.title,
      description: seed.description,
      opportunityType: seed.opportunityType,
      hostType: seed.hostType,
      host: seed.host,
      postedBy: seed.postedBy,
      requiredExpertise: seed.requiredExpertise,
      preferredQualifications: seed.preferredQualifications,
      ...(seed.durationWeeks !== undefined ? { durationWeeks: seed.durationWeeks } : {}),
      ...(seed.stipend ? { stipend: seed.stipend } : {}),
      location: seed.location,
      mode: seed.mode,
      applicationDeadline: daysFromNow(seed.deadlineDays),
      openings: seed.openings,
      targetRoles: seed.targetRoles,
      status: seed.status,
    });
    created.push({
      oppId: doc._id as Types.ObjectId,
      title: seed.title,
      hostType: seed.hostType,
    });
  }
  return created;
}

async function seedFacultyApplications(
  facultyOpps: CreatedFacultyOpp[],
  faculty: CreatedFaculty[],
): Promise<number> {
  const drSharma = faculty.find((f) => f.email === 'dr.sharma@demo.edu');
  const drIyer = faculty.find((f) => f.email === 'dr.iyer@demo.edu');
  if (!drSharma || !drIyer) return 0;

  const fdp = facultyOpps.find((o) => o.title.includes('FDP'));
  const consultancy = facultyOpps.find((o) => o.title.includes('Consultancy'));
  if (!fdp || !consultancy) return 0;

  const rows: Array<{
    faculty: Types.ObjectId;
    opportunityType: 'FDP' | 'CONSULTANCY';
    opportunity: Types.ObjectId;
    status: 'APPLIED' | 'UNDER_REVIEW';
    matchScore: number;
    timeline: Array<{ status: 'APPLIED' | 'UNDER_REVIEW'; at: Date }>;
  }> = [
    {
      faculty: drSharma.facultyProfileId,
      opportunityType: 'FDP',
      opportunity: fdp.oppId,
      status: 'UNDER_REVIEW',
      matchScore: 60,
      timeline: [
        { status: 'APPLIED', at: daysAgo(4) },
        { status: 'UNDER_REVIEW', at: daysAgo(2) },
      ],
    },
    {
      faculty: drIyer.facultyProfileId,
      opportunityType: 'CONSULTANCY',
      opportunity: consultancy.oppId,
      status: 'APPLIED',
      matchScore: 40,
      timeline: [{ status: 'APPLIED', at: daysAgo(1) }],
    },
  ];

  await Application.insertMany(rows);
  return rows.length;
}

async function run(): Promise<void> {
  // Checked before connecting so an unsafe target fails fast and never opens a
  // handle to the database it was about to wipe.
  assertSafeToWipe();
  await connectDB();
  try {
    logger.info('Clearing existing collections');
    await clearAll();

    logger.info('Hashing demo password');
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    logger.info('Seeding institution');
    const institutionId = await seedInstitution();

    logger.info('Seeding skills');
    const skills = await seedSkills();

    logger.info('Seeding users and profiles');
    const { admin, companies, students, faculty, institutionUser } = await seedUsers(
      passwordHash,
      institutionId,
    );

    logger.info('Seeding student skills');
    await seedStudentSkills(students, skills);

    logger.info('Seeding jobs');
    const jobs = await seedJobs(companies, skills);

    logger.info('Seeding internships');
    const internships = await seedInternships(companies, skills);

    logger.info('Seeding training programs');
    await seedTrainings(skills);

    logger.info('Seeding applications');
    const applications = await seedApplications(students, jobs, internships);

    logger.info('Seeding interviews');
    await seedInterviews(applications);

    logger.info('Seeding notifications');
    await seedNotifications(applications, companies, students);

    logger.info('Seeding demo verified documents');
    await seedDemoDocuments(students, admin);

    logger.info('Seeding mentorship');
    await seedMentorshipData(admin, companies, students, faculty);

    logger.info('Seeding interim reports');
    await seedInterimReports(applications, students);

    logger.info('Seeding collaboration events');
    const events = await seedCollaborationEvents(admin, companies, institutionId, institutionUser);

    logger.info('Seeding event registrations');
    await seedEventRegistrations(events, students);

    logger.info('Seeding faculty opportunities');
    const facultyOpps = await seedFacultyOpportunities(companies, institutionId, institutionUser);

    logger.info('Seeding faculty applications');
    await seedFacultyApplications(facultyOpps, faculty);

    logger.info('Seeding aptitude questions and demo test');
    await seedAptitude(students);

    const counts = await summary();
    logger.info({ counts }, 'Seed complete');
  } finally {
    await disconnectDB();
  }
}

run().catch((err: unknown) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
