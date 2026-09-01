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
import type { SkillCategory, AptitudeCategory } from '@aip/config';
import { ALL_APTITUDE_QUESTIONS } from './seedData/aptitude';

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
  // ---------------------------------------------------------------------------
  // PROGRAMMING LANGUAGES
  // ---------------------------------------------------------------------------
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
    description: 'Systems language known for performance and low-level control.',
  },
  {
    name: 'C',
    category: 'PROGRAMMING',
    description:
      'Low-level procedural language foundational to operating systems and embedded systems.',
  },
  {
    name: 'C#',
    category: 'PROGRAMMING',
    description: 'Object-oriented language by Microsoft, used for .NET and game development.',
  },
  {
    name: 'Go',
    category: 'PROGRAMMING',
    description: 'Statically typed language designed for simplicity and concurrency.',
  },
  {
    name: 'Rust',
    category: 'PROGRAMMING',
    description: 'Systems language focused on safety and performance.',
  },
  {
    name: 'PHP',
    category: 'PROGRAMMING',
    description: 'Server-side scripting language widely used for web development.',
  },
  {
    name: 'Ruby',
    category: 'PROGRAMMING',
    description: 'Dynamic object-oriented language known for developer productivity.',
  },
  {
    name: 'Swift',
    category: 'PROGRAMMING',
    description: "Apple's language for iOS, macOS, and related platforms.",
  },
  {
    name: 'Kotlin',
    category: 'PROGRAMMING',
    description: 'Modern JVM language used for Android and server-side development.',
  },
  {
    name: 'Scala',
    category: 'PROGRAMMING',
    description: 'JVM language combining object-oriented and functional programming.',
  },
  {
    name: 'Dart',
    category: 'PROGRAMMING',
    description: 'Language optimized for UI, used by Flutter.',
  },
  {
    name: 'R',
    category: 'PROGRAMMING',
    description: 'Language for statistical computing and data analysis.',
  },
  {
    name: 'MATLAB',
    category: 'PROGRAMMING',
    description: 'Language and environment for numerical computing and visualization.',
  },
  {
    name: 'Perl',
    category: 'PROGRAMMING',
    description: 'Text-processing language used in system administration and bioinformatics.',
  },
  {
    name: 'Haskell',
    category: 'PROGRAMMING',
    description: 'Purely functional language known for type safety and concurrency.',
  },
  {
    name: 'Lua',
    category: 'PROGRAMMING',
    description: 'Lightweight scripting language used in embedded systems and games.',
  },
  {
    name: 'Assembly',
    category: 'PROGRAMMING',
    description: 'Low-level language that maps directly to machine code instructions.',
  },
  {
    name: 'Shell Scripting',
    category: 'PROGRAMMING',
    description: 'Scripting for shell environments (Bash, Zsh) to automate OS tasks.',
  },
  {
    name: 'PowerShell',
    category: 'PROGRAMMING',
    description: 'Microsoft scripting language for task automation and configuration management.',
  },
  {
    name: 'Groovy',
    category: 'PROGRAMMING',
    description: 'JVM language used in Jenkins pipelines and Gradle build scripts.',
  },
  {
    name: 'Elixir',
    category: 'PROGRAMMING',
    description: 'Functional language built on the Erlang VM for scalable applications.',
  },
  {
    name: 'Julia',
    category: 'PROGRAMMING',
    description: 'High-performance language for numerical and computational science.',
  },

  // ---------------------------------------------------------------------------
  // FRONTEND
  // ---------------------------------------------------------------------------
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
    name: 'Vue.js',
    category: 'FRONTEND',
    description: 'Progressive JavaScript framework for building UIs.',
  },
  {
    name: 'Nuxt.js',
    category: 'FRONTEND',
    description: 'Vue.js framework with SSR, routing, and auto-imports.',
  },
  {
    name: 'Angular',
    category: 'FRONTEND',
    description: 'Full-featured TypeScript framework by Google for web applications.',
  },
  {
    name: 'Svelte',
    category: 'FRONTEND',
    description: 'Compiler-based UI framework with minimal runtime.',
  },
  { name: 'SvelteKit', category: 'FRONTEND', description: 'Full-stack framework built on Svelte.' },
  {
    name: 'Remix',
    category: 'FRONTEND',
    description: 'React framework focused on web standards and modern UX.',
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
    name: 'Tailwind CSS',
    category: 'FRONTEND',
    description: 'Utility-first CSS framework for rapid UI development.',
  },
  {
    name: 'SASS/SCSS',
    category: 'FRONTEND',
    description: 'CSS preprocessor that adds variables, nesting, and mixins.',
  },
  {
    name: 'Bootstrap',
    category: 'FRONTEND',
    description: 'CSS framework for responsive, mobile-first web development.',
  },
  {
    name: 'Material-UI',
    category: 'FRONTEND',
    description: 'React component library implementing Google Material Design.',
  },
  {
    name: 'Chakra UI',
    category: 'FRONTEND',
    description: 'Accessible React component library with composable primitives.',
  },
  {
    name: 'Redux',
    category: 'FRONTEND',
    description: 'Predictable state container for JavaScript applications.',
  },
  {
    name: 'Zustand',
    category: 'FRONTEND',
    description: 'Small, fast state management for React with simple API.',
  },
  {
    name: 'TanStack Query',
    category: 'FRONTEND',
    description: 'Data-fetching and caching library for React and other frameworks.',
  },
  {
    name: 'React Query',
    category: 'FRONTEND',
    description: 'Data fetching and caching library for React (now TanStack Query).',
  },
  {
    name: 'GraphQL',
    category: 'BACKEND',
    description: 'Query language and runtime for APIs with a typed schema.',
  },
  {
    name: 'Apollo Client',
    category: 'FRONTEND',
    description: 'GraphQL client for React with caching and state management.',
  },
  {
    name: 'Webpack',
    category: 'FRONTEND',
    description: 'Module bundler for JavaScript applications with asset management.',
  },
  {
    name: 'Vite',
    category: 'FRONTEND',
    description: 'Fast build tool and dev server with native ESM support.',
  },
  {
    name: 'ESLint',
    category: 'FRONTEND',
    description: 'Static code analysis tool for identifying JavaScript/TypeScript issues.',
  },
  {
    name: 'Prettier',
    category: 'FRONTEND',
    description: 'Code formatter that enforces consistent style.',
  },
  {
    name: 'Storybook',
    category: 'FRONTEND',
    description: 'Development environment for UI components with isolated rendering.',
  },
  {
    name: 'Three.js',
    category: 'FRONTEND',
    description: 'JavaScript 3D library for rendering WebGL graphics in the browser.',
  },
  {
    name: 'Framer Motion',
    category: 'FRONTEND',
    description: 'Animation and gesture library for React.',
  },
  {
    name: 'WebSockets',
    category: 'FRONTEND',
    description: 'Bidirectional communication protocol for real-time web apps.',
  },

  // ---------------------------------------------------------------------------
  // BACKEND
  // ---------------------------------------------------------------------------
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
  { name: 'Flask', category: 'BACKEND', description: 'Lightweight Python web framework.' },
  {
    name: 'Spring Boot',
    category: 'BACKEND',
    description: 'Java framework for building production-ready Spring applications.',
  },
  {
    name: 'Rails',
    category: 'BACKEND',
    description:
      'Ruby on Rails — full-stack web framework following convention over configuration.',
  },
  {
    name: 'Laravel',
    category: 'BACKEND',
    description: 'PHP framework for web artisans with elegant syntax.',
  },
  {
    name: 'NestJS',
    category: 'BACKEND',
    description: 'Progressive Node.js framework built with TypeScript and decorators.',
  },
  {
    name: 'Fastify',
    category: 'BACKEND',
    description: 'Fast, low-overhead Node.js web framework.',
  },
  {
    name: 'ASP.NET',
    category: 'BACKEND',
    description: "Microsoft's .NET framework for building web applications and APIs.",
  },
  {
    name: 'gRPC',
    category: 'BACKEND',
    description: 'High-performance RPC framework using Protocol Buffers.',
  },
  {
    name: 'REST API',
    category: 'BACKEND',
    description: 'Architectural style for stateless client-server communication over HTTP.',
  },
  {
    name: 'OAuth',
    category: 'CYBERSECURITY',
    description: 'Open standard for access delegation and secure authorization.',
  },
  {
    name: 'JWT',
    category: 'BACKEND',
    description: 'JSON Web Tokens for stateless authentication and information exchange.',
  },
  {
    name: 'Authentication',
    category: 'BACKEND',
    description: 'Processes and mechanisms for verifying user identity.',
  },
  {
    name: 'Authorization',
    category: 'BACKEND',
    description: 'Mechanisms for controlling access to resources based on identity.',
  },
  {
    name: 'WebSocket',
    category: 'BACKEND',
    description: 'Full-duplex communication protocol for persistent real-time connections.',
  },
  {
    name: 'RabbitMQ',
    category: 'BACKEND',
    description: 'Message broker implementing the AMQP protocol for asynchronous messaging.',
  },
  {
    name: 'Apache Kafka',
    category: 'BACKEND',
    description: 'Distributed event streaming platform for high-throughput data pipelines.',
  },
  {
    name: 'Microservices',
    category: 'BACKEND',
    description:
      'Architectural style structuring an application as a collection of loosely coupled services.',
  },
  {
    name: 'Serverless',
    category: 'BACKEND',
    description: 'Cloud execution model where the provider dynamically manages infrastructure.',
  },
  {
    name: 'GraphQL',
    category: 'BACKEND',
    description: 'Query language and runtime for APIs with a typed schema.',
  },
  {
    name: 'Prisma',
    category: 'BACKEND',
    description: 'Next-generation ORM for Node.js and TypeScript with type safety.',
  },
  {
    name: 'Sequelize',
    category: 'BACKEND',
    description: 'Promise-based ORM for Node.js supporting PostgreSQL, MySQL, and others.',
  },
  {
    name: 'Postman',
    category: 'BACKEND',
    description: 'API platform for building, testing, and documenting APIs.',
  },
  {
    name: 'Swagger',
    category: 'BACKEND',
    description: 'Tools for designing, building, and documenting REST APIs with OpenAPI.',
  },
  {
    name: 'OpenAPI',
    category: 'BACKEND',
    description: 'Standard specification format for describing REST APIs.',
  },
  {
    name: 'API Design',
    category: 'BACKEND',
    description: 'Principles and patterns for designing clean, maintainable APIs.',
  },

  // ---------------------------------------------------------------------------
  // DATABASE
  // ---------------------------------------------------------------------------
  {
    name: 'MongoDB',
    category: 'DATABASE',
    description: 'Document-oriented NoSQL database with flexible schema.',
  },
  {
    name: 'PostgreSQL',
    category: 'DATABASE',
    description: 'Powerful open-source relational database with advanced features.',
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
  {
    name: 'Elasticsearch',
    category: 'DATABASE',
    description: 'Distributed search and analytics engine based on Lucene.',
  },
  {
    name: 'Cassandra',
    category: 'DATABASE',
    description: 'Highly scalable NoSQL database designed for write-heavy workloads.',
  },
  {
    name: 'SQLite',
    category: 'DATABASE',
    description: 'Lightweight, serverless SQL database engine embedded in applications.',
  },
  {
    name: 'MariaDB',
    category: 'DATABASE',
    description: 'Open-source relational database, community-developed fork of MySQL.',
  },
  {
    name: 'Oracle',
    category: 'DATABASE',
    description: 'Enterprise relational database management system by Oracle Corporation.',
  },
  {
    name: 'SQL Server',
    category: 'DATABASE',
    description: "Microsoft's enterprise relational database management system.",
  },
  {
    name: 'DynamoDB',
    category: 'DATABASE',
    description: 'Fully managed NoSQL database service by Amazon Web Services.',
  },
  {
    name: 'Firebase',
    category: 'DATABASE',
    description:
      "Google's platform for building web and mobile applications with real-time database.",
  },
  {
    name: 'CouchDB',
    category: 'DATABASE',
    description: 'NoSQL document database accessible via HTTP and queryable with JavaScript.',
  },
  {
    name: 'Neo4j',
    category: 'DATABASE',
    description: 'Graph database optimized for storing and querying connected data.',
  },
  {
    name: 'Supabase',
    category: 'DATABASE',
    description:
      'Open-source Firebase alternative built on PostgreSQL with real-time subscriptions.',
  },
  {
    name: 'SQL',
    category: 'DATABASE',
    description: 'Structured Query Language for managing relational databases.',
  },
  {
    name: 'NoSQL',
    category: 'DATABASE',
    description: 'Non-relational database models for flexible and scalable data storage.',
  },
  {
    name: 'Database Design',
    category: 'DATABASE',
    description: 'Principles and practices for structuring databases effectively.',
  },
  {
    name: 'Database Indexing',
    category: 'DATABASE',
    description: 'Techniques for speeding up data retrieval operations in databases.',
  },
  {
    name: 'Replication',
    category: 'DATABASE',
    description: 'Process of copying and maintaining database objects across multiple nodes.',
  },
  {
    name: 'Data Migration',
    category: 'DATABASE',
    description: 'Process of transferring data between storage types, formats, or systems.',
  },

  // ---------------------------------------------------------------------------
  // CLOUD & DEVOPS
  // ---------------------------------------------------------------------------
  {
    name: 'AWS',
    category: 'CLOUD',
    description: 'Amazon Web Services cloud platform — compute, storage, databases, and more.',
  },
  {
    name: 'GCP',
    category: 'CLOUD',
    description: 'Google Cloud Platform — suite of cloud computing services.',
  },
  {
    name: 'Azure',
    category: 'CLOUD',
    description:
      'Microsoft Azure cloud services for building, deploying, and managing applications.',
  },
  {
    name: 'Docker',
    category: 'DEVOPS',
    description:
      'Container platform for packaging and running applications in isolated environments.',
  },
  {
    name: 'Kubernetes',
    category: 'DEVOPS',
    description: 'Container orchestration platform for automating deployment and scaling.',
  },
  {
    name: 'Git',
    category: 'DEVOPS',
    description: 'Distributed version control system for tracking code changes.',
  },
  {
    name: 'GitHub',
    category: 'DEVOPS',
    description: 'Platform for version control and collaboration using Git.',
  },
  {
    name: 'GitLab',
    category: 'DEVOPS',
    description: 'DevOps platform providing Git repository management, CI/CD, and more.',
  },
  {
    name: 'Bitbucket',
    category: 'DEVOPS',
    description: 'Git solution by Atlassian with built-in CI/CD pipelines.',
  },
  {
    name: 'Jenkins',
    category: 'DEVOPS',
    description: 'Open-source automation server for CI/CD pipelines.',
  },
  {
    name: 'GitHub Actions',
    category: 'DEVOPS',
    description: 'CI/CD platform built into GitHub for automating workflows.',
  },
  {
    name: 'GitLab CI/CD',
    category: 'DEVOPS',
    description: 'Continuous integration and deployment pipelines in GitLab.',
  },
  {
    name: 'CircleCI',
    category: 'DEVOPS',
    description: 'Cloud-based CI/CD service with easy configuration.',
  },
  {
    name: 'Travis CI',
    category: 'DEVOPS',
    description: 'Hosted CI/CD service for open-source and private projects.',
  },
  {
    name: 'CI/CD',
    category: 'DEVOPS',
    description: 'Continuous Integration and Continuous Delivery/Deployment practices and tooling.',
  },
  {
    name: 'Terraform',
    category: 'DEVOPS',
    description: 'Infrastructure as Code tool for provisioning and managing cloud resources.',
  },
  {
    name: 'Ansible',
    category: 'DEVOPS',
    description: 'Automation tool for configuration management and application deployment.',
  },
  {
    name: 'Chef',
    category: 'DEVOPS',
    description: 'Configuration management tool for automating infrastructure.',
  },
  {
    name: 'Puppet',
    category: 'DEVOPS',
    description: 'Configuration management and automation tool for infrastructure.',
  },
  {
    name: 'Vagrant',
    category: 'DEVOPS',
    description: 'Tool for building and managing virtual development environments.',
  },
  {
    name: 'Helm',
    category: 'DEVOPS',
    description:
      'Package manager for Kubernetes that defines, installs, and upgrades complex applications.',
  },
  {
    name: 'Prometheus',
    category: 'DEVOPS',
    description: 'Open-source systems monitoring and alerting toolkit.',
  },
  {
    name: 'Grafana',
    category: 'DEVOPS',
    description: 'Open observability platform for metrics visualization and analysis.',
  },
  {
    name: 'ELK Stack',
    category: 'DEVOPS',
    description: 'Elasticsearch, Logstash, and Kibana stack for log aggregation and analysis.',
  },
  {
    name: 'Datadog',
    category: 'DEVOPS',
    description: 'Cloud-based monitoring and security platform.',
  },
  {
    name: 'New Relic',
    category: 'DEVOPS',
    description: 'Application performance monitoring and observability platform.',
  },
  {
    name: 'Nginx',
    category: 'DEVOPS',
    description: 'High-performance web server, reverse proxy, and load balancer.',
  },
  {
    name: 'Apache',
    category: 'DEVOPS',
    description: 'Widely used open-source web server software.',
  },
  {
    name: 'Linux',
    category: 'DEVOPS',
    description: 'Open-source Unix-like operating system kernel used in servers and cloud.',
  },
  {
    name: 'Unix',
    category: 'DEVOPS',
    description: 'Operating system family known for portability and multiuser design.',
  },
  {
    name: 'Cloud Computing',
    category: 'CLOUD',
    description: 'Delivery of computing resources over the internet on demand.',
  },
  {
    name: 'DevOps',
    category: 'DEVOPS',
    description:
      'Practices combining software development and IT operations to shorten development cycles.',
  },
  {
    name: 'SRE',
    category: 'DEVOPS',
    description:
      'Site Reliability Engineering — applying software engineering to infrastructure and operations.',
  },
  {
    name: 'Infrastructure as Code',
    category: 'DEVOPS',
    description:
      'Managing and provisioning infrastructure through machine-readable configuration files.',
  },
  {
    name: 'Monitoring',
    category: 'DEVOPS',
    description: 'Observing systems to track performance, availability, and reliability.',
  },
  {
    name: 'Logging',
    category: 'DEVOPS',
    description: 'Recording application and system events for debugging and auditing.',
  },
  {
    name: 'Incident Management',
    category: 'DEVOPS',
    description: 'Processes for detecting, responding to, and recovering from service disruptions.',
  },
  {
    name: 'Heroku',
    category: 'CLOUD',
    description: 'Cloud platform as a service for deploying and managing applications.',
  },
  {
    name: 'Vercel',
    category: 'CLOUD',
    description:
      'Platform for frontend frameworks with instant deployment and global edge network.',
  },
  {
    name: 'Netlify',
    category: 'CLOUD',
    description:
      'Platform for modern web projects with deployment, forms, and serverless functions.',
  },

  // ---------------------------------------------------------------------------
  // DATA SCIENCE & ANALYTICS
  // ---------------------------------------------------------------------------
  {
    name: 'Pandas',
    category: 'DATA_SCIENCE',
    description: 'Python library for data manipulation and analysis with DataFrames.',
  },
  {
    name: 'NumPy',
    category: 'DATA_SCIENCE',
    description: 'Fundamental package for numerical computing in Python.',
  },
  {
    name: 'Matplotlib',
    category: 'DATA_SCIENCE',
    description: 'Python library for creating static, animated, and interactive visualizations.',
  },
  {
    name: 'Seaborn',
    category: 'DATA_SCIENCE',
    description: 'Python visualization library based on Matplotlib with statistical graphics.',
  },
  {
    name: 'Scikit-learn',
    category: 'DATA_SCIENCE',
    description: 'Python library for classical machine learning algorithms and data preprocessing.',
  },
  {
    name: 'SciPy',
    category: 'DATA_SCIENCE',
    description: 'Python library for scientific and technical computing.',
  },
  {
    name: 'Jupyter',
    category: 'DATA_SCIENCE',
    description:
      'Open-source web application for creating and sharing documents with live code and visualizations.',
  },
  {
    name: 'Tableau',
    category: 'DATA_SCIENCE',
    description: 'Business intelligence and analytics platform for visual data exploration.',
  },
  {
    name: 'Power BI',
    category: 'DATA_SCIENCE',
    description:
      "Microsoft's business analytics tool for interactive visualizations and dashboards.",
  },
  {
    name: 'Excel',
    category: 'DATA_SCIENCE',
    description: 'Spreadsheet software widely used for data analysis and visualization.',
  },
  {
    name: 'Statistics',
    category: 'DATA_SCIENCE',
    description: 'Discipline of collecting, organizing, and interpreting data.',
  },
  {
    name: 'Data Visualization',
    category: 'DATA_SCIENCE',
    description: 'Representing data in graphical or pictorial formats to communicate insights.',
  },
  {
    name: 'Data Analysis',
    category: 'DATA_SCIENCE',
    description:
      'Process of inspecting, cleansing, and modeling data to discover useful information.',
  },
  {
    name: 'Data Engineering',
    category: 'DATA_SCIENCE',
    description: 'Designing and building systems for collecting, storing, and analyzing data.',
  },
  {
    name: 'Big Data',
    category: 'DATA_SCIENCE',
    description: 'Extremely large datasets requiring specialized processing and tools.',
  },
  {
    name: 'Hadoop',
    category: 'DATA_SCIENCE',
    description: 'Open-source framework for distributed storage and processing of big data.',
  },
  {
    name: 'Apache Spark',
    category: 'DATA_SCIENCE',
    description:
      'Unified analytics engine for large-scale data processing with APIs in Python, Java, and Scala.',
  },
  {
    name: 'ETL',
    category: 'DATA_SCIENCE',
    description: 'Extract, Transform, Load — process for moving data between systems.',
  },
  {
    name: 'Data Wrangling',
    category: 'DATA_SCIENCE',
    description:
      'Process of cleaning and transforming raw data into a structured format for analysis.',
  },
  {
    name: 'SQL',
    category: 'DATABASE',
    description: 'Structured Query Language for managing relational databases.',
  },

  // ---------------------------------------------------------------------------
  // AI / ML
  // ---------------------------------------------------------------------------
  {
    name: 'TensorFlow',
    category: 'AI_ML',
    description: 'Open-source machine learning framework by Google.',
  },
  {
    name: 'PyTorch',
    category: 'AI_ML',
    description: 'Deep learning framework by Meta with dynamic computation graphs.',
  },
  {
    name: 'Keras',
    category: 'AI_ML',
    description: 'High-level neural networks API, running on top of TensorFlow.',
  },
  {
    name: 'OpenCV',
    category: 'AI_ML',
    description: 'Open-source computer vision library with tools for image and video processing.',
  },
  {
    name: 'NLP',
    category: 'AI_ML',
    description:
      'Natural Language Processing — field of AI enabling machines to understand human language.',
  },
  {
    name: 'Computer Vision',
    category: 'AI_ML',
    description: 'Field of AI enabling machines to interpret and understand visual information.',
  },
  {
    name: 'Deep Learning',
    category: 'AI_ML',
    description: 'Subset of machine learning using neural networks with many layers.',
  },
  {
    name: 'Machine Learning',
    category: 'AI_ML',
    description: 'Field of AI enabling computers to learn from data without explicit programming.',
  },
  {
    name: 'Hugging Face',
    category: 'AI_ML',
    description: 'Platform and library for state-of-the-art NLP and transformer models.',
  },
  {
    name: 'LangChain',
    category: 'AI_ML',
    description: 'Framework for developing applications powered by language models.',
  },
  {
    name: 'Generative AI',
    category: 'AI_ML',
    description: 'AI systems that generate new content — text, images, code, or other media.',
  },
  {
    name: 'LLM',
    category: 'AI_ML',
    description: 'Large Language Model — deep learning model trained on vast amounts of text data.',
  },
  {
    name: 'Prompt Engineering',
    category: 'AI_ML',
    description: 'Crafting effective inputs to elicit desired outputs from language models.',
  },
  {
    name: 'MLOps',
    category: 'AI_ML',
    description:
      'Practices for deploying, monitoring, and maintaining machine learning systems in production.',
  },
  {
    name: 'RAG',
    category: 'AI_ML',
    description:
      'Retrieval-Augmented Generation — combining retrieval systems with generative models.',
  },
  {
    name: 'AI Agents',
    category: 'AI_ML',
    description: 'Autonomous software systems that use AI models to plan and execute actions.',
  },
  {
    name: 'Neural Networks',
    category: 'AI_ML',
    description:
      'Computing systems inspired by biological neural networks, foundation of deep learning.',
  },
  {
    name: 'Reinforcement Learning',
    category: 'AI_ML',
    description: 'Machine learning paradigm where agents learn by trial and error with rewards.',
  },
  {
    name: 'Data Structures',
    category: 'PROGRAMMING',
    description:
      'Organized ways of storing and organizing data for efficient access and modification.',
  },
  {
    name: 'Algorithms',
    category: 'PROGRAMMING',
    description: 'Step-by-step procedures for solving problems or accomplishing tasks.',
  },

  // ---------------------------------------------------------------------------
  // MOBILE
  // ---------------------------------------------------------------------------
  {
    name: 'Swift',
    category: 'MOBILE',
    description: "Apple's language for iOS, macOS, watchOS, and tvOS development.",
  },
  {
    name: 'Kotlin',
    category: 'MOBILE',
    description: 'Modern language for Android development and server-side applications.',
  },
  {
    name: 'Android Studio',
    category: 'MOBILE',
    description: 'Official IDE for Android development based on IntelliJ IDEA.',
  },
  {
    name: 'Xcode',
    category: 'MOBILE',
    description: "Apple's IDE for developing software across Apple platforms.",
  },
  {
    name: 'Ionic',
    category: 'MOBILE',
    description:
      'Open-source framework for building cross-platform mobile apps with web technologies.',
  },
  {
    name: 'Apache Cordova',
    category: 'MOBILE',
    description: 'Mobile application development framework using HTML, CSS, and JavaScript.',
  },
  {
    name: 'App Store',
    category: 'MOBILE',
    description: "Apple's marketplace for distributing iOS applications.",
  },
  {
    name: 'Google Play',
    category: 'MOBILE',
    description: "Google's marketplace for Android applications.",
  },
  {
    name: 'React Native',
    category: 'MOBILE',
    description: 'Framework for building native mobile apps using React and JavaScript.',
  },
  {
    name: 'Flutter',
    category: 'MOBILE',
    description:
      "Google's UI toolkit for building natively compiled apps for mobile from a single codebase.",
  },

  // ---------------------------------------------------------------------------
  // CYBERSECURITY
  // ---------------------------------------------------------------------------
  {
    name: 'OWASP',
    category: 'CYBERSECURITY',
    description:
      'Open Web Application Security Project — community focused on web application security.',
  },
  {
    name: 'Network Security',
    category: 'CYBERSECURITY',
    description: 'Practices and policies for protecting network infrastructure and data.',
  },
  {
    name: 'Cryptography',
    category: 'CYBERSECURITY',
    description: 'Science of securing communication through encoding and decoding.',
  },
  {
    name: 'Ethical Hacking',
    category: 'CYBERSECURITY',
    description: 'Authorized simulated cyberattacks to identify security vulnerabilities.',
  },
  {
    name: 'Penetration Testing',
    category: 'CYBERSECURITY',
    description: 'Ethical hacking practice of testing a system for exploitable vulnerabilities.',
  },
  {
    name: 'OAuth',
    category: 'CYBERSECURITY',
    description: 'Open standard for access delegation, commonly used for secure authorization.',
  },
  {
    name: 'JWT',
    category: 'CYBERSECURITY',
    description: 'JSON Web Tokens for securely transmitting information as JSON objects.',
  },
  {
    name: 'SSL/TLS',
    category: 'CYBERSECURITY',
    description: 'Cryptographic protocols for securing communications over networks.',
  },
  {
    name: 'Firewalls',
    category: 'CYBERSECURITY',
    description: 'Network security devices or software that monitor and filter traffic.',
  },
  {
    name: 'Malware Analysis',
    category: 'CYBERSECURITY',
    description: 'Process of examining malicious software to understand its behavior and purpose.',
  },
  {
    name: 'Vulnerability Assessment',
    category: 'CYBERSECURITY',
    description: 'Systematic review of security weaknesses in a system or network.',
  },
  {
    name: 'Incident Response',
    category: 'CYBERSECURITY',
    description: 'Planned approach to addressing and managing security breaches and attacks.',
  },
  {
    name: 'SIEM',
    category: 'CYBERSECURITY',
    description:
      'Security Information and Event Management — tools for security monitoring and analysis.',
  },
  {
    name: 'Zero Trust',
    category: 'CYBERSECURITY',
    description: 'Security model that assumes no implicit trust and verifies every request.',
  },
  {
    name: 'Identity and Access Management',
    category: 'CYBERSECURITY',
    description: 'Framework of policies and technologies ensuring appropriate access to resources.',
  },

  // ---------------------------------------------------------------------------
  // SOFT SKILLS
  // ---------------------------------------------------------------------------
  {
    name: 'Communication',
    category: 'SOFT_SKILLS',
    description: 'Verbal and written communication skills for effective information exchange.',
  },
  {
    name: 'Teamwork',
    category: 'SOFT_SKILLS',
    description: 'Collaborating effectively within diverse teams toward shared goals.',
  },
  {
    name: 'Problem Solving',
    category: 'SOFT_SKILLS',
    description: 'Analytical approach to breaking down complex problems and devising solutions.',
  },
  {
    name: 'Leadership',
    category: 'SOFT_SKILLS',
    description: 'Guiding, motivating, and coordinating individuals or teams toward outcomes.',
  },
  {
    name: 'Time Management',
    category: 'SOFT_SKILLS',
    description: 'Planning and organizing time to accomplish tasks efficiently.',
  },
  {
    name: 'Critical Thinking',
    category: 'SOFT_SKILLS',
    description: 'Objective analysis and evaluation to form a reasoned judgment.',
  },
  {
    name: 'Adaptability',
    category: 'SOFT_SKILLS',
    description: 'Ability to adjust to new conditions, requirements, and environments.',
  },
  {
    name: 'Creativity',
    category: 'SOFT_SKILLS',
    description: 'Capability to generate novel and useful ideas and solutions.',
  },
  {
    name: 'Project Management',
    category: 'SOFT_SKILLS',
    description: 'Planning, organizing, and managing resources to complete project goals.',
  },
  {
    name: 'Agile',
    category: 'SOFT_SKILLS',
    description: 'Iterative approach to project management and software development.',
  },
  {
    name: 'Scrum',
    category: 'SOFT_SKILLS',
    description: 'Agile framework for managing knowledge work with sprints and daily standups.',
  },
  {
    name: 'Presentation Skills',
    category: 'SOFT_SKILLS',
    description: 'Ability to present information clearly and engagingly to an audience.',
  },
  {
    name: 'Negotiation',
    category: 'SOFT_SKILLS',
    description: 'Skill in reaching mutually beneficial agreements through discussion.',
  },
  {
    name: 'Mentoring',
    category: 'SOFT_SKILLS',
    description:
      'Guidance and advice provided to less experienced individuals to support their growth.',
  },
  {
    name: 'Research',
    category: 'SOFT_SKILLS',
    description: 'Systematic investigation and study of materials and sources to establish facts.',
  },
  {
    name: 'Analytical Skills',
    category: 'SOFT_SKILLS',
    description: 'Ability to collect, organize, and interpret information to solve problems.',
  },
  {
    name: 'Technical Writing',
    category: 'SOFT_SKILLS',
    description: 'Writing clear, well-organized technical documentation and manuals.',
  },
  {
    name: 'Collaboration',
    category: 'SOFT_SKILLS',
    description: 'Working jointly with others to achieve shared objectives.',
  },

  // ---------------------------------------------------------------------------
  // PRODUCT & DESIGN
  // ---------------------------------------------------------------------------
  {
    name: 'UI Design',
    category: 'FRONTEND',
    description: 'User Interface design — visual design of interactive elements and layouts.',
  },
  {
    name: 'UX Design',
    category: 'FRONTEND',
    description:
      'User Experience design — overall experience of a person using a product or service.',
  },
  {
    name: 'Figma',
    category: 'FRONTEND',
    description: 'Cloud-based design tool for UI/UX design and prototyping.',
  },
  {
    name: 'Adobe XD',
    category: 'FRONTEND',
    description: 'Vector-based UX design tool by Adobe for prototyping and collaboration.',
  },
  {
    name: 'Sketch',
    category: 'FRONTEND',
    description: 'Mac application for UI/UX design with vector editing capabilities.',
  },
  {
    name: 'Product Management',
    category: 'SOFT_SKILLS',
    description: 'Process of guiding a product from ideation to launch and beyond.',
  },
  {
    name: 'System Design',
    category: 'PROGRAMMING',
    description: 'Process of defining the architecture and components of a software system.',
  },
  {
    name: 'Technical Leadership',
    category: 'SOFT_SKILLS',
    description:
      'Leading technical decisions and guiding engineering teams toward architectural goals.',
  },
  {
    name: 'Code Review',
    category: 'SOFT_SKILLS',
    description: 'Systematic examination of source code to identify defects and improve quality.',
  },
  {
    name: 'Software Architecture',
    category: 'PROGRAMMING',
    description: 'High-level structure and organization of a software system.',
  },
  {
    name: 'Testing',
    category: 'SOFT_SKILLS',
    description:
      'Practice of verifying software functionality and quality through various test types.',
  },
  {
    name: 'Quality Assurance',
    category: 'SOFT_SKILLS',
    description: 'Systematic process of ensuring software meets specified requirements.',
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
