/**
 * Demo dataset — students (split from data-people.ts to stay under 500 lines).
 */
import { demoEmail } from './data-people';

export interface DemoStudentSkill {
  name: string;
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  years?: number;
}

export interface DemoStudent {
  key: string;
  email: string;
  institution: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  degree: string;
  branch: string;
  semester: number;
  graduationYear: number;
  cgpa: number;
  city: string;
  state: string;
  bio: string;
  preferredRoles: string[];
  preferredLocations: string[];
  skills: DemoStudentSkill[];
  certifications: { title: string; issuer: string; monthsAgo: number }[];
  projects: { title: string; description: string; role: string; technologies: string[] }[];
}

const s = (name: string, proficiency: DemoStudentSkill['proficiency'], years?: number) => ({
  name,
  proficiency,
  years,
});

export const DEMO_STUDENTS: DemoStudent[] = [
  {
    key: 'aarav',
    email: demoEmail('aarav.sharma'),
    institution: 'nit',
    fullName: 'Aarav Sharma',
    gender: 'MALE',
    degree: 'B.Tech',
    branch: 'Computer Science and Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 8.9,
    city: 'Pune',
    state: 'Maharashtra',
    bio: 'Final-year CSE student who enjoys building data products end to end, from pipelines to dashboards.',
    preferredRoles: ['Data Scientist', 'ML Engineer'],
    preferredLocations: ['Bengaluru', 'Pune', 'Remote'],
    skills: [
      s('Python', 'ADVANCED', 3),
      s('Machine Learning', 'ADVANCED', 2),
      s('Pandas', 'ADVANCED', 2),
      s('SQL', 'INTERMEDIATE', 2),
      s('Scikit-learn', 'INTERMEDIATE', 1),
      s('Data Visualization', 'INTERMEDIATE', 1),
    ],
    certifications: [
      { title: 'Machine Learning Specialization', issuer: 'Coursera', monthsAgo: 8 },
      { title: 'Data Analysis with Python', issuer: 'freeCodeCamp', monthsAgo: 14 },
    ],
    projects: [
      {
        title: 'Retail Demand Forecaster',
        description:
          'Forecasts weekly SKU demand for a mock retail chain using gradient boosting, with a Streamlit dashboard for planners.',
        role: 'Lead developer',
        technologies: ['Python', 'Pandas', 'Scikit-learn'],
      },
    ],
  },
  {
    key: 'diya',
    email: demoEmail('diya.patel'),
    institution: 'nit',
    fullName: 'Diya Patel',
    gender: 'FEMALE',
    degree: 'B.Tech',
    branch: 'Computer Science and Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 9.2,
    city: 'Ahmedabad',
    state: 'Gujarat',
    bio: 'Full-stack developer focused on React and Node.js; open-source contributor.',
    preferredRoles: ['Full Stack Developer', 'Frontend Engineer'],
    preferredLocations: ['Bengaluru', 'Remote'],
    skills: [
      s('JavaScript', 'EXPERT', 4),
      s('TypeScript', 'ADVANCED', 2),
      s('React', 'ADVANCED', 3),
      s('Node.js', 'ADVANCED', 2),
      s('MongoDB', 'INTERMEDIATE', 2),
      s('Git', 'ADVANCED', 3),
    ],
    certifications: [{ title: 'Meta Front-End Developer', issuer: 'Coursera', monthsAgo: 10 }],
    projects: [
      {
        title: 'CampusConnect Event Platform',
        description:
          'A MERN app for college clubs to publish events, manage registrations and send reminders; used by 600+ students.',
        role: 'Full-stack developer',
        technologies: ['React', 'Node.js', 'MongoDB', 'TypeScript'],
      },
      {
        title: 'Open-source UI component fixes',
        description:
          'Contributed accessibility fixes and tests to a popular React component library.',
        role: 'Contributor',
        technologies: ['React', 'TypeScript'],
      },
    ],
  },
  {
    key: 'kabir',
    email: demoEmail('kabir.singh'),
    institution: 'nit',
    fullName: 'Kabir Singh',
    gender: 'MALE',
    degree: 'B.Tech',
    branch: 'Information Technology',
    semester: 7,
    graduationYear: 2027,
    cgpa: 7.8,
    city: 'Nagpur',
    state: 'Maharashtra',
    bio: 'Interested in backend systems and cloud infrastructure.',
    preferredRoles: ['Backend Developer', 'DevOps Engineer'],
    preferredLocations: ['Hyderabad', 'Pune'],
    skills: [
      s('Java', 'ADVANCED', 3),
      s('Spring Boot', 'INTERMEDIATE', 1),
      s('Docker', 'INTERMEDIATE', 1),
      s('Linux', 'INTERMEDIATE', 2),
      s('SQL', 'INTERMEDIATE', 2),
    ],
    certifications: [
      { title: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', monthsAgo: 5 },
    ],
    projects: [
      {
        title: 'Library Microservices',
        description:
          'Split a monolithic library system into Spring Boot services behind an API gateway, containerised with Docker Compose.',
        role: 'Backend developer',
        technologies: ['Java', 'Spring Boot', 'Docker'],
      },
    ],
  },
  {
    key: 'ananya',
    email: demoEmail('ananya.joshi'),
    institution: 'nit',
    fullName: 'Ananya Joshi',
    gender: 'FEMALE',
    degree: 'B.Tech',
    branch: 'Information Technology',
    semester: 5,
    graduationYear: 2028,
    cgpa: 8.4,
    city: 'Pune',
    state: 'Maharashtra',
    bio: 'Third-year IT student exploring UI/UX and frontend engineering.',
    preferredRoles: ['UI Developer', 'Product Designer'],
    preferredLocations: ['Pune', 'Remote'],
    skills: [
      s('HTML', 'ADVANCED', 3),
      s('CSS', 'ADVANCED', 3),
      s('JavaScript', 'INTERMEDIATE', 2),
      s('Figma', 'ADVANCED', 2),
      s('UI Design', 'INTERMEDIATE', 1),
    ],
    certifications: [{ title: 'Google UX Design', issuer: 'Coursera', monthsAgo: 6 }],
    projects: [
      {
        title: 'Hostel Mess Feedback App',
        description:
          'Designed and built a responsive web app that collects and charts daily mess feedback.',
        role: 'Designer and frontend developer',
        technologies: ['Figma', 'HTML', 'CSS', 'JavaScript'],
      },
    ],
  },
  {
    key: 'rohan',
    email: demoEmail('rohan.mehta'),
    institution: 'nit',
    fullName: 'Rohan Mehta',
    gender: 'MALE',
    degree: 'B.Tech',
    branch: 'Computer Science and Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 7.1,
    city: 'Mumbai',
    state: 'Maharashtra',
    bio: 'Competitive programmer interested in fintech backend roles.',
    preferredRoles: ['Software Engineer', 'Backend Developer'],
    preferredLocations: ['Mumbai', 'Pune'],
    skills: [
      s('C++', 'ADVANCED', 3),
      s('Data Structures', 'ADVANCED', 3),
      s('Algorithms', 'ADVANCED', 3),
      s('Python', 'INTERMEDIATE', 1),
      s('Git', 'BEGINNER'),
    ],
    certifications: [],
    projects: [
      {
        title: 'Order Book Matching Engine',
        description:
          'A price-time priority limit order book in C++ with a benchmark harness and unit tests.',
        role: 'Sole developer',
        technologies: ['C++'],
      },
    ],
  },
  {
    key: 'ishita',
    email: demoEmail('ishita.verma'),
    institution: 'nit',
    fullName: 'Ishita Verma',
    gender: 'FEMALE',
    degree: 'B.Tech',
    branch: 'Electronics and Communication Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 8.1,
    city: 'Indore',
    state: 'Madhya Pradesh',
    bio: 'ECE student working at the intersection of embedded systems and data.',
    preferredRoles: ['Embedded Engineer', 'IoT Developer'],
    preferredLocations: ['Pune', 'Bengaluru'],
    skills: [
      s('C', 'ADVANCED', 3),
      s('Python', 'INTERMEDIATE', 2),
      s('MATLAB', 'INTERMEDIATE', 2),
      s('Linux', 'BEGINNER'),
    ],
    certifications: [{ title: 'Embedded Systems Essentials', issuer: 'NPTEL', monthsAgo: 9 }],
    projects: [
      {
        title: 'Solar Panel Health Monitor',
        description:
          'ESP32-based sensor node that streams panel voltage and temperature to a cloud dashboard.',
        role: 'Firmware and dashboard',
        technologies: ['C', 'Python'],
      },
    ],
  },
  {
    key: 'arjun',
    email: demoEmail('arjun.nair'),
    institution: 'rce',
    fullName: 'Arjun Nair',
    gender: 'MALE',
    degree: 'B.E.',
    branch: 'Computer Science and Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 8.6,
    city: 'Kochi',
    state: 'Kerala',
    bio: 'Cloud and DevOps enthusiast; runs the college Linux user group.',
    preferredRoles: ['SRE', 'Cloud Engineer'],
    preferredLocations: ['Hyderabad', 'Bengaluru'],
    skills: [
      s('Kubernetes', 'INTERMEDIATE', 1),
      s('Docker', 'ADVANCED', 2),
      s('Go', 'INTERMEDIATE', 1),
      s('Linux', 'ADVANCED', 3),
      s('AWS', 'INTERMEDIATE', 1),
      s('CI/CD', 'INTERMEDIATE', 1),
    ],
    certifications: [
      { title: 'Certified Kubernetes Application Developer', issuer: 'CNCF', monthsAgo: 3 },
    ],
    projects: [
      {
        title: 'Self-hosted Observability Stack',
        description:
          'Helm charts deploying Prometheus, Grafana and Loki on a k3s cluster with alerting rules.',
        role: 'Platform engineer',
        technologies: ['Kubernetes', 'Docker', 'Go'],
      },
    ],
  },
  {
    key: 'sneha',
    email: demoEmail('sneha.reddy'),
    institution: 'rce',
    fullName: 'Sneha Reddy',
    gender: 'FEMALE',
    degree: 'B.E.',
    branch: 'Computer Science and Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 9.0,
    city: 'Bengaluru',
    state: 'Karnataka',
    bio: 'Interested in NLP and applied deep learning research.',
    preferredRoles: ['ML Engineer', 'Research Intern'],
    preferredLocations: ['Bengaluru'],
    skills: [
      s('Python', 'EXPERT', 4),
      s('Deep Learning', 'ADVANCED', 2),
      s('PyTorch', 'ADVANCED', 2),
      s('NLP', 'INTERMEDIATE', 1),
      s('Machine Learning', 'ADVANCED', 2),
    ],
    certifications: [{ title: 'Deep Learning Specialization', issuer: 'Coursera', monthsAgo: 11 }],
    projects: [
      {
        title: 'Kannada News Classifier',
        description:
          'Fine-tuned a multilingual transformer to classify regional-language news articles by topic.',
        role: 'Researcher',
        technologies: ['Python', 'PyTorch', 'NLP'],
      },
    ],
  },
  {
    key: 'vivaan',
    email: demoEmail('vivaan.gupta'),
    institution: 'rce',
    fullName: 'Vivaan Gupta',
    gender: 'MALE',
    degree: 'B.E.',
    branch: 'Information Science and Engineering',
    semester: 5,
    graduationYear: 2028,
    cgpa: 7.6,
    city: 'Mysuru',
    state: 'Karnataka',
    bio: 'Mobile developer building Flutter apps for local businesses.',
    preferredRoles: ['Mobile Developer'],
    preferredLocations: ['Bengaluru', 'Chennai', 'Remote'],
    skills: [
      s('Flutter', 'ADVANCED', 2),
      s('Dart', 'ADVANCED', 2),
      s('Firebase', 'INTERMEDIATE', 1),
      s('Kotlin', 'BEGINNER'),
    ],
    certifications: [],
    projects: [
      {
        title: 'Kirana Ledger',
        description:
          'Offline-first Flutter app for small shops to track credit sales, synced through Firebase.',
        role: 'Mobile developer',
        technologies: ['Flutter', 'Dart', 'Firebase'],
      },
    ],
  },
  {
    key: 'meghna',
    email: demoEmail('meghna.krishnan'),
    institution: 'rce',
    fullName: 'Meghna Krishnan',
    gender: 'FEMALE',
    degree: 'B.E.',
    branch: 'Electronics and Communication Engineering',
    semester: 7,
    graduationYear: 2027,
    cgpa: 6.9,
    city: 'Chennai',
    state: 'Tamil Nadu',
    bio: 'Exploring a move from electronics into data analytics.',
    preferredRoles: ['Data Analyst'],
    preferredLocations: ['Chennai', 'Bengaluru'],
    skills: [s('Excel', 'ADVANCED', 2), s('SQL', 'BEGINNER'), s('Power BI', 'INTERMEDIATE', 1)],
    certifications: [{ title: 'Google Data Analytics', issuer: 'Coursera', monthsAgo: 4 }],
    projects: [
      {
        title: 'City Air Quality Dashboard',
        description:
          'Power BI dashboard of public air-quality sensor data with monthly trend analysis.',
        role: 'Analyst',
        technologies: ['Power BI', 'Excel'],
      },
    ],
  },
];
