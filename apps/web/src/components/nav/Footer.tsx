import { Link } from 'react-router-dom';
import Logo from '@/components/ui/Logo';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      <div className="container-page py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo className="h-5" />
            <span className="text-sm text-slate-500 dark:text-slate-400">AcadIn</span>
          </div>
          <nav className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <Link
              to="/about"
              className="hover:text-indigo-600 transition-colors no-underline text-slate-500 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              About
            </Link>
            <Link
              to="/contact"
              className="hover:text-indigo-600 transition-colors no-underline text-slate-500 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              Contact
            </Link>
            <Link
              to="/jobs"
              className="hover:text-indigo-600 transition-colors no-underline text-slate-500 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              Jobs
            </Link>
            <Link
              to="/internships"
              className="hover:text-indigo-600 transition-colors no-underline text-slate-500 dark:text-slate-400 dark:hover:text-indigo-400"
            >
              Internships
            </Link>
          </nav>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            &copy; {year} AcadIn. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
