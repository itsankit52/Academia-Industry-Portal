/**
 * Demo dataset — jobs, internships, faculty opportunities and the applications
 * that connect students to them. Dates are expressed relative to "now" so a
 * re-seeded database always has open postings and upcoming interviews.
 */

const CSE = 'Computer Science and Engineering';
const IT = 'Information Technology';
const ISE = 'Information Science and Engineering';
const ECE = 'Electronics and Communication Engineering';

export interface DemoJob {
  key: string;
  company: string;
  title: string;
  description: string;
  location: string;
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
  salaryLpa: [number, number];
  minCgpa?: number;
  branches: string[];
  gradYears: number[];
  required: string[];
  preferred: string[];
  deadlineDays: number;
  openings: number;
  status: 'PUBLISHED' | 'CLOSED' | 'DRAFT';
}

const desc = (role: string, team: string, extra: string) =>
  `${role} on the ${team} team. ${extra} You will work with senior engineers, ship to production in your first quarter, and receive structured mentoring.`;

export const DEMO_JOBS: DemoJob[] = [
  {
    key: 'nimbus-ds',
    company: 'nimbus',
    title: 'Graduate Data Scientist',
    description: desc(
      'Graduate Data Scientist',
      'forecasting',
      'Build and evaluate demand-forecasting models on real retail data.',
    ),
    location: 'Bengaluru',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salaryLpa: [10, 14],
    minCgpa: 7.5,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['Python', 'Machine Learning', 'SQL'],
    preferred: ['Pandas', 'Statistics'],
    deadlineDays: 30,
    openings: 4,
    status: 'PUBLISHED',
  },
  {
    key: 'nimbus-mle',
    company: 'nimbus',
    title: 'Machine Learning Engineer I',
    description: desc(
      'Machine Learning Engineer',
      'ML platform',
      'Productionise models, own feature pipelines and monitoring.',
    ),
    location: 'Bengaluru',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salaryLpa: [14, 18],
    minCgpa: 8,
    branches: [CSE],
    gradYears: [2027],
    required: ['Python', 'Deep Learning', 'PyTorch'],
    preferred: ['MLOps', 'Docker'],
    deadlineDays: 25,
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    key: 'nimbus-da',
    company: 'nimbus',
    title: 'Data Analyst',
    description: desc(
      'Data Analyst',
      'customer insights',
      'Turn product data into dashboards and weekly business reviews.',
    ),
    location: 'Remote',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    salaryLpa: [6, 8],
    minCgpa: 6.5,
    branches: [CSE, IT, ISE, ECE],
    gradYears: [2027],
    required: ['SQL', 'Excel'],
    preferred: ['Power BI', 'Data Visualization'],
    deadlineDays: 40,
    openings: 3,
    status: 'PUBLISHED',
  },
  {
    key: 'kestrel-be',
    company: 'kestrel',
    title: 'Backend Engineer (Java)',
    description: desc(
      'Backend Engineer',
      'payments core',
      'Design and operate high-throughput Java services that move money safely.',
    ),
    location: 'Mumbai',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salaryLpa: [12, 16],
    minCgpa: 7,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['Java', 'Spring Boot', 'SQL'],
    preferred: ['Microservices', 'Docker'],
    deadlineDays: 20,
    openings: 5,
    status: 'PUBLISHED',
  },
  {
    key: 'kestrel-sde',
    company: 'kestrel',
    title: 'Software Development Engineer',
    description: desc(
      'Software Development Engineer',
      'lending platform',
      'Solve algorithm-heavy problems in credit decisioning.',
    ),
    location: 'Mumbai',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salaryLpa: [15, 20],
    minCgpa: 7,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['Data Structures', 'Algorithms'],
    preferred: ['C++', 'Java'],
    deadlineDays: 18,
    openings: 3,
    status: 'PUBLISHED',
  },
  {
    key: 'kestrel-sec',
    company: 'kestrel',
    title: 'Security Analyst',
    description: desc(
      'Security Analyst',
      'application security',
      'Run vulnerability assessments and help teams fix findings.',
    ),
    location: 'Mumbai',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salaryLpa: [9, 12],
    branches: [CSE, IT, ECE],
    gradYears: [2027],
    required: ['Network Security', 'Linux'],
    preferred: ['OWASP', 'Penetration Testing'],
    deadlineDays: -5,
    openings: 1,
    status: 'CLOSED',
  },
  {
    key: 'orbit-sre',
    company: 'orbit',
    title: 'Site Reliability Engineer',
    description: desc(
      'Site Reliability Engineer',
      'managed Kubernetes',
      'Keep customer clusters healthy and automate away toil.',
    ),
    location: 'Hyderabad',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salaryLpa: [13, 17],
    minCgpa: 7,
    branches: [CSE, IT, ISE],
    gradYears: [2027],
    required: ['Kubernetes', 'Linux', 'Docker'],
    preferred: ['Go', 'Prometheus'],
    deadlineDays: 28,
    openings: 3,
    status: 'PUBLISHED',
  },
  {
    key: 'orbit-cloud',
    company: 'orbit',
    title: 'Cloud Support Engineer',
    description: desc(
      'Cloud Support Engineer',
      'customer success',
      'Debug customer deployments and write runbooks.',
    ),
    location: 'Hyderabad',
    workMode: 'ONSITE',
    employmentType: 'CONTRACT',
    salaryLpa: [7, 9],
    branches: [CSE, IT, ISE, ECE],
    gradYears: [2027],
    required: ['Linux', 'AWS'],
    preferred: ['Docker', 'Shell Scripting'],
    deadlineDays: 35,
    openings: 4,
    status: 'PUBLISHED',
  },
  {
    key: 'orbit-fe',
    company: 'orbit',
    title: 'Frontend Engineer',
    description: desc(
      'Frontend Engineer',
      'developer console',
      'Build the React console customers use to manage clusters.',
    ),
    location: 'Remote',
    workMode: 'REMOTE',
    employmentType: 'FULL_TIME',
    salaryLpa: [11, 15],
    minCgpa: 7.5,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['React', 'TypeScript', 'JavaScript'],
    preferred: ['Next.js', 'Tailwind CSS'],
    deadlineDays: 22,
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    key: 'greengrid-emb',
    company: 'greengrid',
    title: 'Embedded Software Engineer',
    description: desc(
      'Embedded Software Engineer',
      'devices',
      'Write firmware for solar inverter monitoring units.',
    ),
    location: 'Pune',
    workMode: 'ONSITE',
    employmentType: 'FULL_TIME',
    salaryLpa: [8, 11],
    minCgpa: 7,
    branches: [ECE],
    gradYears: [2027],
    required: ['C', 'Linux'],
    preferred: ['Python', 'MATLAB'],
    deadlineDays: 26,
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    key: 'greengrid-fs',
    company: 'greengrid',
    title: 'Full Stack Developer',
    description: desc(
      'Full Stack Developer',
      'energy analytics',
      'Build the web dashboards installers use to monitor sites.',
    ),
    location: 'Pune',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salaryLpa: [9, 12],
    minCgpa: 7,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['JavaScript', 'React', 'Node.js'],
    preferred: ['MongoDB', 'TypeScript'],
    deadlineDays: 32,
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    key: 'greengrid-de',
    company: 'greengrid',
    title: 'Data Engineer',
    description: desc(
      'Data Engineer',
      'telemetry',
      'Own ingestion of device telemetry into the analytics warehouse.',
    ),
    location: 'Pune',
    workMode: 'HYBRID',
    employmentType: 'CONTRACT',
    salaryLpa: [10, 13],
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['Python', 'SQL', 'ETL'],
    preferred: ['Apache Spark'],
    deadlineDays: 45,
    openings: 1,
    status: 'DRAFT',
  },
  {
    key: 'pixelcraft-mob',
    company: 'pixelcraft',
    title: 'Mobile App Developer',
    description: desc(
      'Mobile App Developer',
      'client delivery',
      'Ship Flutter apps for startup clients.',
    ),
    location: 'Chennai',
    workMode: 'HYBRID',
    employmentType: 'FULL_TIME',
    salaryLpa: [6, 9],
    branches: [CSE, IT, ISE],
    gradYears: [2027, 2028],
    required: ['Flutter', 'Dart'],
    preferred: ['Firebase'],
    deadlineDays: 30,
    openings: 2,
    status: 'PUBLISHED',
  },
];

export interface DemoInternship {
  key: string;
  company: string;
  title: string;
  description: string;
  location: string;
  workMode: 'REMOTE' | 'HYBRID' | 'ONSITE';
  durationMonths: number;
  stipend: number;
  minCgpa?: number;
  branches: string[];
  gradYears: number[];
  required: string[];
  preferred: string[];
  deadlineDays: number;
  openings: number;
  status: 'PUBLISHED' | 'CLOSED';
}

const idesc = (team: string, extra: string) =>
  `Internship with the ${team} team. ${extra} Interns get a dedicated mentor, weekly reviews and a pre-placement offer track.`;

export const DEMO_INTERNSHIPS: DemoInternship[] = [
  {
    key: 'nimbus-ml-int',
    company: 'nimbus',
    title: 'Machine Learning Intern',
    description: idesc('ML research', 'Prototype forecasting models and run experiments.'),
    location: 'Bengaluru',
    workMode: 'HYBRID',
    durationMonths: 6,
    stipend: 40000,
    minCgpa: 8,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['Python', 'Machine Learning'],
    preferred: ['PyTorch'],
    deadlineDays: 21,
    openings: 3,
    status: 'PUBLISHED',
  },
  {
    key: 'nimbus-da-int',
    company: 'nimbus',
    title: 'Business Analytics Intern',
    description: idesc('customer insights', 'Build dashboards for account managers.'),
    location: 'Remote',
    workMode: 'REMOTE',
    durationMonths: 3,
    stipend: 20000,
    branches: [CSE, IT, ISE, ECE],
    gradYears: [2027, 2028],
    required: ['Excel', 'SQL'],
    preferred: ['Power BI'],
    deadlineDays: 35,
    openings: 4,
    status: 'PUBLISHED',
  },
  {
    key: 'kestrel-be-int',
    company: 'kestrel',
    title: 'Backend Engineering Intern',
    description: idesc('payments core', 'Build internal APIs in Java and Spring Boot.'),
    location: 'Mumbai',
    workMode: 'ONSITE',
    durationMonths: 6,
    stipend: 45000,
    minCgpa: 7,
    branches: [CSE, IT],
    gradYears: [2027],
    required: ['Java', 'SQL'],
    preferred: ['Spring Boot'],
    deadlineDays: 15,
    openings: 4,
    status: 'PUBLISHED',
  },
  {
    key: 'kestrel-qa-int',
    company: 'kestrel',
    title: 'QA Automation Intern',
    description: idesc('quality engineering', 'Write automated API and UI tests.'),
    location: 'Mumbai',
    workMode: 'HYBRID',
    durationMonths: 3,
    stipend: 25000,
    branches: [CSE, IT, ISE],
    gradYears: [2027, 2028],
    required: ['Testing', 'Python'],
    preferred: ['Postman'],
    deadlineDays: -10,
    openings: 2,
    status: 'CLOSED',
  },
  {
    key: 'orbit-devops-int',
    company: 'orbit',
    title: 'DevOps Intern',
    description: idesc('platform', 'Automate cluster provisioning and CI pipelines.'),
    location: 'Hyderabad',
    workMode: 'HYBRID',
    durationMonths: 6,
    stipend: 35000,
    branches: [CSE, IT, ISE],
    gradYears: [2027],
    required: ['Docker', 'Linux'],
    preferred: ['Kubernetes', 'CI/CD'],
    deadlineDays: 24,
    openings: 3,
    status: 'PUBLISHED',
  },
  {
    key: 'orbit-fe-int',
    company: 'orbit',
    title: 'Frontend Intern',
    description: idesc('developer console', 'Build React features for the cluster console.'),
    location: 'Remote',
    workMode: 'REMOTE',
    durationMonths: 4,
    stipend: 30000,
    branches: [CSE, IT, ISE],
    gradYears: [2027, 2028],
    required: ['JavaScript', 'React'],
    preferred: ['TypeScript'],
    deadlineDays: 28,
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    key: 'greengrid-iot-int',
    company: 'greengrid',
    title: 'IoT Firmware Intern',
    description: idesc('devices', 'Develop and test sensor firmware.'),
    location: 'Pune',
    workMode: 'ONSITE',
    durationMonths: 6,
    stipend: 25000,
    branches: [ECE],
    gradYears: [2027],
    required: ['C'],
    preferred: ['Python'],
    deadlineDays: 30,
    openings: 2,
    status: 'PUBLISHED',
  },
  {
    key: 'greengrid-ui-int',
    company: 'greengrid',
    title: 'UI/UX Design Intern',
    description: idesc('product design', 'Design installer-facing dashboards in Figma.'),
    location: 'Pune',
    workMode: 'HYBRID',
    durationMonths: 3,
    stipend: 18000,
    branches: [CSE, IT, ISE, ECE],
    gradYears: [2027, 2028],
    required: ['Figma', 'UI Design'],
    preferred: ['UX Design'],
    deadlineDays: 33,
    openings: 1,
    status: 'PUBLISHED',
  },
  {
    key: 'pixelcraft-flutter-int',
    company: 'pixelcraft',
    title: 'Flutter Developer Intern',
    description: idesc('mobile', 'Build screens and integrations for client apps.'),
    location: 'Chennai',
    workMode: 'HYBRID',
    durationMonths: 3,
    stipend: 15000,
    branches: [CSE, IT, ISE],
    gradYears: [2027, 2028],
    required: ['Flutter'],
    preferred: ['Dart', 'Firebase'],
    deadlineDays: 27,
    openings: 2,
    status: 'PUBLISHED',
  },
];

export interface DemoFacultyOpportunity {
  key: string;
  hostType: 'COMPANY' | 'INSTITUTION';
  host: string;
  title: string;
  description: string;
  opportunityType:
    'FACULTY_INTERNSHIP' | 'FDP' | 'CONSULTANCY' | 'COLLABORATIVE_RESEARCH' | 'PROJECT';
  expertise: string[];
  qualifications: string[];
  durationWeeks: number;
  stipend?: number;
  location: string;
  mode: 'REMOTE' | 'HYBRID' | 'ONSITE';
  deadlineDays: number;
  openings: number;
  targetRoles: ('STUDENT' | 'FACULTY')[];
}

export const DEMO_FACULTY_OPPORTUNITIES: DemoFacultyOpportunity[] = [
  {
    key: 'nimbus-fdp',
    hostType: 'COMPANY',
    host: 'nimbus',
    title: 'FDP: Applied Machine Learning in Industry',
    description:
      'A two-week faculty development programme covering how ML systems are built, evaluated and monitored in production, with hands-on labs.',
    opportunityType: 'FDP',
    expertise: ['machine learning', 'python'],
    qualifications: ['Ph.D. or M.Tech in CS/IT'],
    durationWeeks: 2,
    location: 'Bengaluru',
    mode: 'HYBRID',
    deadlineDays: 25,
    openings: 15,
    targetRoles: ['FACULTY'],
  },
  {
    key: 'orbit-fi',
    hostType: 'COMPANY',
    host: 'orbit',
    title: 'Faculty Industry Internship: Cloud Native Platforms',
    description:
      'Spend six weeks embedded with our platform team to bring current cloud-native practice back into the curriculum.',
    opportunityType: 'FACULTY_INTERNSHIP',
    expertise: ['cloud computing', 'devops'],
    qualifications: ['Teaching cloud or DevOps courses'],
    durationWeeks: 6,
    stipend: 60000,
    location: 'Hyderabad',
    mode: 'ONSITE',
    deadlineDays: 30,
    openings: 3,
    targetRoles: ['FACULTY'],
  },
  {
    key: 'greengrid-consult',
    hostType: 'COMPANY',
    host: 'greengrid',
    title: 'Consultancy: Battery Health Estimation',
    description:
      'Seeking faculty consultants to advise on state-of-health estimation algorithms for lithium battery packs.',
    opportunityType: 'CONSULTANCY',
    expertise: ['embedded systems', 'machine learning'],
    qualifications: ['Research in embedded systems or signal processing'],
    durationWeeks: 12,
    stipend: 150000,
    location: 'Pune',
    mode: 'REMOTE',
    deadlineDays: 40,
    openings: 2,
    targetRoles: ['FACULTY'],
  },
  {
    key: 'nit-research',
    hostType: 'INSTITUTION',
    host: 'nit',
    title: 'Student Research Project: Campus Energy Analytics',
    description:
      'Faculty-guided research project analysing campus electricity usage data to recommend savings; open to final-year students.',
    opportunityType: 'PROJECT',
    expertise: ['data analysis', 'python'],
    qualifications: [],
    durationWeeks: 10,
    location: 'Pune',
    mode: 'ONSITE',
    deadlineDays: 20,
    openings: 4,
    targetRoles: ['STUDENT'],
  },
];

/** Faculty applications to company-hosted faculty opportunities. */
export const DEMO_FACULTY_APPLICATIONS: {
  faculty: string;
  opportunity: string;
  status: 'APPLIED' | 'SHORTLISTED' | 'SELECTED' | 'UNDER_REVIEW';
}[] = [
  { faculty: 'meera', opportunity: 'nimbus-fdp', status: 'SELECTED' },
  { faculty: 'rahul', opportunity: 'orbit-fi', status: 'SHORTLISTED' },
  { faculty: 'anita', opportunity: 'greengrid-consult', status: 'UNDER_REVIEW' },
  { faculty: 'vikram', opportunity: 'nimbus-fdp', status: 'APPLIED' },
];

export type DemoAppStatus =
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'INTERVIEW_SCHEDULED'
  | 'SELECTED'
  | 'REJECTED'
  | 'OFFER_ACCEPTED';

export interface DemoApplication {
  student: string;
  type: 'JOB' | 'INTERNSHIP';
  opportunity: string;
  status: DemoAppStatus;
  daysAgo: number;
  /** For INTERVIEW_SCHEDULED: days from now. Negative = a completed interview. */
  interviewInDays?: number;
}

export const DEMO_APPLICATIONS: DemoApplication[] = [
  {
    student: 'aarav',
    type: 'JOB',
    opportunity: 'nimbus-ds',
    status: 'INTERVIEW_SCHEDULED',
    daysAgo: 12,
    interviewInDays: 3,
  },
  {
    student: 'aarav',
    type: 'INTERNSHIP',
    opportunity: 'nimbus-ml-int',
    status: 'SHORTLISTED',
    daysAgo: 9,
  },
  { student: 'aarav', type: 'JOB', opportunity: 'greengrid-fs', status: 'APPLIED', daysAgo: 2 },
  {
    student: 'diya',
    type: 'JOB',
    opportunity: 'orbit-fe',
    status: 'OFFER_ACCEPTED',
    daysAgo: 30,
    interviewInDays: -18,
  },
  { student: 'diya', type: 'JOB', opportunity: 'greengrid-fs', status: 'SHORTLISTED', daysAgo: 6 },
  {
    student: 'diya',
    type: 'INTERNSHIP',
    opportunity: 'orbit-fe-int',
    status: 'UNDER_REVIEW',
    daysAgo: 4,
  },
  {
    student: 'kabir',
    type: 'JOB',
    opportunity: 'kestrel-be',
    status: 'INTERVIEW_SCHEDULED',
    daysAgo: 10,
    interviewInDays: 5,
  },
  {
    student: 'kabir',
    type: 'INTERNSHIP',
    opportunity: 'orbit-devops-int',
    status: 'APPLIED',
    daysAgo: 3,
  },
  { student: 'kabir', type: 'JOB', opportunity: 'orbit-cloud', status: 'REJECTED', daysAgo: 20 },
  {
    student: 'ananya',
    type: 'INTERNSHIP',
    opportunity: 'greengrid-ui-int',
    status: 'SELECTED',
    daysAgo: 18,
    interviewInDays: -7,
  },
  {
    student: 'ananya',
    type: 'INTERNSHIP',
    opportunity: 'orbit-fe-int',
    status: 'APPLIED',
    daysAgo: 1,
  },
  { student: 'rohan', type: 'JOB', opportunity: 'kestrel-sde', status: 'SHORTLISTED', daysAgo: 8 },
  { student: 'rohan', type: 'JOB', opportunity: 'nimbus-ds', status: 'REJECTED', daysAgo: 15 },
  {
    student: 'ishita',
    type: 'JOB',
    opportunity: 'greengrid-emb',
    status: 'INTERVIEW_SCHEDULED',
    daysAgo: 7,
    interviewInDays: 2,
  },
  {
    student: 'ishita',
    type: 'INTERNSHIP',
    opportunity: 'greengrid-iot-int',
    status: 'UNDER_REVIEW',
    daysAgo: 5,
  },
  {
    student: 'arjun',
    type: 'JOB',
    opportunity: 'orbit-sre',
    status: 'SELECTED',
    daysAgo: 25,
    interviewInDays: -12,
  },
  {
    student: 'arjun',
    type: 'INTERNSHIP',
    opportunity: 'orbit-devops-int',
    status: 'SHORTLISTED',
    daysAgo: 6,
  },
  { student: 'arjun', type: 'JOB', opportunity: 'orbit-cloud', status: 'APPLIED', daysAgo: 2 },
  {
    student: 'sneha',
    type: 'JOB',
    opportunity: 'nimbus-mle',
    status: 'INTERVIEW_SCHEDULED',
    daysAgo: 9,
    interviewInDays: 4,
  },
  {
    student: 'sneha',
    type: 'INTERNSHIP',
    opportunity: 'nimbus-ml-int',
    status: 'UNDER_REVIEW',
    daysAgo: 5,
  },
  {
    student: 'vivaan',
    type: 'INTERNSHIP',
    opportunity: 'pixelcraft-flutter-int',
    status: 'SHORTLISTED',
    daysAgo: 7,
  },
  { student: 'vivaan', type: 'JOB', opportunity: 'pixelcraft-mob', status: 'APPLIED', daysAgo: 3 },
  { student: 'meghna', type: 'JOB', opportunity: 'nimbus-da', status: 'UNDER_REVIEW', daysAgo: 6 },
  {
    student: 'meghna',
    type: 'INTERNSHIP',
    opportunity: 'nimbus-da-int',
    status: 'REJECTED',
    daysAgo: 14,
  },
];

/** Saved (bookmarked) opportunities per student. */
export const DEMO_SAVED: { student: string; type: 'JOB' | 'INTERNSHIP'; opportunity: string }[] = [
  { student: 'aarav', type: 'JOB', opportunity: 'nimbus-mle' },
  { student: 'diya', type: 'JOB', opportunity: 'orbit-fe' },
  { student: 'kabir', type: 'JOB', opportunity: 'orbit-sre' },
  { student: 'sneha', type: 'INTERNSHIP', opportunity: 'nimbus-ml-int' },
  { student: 'meghna', type: 'JOB', opportunity: 'orbit-cloud' },
];
