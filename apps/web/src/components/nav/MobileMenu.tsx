import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/mutations/useLogout';
import { dashboardPathForRole } from '@/lib/roleRoutes';
import Logo from '@/components/ui/Logo';

interface Props {
  open: boolean;
  onClose: () => void;
}

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/internships', label: 'Internships' },
  { to: '/guide', label: 'User Guide' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function MobileMenu({ open, onClose }: Props) {
  const { isAuthenticated, user } = useAuth();
  const logout = useLogout();

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  // Phase 14A: consume the centralized role → dashboard helper so all
  // chrome surfaces (Navbar, MobileMenu, Sidebar, etc.) stay in lock-step.
  const dashboardPath = dashboardPathForRole(user?.role);

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
    >
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm dark:bg-black/70"
        onClick={onClose}
      />
      <div
        className={cn(
          'absolute top-0 right-0 h-full w-72 bg-white shadow-xl flex flex-col dark:bg-slate-900',
          'transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <Logo className="h-5" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:bg-slate-800"
            aria-label="Close menu"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {publicLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {isAuthenticated ? (
            <>
              <Link
                to={dashboardPath}
                onClick={onClose}
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors no-underline"
              >
                Dashboard
              </Link>
              <button
                onClick={() => {
                  logout.mutate();
                  onClose();
                }}
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={onClose}
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors no-underline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Log in
              </Link>
              <Link
                to="/register"
                onClick={onClose}
                className="flex items-center justify-center w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors no-underline"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
