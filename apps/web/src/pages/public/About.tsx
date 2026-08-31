import { FiTarget, FiUsers, FiTrendingUp, FiAward } from 'react-icons/fi';

const roles = [
  {
    title: 'Students',
    icon: FiUsers,
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
    description:
      'Discover jobs and internships perfectly matched to your skills and academic profile. Get AI-powered skill gap analysis, training recommendations, and real-time application tracking — all in one place.',
  },
  {
    title: 'Companies',
    icon: FiTrendingUp,
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
    description:
      'Post opportunities, find the best-fit candidates with intelligent matching, manage the entire hiring pipeline, schedule interviews, and build your talent pipeline directly from campus.',
  },
  {
    title: 'Placement Admins',
    icon: FiAward,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    description:
      'Oversee placement activity across the institution, monitor skill demand trends, manage training programmes, and generate insights to continuously improve employability outcomes.',
  },
];

const values = [
  'Data-driven matching between student profiles and industry requirements',
  'Transparent application tracking with real-time status updates',
  'Skill gap analysis backed by live industry demand signals',
  'Centralised placement management with powerful admin analytics',
];

export default function About() {
  return (
    <div className="container-page py-16 space-y-20">
      <section className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium mb-6 dark:bg-indigo-950 dark:text-indigo-300">
          <FiTarget className="w-4 h-4" />
          Our Mission
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-6 leading-tight dark:text-slate-100">
          Bridging the gap between academia and industry
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-4 dark:text-slate-400">
          The AcadIn is a centralised platform designed to streamline every touchpoint between
          educational institutions, students, and industry partners. We eliminate friction in the
          placement process so students can focus on building careers, companies can find the right
          talent efficiently, and administrators can deliver measurable outcomes.
        </p>
        <p className="text-base text-slate-500 leading-relaxed dark:text-slate-400">
          Built from the ground up with modern technology and deep domain insight, our platform is
          the single source of truth for placement operations — from a student's first application
          to a company's final offer.
        </p>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-8 dark:text-slate-100">
          Who it's built for
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => {
            const Icon = role.icon;
            return (
              <div
                key={role.title}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 dark:bg-slate-900 dark:border-slate-800"
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${role.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2 dark:text-slate-100">
                  {role.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed dark:text-slate-400">
                  {role.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-indigo-600 rounded-2xl p-10 text-white dark:bg-indigo-900">
        <h2 className="text-2xl font-bold mb-6">What we stand for</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {values.map((v) => (
            <li key={v} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
              <span className="text-indigo-100 text-sm leading-relaxed">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
