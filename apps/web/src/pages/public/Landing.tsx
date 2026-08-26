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
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
  },
  {
    icon: FiBookOpen,
    title: 'Internship Discovery',
    description:
      'Browse curated internships with stipend details, duration, and eligibility filters tailored to your profile.',
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  },
  {
    icon: FiBriefcase,
    title: 'Campus Placements',
    description:
      'End-to-end placement management — applications, shortlisting, interviews, and offers in one workflow.',
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  },
  {
    icon: FiBarChart2,
    title: 'Placement Analytics',
    description:
      'Live dashboards for admins tracking placement rates, skill demand trends, and industry partnerships.',
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  },
];

const roles = [
  {
    icon: FiUsers,
    title: "I'm a Student",
    description: 'Find jobs, internships, track applications, and close skill gaps with personalised recommendations.',
    to: '/register',
    cta: 'Create student account',
    color: 'border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-indigo-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/50',
    iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300',
  },
  {
    icon: FiBriefcase,
    title: "I'm a Company",
    description: 'Post opportunities, discover pre-matched candidates, and manage your entire campus hiring pipeline.',
    to: '/register',
    cta: 'Create company account',
    color: 'border-sky-200 hover:border-sky-400 hover:bg-sky-50/50 dark:border-sky-800 dark:hover:border-sky-600 dark:hover:bg-sky-950/50',
    iconBg: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300',
  },
  {
    icon: FiShield,
    title: "I'm an Admin",
    description: 'Manage the placement cell, monitor real-time analytics, and drive better institutional outcomes.',
    to: '/login',
    cta: 'Admin sign in',
    color: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-emerald-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/50',
    iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300',
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
      <dt className="text-3xl lg:text-4xl font-bold text-indigo-600">
        {value === undefined ? (
          <span className="inline-block w-16 h-9 rounded bg-slate-100 dark:bg-slate-800 animate-pulse align-middle" />
        ) : (
          value.toLocaleString()
        )}
      </dt>
      <dd className="text-sm text-slate-500 mt-1 dark:text-slate-400">{label}</dd>
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
    <div className="overflow-x-hidden">
      <section className="relative bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 dark:from-slate-900 dark:via-purple-950 dark:to-slate-950 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 20%, white 1px, transparent 0), radial-gradient(circle at 70% 80%, white 1px, transparent 0)', backgroundSize: '48px 48px' }} aria-hidden="true" />
        <div className="container-page relative py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-indigo-100 text-sm font-medium mb-8 border border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Now open for placements
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Bridging Academia
              <br />
              <span className="text-sky-300">& Industry</span>
            </h1>
            <p className="text-xl text-indigo-100 leading-relaxed mb-10 max-w-xl">
              The centralised platform connecting students, companies, and placement administrators —
              from skill mapping to final offer.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors no-underline text-base"
              >
                Get started free
                <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/jobs"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/30 text-white font-medium hover:bg-white/10 transition-colors no-underline text-base"
              >
                Browse opportunities
              </Link>
            </div>
          </div>
        </div>
      </section>

      {countsAvailable && (
        <section className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
          <div className="container-page py-12">
            <dl className="grid grid-cols-2 gap-8 max-w-lg mx-auto">
              <LiveCount value={jobs.data?.total} label="Open job postings" />
              <LiveCount value={internships.data?.total} label="Open internships" />
            </dl>
          </div>
        </section>
      )}

      <section className="container-page py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-3xl font-bold text-slate-900 mb-4 dark:text-slate-100">Everything in one platform</h2>
          <p className="text-slate-500 text-lg dark:text-slate-400">
            From intelligent matching to placement analytics — we've built every tool you need.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-800">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2 dark:text-slate-100">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed dark:text-slate-400">{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-slate-50 border-y border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
        <div className="container-page py-20">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-12 dark:text-slate-100">Choose your path</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.title}
                  className={`bg-white rounded-xl border-2 p-6 transition-all duration-150 dark:bg-slate-900 ${r.color}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${r.iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2 dark:text-slate-100">{r.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-6 dark:text-slate-400">{r.description}</p>
                  <Link
                    to={r.to}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 no-underline transition-colors dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {r.cta} <FiArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="container-page py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4 dark:text-slate-100">Why students love it</h2>
            <p className="text-slate-500 mb-8 leading-relaxed dark:text-slate-400">
              We built the platform students actually want — clear status updates, smart recommendations, and no more
              chasing placement coordinators for information.
            </p>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3">
                  <FiCheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span className="text-slate-700 text-sm dark:text-slate-300">{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-sky-50 rounded-2xl border border-indigo-100 p-8 space-y-4 dark:from-slate-900 dark:to-slate-800 dark:border-slate-700">
            {/* Real published postings. The match score and application status that
                used to sit here were invented — neither exists for a visitor who
                has not signed in, so the card shows the employer and location the
                API actually returned and links through to the posting. */}
            {jobs.isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 p-4 h-[68px] animate-pulse dark:bg-slate-900 dark:border-slate-700"
                />
              ))}

            {jobItems.map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.id}`}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 shadow-sm no-underline hover:border-indigo-300 transition-colors dark:bg-slate-900 dark:border-slate-700 dark:hover:border-indigo-600"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 dark:bg-indigo-900/50 dark:text-indigo-300">
                  <FiBriefcase className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">
                    {job.title} — {job.company.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{job.location}</p>
                </div>
                <FiArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
              </Link>
            ))}

            {jobs.isSuccess && jobItems.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-6 dark:text-slate-400">
                No openings are published right now. Create an account to be ready when they are.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-indigo-600 dark:bg-indigo-900">
        <div className="container-page py-16 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-indigo-100 mb-8 max-w-xl mx-auto">
            Students, companies and placement teams working from the same real-time picture.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors no-underline"
            >
              Create free account <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-white/30 text-white font-medium hover:bg-white/10 transition-colors no-underline"
            >
              Browse jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
