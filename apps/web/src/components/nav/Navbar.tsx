import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiMenu } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/mutations/useLogout';
import MobileMenu from './MobileMenu';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { dashboardPathForRole } from '@/lib/roleRoutes';

const publicLinks = [
  { to: '/jobs', label: 'Jobs' },
  { to: '/internships', label: 'Internships' },
  { to: '/guide', label: 'User Guide' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const logout = useLogout();

  // Phase 14A: centralized role → dashboard mapping (single source of truth)
  const dashboardPath = dashboardPathForRole(user?.role);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-800">
        <div className="container-page">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 no-underline" aria-label="Home">
              <span className="text-xl font-bold text-indigo-600">AIP</span>
              <span className="hidden sm:block text-sm font-medium text-slate-600 dark:text-slate-400">
                AcadIn
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Primary navigation">
              {publicLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline',
                      isActive
                        ? 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden lg:flex items-center gap-3">
              <ThemeToggle />
              {isAuthenticated ? (
                <>
                  <Link
                    to={dashboardPath}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors no-underline"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => logout.mutate()}
                    disabled={logout.isPending}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-lg text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors no-underline dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors no-underline"
                  >
                    Get started
                  </Link>
                </>
              )}
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <ThemeToggle />
              <button
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800"
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={menuOpen}
              >
                <FiMenu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
