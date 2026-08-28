import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiAward,
  FiBookOpen,
  FiBookmark,
  FiBriefcase,
  FiCalendar,
  FiClock,
  FiCompass,
  FiFileText,
  FiHelpCircle,
  FiList,
  FiMap,
  FiShield,
  FiTarget,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { usePersistedState } from '@/lib/usePersistedState';

/* ---------- Section data ---------- */

type SectionId =
  | 'welcome'
  | 'getting-started'
  | 'for-students'
  | 'for-companies'
  | 'for-admins'
  | 'for-faculty'
  | 'for-institutions'
  | 'how-applications-work'
  | 'how-matching-works'
  | 'navigating-dashboards'
  | 'help-faq';

interface Section {
  id: SectionId;
  title: string;
  short: string;
  icon: typeof FiCompass;
  color: string;
}

const sections: Section[] = [
  {
    id: 'welcome',
    title: 'Welcome to the Portal',
    short: 'What the platform does',
    icon: FiCompass,
    color: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
  },
  {
    id: 'getting-started',
    title: 'Getting Started',
    short: 'Register, sign in, manage your account',
    icon: FiTarget,
    color: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
  },
  {
    id: 'for-students',
    title: 'For Students',
    short: 'Profile, applications, interviews',
    icon: FiUsers,
    color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
  },
  {
    id: 'for-companies',
    title: 'For Companies',
    short: 'Post roles, find candidates',
    icon: FiBriefcase,
    color: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  },
  {
    id: 'for-admins',
    title: 'For Placement Admins',
    short: 'Manage students, companies, skills',
    icon: FiShield,
    color: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
  },
  {
    id: 'for-faculty',
    title: 'For Faculty',
    short: 'Faculty opportunities, mentorship, events',
    icon: FiBookOpen,
    color: 'bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
  },
  {
    id: 'for-institutions',
    title: 'For Institutions',
    short: 'Institutional dashboards, FDPs, verifications',
    icon: FiAward,
    color: 'bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400',
  },
  {
    id: 'how-applications-work',
    title: 'How Applications Work',
    short: 'Status flow from APPLIED to OFFER',
    icon: FiClock,
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  {
    id: 'how-matching-works',
    title: 'How Matching & Skill Analysis Works',
    short: 'Match score, skill gap, recommendations',
    icon: FiZap,
    color: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-950 dark:text-fuchsia-400',
  },
  {
    id: 'navigating-dashboards',
    title: 'Navigating Your Dashboard',
    short: 'What every sidebar item does',
    icon: FiList,
    color: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
  },
  {
    id: 'help-faq',
    title: 'Help & FAQ',
    short: 'Common questions and support',
    icon: FiHelpCircle,
    color: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  },
];

/* ---------- Small reusable visual primitives ---------- */

function SectionCard({
  section,
  isOpen,
  onToggle,
  children,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const Icon = section.icon;
  return (
    <section
      id={section.id}
      className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800 scroll-mt-20"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${section.id}-content`}
        className="w-full flex items-center justify-between gap-4 p-6 text-left hover:bg-slate-50 transition-colors dark:hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${section.color}`}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {section.title}
            </h2>
            <p className="text-sm text-slate-500 truncate dark:text-slate-400">{section.short}</p>
          </div>
        </div>
        <span
          className={`shrink-0 w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 transition-transform dark:border-slate-600 dark:text-slate-400 ${isOpen ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      {isOpen && (
        <div
          id={`${section.id}-content`}
          className="px-6 pb-8 pt-2 text-slate-700 dark:text-slate-300"
        >
          {children}
        </div>
      )}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-2">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 mb-3">{children}</p>
  );
}

function Ol({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-400">
      {items.map((it, i) => (
        <li key={i} className="leading-relaxed">
          {it}
        </li>
      ))}
    </ol>
  );
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
      {items.map((it, i) => (
        <li key={i} className="leading-relaxed">
          {it}
        </li>
      ))}
    </ul>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
      <div className="font-medium mb-1">Tip</div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function UserGuide() {
  // Open the first section by default; the visitor's choice is remembered
  // so a refresh keeps them where they were.
  const [openIds, setOpenIds] = usePersistedState<SectionId[]>('aip-guide-open', ['welcome']);

  const toggle = (id: SectionId) => {
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const isOpen = (id: SectionId) => openIds.includes(id);

  // Open the section matching the URL hash when the page first loads.
  const [hashHandled, setHashHandled] = useState(false);
  useEffect(() => {
    if (hashHandled) return;
    const hash = window.location.hash.replace('#', '') as SectionId;
    if (sections.some((s) => s.id === hash)) {
      setOpenIds((prev) => (prev.includes(hash) ? prev : [...prev, hash]));
    }
    setHashHandled(true);
  }, [hashHandled, setOpenIds]);

  return (
    <div className="container-page py-12 lg:py-16">
      {/* Page header */}
      <div className="max-w-3xl mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium mb-4 dark:bg-indigo-950 dark:text-indigo-300">
          <FiBookOpen className="w-4 h-4" />
          User Guide
        </div>
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4 leading-tight dark:text-slate-100">
          How the Academia–Industry Portal works
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed dark:text-slate-400">
          A step-by-step walkthrough for every role. New here? Start with
          <span className="font-medium"> Getting Started</span>. Returning visitor? Jump to your
          role from the table of contents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8 lg:gap-10">
        {/* Sticky table of contents — desktop */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-3 dark:text-slate-100">
              <FiMap className="w-4 h-4" />
              On this page
            </div>
            <nav className="space-y-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors no-underline dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Mobile pill bar */}
        <div className="lg:hidden -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 pb-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4 min-w-0">
          {/* WELCOME */}
          <SectionCard
            section={sections[0]}
            isOpen={isOpen('welcome')}
            onToggle={() => toggle('welcome')}
          >
            <P>
              The Academia–Industry Portal is a single place where{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">students</span>,{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">companies</span>,{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                placement admins
              </span>
              , <span className="font-medium text-slate-900 dark:text-slate-100">faculty</span>, and{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">institutions</span>{' '}
              work together — from the first skill assessment all the way to a final offer letter.
            </P>
            <P>
              Companies post jobs and internships. Students build profiles, get matched by skill,
              and apply with one click. Placement admins see live analytics, run verifications, and
              manage training. Faculty and institutions participate in collaborative research,
              mentorship, and events.
            </P>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                {
                  icon: FiZap,
                  title: 'Skill-based matching',
                  text: 'Every job has a match score against your profile.',
                },
                {
                  icon: FiFileText,
                  title: 'Application tracking',
                  text: 'See where every application stands, in real time.',
                },
                {
                  icon: FiCalendar,
                  title: 'Interviews built in',
                  text: 'Schedule, reschedule, and prepare — no separate tools.',
                },
                {
                  icon: FiAward,
                  title: 'Verified certificates',
                  text: 'Documents and completion certificates, all in one place.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    <Icon className="w-4 h-4 text-indigo-500" />
                    {title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* GETTING STARTED */}
          <SectionCard
            section={sections[1]}
            isOpen={isOpen('getting-started')}
            onToggle={() => toggle('getting-started')}
          >
            <H3>Create an account</H3>
            <Ol
              items={[
                <>
                  Click <span className="font-medium">Get started</span> in the top-right corner of
                  any page.
                </>,
                <>
                  Pick the role that matches you: <span className="font-medium">Student</span>,{' '}
                  <span className="font-medium">Company</span>,{' '}
                  <span className="font-medium">Faculty</span>, or{' '}
                  <span className="font-medium">Institution</span>. Admins are created by the
                  platform team, not self-registered.
                </>,
                <>
                  Enter your email, set a strong password (at least 8 characters), and accept the
                  terms.
                </>,
                <>Confirm the email you receive. You are now ready to sign in.</>,
              ]}
            />
            <Tip>
              Use a personal email you check often — companies and placement admins will contact you
              through the email on file.
            </Tip>
            <H3>Sign in</H3>
            <P>
              Click <span className="font-medium">Log in</span> in the top-right corner and enter
              your email and password. After signing in, you stay signed in for 7 days unless you
              sign out manually. Your session uses secure HTTP-only cookies, so you don&apos;t need
              to manage tokens yourself.
            </P>
            <H3>Forgot your password?</H3>
            <P>
              On the sign-in page, click <span className="font-medium">Forgot password</span> and
              enter your registered email. You will receive a one-time reset link valid for 30
              minutes. After resetting, sign in with the new password.
            </P>
            <H3>Signing out</H3>
            <P>
              Click <span className="font-medium">Sign out</span> in the top-right corner of the
              navbar. For shared or public computers, always sign out when you are done.
            </P>
          </SectionCard>

          {/* FOR STUDENTS */}
          <SectionCard
            section={sections[2]}
            isOpen={isOpen('for-students')}
            onToggle={() => toggle('for-students')}
          >
            <P>
              Your student dashboard is your home base. Almost everything starts there. Use the left
              sidebar to jump between sections.
            </P>
            <H3>1. Complete your profile</H3>
            <P>
              A complete profile gets better matches. From the sidebar, open{' '}
              <span className="font-medium">Profile</span> and fill in:
            </P>
            <Ul
              items={[
                <>Personal details: full name, date of birth, contact info, address.</>,
                <>Academic record: college, branch, CGPA, graduation year, current semester.</>,
                <>Projects, certifications, internships, and achievements.</>,
                <>A profile photo (optional but recommended).</>,
              ]}
            />
            <H3>2. Add your skills</H3>
            <P>
              Open <span className="font-medium">Skills</span> from the sidebar. Add each skill you
              know and set your proficiency level:
            </P>
            <Ul
              items={[
                <>
                  <span className="font-medium">Beginner</span> — you have taken a course or read
                  about it.
                </>,
                <>
                  <span className="font-medium">Intermediate</span> — you can apply it on a small
                  project.
                </>,
                <>
                  <span className="font-medium">Advanced</span> — you have shipped something with
                  it.
                </>,
                <>
                  <span className="font-medium">Expert</span> — you can teach or lead others.
                </>,
              ]}
            />
            <P>
              Add an evidence link (GitHub repo, blog post, project URL) for any skill you want to
              stand out on. The skill you list here is what the matching engine uses to score you
              against jobs.
            </P>
            <H3>3. Upload your resume</H3>
            <P>
              Open <span className="font-medium">Resume</span> from the sidebar. Upload a PDF up to
              5 MB. The file is stored privately — only companies you apply to (and the placement
              admin) can see it. You can replace the resume at any time; older applications keep the
              version that was current when you applied.
            </P>
            <H3>4. Take AI skill assessments (optional but powerful)</H3>
            <P>
              Open <span className="font-medium">Assessments</span>. The platform can generate a
              short, skill-specific set of questions using AI, and grade your answers. Passing an
              assessment automatically upgrades your skill proficiency for that topic, which
              improves your match score.
            </P>
            <H3>5. Browse jobs and internships</H3>
            <P>Two ways to find opportunities:</P>
            <Ul
              items={[
                <>
                  <span className="font-medium">Recommended</span> — opportunities the platform
                  matched to your profile, ranked by match score.
                </>,
                <>
                  <span className="font-medium">Jobs</span> /{' '}
                  <span className="font-medium">Internships</span> — full searchable list with
                  filters for location, work mode, stipend, and skill.
                </>,
              ]}
            />
            <P>
              Every opportunity shows a match percentage and a skill-gap breakdown. A higher match
              means your skills cover more of what the company asked for. A skill gap tells you
              which skills to add to your profile to improve the match.
            </P>
            <H3>6. Apply</H3>
            <P>
              On the opportunity page, click <span className="font-medium">Apply</span>, attach a
              short cover letter, and submit. The application is now in{' '}
              <span className="font-medium">APPLIED</span> status. You can save an opportunity to
              revisit later without applying — use the bookmark icon on the card.
            </P>
            <H3>7. Track applications and interviews</H3>
            <P>From the sidebar:</P>
            <Ul
              items={[
                <>
                  <span className="font-medium">Applications</span> — every application with its
                  current status, who it&apos;s with, and the next step.
                </>,
                <>
                  <span className="font-medium">Interviews</span> — scheduled interviews with date,
                  time, mode (online / onsite), and any prep notes from the company.
                </>,
                <>
                  <span className="font-medium">Notifications</span> — in-app alerts for status
                  changes, new interviews, mentor messages, and events.
                </>,
              ]}
            />
            <H3>8. Interim reports and completion certificates</H3>
            <P>
              If you are selected for an internship, open{' '}
              <span className="font-medium">Applications → Selected → Reports</span> to submit
              weekly progress reports. Companies read and rate your reports. When the internship
              ends, you can download a signed PDF completion certificate from the application page.
            </P>
            <H3>9. Mentorship, aptitude tests, training</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Mentorship</span> — request a mentor by expertise
                  area; once accepted, message them in a thread.
                </>,
                <>
                  <span className="font-medium">Aptitude</span> — take timed QUANT / LOGIC / VERBAL
                  / ENGLISH tests. Passing auto-upgrades a related skill.
                </>,
                <>
                  <span className="font-medium">Training</span> — recommended training programs
                  based on your skill gaps.
                </>,
                <>
                  <span className="font-medium">Documents</span> — upload certificates and
                  transcripts for institutional verification. Only verified documents appear on your
                  public portfolio at{' '}
                  <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-xs">
                    /portfolio/your-id
                  </code>
                  .
                </>,
              ]}
            />
          </SectionCard>

          {/* FOR COMPANIES */}
          <SectionCard
            section={sections[3]}
            isOpen={isOpen('for-companies')}
            onToggle={() => toggle('for-companies')}
          >
            <P>
              Company accounts post roles, see ranked applicants, and run the hiring workflow
              end-to-end.
            </P>
            <H3>1. Set up your company profile</H3>
            <P>
              From <span className="font-medium">Profile</span> in the sidebar, fill in:
            </P>
            <Ul
              items={[
                <>Company name, logo, website, industry, size, and description.</>,
                <>Contact details and the official email used for verification.</>,
                <>Locations, benefits, and any media links.</>,
              ]}
            />
            <P>
              A placement admin can verify your company, which adds a{' '}
              <span className="font-medium">Verified</span> badge to your postings.
            </P>
            <H3>2. Post a job or internship</H3>
            <P>
              From the sidebar, choose <span className="font-medium">Jobs</span> or{' '}
              <span className="font-medium">Internships</span> and click{' '}
              <span className="font-medium">New</span>. Fill in:
            </P>
            <Ul
              items={[
                <>
                  Title, description, location, work mode (onsite / hybrid / remote), and employment
                  type.
                </>,
                <>Required skills — add at least one; the matching engine uses this list.</>,
                <>
                  Salary or stipend range, openings, application deadline, and any eligibility
                  filters (min CGPA, allowed batches, etc.).
                </>,
              ]}
            />
            <P>
              Save as <span className="font-medium">Draft</span> to keep working, or{' '}
              <span className="font-medium">Publish</span> to make it visible to students. Drafts
              are private. Published roles appear in student search results.
            </P>
            <Tip>
              Required skills are the most important field — they drive the match score. Be
              specific. &quot;React, TypeScript, REST APIs&quot; ranks better than
              &quot;frontend&quot;.
            </Tip>
            <H3>3. Review applicants</H3>
            <P>
              Open <span className="font-medium">Applicants</span> from the sidebar. Each candidate
              is listed with a match score and a skill gap. Click any row to see the full profile,
              resume, and any verified documents. You can:
            </P>
            <Ul
              items={[
                <>
                  <span className="font-medium">Shortlist</span> — move a candidate to your
                  shortlist (they are notified).
                </>,
                <>
                  <span className="font-medium">Reject</span> — remove from your active pool (with
                  an optional reason).
                </>,
              ]}
            />
            <H3>4. Schedule and run interviews</H3>
            <P>
              From the application detail, click{' '}
              <span className="font-medium">Schedule interview</span>. Pick a date, time, mode, and
              a meeting link (or address). The student is notified in-app and by email. Reschedule,
              cancel, or mark complete from the <span className="font-medium">Interviews</span>{' '}
              page.
            </P>
            <H3>5. Close the role</H3>
            <P>
              Once you have made an offer, mark the candidate as{' '}
              <span className="font-medium">Selected</span>. To stop accepting new applications, set
              the job status to <span className="font-medium">Closed</span> (you can also do this
              from the <span className="font-medium">Manage</span> page).
            </P>
            <H3>6. Faculty opportunities, events, mentorship</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Faculty opportunities</span> — post FDPs,
                  consultancy engagements, collaborative research, or faculty internships.
                </>,
                <>
                  <span className="font-medium">Events</span> — host workshops, guest lectures,
                  innovation challenges, or live projects.
                </>,
                <>
                  <span className="font-medium">Mentorship</span> — publish a mentor profile (bio,
                  expertise, capacity) and accept student / faculty mentorship requests.
                </>,
                <>
                  <span className="font-medium">Verifications</span> — verify documents submitted by
                  applicants.
                </>,
              ]}
            />
          </SectionCard>

          {/* FOR ADMINS */}
          <SectionCard
            section={sections[4]}
            isOpen={isOpen('for-admins')}
            onToggle={() => toggle('for-admins')}
          >
            <P>
              The placement admin dashboard gives you a live view of every student, company, and
              opportunity on the platform.
            </P>
            <H3>From the dashboard</H3>
            <Ul
              items={[
                <>
                  Six stat cards summarise active students, active companies, open jobs, open
                  internships, total applications, and placements.
                </>,
                <>
                  Recharts visualisations show applications over time, top skills in demand, and
                  placement rate by branch.
                </>,
              ]}
            />
            <H3>Manage users</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Students</span> — view, filter, and activate /
                  deactivate accounts. Inactive students cannot sign in.
                </>,
                <>
                  <span className="font-medium">Companies</span> — verify companies (adds a verified
                  badge to their postings), and activate / deactivate.
                </>,
              ]}
            />
            <H3>Verification queue</H3>
            <P>
              Open <span className="font-medium">Verification queue</span> from the sidebar. Every
              uploaded document — certificates, transcripts, internship reports — appears here.
              Click any document to view, approve, or reject with a reason. Approved documents
              surface on the student&apos;s public portfolio.
            </P>
            <H3>Skill catalog and training</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Skills</span> — add, edit, or archive skills.
                  Archived skills cannot be added to new profiles but remain on existing ones.
                </>,
                <>
                  <span className="font-medium">Training</span> — create training programs (title,
                  description, link, category). Students see them as recommendations to close skill
                  gaps.
                </>,
                <>
                  <span className="font-medium">Aptitude questions</span> — curate the question bank
                  for QUANT / LOGIC / VERBAL / ENGLISH tests.
                </>,
              ]}
            />
            <H3>Manage opportunities and institutions</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Jobs</span> /{' '}
                  <span className="font-medium">Internships</span> — view every posting, force-close
                  any role, or delete a posting entirely.
                </>,
                <>
                  <span className="font-medium">Institutions</span> — create institutions, edit
                  details, verify them, and invite institution users.
                </>,
                <>
                  <span className="font-medium">Industry skill demand</span> — see which skills are
                  most requested across active postings.
                </>,
              ]}
            />
            <H3>Audit and oversight</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Audit logs</span> — every admin and company action
                  is recorded with actor, action, entity, and a before/after diff.
                </>,
                <>
                  <span className="font-medium">Events</span> and{' '}
                  <span className="font-medium">Mentorship</span> — see everything happening
                  platform-wide.
                </>,
              ]}
            />
          </SectionCard>

          {/* FOR FACULTY */}
          <SectionCard
            section={sections[5]}
            isOpen={isOpen('for-faculty')}
            onToggle={() => toggle('for-faculty')}
          >
            <P>
              Faculty accounts participate in industry collaboration, mentor students, and engage in
              faculty development programs.
            </P>
            <H3>Profile</H3>
            <P>
              From <span className="font-medium">Profile</span>, fill in department, designation,
              qualifications, research interests, and a bio. This is what students and companies see
              when you appear in opportunity listings.
            </P>
            <H3>Browse and apply to faculty opportunities</H3>
            <P>
              Open <span className="font-medium">Opportunities</span> from the sidebar. You will see
              FDPs, consultancy engagements, collaborative research, and faculty internships posted
              by companies. Apply with a short statement of interest. Track your applications in the{' '}
              <span className="font-medium">Applications</span> tab.
            </P>
            <H3>Mentor students</H3>
            <P>
              Students and other faculty can request mentorship from you. Open{' '}
              <span className="font-medium">Mentorship</span> to accept or decline pending requests.
              Once accepted, communicate via a threaded inbox. You can give feedback and ratings on
              interim reports from students you mentor.
            </P>
            <H3>Events and documents</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Events</span> — register for workshops, guest
                  lectures, and innovation challenges.
                </>,
                <>
                  <span className="font-medium">Documents</span> — upload transcripts, certificates,
                  and publications for institutional verification.
                </>,
                <>
                  <span className="font-medium">Certificates</span> — download a signed PDF
                  completion certificate after a successful engagement.
                </>,
              ]}
            />
          </SectionCard>

          {/* FOR INSTITUTIONS */}
          <SectionCard
            section={sections[6]}
            isOpen={isOpen('for-institutions')}
            onToggle={() => toggle('for-institutions')}
          >
            <P>
              Institution accounts see their own students and faculty in one consolidated dashboard.
              Admins can override the scope with{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-xs">
                ?institutionId=...
              </code>
              .
            </P>
            <H3>Dashboards and analytics</H3>
            <Ul
              items={[
                <>
                  Placement metrics, skill-gap trends, and FDP participation charts — scoped to your
                  institution only.
                </>,
                <>
                  Drill into individual students or faculty to see their profiles, applications, and
                  skill profiles.
                </>,
              ]}
            />
            <H3>Student and faculty directories</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Students</span> — every student linked to your
                  institution. Open any profile to see their academic record, skills, and placement
                  progress.
                </>,
                <>
                  <span className="font-medium">Faculty</span> — every faculty member linked to your
                  institution.
                </>,
              ]}
            />
            <H3>Skill gaps and placements</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">Skill gaps</span> — aggregate view of where your
                  students fall short of industry demand.
                </>,
                <>
                  <span className="font-medium">Placements</span> — placement outcomes, branch-wise,
                  year-wise.
                </>,
              ]}
            />
            <H3>FDPs and verifications</H3>
            <Ul
              items={[
                <>
                  <span className="font-medium">FDPs</span> — post faculty development programs and
                  track registrations.
                </>,
                <>
                  <span className="font-medium">Verifications</span> — verify documents submitted by
                  your own students and faculty.
                </>,
                <>
                  <span className="font-medium">Events</span> — host guest lectures, workshops, and
                  other collaboration events.
                </>,
              ]}
            />
            <H3>ERP sync (advanced)</H3>
            <P>
              Your institution&apos;s ERP can post to{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-xs">
                POST /webhooks/erp/students
              </code>{' '}
              with an HMAC-SHA256 signature to upsert students automatically. The platform team sets
              the secret and disables the endpoint if the secret is left blank.
            </P>
          </SectionCard>

          {/* HOW APPLICATIONS WORK */}
          <SectionCard
            section={sections[7]}
            isOpen={isOpen('how-applications-work')}
            onToggle={() => toggle('how-applications-work')}
          >
            <P>
              Every application moves through a defined status flow. Both you and the company see
              the same status; updates are real-time.
            </P>
            <ol className="space-y-3 mt-2">
              {[
                { status: 'APPLIED', who: 'You submitted your application and cover letter.' },
                {
                  status: 'SHORTLISTED',
                  who: 'The company reviewed your profile and moved you forward.',
                },
                {
                  status: 'INTERVIEW_SCHEDULED',
                  who: 'The company scheduled an interview. Check the Interviews tab.',
                },
                {
                  status: 'OFFERED',
                  who: 'You received an offer. Accept or decline from the application page.',
                },
                {
                  status: 'SELECTED',
                  who: 'You accepted. Submit interim reports during the engagement.',
                },
                {
                  status: 'REJECTED',
                  who: 'The company passed on this application. You can apply to other roles.',
                },
              ].map((step) => (
                <li key={step.status} className="flex gap-3">
                  <span className="shrink-0 w-2 h-2 mt-2 rounded-full bg-indigo-500" />
                  <div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      {step.status}
                    </span>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {step.who}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <Tip>
              You can withdraw an application any time before it reaches{' '}
              <span className="font-mono text-xs">SELECTED</span> from the application detail page.
            </Tip>
          </SectionCard>

          {/* HOW MATCHING WORKS */}
          <SectionCard
            section={sections[8]}
            isOpen={isOpen('how-matching-works')}
            onToggle={() => toggle('how-matching-works')}
          >
            <P>
              The match score is a percentage that shows how well your skills cover what a company
              asked for. It combines a deterministic overlap calculation with an AI-enhanced reading
              of the job description.
            </P>
            <H3>How the score is calculated</H3>
            <Ol
              items={[
                <>
                  The job&apos;s required skills are compared to your profile skills (with
                  proficiency levels).
                </>,
                <>
                  Skills you have at the right or higher proficiency contribute positively. Missing
                  or lower-proficiency skills are gaps.
                </>,
                <>
                  The base score is the percentage of required skills you cover. An AI pass then
                  adjusts the score for nuance — synonyms, related technologies, and context.
                </>,
              ]}
            />
            <H3>Reading the skill gap view</H3>
            <P>Open any opportunity detail page to see the breakdown:</P>
            <Ul
              items={[
                <>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Have</span> —
                  skills you already list at sufficient proficiency.
                </>,
                <>
                  <span className="font-medium text-rose-600 dark:text-rose-400">Need</span> —
                  required skills missing or below the requested level.
                </>,
                <>
                  <span className="font-medium text-amber-600 dark:text-amber-400">Stretch</span> —
                  adjacent skills that are not an exact match but close.
                </>,
              ]}
            />
            <P>
              Add a missing skill to your profile (or take an assessment to upgrade its proficiency)
              and the next match recomputes automatically.
            </P>
            <H3>Where you see the score</H3>
            <Ul
              items={[
                <>On every opportunity card, as a coloured percentage badge.</>,
                <>
                  In the <span className="font-medium">Recommended</span> tab, where opportunities
                  are ranked by score.
                </>,
                <>
                  On the company&apos;s <span className="font-medium">Applicants</span> list, where
                  each candidate is also scored against the role.
                </>,
              ]}
            />
          </SectionCard>

          {/* NAVIGATING DASHBOARDS */}
          <SectionCard
            section={sections[9]}
            isOpen={isOpen('navigating-dashboards')}
            onToggle={() => toggle('navigating-dashboards')}
          >
            <P>
              Every dashboard has a left sidebar with the same visual structure. Here is what every
              menu item does, grouped by role.
            </P>
            <H3>Student</H3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                ['Dashboard', 'Overview cards and your latest application statuses.'],
                ['Profile', 'Your full academic record and personal details.'],
                ['Skills', 'Add, edit, and upgrade skills; take AI assessments.'],
                ['Resume', 'Upload or replace your PDF resume.'],
                ['Documents', 'Upload certificates and transcripts for verification.'],
                ['Recommended', 'Opportunities matched to your profile, ranked.'],
                ['Jobs / Internships', 'Browse all open roles with filters.'],
                ['Saved', 'Opportunities you bookmarked for later.'],
                ['Applications', 'Track every application and its current status.'],
                ['Interviews', 'Scheduled interviews with date, time, and mode.'],
                ['Skill Gap', 'Aggregate view of where you fall short of demand.'],
                ['Aptitude', 'Timed QUANT / LOGIC / VERBAL / ENGLISH tests.'],
                ['Training', 'Recommended training to close skill gaps.'],
                ['Mentorship', 'Request and message a mentor.'],
                ['Events', 'Discover and register for collaboration events.'],
                ['Notifications', 'In-app alerts and status updates.'],
                ['Settings', 'Account, password, theme, and privacy.'],
              ].map(([label, desc]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{label}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    {desc}
                  </div>
                </div>
              ))}
            </div>
            <H3>Company</H3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                ['Dashboard', 'Your active roles, applicants, and upcoming interviews.'],
                ['Profile', 'Company details, logo, and contact info.'],
                ['Jobs / Internships', 'List of your postings, with publish / close controls.'],
                ['Applicants', 'Candidates ranked by match score.'],
                ['Shortlisted', 'Candidates you have shortlisted.'],
                ['Interviews', 'Schedule, reschedule, and complete interviews.'],
                ['Faculty opportunities', 'FDPs, consultancies, and research postings.'],
                ['Events', 'Host workshops, lectures, and challenges.'],
                ['Mentorship', 'Publish a mentor profile and accept requests.'],
                ['Verifications', 'Verify student-submitted documents.'],
                ['Notifications', 'Application and interview alerts.'],
                ['Settings', 'Account, password, and notification preferences.'],
              ].map(([label, desc]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{label}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    {desc}
                  </div>
                </div>
              ))}
            </div>
            <H3>Admin</H3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                ['Dashboard', '6 stat cards + analytics charts.'],
                ['Students / Companies', 'View, filter, and activate / deactivate.'],
                ['Jobs / Internships', 'All postings; force-close or delete.'],
                ['Applications', 'Every application across the platform.'],
                ['Skills', 'Skill catalog management.'],
                ['Aptitude questions', 'Curate the timed test question bank.'],
                ['Training', 'Create and manage training programs.'],
                ['Analytics', 'Applications over time, top skills, placement rate.'],
                ['Industry skill demand', 'What skills are most requested.'],
                ['Verification queue', 'Approve or reject uploaded documents.'],
                ['Institutions', 'Create, edit, and verify institutions.'],
                ['Events / Mentorship', 'Platform-wide oversight.'],
                ['Audit logs', 'Every action with before / after diff.'],
                ['Settings', 'Platform configuration.'],
              ].map(([label, desc]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="font-medium text-slate-900 dark:text-slate-100">{label}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* HELP & FAQ */}
          <SectionCard
            section={sections[10]}
            isOpen={isOpen('help-faq')}
            onToggle={() => toggle('help-faq')}
          >
            <div className="space-y-4">
              {[
                {
                  q: 'I cannot sign in. The page says "Invalid credentials".',
                  a: 'Double-check the email — including the domain — and try resetting your password. If the issue persists, your account may be inactive; contact your placement admin.',
                },
                {
                  q: 'My session keeps signing me out.',
                  a: 'Sessions last 7 days. If you are on a shared device or have cookies disabled, enable cookies for this site. If you have signed in on a different device, the older session is invalidated.',
                },
                {
                  q: 'My resume upload is failing.',
                  a: 'The maximum size is 5 MB and the format must be PDF. If the file is valid and still fails, try a different browser or check your network connection.',
                },
                {
                  q: 'I do not see a job that was posted earlier.',
                  a: 'Only PUBLISHED jobs are visible to students. Drafts, closed, and deleted jobs are hidden. If you saved a job and the company later unpublished it, the bookmark will also disappear.',
                },
                {
                  q: 'How do I contact support?',
                  a: 'Use the Contact page from the top nav, or reach out to your placement admin. For technical issues, include a screenshot and the time the problem occurred.',
                },
                {
                  q: 'Is the platform accessible?',
                  a: 'The platform is built to be keyboard-navigable and screen-reader-friendly. Every interactive control has a visible focus ring, every icon-only button has an aria-label, and all content respects your system dark-mode preference (with a manual override).',
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="rounded-lg border border-slate-200 p-4 group dark:border-slate-800"
                >
                  <summary className="cursor-pointer font-medium text-slate-900 dark:text-slate-100 list-none flex items-start justify-between gap-3">
                    <span>{item.q}</span>
                    <span className="shrink-0 text-slate-400 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-2">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 no-underline"
              >
                Contact support <FiArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Create an account
              </Link>
            </div>
          </SectionCard>

          {/* Bottom CTA */}
          <div className="mt-10 rounded-2xl bg-indigo-600 p-8 lg:p-10 text-white dark:bg-indigo-900">
            <div className="flex items-start gap-4">
              <FiBookmark className="w-6 h-6 shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold mb-2">Ready to get started?</h2>
                <p className="text-indigo-100 mb-6 max-w-2xl leading-relaxed">
                  Your account works across roles. Create one account, and your placement admin can
                  grant you additional access as needed.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-indigo-700 font-medium hover:bg-indigo-50 no-underline"
                  >
                    Create an account <FiArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/jobs"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-indigo-300 text-white hover:bg-indigo-700 no-underline"
                  >
                    Browse opportunities
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// (no extra exports)
