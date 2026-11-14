/**
 * Demo dataset for `seedDemo.ts`. Plain data only — no database access here.
 *
 * Every account uses the reserved `.test` TLD so a demo address can never
 * belong to a real person or receive mail. Cross-references between records
 * use array indexes into the lists below (e.g. `company: 0`).
 */
import type {
  EmploymentType,
  Proficiency,
  SkillCategory,
  WorkMode,
  CollabEventType,
} from '@aip/config';

export const DEMO_EMAIL_DOMAIN = 'acadin-demo.test';
export const DEFAULT_DEMO_PASSWORD = 'DemoPass123!';

const email = (local: string): string => `${local}@${DEMO_EMAIL_DOMAIN}`;

export const DEMO_INSTITUTION = {
  name: 'Demo Institute of Technology',
  code: 'DEMOIT',
  domain: 'demo-institute.test',
  address: '12 Innovation Road, Sector 5',
  city: 'Pune',
  state: 'Maharashtra',
  contactEmail: email('institution'),
  contactPhone: '+91 20 5550 0100',
  website: 'https://demo-institute.test',
};

export const DEMO_ADMIN_EMAIL = email('admin');
export const DEMO_INSTITUTION_EMAIL = email('institution');

/** Skills the demo data references. Upserted, so existing skills are reused. */
export const DEMO_SKILLS: Array<{ name: string; category: SkillCategory }> = [
  { name: 'javascript', category: 'PROGRAMMING' },
  { name: 'typescript', category: 'PROGRAMMING' },
  { name: 'python', category: 'PROGRAMMING' },
  { name: 'java', category: 'PROGRAMMING' },
  { name: 'react', category: 'FRONTEND' },
  { name: 'node.js', category: 'BACKEND' },
  { name: 'mongodb', category: 'DATABASE' },
  { name: 'sql', category: 'DATABASE' },
  { name: 'docker', category: 'DEVOPS' },
  { name: 'aws', category: 'CLOUD' },
  { name: 'machine learning', category: 'AI_ML' },
  { name: 'pandas', category: 'DATA_SCIENCE' },
  { name: 'communication', category: 'SOFT_SKILLS' },
];

export interface DemoStudent {
  email: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  branch: string;
  semester: number;
  graduationYear: number;
  cgpa: number;
  bio: string;
  preferredRoles: string[];
  skills: Array<[skill: string, proficiency: Proficiency]>;
}

export const DEMO_STUDENTS: DemoStudent[] = [
  {
    email: email('aarav.sharma'),
    fullName: 'Aarav Sharma',
    gender: 'MALE',
    branch: 'Computer Science',
    semester: 7,
    graduationYear: 2027,
    cgpa: 8.7,
    bio: 'Full-stack enthusiast who enjoys building web apps with React and Node.js.',
    preferredRoles: ['Full Stack Developer', 'Frontend Developer'],
    skills: [
      ['javascript', 'ADVANCED'],
      ['react', 'ADVANCED'],
      ['node.js', 'INTERMEDIATE'],
      ['mongodb', 'INTERMEDIATE'],
    ],
  },
  {
    email: email('priya.patel'),
    fullName: 'Priya Patel',
    gender: 'FEMALE',
    branch: 'Computer Science',
    semester: 7,
    graduationYear: 2027,
    cgpa: 9.1,
    bio: 'Interested in machine learning and data-driven products.',
    preferredRoles: ['ML Engineer', 'Data Scientist'],
    skills: [
      ['python', 'EXPERT'],
      ['machine learning', 'ADVANCED'],
      ['pandas', 'ADVANCED'],
      ['sql', 'INTERMEDIATE'],
    ],
  },
  {
    email: email('rohan.verma'),
    fullName: 'Rohan Verma',
    gender: 'MALE',
    branch: 'Information Technology',
    semester: 5,
    graduationYear: 2028,
    cgpa: 7.8,
    bio: 'Backend developer learning cloud and DevOps.',
    preferredRoles: ['Backend Developer', 'DevOps Engineer'],
    skills: [
      ['java', 'ADVANCED'],
      ['sql', 'ADVANCED'],
      ['docker', 'INTERMEDIATE'],
      ['aws', 'BEGINNER'],
    ],
  },
  {
    email: email('ananya.iyer'),
    fullName: 'Ananya Iyer',
    gender: 'FEMALE',
    branch: 'Information Technology',
    semester: 7,
    graduationYear: 2027,
    cgpa: 8.2,
    bio: 'Frontend developer with an eye for design and accessibility.',
    preferredRoles: ['Frontend Developer', 'UI Engineer'],
    skills: [
      ['typescript', 'ADVANCED'],
      ['react', 'ADVANCED'],
      ['communication', 'EXPERT'],
    ],
  },
  {
    email: email('kabir.singh'),
    fullName: 'Kabir Singh',
    gender: 'MALE',
    branch: 'Electronics',
    semester: 5,
    graduationYear: 2028,
    cgpa: 7.1,
    bio: 'Electronics student exploring software through Python scripting.',
    preferredRoles: ['Software Engineer'],
    skills: [
      ['python', 'INTERMEDIATE'],
      ['sql', 'BEGINNER'],
    ],
  },
  {
    email: email('meera.nair'),
    fullName: 'Meera Nair',
    gender: 'FEMALE',
    branch: 'Computer Science',
    semester: 3,
    graduationYear: 2029,
    cgpa: 8.9,
    bio: 'Second-year student keen on cloud-native development.',
    preferredRoles: ['Cloud Engineer', 'Backend Developer'],
    skills: [
      ['node.js', 'INTERMEDIATE'],
      ['typescript', 'INTERMEDIATE'],
      ['aws', 'INTERMEDIATE'],
    ],
  },
];

export const DEMO_FACULTY = [
  {
    email: email('dr.kulkarni'),
    fullName: 'Dr. Sunita Kulkarni',
    designation: 'Professor',
    department: 'Computer Science',
    qualifications: ['PhD Computer Science', 'MTech'],
    researchInterests: ['Machine Learning', 'Distributed Systems'],
  },
  {
    email: email('prof.menon'),
    fullName: 'Prof. Arjun Menon',
    designation: 'Assistant Professor',
    department: 'Information Technology',
    qualifications: ['MTech Information Technology'],
    researchInterests: ['Cloud Computing', 'Software Engineering'],
  },
];

export const DEMO_COMPANIES = [
  {
    email: email('hr.technova'),
    companyName: 'TechNova Solutions',
    industry: 'Software',
    location: 'Bengaluru',
    companySize: '201-500',
    foundedYear: 2012,
    description: 'Product engineering company building SaaS platforms for logistics.',
    mentorExpertise: ['react', 'node.js', 'system design'],
  },
  {
    email: email('careers.datasphere'),
    companyName: 'DataSphere Analytics',
    industry: 'Data & AI',
    location: 'Hyderabad',
    companySize: '51-200',
    foundedYear: 2017,
    description: 'Analytics consultancy delivering ML solutions to retail and finance clients.',
    mentorExpertise: ['machine learning', 'python', 'data engineering'],
  },
  {
    email: email('talent.cloudpeak'),
    companyName: 'CloudPeak Systems',
    industry: 'Cloud Infrastructure',
    location: 'Pune',
    companySize: '501-1000',
    foundedYear: 2009,
    description: 'Managed cloud and DevOps services provider.',
    mentorExpertise: [],
  },
];

export interface DemoOpening {
  company: number;
  title: string;
  description: string;
  location: string;
  workMode: WorkMode;
  requiredSkills: string[];
  preferredSkills: string[];
  minCgpa?: number;
  status: 'PUBLISHED' | 'DRAFT' | 'CLOSED';
}

export const DEMO_JOBS: Array<
  DemoOpening & { employmentType: EmploymentType; salaryMin: number; salaryMax: number }
> = [
  {
    company: 0,
    title: 'Associate Full Stack Developer',
    description: 'Build and maintain customer-facing features across our React and Node.js stack.',
    location: 'Bengaluru',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salaryMin: 600000,
    salaryMax: 900000,
    requiredSkills: ['javascript', 'react', 'node.js'],
    preferredSkills: ['mongodb', 'typescript'],
    minCgpa: 7,
    status: 'PUBLISHED',
  },
  {
    company: 1,
    title: 'Junior Data Scientist',
    description: 'Work with senior scientists to build forecasting and recommendation models.',
    location: 'Hyderabad',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salaryMin: 700000,
    salaryMax: 1000000,
    requiredSkills: ['python', 'machine learning'],
    preferredSkills: ['pandas', 'sql'],
    minCgpa: 7.5,
    status: 'PUBLISHED',
  },
  {
    company: 2,
    title: 'Graduate DevOps Engineer',
    description: 'Automate infrastructure, maintain CI/CD pipelines and support cloud migrations.',
    location: 'Pune',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salaryMin: 550000,
    salaryMax: 800000,
    requiredSkills: ['docker', 'aws'],
    preferredSkills: ['java', 'sql'],
    status: 'PUBLISHED',
  },
  {
    company: 0,
    title: 'Frontend Engineer (Draft)',
    description:
      'Draft posting for a TypeScript and React frontend role on the design-system team.',
    location: 'Remote',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    salaryMin: 800000,
    salaryMax: 1200000,
    requiredSkills: ['typescript', 'react'],
    preferredSkills: [],
    status: 'DRAFT',
  },
];

export const DEMO_INTERNSHIPS: Array<DemoOpening & { durationMonths: number; stipend: number }> = [
  {
    company: 0,
    title: 'Web Development Intern',
    description: 'Six-month internship shipping features on our internal admin dashboards.',
    location: 'Bengaluru',
    workMode: 'HYBRID',
    durationMonths: 6,
    stipend: 25000,
    requiredSkills: ['javascript', 'react'],
    preferredSkills: ['node.js'],
    status: 'PUBLISHED',
  },
  {
    company: 1,
    title: 'Data Analytics Intern',
    description: 'Clean, analyse and visualise client datasets with Python and SQL.',
    location: 'Remote',
    workMode: 'REMOTE',
    durationMonths: 3,
    stipend: 20000,
    requiredSkills: ['python', 'sql'],
    preferredSkills: ['pandas'],
    status: 'PUBLISHED',
  },
  {
    company: 2,
    title: 'Cloud Operations Intern',
    description: 'Assist the SRE team with monitoring, incident runbooks and cost reports.',
    location: 'Pune',
    workMode: 'ONSITE',
    durationMonths: 4,
    stipend: 18000,
    requiredSkills: ['docker'],
    preferredSkills: ['aws'],
    status: 'PUBLISHED',
  },
  {
    company: 1,
    title: 'ML Research Intern (Closed)',
    description: 'Closed summer internship on applied NLP research for document classification.',
    location: 'Hyderabad',
    workMode: 'ONSITE',
    durationMonths: 2,
    stipend: 30000,
    requiredSkills: ['python', 'machine learning'],
    preferredSkills: [],
    status: 'CLOSED',
  },
];

/** `path` is the status history; the last entry is the current status. */
export const DEMO_APPLICATIONS: Array<{
  student: number;
  type: 'JOB' | 'INTERNSHIP';
  opening: number;
  path: string[];
  matchScore: number;
}> = [
  { student: 0, type: 'JOB', opening: 0, path: ['APPLIED'], matchScore: 88 },
  {
    student: 0,
    type: 'INTERNSHIP',
    opening: 0,
    path: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED'],
    matchScore: 91,
  },
  {
    student: 1,
    type: 'JOB',
    opening: 1,
    path: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'],
    matchScore: 94,
  },
  { student: 1, type: 'INTERNSHIP', opening: 1, path: ['APPLIED', 'UNDER_REVIEW'], matchScore: 86 },
  {
    student: 2,
    type: 'JOB',
    opening: 2,
    path: ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED'],
    matchScore: 79,
  },
  { student: 2, type: 'JOB', opening: 0, path: ['APPLIED', 'REJECTED'], matchScore: 52 },
  {
    student: 3,
    type: 'INTERNSHIP',
    opening: 0,
    path: ['APPLIED', 'SHORTLISTED', 'SELECTED', 'INTERNSHIP_STARTED'],
    matchScore: 90,
  },
  { student: 3, type: 'JOB', opening: 0, path: ['APPLIED', 'UNDER_REVIEW'], matchScore: 84 },
  { student: 4, type: 'INTERNSHIP', opening: 1, path: ['APPLIED', 'WITHDRAWN'], matchScore: 61 },
  { student: 5, type: 'INTERNSHIP', opening: 2, path: ['APPLIED'], matchScore: 73 },
];

export type DemoHost = { type: 'COMPANY' | 'FACULTY'; index: number } | { type: 'INSTITUTION' };

/** `startInDays` is relative to the seed run; negative means in the past. */
export const DEMO_EVENTS: Array<{
  title: string;
  description: string;
  eventType: CollabEventType;
  host: DemoHost;
  startInDays: number;
  durationHours: number;
  mode: 'ONLINE' | 'ONSITE' | 'HYBRID';
  capacity: number;
  status: 'PUBLISHED' | 'COMPLETED';
  skills: string[];
  tags: string[];
  registrants: number[];
}> = [
  {
    title: 'Hands-on React Workshop',
    description: 'A three-hour practical workshop on building accessible React components.',
    eventType: 'WORKSHOP',
    host: { type: 'COMPANY', index: 0 },
    startInDays: 7,
    durationHours: 3,
    mode: 'ONLINE',
    capacity: 50,
    status: 'PUBLISHED',
    skills: ['react', 'javascript'],
    tags: ['frontend', 'hands-on'],
    registrants: [0, 3, 5],
  },
  {
    title: 'Careers in Data Science — Guest Lecture',
    description: 'Industry experts discuss data science career paths and interview preparation.',
    eventType: 'GUEST_LECTURE',
    host: { type: 'INSTITUTION' },
    startInDays: 14,
    durationHours: 2,
    mode: 'ONSITE',
    capacity: 120,
    status: 'PUBLISHED',
    skills: ['machine learning', 'python'],
    tags: ['careers', 'data'],
    registrants: [1, 2, 4],
  },
  {
    title: 'Cloud Cost Optimisation Live Project',
    description: 'Completed live project where students analysed and reduced cloud spend.',
    eventType: 'LIVE_PROJECT',
    host: { type: 'FACULTY', index: 1 },
    startInDays: -30,
    durationHours: 40,
    mode: 'HYBRID',
    capacity: 20,
    status: 'COMPLETED',
    skills: ['aws', 'docker'],
    tags: ['cloud', 'project'],
    registrants: [2, 5],
  },
];

/** Mentors are referenced as company or faculty indexes; mentees are students. */
export const DEMO_MENTORSHIPS: Array<{
  mentee: number;
  mentor: { type: 'COMPANY' | 'FACULTY'; index: number };
  status: 'REQUESTED' | 'ACTIVE' | 'COMPLETED';
  initialMessage: string;
  goals: string;
  messages: string[];
}> = [
  {
    mentee: 0,
    mentor: { type: 'COMPANY', index: 0 },
    status: 'ACTIVE',
    initialMessage: 'Hi! I would love guidance on becoming a full stack engineer.',
    goals: 'Prepare for full stack interviews and improve system design basics.',
    messages: [
      'Happy to help. Share a project you are proud of and we can start there.',
      'Thanks! Here is my portfolio project — a job board built with React and Express.',
      'Nice work. Next session, let us review how you structured the API.',
    ],
  },
  {
    mentee: 1,
    mentor: { type: 'FACULTY', index: 0 },
    status: 'REQUESTED',
    initialMessage: 'Could you mentor me on publishing my ML research project?',
    goals: 'Turn my final-year project into a conference paper.',
    messages: [],
  },
  {
    mentee: 2,
    mentor: { type: 'COMPANY', index: 1 },
    status: 'COMPLETED',
    initialMessage: 'I want to understand how data teams work in industry.',
    goals: 'Learn real-world data pipeline practices.',
    messages: ['Great sessions — good luck with your placements!'],
  },
];

export const DEMO_FACULTY_MENTOR = {
  faculty: 0,
  expertise: ['machine learning', 'research writing'],
  yearsExperience: 15,
};
