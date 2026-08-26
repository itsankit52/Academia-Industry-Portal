import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiBarChart2,
  FiBriefcase,
  FiBookOpen,
  FiZap,
  FiUsers,
  FiShield,
  FiCheckCircle,
} from 'react-icons/fi';
import { useJobs } from '@/hooks/queries/useJobs';
import { useInternships } from '@/hooks/queries/useInternships';

const features = [
  {
    icon: FiZap,
    title: 'AI-Powered Skill Mapping',
    description:
      'Automatically match student profiles to opportunities using real-time skill analysis and intelligent scoring.',
    color: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
  {
    icon: FiBookOpen,
    title: 'Internship Discovery',
    description:
      'Browse curated internships with stipend details, duration, and eligibility filters tailored to your profile.',
    color: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
  {
    icon: FiBriefcase,
    title: 'Campus Placements',
    description:
      'End-to-end placement management — applications, shortlisting, interviews, and offers in one workflow.',
    color: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
  {
    icon: FiBarChart2,
    title: 'Placement Analytics',
    description:
      'Live dashboards for admins tracking placement rates, skill demand trends, and industry partnerships.',
    color: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
];

const roles = [
  {
    icon: FiUsers,
    title: "I'm a Student",
    description: 'Find jobs, internships, track applications, and close skill gaps with personalised recommendations.',
    to: '/register',
    cta: 'Create student account',
    color: 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500',
    iconBg: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
  {
    icon: FiBriefcase,
    title: "I'm a Company",
    description: 'Post opportunities, discover pre-matched candidates, and manage your entire campus hiring pipeline.',
    to: '/register',
    cta: 'Create company account',
    color: 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500',
    iconBg: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
  {
    icon: FiShield,
    title: "I'm an Admin",
    description: 'Manage the placement cell, monitor real-time analytics, and drive better institutional outcomes.',
    to: '/login',
    cta: 'Admin sign in',
    color: 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500',
    iconBg: 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-200',
  },
];

const benefits = [
  'Real-time skill gap analysis',
  'Intelligent job matching scores',
  'One-click application tracking',
  'Interview scheduling built-in',
  'Training programme recommendations',
  'Placement analytics dashboard',
];

/**
 * The counters and the preview cards read the public opportunity endpoints, which
 * only ever return PUBLISHED postings. This section previously rendered invented
 * figures ("2,400+ students placed", "94% placement rate") and three made-up
 * postings with made-up match scores, none of which existed in the database.
 */
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

export default function Landing() {
  // `pageSize: 3` covers both jobs uses in one request: `total` drives the counter
  // and the three rows drive the preview cards.
  const jobs = useJobs({ pageSize: 3 });
  const internships = useInternships({ pageSize: 1 });

  const jobItems = jobs.data?.items ?? [];
  // A failed request must not silently become a number the visitor reads as real,
  // so the strip is dropped entirely rather than showing zero or a placeholder.
  const countsAvailable = !jobs.isError && !internships.isError;

  return (
    <div className="overflow-x-hidden bg-white dark:bg-neutral-950">
      {/* Hero Section */}
      <section className="relative bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800">
        <div className="container-page py-14 lg:py-22">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-sm font-medium mb-8 dark:bg-neutral-900 dark:text-neutral-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Now open for placements
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-6 tracking-tight">
            Connect students, institutions, and companies through meaningful opportunities, collaboration, and career growth.
              <br />
              
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed mb-10 max-w-xl dark:text-neutral-400">
              The centralised platform connecting students, companies, and placement administrators —
              from skill mapping to final offer.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium transition-colors no-underline dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
            </div>
          </div>
        </div>
      </section>

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

      {/* Features Section */}
      <section className="container-page py-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-neutral-900 mb-4 dark:text-neutral-100">
            Everything in one platform
          </h2>
          <p className="text-neutral-600 text-lg dark:text-neutral-400">
            From intelligent matching to placement analytics — we've built every tool you need.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${f.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-neutral-900 mb-2 dark:text-neutral-100">
                  {f.title}
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed dark:text-neutral-400">
                  {f.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Roles Section */}
      <section className="bg-neutral-50 border-y border-neutral-200 dark:bg-neutral-900/50 dark:border-neutral-800">
        <div className="container-page py-20">
          <h2 className="text-3xl font-bold text-neutral-900 text-center mb-12 dark:text-neutral-100">
            Choose your path
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  className={`bg-white rounded-lg border p-8 transition-colors dark:bg-neutral-950 ${r.color}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${r.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-2 dark:text-neutral-100">
                    {r.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed mb-6 dark:text-neutral-400">
                    {r.description}
                  </p>
                  <Link
                    to={r.to}
                    className="inline-flex items-center gap-2 text-sm font-medium text-neutral-900 hover:text-neutral-600 no-underline transition-colors dark:text-neutral-100 dark:hover:text-neutral-400"
                  >
                    {r.cta} <FiArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits & Preview Section */}
      <section className="container-page py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold text-neutral-900 mb-4 dark:text-neutral-100">
              Why students love it
            </h2>
            <p className="text-neutral-600 mb-8 leading-relaxed dark:text-neutral-400">
              We built the platform students actually want — clear status updates, smart recommendations, and no more
              chasing placement coordinators for information.
            </p>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <FiCheckCircle className="w-5 h-5 text-neutral-400 shrink-0" />
                  <span className="text-neutral-700 text-sm dark:text-neutral-300">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-6 space-y-3 dark:bg-neutral-900/50 dark:border-neutral-800">
            {/* Real published postings. The match score and application status that
                used to sit here were invented — neither exists for a visitor who
                has not signed in, so the card shows the employer and location the
                API actually returned and links through to the posting. */}
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
                    {job.title} — {job.company.name}
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

      {/* CTA Section */}
      <section className="bg-neutral-900 dark:bg-neutral-800">
        <div className="container-page py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-neutral-300 mb-8 max-w-xl mx-auto">
            Students, companies and placement teams working from the same real-time picture.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-neutral-900 font-medium hover:bg-neutral-200 transition-colors no-underline"
            >
              Create free account <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-neutral-500 text-white font-medium hover:bg-neutral-700 transition-colors no-underline"
            >
              Browse jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}