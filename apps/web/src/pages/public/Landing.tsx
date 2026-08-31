import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiBookOpen,
  FiCheckCircle,
  FiClipboard,
  FiCompass,
  FiCpu,
  FiFileText,
  FiFlag,
  FiHeart,
  FiLogIn,
  FiPieChart,
  FiTarget,
  FiTrendingUp,
  FiUserCheck,
  FiUserPlus,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { useJobs } from '@/hooks/queries/useJobs';
import { useInternships } from '@/hooks/queries/useInternships';

/* ------------------------------------------------------------------ */
/* Reusable: counter that stays a placeholder while the API loads.    */
/* ------------------------------------------------------------------ */

function LiveCount({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="text-center">
      <dt className="text-3xl lg:text-4xl font-semibold text-neutral-900 dark:text-neutral-100">
        {value === undefined ? (
          <span className="inline-block w-16 h-9 rounded bg-neutral-100 dark:bg-neutral-800 animate-pulse align-middle" />
        ) : (
          value.toLocaleString()
        )}
      </dt>
      <dd className="text-sm text-neutral-500 mt-2 dark:text-neutral-400">{label}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What the platform is + who it serves                                */
/* ------------------------------------------------------------------ */

const platformBenefits = [
  {
    icon: FiUsers,
    title: 'For Students',
    to: '/guide#for-students',
    description:
      'Build a complete profile, take skill assessments, see your skill gap, and apply to matched jobs and internships in one place.',
  },
  {
    icon: FiBriefcase,
    title: 'For Industry / Companies',
    to: '/guide#for-companies',
    description:
      'Post jobs and internships, see pre-ranked candidates, schedule interviews, and run the entire hiring pipeline without leaving the portal.',
  },
  {
    icon: FiBookOpen,
    title: 'For Faculty',
    to: '/guide#for-faculty',
    description:
      'Apply for FDPs, consultancies and research collaborations, mentor students, and host workshops, guest lectures and innovation challenges.',
  },
  {
    icon: FiFlag,
    title: 'For Institutions',
    to: '/guide#for-institutions',
    description:
      'See placement outcomes, aggregate skill gaps, manage verifications, and host events scoped to your own campus — all from one dashboard.',
  },
];

/* ------------------------------------------------------------------ */
/* Core capabilities of the platform                                   */
/* ------------------------------------------------------------------ */

const capabilities = [
  {
    icon: FiCpu,
    title: 'Skill Assessment',
    short: 'Verify what you know',
    description:
      'Take AI-generated, skill-specific assessments. Passing one auto-upgrades your proficiency, which improves your match score.',
  },
  {
    icon: FiBarChart2,
    title: 'Skill-Gap Analysis',
    short: 'See where you fall short',
    description:
      'For every opportunity and across the whole platform — a clear Have / Need / Stretch breakdown so you know exactly what to learn next.',
  },
  {
    icon: FiTarget,
    title: 'Job & Internship Matching',
    short: 'Opportunities ranked for you',
    description:
      'A deterministic skill-overlap score, refined by an AI reading of the job description. Recommended opportunities are sorted by fit.',
  },
  {
    icon: FiBookOpen,
    title: 'Learning Recommendations',
    short: 'Trainings that close the gap',
    description:
      'Get curated training programs based on the skills you are missing. Each recommendation explains which gap it addresses.',
  },
  {
    icon: FiUsers,
    title: 'Mentorship',
    short: 'Guidance from industry experts',
    description:
      'Request a mentor by expertise area, exchange messages, and rate the engagement when it ends.',
  },
  {
    icon: FiTrendingUp,
    title: 'Placement Tracking',
    short: 'From APPLIED to SELECTED',
    description:
      'Every application moves through a defined status flow. Interview scheduling, offers and completion certificates all live in one timeline.',
  },
];

/* ------------------------------------------------------------------ */
/* How It Works — 9 steps from signup to placement                     */
/* ------------------------------------------------------------------ */

const howItWorksSteps: { icon: typeof FiCompass; title: string; description: string }[] = [
  {
    icon: FiUserPlus,
    title: 'Register / Login',
    description: 'Pick your role and create an account in under a minute.',
  },
  {
    icon: FiFileText,
    title: 'Create Profile',
    description: 'Add academic details, projects, certifications and a resume.',
  },
  {
    icon: FiCpu,
    title: 'Assess Skills',
    description: 'Take AI skill assessments to verify and upgrade your proficiency.',
  },
  {
    icon: FiCompass,
    title: 'Discover Opportunities',
    description: 'Browse jobs and internships matched to your skills and interests.',
  },
  {
    icon: FiPieChart,
    title: 'Analyze Skill Gap',
    description: 'See which skills you have, which you need, and which are stretch goals.',
  },
  {
    icon: FiBookOpen,
    title: 'Learn / Improve',
    description: 'Follow training recommendations to close the gaps that matter.',
  },
  {
    icon: FiZap,
    title: 'Apply',
    description: 'Submit an application with one click — your profile travels with it.',
  },
  {
    icon: FiUserCheck,
    title: 'Interview',
    description: 'Track interview schedules, mode and prep notes inside the portal.',
  },
  {
    icon: FiCheckCircle,
    title: 'Selection & Placement',
    description: 'Accept the offer, submit interim reports, and download your certificate.',
  },
];

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const jobs = useJobs({ pageSize: 3 });
  const internships = useInternships({ pageSize: 1 });

  const jobItems = jobs.data?.items ?? [];
  const countsAvailable = !jobs.isError && !internships.isError;

  return (
    <div className="overflow-x-hidden bg-white dark:bg-neutral-950">
      {/* Hero */}
      <section className="relative bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800">
        <div className="container-page py-14 lg:py-22">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-sm font-medium mb-8 dark:bg-neutral-900 dark:text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Now open for placements
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-6 tracking-tight">
              The AcadIn &ndash; that connects students, faculty, institutions, and companies
              &mdash; from skill assessment to placement.
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed mb-10 max-w-2xl dark:text-neutral-400">
              A single platform where every stakeholder in the placement lifecycle works from the
              same real-time picture: assess skills, see skill gaps, get matched to the right
              opportunity, learn what you need, apply, interview, and get placed &mdash; all in one
              place.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-700 transition-colors no-underline dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Get started free
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors no-underline dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                Browse opportunities
              </Link>
              <Link
                to="/guide"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-neutral-700 font-medium hover:bg-neutral-50 transition-colors no-underline dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                <FiBookOpen className="w-4 h-4" />
                Read the User Guide
                <FiArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Live counters */}
      {countsAvailable && (
        <section className="bg-white border-b border-neutral-200 dark:bg-neutral-950 dark:border-neutral-800">
          <div className="container-page py-12">
            <dl className="grid grid-cols-2 gap-8 max-w-lg mx-auto">
              <LiveCount value={jobs.data?.total} label="Open job postings" />
              <LiveCount value={internships.data?.total} label="Open internships" />
            </dl>
          </div>
        </section>
      )}

      {/* What it is + who it serves */}
      <section className="container-page py-20" id="what-it-is">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4 dark:text-neutral-100">
            One platform, four roles, one shared workflow
          </h2>
          <p className="text-neutral-600 text-lg dark:text-neutral-400">
            The Academia &ndash; Industry Portal is built for every stakeholder in campus placement.
            Whether you are a student looking for your first role, a company hiring the next batch,
            a faculty member mentoring candidates, or an institution tracking outcomes &mdash; you
            belong here.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {platformBenefits.map((b) => {
            const Icon = b.icon;
            return (
              <Link
                key={b.title}
                to={b.to}
                className="group bg-white rounded-xl border border-neutral-200 p-6 hover:border-neutral-400 transition-colors no-underline dark:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-600"
              >
                <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4 dark:bg-neutral-800 dark:text-neutral-200">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2 dark:text-neutral-100">
                  {b.title}
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed dark:text-neutral-400">
                  {b.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Read the guide
                  <FiArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How It Works — 9-step flow */}
      <section
        className="bg-neutral-50 border-y border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-800"
        id="how-it-works"
      >
        <div className="container-page py-20">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium mb-4 dark:bg-indigo-950 dark:text-indigo-300">
              <FiCompass className="w-4 h-4" />
              How it works
            </div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-4 dark:text-neutral-100">
              From signup to selection in nine steps
            </h2>
            <p className="text-neutral-600 text-lg dark:text-neutral-400">
              The same flow, in order, for every student. Each step builds on the one before, so the
              platform always knows how to help you next.
            </p>
          </div>

          {/* Mobile: vertical stack. Desktop: 3x3 grid with arrows between cells. */}
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {howItWorksSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.title}
                  className="relative bg-white rounded-xl border border-neutral-200 p-6 dark:bg-neutral-950 dark:border-neutral-800"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center dark:bg-indigo-950 dark:text-indigo-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">
                          Step {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {step.title}
                      </h3>
                      <p className="text-sm text-neutral-600 leading-relaxed mt-1 dark:text-neutral-400">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="text-center mt-10">
            <Link
              to="/guide#how-applications-work"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-white transition-colors no-underline dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              See the application status flow
              <FiArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="container-page py-20" id="capabilities">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4 dark:text-neutral-100">
            Everything in one platform
          </h2>
          <p className="text-neutral-600 text-lg dark:text-neutral-400">
            Six tools that work together, replacing the spreadsheets, email threads and one-off
            portals you use today.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {capabilities.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.title}
                className="bg-white rounded-xl border border-neutral-200 p-6 dark:bg-neutral-900 dark:border-neutral-800"
              >
                <div className="w-10 h-10 rounded-lg bg-neutral-100 text-neutral-900 flex items-center justify-center mb-4 dark:bg-neutral-800 dark:text-neutral-200">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                  {c.short}
                </div>
                <h3 className="font-semibold text-neutral-900 mt-1 mb-2 dark:text-neutral-100">
                  {c.title}
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed dark:text-neutral-400">
                  {c.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Why students love it + live jobs preview */}
      <section className="container-page py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-4 dark:text-neutral-100">
              Why students love it
            </h2>
            <p className="text-neutral-600 mb-8 leading-relaxed dark:text-neutral-400">
              We built the platform students actually want &mdash; clear status updates, smart
              recommendations, and no more chasing placement coordinators for information.
            </p>
            <ul className="space-y-3">
              {[
                'Real-time skill gap analysis with a clear Have / Need / Stretch view',
                'Intelligent job matching with an explainable percentage score',
                'One-click application tracking from APPLIED to SELECTED',
                'Interview scheduling built in &mdash; no separate tools to learn',
                'Training programme recommendations tailored to your gaps',
                'Mentorship by industry experts, threaded and rateable',
                'Placement analytics and verified completion certificates',
              ].map((b) => (
                <li key={b} className="flex items-start gap-3">
                  <FiCheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-neutral-700 text-sm dark:text-neutral-300">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-700 transition-colors no-underline dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                Create a student account
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/guide#for-students"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 transition-colors no-underline dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
              >
                <FiBookOpen className="w-4 h-4" />
                Student guide
              </Link>
            </div>
          </div>
          <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6 space-y-3 dark:bg-neutral-900/50 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Live openings
              </h3>
              <Link
                to="/jobs"
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 no-underline dark:text-neutral-400 dark:hover:text-neutral-100"
              >
                View all
              </Link>
            </div>
            {jobs.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-md border border-neutral-200 p-4 h-[68px] animate-pulse dark:bg-neutral-950 dark:border-neutral-800"
                />
              ))}

            {jobItems.map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="bg-white rounded-md border border-neutral-200 p-4 flex items-center gap-4 no-underline hover:border-neutral-400 transition-colors dark:bg-neutral-950 dark:border-neutral-800 dark:hover:border-neutral-600"
              >
                <div className="w-9 h-9 rounded-md bg-neutral-100 flex items-center justify-center text-neutral-700 shrink-0 dark:bg-neutral-800 dark:text-neutral-300">
                  <FiBriefcase className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate dark:text-neutral-100">
                    {job.title} &mdash; {job.company.name}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{job.location}</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-neutral-400 shrink-0" />
              </Link>
            ))}

            {jobs.isSuccess && jobItems.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-6 dark:text-neutral-400">
                No openings are published right now. Create an account to be ready when they are.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* User Guide teaser */}
      <section className="bg-indigo-600 dark:bg-indigo-900 text-white" id="user-guide">
        <div className="container-page py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-50 text-sm font-medium mb-4">
                <FiBookOpen className="w-4 h-4" />
                New here? Start with the guide
              </div>
              <h2 className="text-3xl font-bold mb-4">A beginner-friendly User Guide</h2>
              <p className="text-indigo-100 leading-relaxed mb-6">
                Step-by-step walkthroughs for every role, written for first-time users. Read only
                the section that matches you &mdash; Student, Company, Faculty, or Institution /
                Admin &mdash; and skip the rest.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/guide#for-students"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-indigo-700 text-sm font-medium hover:bg-indigo-50 no-underline"
                >
                  Student guide
                  <FiArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/guide#for-companies"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-300 text-white text-sm font-medium hover:bg-indigo-700 no-underline"
                >
                  Company guide
                </Link>
                <Link
                  to="/guide#for-faculty"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-300 text-white text-sm font-medium hover:bg-indigo-700 no-underline"
                >
                  Faculty guide
                </Link>
                <Link
                  to="/guide#for-institutions"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-300 text-white text-sm font-medium hover:bg-indigo-700 no-underline"
                >
                  Institution / Admin guide
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex flex-col gap-2 w-64">
              {[
                { icon: FiUserPlus, label: 'Register / Login' },
                { icon: FiFileText, label: 'Create Profile' },
                { icon: FiCpu, label: 'Assess Skills' },
                { icon: FiTarget, label: 'Match to Opportunities' },
                { icon: FiClipboard, label: 'Apply & Track' },
                { icon: FiHeart, label: 'Get Placed' },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-500/20 text-indigo-50 text-sm"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-neutral-900 dark:bg-neutral-800">
        <div className="container-page py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-neutral-300 mb-8 max-w-xl mx-auto">
            Students, companies, faculty, and institutions working from the same real-time picture.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-200 transition-colors no-underline"
            >
              Create free account
              <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/guide"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-neutral-500 text-white font-medium hover:bg-neutral-700 transition-colors no-underline"
            >
              <FiBookOpen className="w-4 h-4" />
              Read the User Guide
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-neutral-200 font-medium hover:text-white transition-colors no-underline"
            >
              <FiLogIn className="w-4 h-4" />I already have an account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
