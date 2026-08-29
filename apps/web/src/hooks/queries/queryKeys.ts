export const queryKeys = {
  studentDashboard: () => ['student', 'dashboard'] as const,
  studentProfile: () => ['student', 'profile'] as const,
  studentSkills: () => ['student', 'skills'] as const,
  skillsCatalog: () => ['skills', 'catalog'] as const,
  studentResume: () => ['student', 'resume'] as const,
  savedOpportunities: () => ['student', 'saved'] as const,
  studentApplications: (filters?: object) => ['student', 'applications', filters] as const,
  studentApplication: (id: string) => ['student', 'application', id] as const,
  studentInterviews: (tab?: string) => ['student', 'interviews', tab] as const,
  studentInterview: (id: string) => ['student', 'interview', id] as const,
  studentNotifications: () => ['student', 'notifications'] as const,
  recommendations: (kind: string) => ['recommendations', kind] as const,
  jobs: (filters?: object) => ['jobs', filters] as const,
  internships: (filters?: object) => ['internships', filters] as const,
  trainings: (filters?: object) => ['trainings', 'list', filters] as const,
  recommendedTrainings: () => ['trainings', 'recommended'] as const,
  learningRecommendations: (params?: object) =>
    ['recommendations', 'learning', params ?? {}] as const,
  fullMatch: (type: string, id: string) => ['recommendations', 'full-match', type, id] as const,

  student: {
    dashboard: ['student', 'dashboard'] as const,
    assessments: {
      all: ['student', 'assessments'] as const,
      list: (page?: number) => ['student', 'assessments', 'list', page ?? 1] as const,
      latest: ['student', 'assessments', 'latest'] as const,
      summary: ['student', 'assessments', 'summary'] as const,
      detail: (id: string) => ['student', 'assessments', 'detail', id] as const,
    },
  },

  company: {
    dashboard: () => ['company', 'dashboard'] as const,
    profile: () => ['company', 'profile'] as const,
    jobs: (filters?: object) => ['company', 'jobs', filters] as const,
    internships: (filters?: object) => ['company', 'internships', filters] as const,
    applicants: (filters?: object) => ['company', 'applicants', filters] as const,
    candidate: (id: string) => ['company', 'candidate', id] as const,
    interviews: (filters?: object) => ['company', 'interviews', filters] as const,
    facultyOpps: (filters?: object) => ['company', 'faculty-opps', filters] as const,
    facultyOpp: (id: string) => ['company', 'faculty-opp', id] as const,
  },

  faculty: {
    dashboard: () => ['faculty', 'dashboard'] as const,
    profile: () => ['faculty', 'profile'] as const,
    applications: (filters?: object) => ['faculty', 'applications', filters] as const,
    application: (id: string) => ['faculty', 'application', id] as const,
    opportunities: (filters?: object) => ['faculty', 'opportunities', filters] as const,
    opportunity: (id: string) => ['faculty', 'opportunity', id] as const,
    countByStatus: () => ['faculty', 'count-by-status'] as const,
  },

  admin: {
    dashboard: () => ['admin', 'analytics', 'dashboard'] as const,
    analyticsSkills: () => ['admin', 'analytics', 'skills'] as const,
    analyticsPlacements: () => ['admin', 'analytics', 'placements'] as const,
    industrySkillDemand: () => ['admin', 'analytics', 'industry-skill-demand'] as const,
    students: (filters?: object) => ['admin', 'students', filters] as const,
    companies: (filters?: object) => ['admin', 'companies', filters] as const,
    jobs: (filters?: object) => ['admin', 'jobs', filters] as const,
    internships: (filters?: object) => ['admin', 'internships', filters] as const,
    applications: (filters?: object) => ['admin', 'applications', filters] as const,
    auditLogs: (filters?: object) => ['admin', 'audit-logs', filters] as const,
    trainings: (filters?: object) => ['admin', 'trainings', filters] as const,
  },

  institution: {
    stats: (filters?: object) => ['institution', 'stats', filters] as const,
    students: (filters?: object) => ['institution', 'students', 'list', filters] as const,
    student: (id: string) => ['institution', 'students', id] as const,
    faculty: (filters?: object) => ['institution', 'faculty', 'list', filters] as const,
    facultyMember: (id: string) => ['institution', 'faculty', id] as const,
    skillGaps: (institutionId?: string) => ['institution', 'skill-gaps', institutionId] as const,
    placements: (institutionId?: string) => ['institution', 'placements', institutionId] as const,
    fdps: (institutionId?: string) => ['institution', 'fdps', institutionId] as const,
  },

  skills: (filters?: object) => ['skills', 'list', filters] as const,
  notifications: (scope: string) => ['notifications', scope] as const,

  documents: {
    mine: (filters?: object) => ['documents', 'mine', filters] as const,
    detail: (id: string) => ['documents', 'detail', id] as const,
  },

  portfolio: (studentId: string) => ['portfolio', studentId] as const,

  verifications: {
    queue: (scope: string, filters?: object) => ['verifications', 'queue', scope, filters] as const,
  },

  aptitude: {
    all: ['aptitude'] as const,
    categories: () => ['aptitude', 'categories'] as const,
    myTests: (filters?: object) => ['aptitude', 'tests', 'me', filters] as const,
    test: (id: string) => ['aptitude', 'tests', id] as const,
    adminQuestions: (filters?: object) => ['aptitude', 'admin', 'questions', filters] as const,
  },

  mentorship: {
    mentors: (filters?: object) => ['mentorship', 'mentors', filters] as const,
    mentor: (userId: string) => ['mentorship', 'mentor', userId] as const,
    requestsAsMentee: (filters?: object) => ['mentorship', 'requests', 'mentee', filters] as const,
    requestsAsMentor: (filters?: object) => ['mentorship', 'requests', 'mentor', filters] as const,
    request: (id: string) => ['mentorship', 'request', id] as const,
    messages: (requestId: string, filters?: object) =>
      ['mentorship', 'messages', requestId, filters] as const,
    adminAll: (filters?: object) => ['mentorship', 'admin', 'all', filters] as const,
  },

  interim: {
    forApp: (appId: string, filters?: object) => ['interim', 'app', appId, filters] as const,
    detail: (id: string) => ['interim', 'detail', id] as const,
  },

  events: {
    list: (filters?: object) => ['events', 'list', filters] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
    myRegistrations: (filters?: object) => ['events', 'mine', 'registrations', filters] as const,
    registrations: (eventId: string, filters?: object) =>
      ['events', 'registrations', eventId, filters] as const,
  },
};
