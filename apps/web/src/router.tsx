import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
import StudentLayout from '@/layouts/StudentLayout';
import CompanyLayout from '@/layouts/CompanyLayout';
import AdminLayout from '@/layouts/AdminLayout';
import FacultyLayout from '@/layouts/FacultyLayout';
import InstitutionLayout from '@/layouts/InstitutionLayout';
import RequireAuth from '@/routes/guards/RequireAuth';
import RequireRole from '@/routes/guards/RequireRole';
import PageSkeleton from '@/components/ui/PageSkeleton';

function s(Component: ComponentType) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

const Landing = lazy(() => import('@/pages/public/Landing'));
const About = lazy(() => import('@/pages/public/About'));
const Contact = lazy(() => import('@/pages/public/Contact'));
const UserGuide = lazy(() => import('@/pages/public/UserGuide'));
const PublicJobs = lazy(() => import('@/pages/public/PublicJobs'));
const PublicJobDetails = lazy(() => import('@/pages/public/PublicJobDetails'));
const PublicInternships = lazy(() => import('@/pages/public/PublicInternships'));
const PublicInternshipDetails = lazy(() => import('@/pages/public/PublicInternshipDetails'));
const NotFound = lazy(() => import('@/pages/public/NotFound'));

const Login = lazy(() => import('@/pages/auth/Login'));
const Register = lazy(() => import('@/pages/auth/Register'));

const PublicPortfolio = lazy(() => import('@/pages/portfolio/PublicPortfolio'));

const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'));
const StudentProfile = lazy(() => import('@/pages/student/StudentProfile'));
const StudentEditProfile = lazy(() => import('@/pages/student/StudentEditProfile'));
const StudentSkills = lazy(() => import('@/pages/student/StudentSkills'));
const StudentResume = lazy(() => import('@/pages/student/StudentResume'));
const StudentRecommended = lazy(() => import('@/pages/student/StudentRecommended'));
const StudentJobs = lazy(() => import('@/pages/student/StudentJobs'));
const StudentInternships = lazy(() => import('@/pages/student/StudentInternships'));
const StudentSaved = lazy(() => import('@/pages/student/StudentSaved'));
const StudentApplications = lazy(() => import('@/pages/student/StudentApplications'));
const StudentApplicationDetails = lazy(() => import('@/pages/student/StudentApplicationDetails'));
const StudentInterviews = lazy(() => import('@/pages/student/StudentInterviews'));
const StudentInterviewDetails = lazy(() => import('@/pages/student/StudentInterviewDetails'));
const StudentNotifications = lazy(() => import('@/pages/student/StudentNotifications'));
const StudentSkillGap = lazy(() => import('@/pages/student/StudentSkillGap'));
const StudentSkillProfile = lazy(() => import('@/pages/student/StudentSkillProfile'));
const StudentTraining = lazy(() => import('@/pages/student/StudentTraining'));
const StudentLearning = lazy(() => import('@/pages/student/StudentLearning'));
const StudentSettings = lazy(() => import('@/pages/student/StudentSettings'));
const StudentAssessments = lazy(() => import('@/pages/student/StudentAssessments'));
const StudentAssessmentTake = lazy(() => import('@/pages/student/StudentAssessmentTake'));
const StudentAssessmentResult = lazy(() => import('@/pages/student/StudentAssessmentResult'));
const StudentAptitude = lazy(() => import('@/pages/student/StudentAptitude'));
const StudentAptitudeTake = lazy(() => import('@/pages/student/StudentAptitudeTake'));
const StudentAptitudeResult = lazy(() => import('@/pages/student/StudentAptitudeResult'));
const StudentDocuments = lazy(() => import('@/pages/student/StudentDocuments'));

const CompanyDashboard = lazy(() => import('@/pages/company/CompanyDashboard'));
const CompanyProfile = lazy(() => import('@/pages/company/CompanyProfile'));
const CompanyEditProfile = lazy(() => import('@/pages/company/CompanyEditProfile'));
const CompanyJobs = lazy(() => import('@/pages/company/CompanyJobs'));
const CompanyJobCreate = lazy(() => import('@/pages/company/CompanyJobCreate'));
const CompanyJobEdit = lazy(() => import('@/pages/company/CompanyJobEdit'));
const CompanyJobManage = lazy(() => import('@/pages/company/CompanyJobManage'));
const CompanyInternships = lazy(() => import('@/pages/company/CompanyInternships'));
const CompanyInternshipCreate = lazy(() => import('@/pages/company/CompanyInternshipCreate'));
const CompanyInternshipEdit = lazy(() => import('@/pages/company/CompanyInternshipEdit'));
const CompanyInternshipManage = lazy(() => import('@/pages/company/CompanyInternshipManage'));
const CompanyApplicants = lazy(() => import('@/pages/company/CompanyApplicants'));
const CompanyApplicantDetails = lazy(() => import('@/pages/company/CompanyApplicantDetails'));
const CompanyShortlisted = lazy(() => import('@/pages/company/CompanyShortlisted'));
const CompanyInterviews = lazy(() => import('@/pages/company/CompanyInterviews'));
const CompanyNotifications = lazy(() => import('@/pages/company/CompanyNotifications'));
const CompanySettings = lazy(() => import('@/pages/company/CompanySettings'));
const CompanyManageFacultyOpps = lazy(() => import('@/pages/company/CompanyManageFacultyOpps'));
const CompanyCreateFacultyOpp = lazy(() => import('@/pages/company/CompanyCreateFacultyOpp'));
const CompanyEditFacultyOpp = lazy(() => import('@/pages/company/CompanyEditFacultyOpp'));

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminStudents = lazy(() => import('@/pages/admin/AdminStudents'));
const AdminCompanies = lazy(() => import('@/pages/admin/AdminCompanies'));
const AdminJobs = lazy(() => import('@/pages/admin/AdminJobs'));
const AdminInternships = lazy(() => import('@/pages/admin/AdminInternships'));
const AdminApplications = lazy(() => import('@/pages/admin/AdminApplications'));
const AdminSkills = lazy(() => import('@/pages/admin/AdminSkills'));
const AdminAptitudeQuestions = lazy(() => import('@/pages/admin/AdminAptitudeQuestions'));
const AdminTraining = lazy(() => import('@/pages/admin/AdminTraining'));
const AdminAnalytics = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminIndustrySkillDemand = lazy(() => import('@/pages/admin/AdminIndustrySkillDemand'));
const AdminAuditLogs = lazy(() => import('@/pages/admin/AdminAuditLogs'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminVerificationQueue = lazy(() => import('@/pages/admin/AdminVerificationQueue'));
const AdminCollaborationHub = lazy(() => import('@/pages/admin/AdminCollaborationHub'));

const CompanyVerifications = lazy(() => import('@/pages/company/CompanyVerifications'));

const FacultyDashboard = lazy(() => import('@/pages/faculty/FacultyDashboard'));
const FacultyBrowseOpportunities = lazy(() => import('@/pages/faculty/FacultyBrowseOpportunities'));
const FacultyOpportunityDetails = lazy(() => import('@/pages/faculty/FacultyOpportunityDetails'));
const FacultyApplications = lazy(() => import('@/pages/faculty/FacultyApplications'));
const FacultyApplicationDetails = lazy(() => import('@/pages/faculty/FacultyApplicationDetails'));
const FacultyProfile = lazy(() => import('@/pages/faculty/FacultyProfile'));
const FacultyEditProfile = lazy(() => import('@/pages/faculty/FacultyEditProfile'));
const FacultySettings = lazy(() => import('@/pages/faculty/FacultySettings'));

const InstitutionDashboard = lazy(() => import('@/pages/institution/InstitutionDashboard'));
const InstitutionStudents = lazy(() => import('@/pages/institution/InstitutionStudents'));
const InstitutionStudentDetails = lazy(
  () => import('@/pages/institution/InstitutionStudentDetails'),
);
const InstitutionFaculty = lazy(() => import('@/pages/institution/InstitutionFaculty'));
const InstitutionFacultyDetails = lazy(
  () => import('@/pages/institution/InstitutionFacultyDetails'),
);
const InstitutionSkillGaps = lazy(() => import('@/pages/institution/InstitutionSkillGaps'));
const InstitutionPlacements = lazy(() => import('@/pages/institution/InstitutionPlacements'));
const InstitutionFdps = lazy(() => import('@/pages/institution/InstitutionFdps'));
const InstitutionCollaborationHub = lazy(
  () => import('@/pages/institution/InstitutionCollaborationHub'),
);
const InstitutionSettings = lazy(() => import('@/pages/institution/InstitutionSettings'));
const InstitutionVerifications = lazy(() => import('@/pages/institution/InstitutionVerifications'));

const StudentMentorship = lazy(() => import('@/pages/student/StudentMentorship'));
const StudentMentorshipDetails = lazy(() => import('@/pages/student/StudentMentorshipDetails'));
const StudentInterimReports = lazy(() => import('@/pages/student/StudentInterimReports'));
const StudentEvents = lazy(() => import('@/pages/student/StudentEvents'));
const StudentMyRegistrations = lazy(() => import('@/pages/student/StudentMyRegistrations'));
const StudentCollaborationHub = lazy(() => import('@/pages/student/StudentCollaborationHub'));

const FacultyMentorship = lazy(() => import('@/pages/faculty/FacultyMentorship'));
const FacultyMentorshipDetails = lazy(() => import('@/pages/faculty/FacultyMentorshipDetails'));
const FacultyEvents = lazy(() => import('@/pages/faculty/FacultyEvents'));
const FacultyEventCreate = lazy(() => import('@/pages/faculty/FacultyEventCreate'));
const FacultyCollaborationHub = lazy(() => import('@/pages/faculty/FacultyCollaborationHub'));
const FacultyEventEdit = lazy(() => import('@/pages/faculty/FacultyEventEdit'));
const FacultyEventDetails = lazy(() => import('@/pages/faculty/FacultyEventDetails'));

const CompanyMentorship = lazy(() => import('@/pages/company/CompanyMentorship'));
const CompanyMentorshipDetails = lazy(() => import('@/pages/company/CompanyMentorshipDetails'));
const CompanyEvents = lazy(() => import('@/pages/company/CompanyEvents'));
const CompanyEventCreate = lazy(() => import('@/pages/company/CompanyEventCreate'));
const CompanyEventEdit = lazy(() => import('@/pages/company/CompanyEventEdit'));
const CompanyEventDetails = lazy(() => import('@/pages/company/CompanyEventDetails'));
const CompanyInterimReports = lazy(() => import('@/pages/company/CompanyInterimReports'));
const CompanyCollaborationHub = lazy(() => import('@/pages/company/CompanyCollaborationHub'));

const InstitutionEvents = lazy(() => import('@/pages/institution/InstitutionEvents'));
const InstitutionEventCreate = lazy(() => import('@/pages/institution/InstitutionEventCreate'));
const InstitutionEventEdit = lazy(() => import('@/pages/institution/InstitutionEventEdit'));
const InstitutionEventDetails = lazy(() => import('@/pages/institution/InstitutionEventDetails'));

const AdminEvents = lazy(() => import('@/pages/admin/AdminEvents'));
const AdminMentorship = lazy(() => import('@/pages/admin/AdminMentorship'));

const EventsPublic = lazy(() => import('@/pages/EventsPublic'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: s(Landing) },
      { path: 'about', element: s(About) },
      { path: 'contact', element: s(Contact) },
      { path: 'guide', element: s(UserGuide) },
      { path: 'login', element: s(Login) },
      { path: 'register', element: s(Register) },
      { path: 'jobs', element: s(PublicJobs) },
      { path: 'jobs/:id', element: s(PublicJobDetails) },
      { path: 'internships', element: s(PublicInternships) },
      { path: 'internships/:id', element: s(PublicInternshipDetails) },
      { path: 'portfolio/:studentId', element: s(PublicPortfolio) },
      { path: 'events', element: s(EventsPublic) },
      { path: 'events/:id', element: s(EventsPublic) },
    ],
  },
  {
    path: '/student',
    element: <RequireAuth />,
    children: [
      {
        element: (
          <RequireRole role="STUDENT">
            <StudentLayout />
          </RequireRole>
        ),
        children: [
          { path: 'dashboard', element: s(StudentDashboard) },
          { path: 'profile', element: s(StudentProfile) },
          { path: 'profile/edit', element: s(StudentEditProfile) },
          { path: 'skills', element: s(StudentSkills) },
          { path: 'resume', element: s(StudentResume) },
          { path: 'documents', element: s(StudentDocuments) },
          { path: 'recommended', element: s(StudentRecommended) },
          { path: 'jobs', element: s(StudentJobs) },
          // The student lists, recommendations and saved page all link to
          // `/student/{jobs,internships}/:id`. Without these children every card
          // click fell through to the catch-all NotFound route. The detail pages
          // are reused as-is; they read the same public GET endpoint, which
          // already refuses to serve a non-published posting to a student.
          { path: 'jobs/:id', element: s(PublicJobDetails) },
          { path: 'internships', element: s(StudentInternships) },
          { path: 'internships/:id', element: s(PublicInternshipDetails) },
          { path: 'saved', element: s(StudentSaved) },
          { path: 'applications', element: s(StudentApplications) },
          { path: 'applications/:id', element: s(StudentApplicationDetails) },
          { path: 'interviews', element: s(StudentInterviews) },
          // `interviews.service.ts` writes its interview notifications with the
          // link `/student/interviews/<id>`. Without this child that link matched
          // nothing and fell through to the catch-all NotFound route, so a student
          // could never open the interview to reach its meeting link. The page
          // reads the existing `GET /interviews/:id`, which already refuses an
          // interview belonging to anyone else.
          { path: 'interviews/:id', element: s(StudentInterviewDetails) },
          { path: 'notifications', element: s(StudentNotifications) },
          { path: 'skill-gap', element: s(StudentSkillGap) },
          { path: 'skill-profile', element: s(StudentSkillProfile) },
          { path: 'assessments', element: s(StudentAssessments) },
          { path: 'assessments/:id/take', element: s(StudentAssessmentTake) },
          { path: 'assessments/:id', element: s(StudentAssessmentResult) },
          { path: 'aptitude', element: s(StudentAptitude) },
          { path: 'aptitude/tests/:id', element: s(StudentAptitudeTake) },
          { path: 'aptitude/tests/:id/result', element: s(StudentAptitudeResult) },
          { path: 'training', element: s(StudentTraining) },
          { path: 'learning', element: s(StudentLearning) },
          { path: 'mentorship', element: s(StudentMentorship) },
          { path: 'mentorship/:requestId', element: s(StudentMentorshipDetails) },
          { path: 'applications/:appId/reports', element: s(StudentInterimReports) },
          { path: 'events', element: s(StudentEvents) },
          { path: 'events/registrations', element: s(StudentMyRegistrations) },
          { path: 'collaboration', element: s(StudentCollaborationHub) },
          { path: 'settings', element: s(StudentSettings) },
        ],
      },
    ],
  },
  {
    path: '/company',
    element: <RequireAuth />,
    children: [
      {
        element: (
          <RequireRole role="COMPANY">
            <CompanyLayout />
          </RequireRole>
        ),
        children: [
          { path: 'dashboard', element: s(CompanyDashboard) },
          { path: 'profile', element: s(CompanyProfile) },
          { path: 'profile/edit', element: s(CompanyEditProfile) },
          { path: 'jobs', element: s(CompanyJobs) },
          { path: 'jobs/new', element: s(CompanyJobCreate) },
          { path: 'jobs/:id/edit', element: s(CompanyJobEdit) },
          { path: 'jobs/manage', element: s(CompanyJobManage) },
          { path: 'internships', element: s(CompanyInternships) },
          { path: 'internships/new', element: s(CompanyInternshipCreate) },
          { path: 'internships/:id/edit', element: s(CompanyInternshipEdit) },
          { path: 'internships/manage', element: s(CompanyInternshipManage) },
          { path: 'applicants', element: s(CompanyApplicants) },
          { path: 'applicants/:id', element: s(CompanyApplicantDetails) },
          { path: 'shortlisted', element: s(CompanyShortlisted) },
          { path: 'interviews', element: s(CompanyInterviews) },
          { path: 'notifications', element: s(CompanyNotifications) },
          { path: 'verifications', element: s(CompanyVerifications) },
          { path: 'faculty-opportunities', element: s(CompanyManageFacultyOpps) },
          { path: 'faculty-opportunities/new', element: s(CompanyCreateFacultyOpp) },
          { path: 'faculty-opportunities/:id/edit', element: s(CompanyEditFacultyOpp) },
          { path: 'mentorship', element: s(CompanyMentorship) },
          { path: 'mentorship/:requestId', element: s(CompanyMentorshipDetails) },
          { path: 'events', element: s(CompanyEvents) },
          { path: 'events/new', element: s(CompanyEventCreate) },
          { path: 'events/:id', element: s(CompanyEventDetails) },
          { path: 'events/:id/edit', element: s(CompanyEventEdit) },
          { path: 'applications/:appId/reports', element: s(CompanyInterimReports) },
          { path: 'collaboration', element: s(CompanyCollaborationHub) },
          { path: 'settings', element: s(CompanySettings) },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <RequireAuth />,
    children: [
      {
        element: (
          <RequireRole role="ADMIN">
            <AdminLayout />
          </RequireRole>
        ),
        children: [
          { path: 'dashboard', element: s(AdminDashboard) },
          { path: 'students', element: s(AdminStudents) },
          { path: 'companies', element: s(AdminCompanies) },
          { path: 'jobs', element: s(AdminJobs) },
          { path: 'internships', element: s(AdminInternships) },
          { path: 'applications', element: s(AdminApplications) },
          { path: 'skills', element: s(AdminSkills) },
          { path: 'aptitude-questions', element: s(AdminAptitudeQuestions) },
          { path: 'training', element: s(AdminTraining) },
          { path: 'analytics', element: s(AdminAnalytics) },
          { path: 'industry-skill-demand', element: s(AdminIndustrySkillDemand) },
          { path: 'verification-queue', element: s(AdminVerificationQueue) },
          { path: 'events', element: s(AdminEvents) },
          { path: 'mentorship', element: s(AdminMentorship) },
          { path: 'collaboration', element: s(AdminCollaborationHub) },
          { path: 'audit-logs', element: s(AdminAuditLogs) },
          { path: 'settings', element: s(AdminSettings) },
        ],
      },
    ],
  },
  {
    path: '/faculty',
    element: <RequireAuth />,
    children: [
      {
        element: (
          <RequireRole role="FACULTY">
            <FacultyLayout />
          </RequireRole>
        ),
        children: [
          { path: 'dashboard', element: s(FacultyDashboard) },
          { path: 'opportunities', element: s(FacultyBrowseOpportunities) },
          { path: 'opportunities/:id', element: s(FacultyOpportunityDetails) },
          { path: 'applications', element: s(FacultyApplications) },
          { path: 'applications/:id', element: s(FacultyApplicationDetails) },
          { path: 'profile', element: s(FacultyProfile) },
          { path: 'profile/edit', element: s(FacultyEditProfile) },
          { path: 'mentorship', element: s(FacultyMentorship) },
          { path: 'mentorship/:requestId', element: s(FacultyMentorshipDetails) },
          { path: 'events', element: s(FacultyEvents) },
          { path: 'events/new', element: s(FacultyEventCreate) },
          { path: 'events/:id', element: s(FacultyEventDetails) },
          { path: 'events/:id/edit', element: s(FacultyEventEdit) },
          { path: 'collaboration', element: s(FacultyCollaborationHub) },
          { path: 'settings', element: s(FacultySettings) },
        ],
      },
    ],
  },
  {
    path: '/institution',
    element: <RequireAuth />,
    children: [
      {
        element: (
          <RequireRole role="INSTITUTION">
            <InstitutionLayout />
          </RequireRole>
        ),
        children: [
          { path: 'dashboard', element: s(InstitutionDashboard) },
          { path: 'students', element: s(InstitutionStudents) },
          { path: 'students/:id', element: s(InstitutionStudentDetails) },
          { path: 'faculty', element: s(InstitutionFaculty) },
          { path: 'faculty/:id', element: s(InstitutionFacultyDetails) },
          { path: 'skill-gaps', element: s(InstitutionSkillGaps) },
          { path: 'placements', element: s(InstitutionPlacements) },
          { path: 'fdps', element: s(InstitutionFdps) },
          { path: 'verifications', element: s(InstitutionVerifications) },
          { path: 'events', element: s(InstitutionEvents) },
          { path: 'events/new', element: s(InstitutionEventCreate) },
          { path: 'events/:id', element: s(InstitutionEventDetails) },
          { path: 'events/:id/edit', element: s(InstitutionEventEdit) },
          { path: 'collaboration', element: s(InstitutionCollaborationHub) },
          { path: 'settings', element: s(InstitutionSettings) },
        ],
      },
    ],
  },
  {
    path: '*',
    element: s(NotFound),
  },
]);
