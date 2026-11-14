/**
 * Demo dataset — institutions, companies, faculty and students.
 *
 * Every account lives under DEMO_EMAIL_DOMAIN, a reserved `.test` domain
 * (RFC 2606) that no real signup can use and that can never receive mail. That
 * domain is what marks a record as demo data: the seeder only ever reuses or
 * creates records it can tie back to it, and refuses to touch anything else.
 */

export const DEMO_EMAIL_DOMAIN = 'demo.acadin.test';
export const demoEmail = (local: string): string => `${local}@${DEMO_EMAIL_DOMAIN}`;

export interface DemoInstitution {
  key: string;
  name: string;
  code: string;
  domain: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  website: string;
  verificationStatus: 'VERIFIED' | 'PENDING';
  accountEmail: string;
}

export const DEMO_INSTITUTIONS: DemoInstitution[] = [
  {
    key: 'nit',
    name: 'Northfield Institute of Technology',
    code: 'DEMONIT',
    domain: 'northfield.demo.acadin.test',
    address: 'Plot 12, Hinjewadi Phase 2',
    city: 'Pune',
    state: 'Maharashtra',
    phone: '+91 20 5550 1100',
    website: 'https://northfield.demo.acadin.test',
    verificationStatus: 'VERIFIED',
    accountEmail: demoEmail('placements.northfield'),
  },
  {
    key: 'rce',
    name: 'Riverside College of Engineering',
    code: 'DEMORCE',
    domain: 'riverside.demo.acadin.test',
    address: '45 Outer Ring Road, Marathahalli',
    city: 'Bengaluru',
    state: 'Karnataka',
    phone: '+91 80 5550 2200',
    website: 'https://riverside.demo.acadin.test',
    verificationStatus: 'VERIFIED',
    accountEmail: demoEmail('placements.riverside'),
  },
  // Deliberately left PENDING so the admin verification queue has a request in it.
  {
    key: 'lvu',
    name: 'Lakeview University',
    code: 'DEMOLVU',
    domain: 'lakeview.demo.acadin.test',
    address: '7 Gachibowli Knowledge Park',
    city: 'Hyderabad',
    state: 'Telangana',
    phone: '+91 40 5550 3300',
    website: 'https://lakeview.demo.acadin.test',
    verificationStatus: 'PENDING',
    accountEmail: demoEmail('registrar.lakeview'),
  },
];

export interface DemoCompany {
  key: string;
  email: string;
  companyName: string;
  industry: string;
  description: string;
  website: string;
  phone: string;
  location: string;
  companySize: string;
  foundedYear: number;
  verified: boolean;
}

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    key: 'nimbus',
    email: demoEmail('talent.nimbus'),
    companyName: 'Nimbus Analytics',
    industry: 'Data & AI',
    description:
      'Nimbus Analytics builds forecasting and decision-intelligence products for retail and logistics teams. Engineers work across data pipelines, ML models and the dashboards customers use every day.',
    website: 'https://nimbus.demo.acadin.test',
    phone: '+91 80 5551 0001',
    location: 'Bengaluru, Karnataka',
    companySize: '201-500',
    foundedYear: 2016,
    verified: true,
  },
  {
    key: 'kestrel',
    email: demoEmail('careers.kestrel'),
    companyName: 'Kestrel Fintech',
    industry: 'Financial Services',
    description:
      'Kestrel Fintech runs payment and lending infrastructure for small businesses. The engineering team owns high-throughput Java and Go services with strict reliability and security requirements.',
    website: 'https://kestrel.demo.acadin.test',
    phone: '+91 22 5551 0002',
    location: 'Mumbai, Maharashtra',
    companySize: '501-1000',
    foundedYear: 2013,
    verified: true,
  },
  {
    key: 'orbit',
    email: demoEmail('hiring.orbit'),
    companyName: 'Orbit Cloud Systems',
    industry: 'Cloud Infrastructure',
    description:
      'Orbit Cloud Systems provides managed Kubernetes and observability tooling. New graduates join platform, SRE and developer-experience teams.',
    website: 'https://orbit.demo.acadin.test',
    phone: '+91 40 5551 0003',
    location: 'Hyderabad, Telangana',
    companySize: '51-200',
    foundedYear: 2019,
    verified: true,
  },
  {
    key: 'greengrid',
    email: demoEmail('people.greengrid'),
    companyName: 'GreenGrid Energy Tech',
    industry: 'Clean Energy',
    description:
      'GreenGrid Energy Tech builds IoT monitoring and analytics for solar and battery installations, combining embedded firmware with cloud data platforms.',
    website: 'https://greengrid.demo.acadin.test',
    phone: '+91 20 5551 0004',
    location: 'Pune, Maharashtra',
    companySize: '51-200',
    foundedYear: 2018,
    verified: true,
  },
  // Left unverified so the admin company-verification workflow has work in it.
  {
    key: 'pixelcraft',
    email: demoEmail('studio.pixelcraft'),
    companyName: 'Pixelcraft Studios',
    industry: 'Product Design & Mobile',
    description:
      'Pixelcraft Studios is a product studio designing and shipping mobile and web apps for early-stage startups.',
    website: 'https://pixelcraft.demo.acadin.test',
    phone: '+91 44 5551 0005',
    location: 'Chennai, Tamil Nadu',
    companySize: '11-50',
    foundedYear: 2021,
    verified: false,
  },
];

export interface DemoFaculty {
  key: string;
  email: string;
  institution: string;
  fullName: string;
  designation: string;
  department: string;
  employeeCode: string;
  gender: 'MALE' | 'FEMALE';
  qualifications: string[];
  researchInterests: string[];
  bio: string;
}

export const DEMO_FACULTY: DemoFaculty[] = [
  {
    key: 'meera',
    email: demoEmail('meera.kulkarni'),
    institution: 'nit',
    fullName: 'Dr. Meera Kulkarni',
    designation: 'Associate Professor',
    department: 'Computer Science and Engineering',
    employeeCode: 'NIT-CSE-014',
    gender: 'FEMALE',
    qualifications: ['Ph.D. Computer Science', 'M.Tech Computer Science'],
    researchInterests: ['machine learning', 'data analysis', 'nlp'],
    bio: 'Teaches machine learning and data mining; coordinates industry projects for final-year CSE students.',
  },
  {
    key: 'rahul',
    email: demoEmail('rahul.deshmukh'),
    institution: 'nit',
    fullName: 'Prof. Rahul Deshmukh',
    designation: 'Assistant Professor',
    department: 'Information Technology',
    employeeCode: 'NIT-IT-031',
    gender: 'MALE',
    qualifications: ['M.Tech Software Engineering'],
    researchInterests: ['cloud computing', 'devops', 'microservices'],
    bio: 'Runs the cloud and DevOps lab and mentors students on internship reports.',
  },
  {
    key: 'anita',
    email: demoEmail('anita.rao'),
    institution: 'rce',
    fullName: 'Dr. Anita Rao',
    designation: 'Professor',
    department: 'Electronics and Communication Engineering',
    employeeCode: 'RCE-ECE-005',
    gender: 'FEMALE',
    qualifications: ['Ph.D. Embedded Systems', 'M.E. VLSI Design'],
    researchInterests: ['embedded systems', 'iot', 'computer vision'],
    bio: 'Heads the IoT research group and the department placement committee.',
  },
  {
    key: 'vikram',
    email: demoEmail('vikram.iyer'),
    institution: 'rce',
    fullName: 'Prof. Vikram Iyer',
    designation: 'Assistant Professor',
    department: 'Computer Science and Engineering',
    employeeCode: 'RCE-CSE-022',
    gender: 'MALE',
    qualifications: ['M.Tech Computer Science'],
    researchInterests: ['web development', 'system design', 'software architecture'],
    bio: 'Teaches full-stack web development and software engineering.',
  },
];
