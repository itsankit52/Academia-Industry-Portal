import { Outlet } from 'react-router-dom';
import { FiMenu, FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Sidebar from '@/components/nav/Sidebar';
import { adminNavItems } from '@/components/nav/AdminNavItems';
import { useHydrateAuth } from '@/hooks/useHydrateAuth';
import { useAuth } from '@/hooks/useAuth';
import { useLogout } from '@/hooks/mutations/useLogout';
import { useSidebarDrawer } from '@/hooks/useSidebarDrawer';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Logo from '@/components/ui/Logo';

export default function AdminLayout() {
  useHydrateAuth();
  const { user } = useAuth();
  const logout = useLogout();
  const drawer = useSidebarDrawer();

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      <Sidebar
        items={adminNavItems}
        header="Admin Portal"
        isOpen={drawer.isOpen}
        onClose={drawer.close}
        drawerRef={drawer.drawerRef}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between shrink-0 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={drawer.open}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Open navigation menu"
              aria-expanded={drawer.isOpen}
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <Link to="/" className="no-underline lg:hidden">
              <Logo className="h-6" />
            </Link>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/admin/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors no-underline text-sm font-medium dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Admin settings"
            >
              <FiUser className="w-4 h-4" />
              <span className="hidden sm:block">{user?.email ?? 'Admin'}</span>
            </Link>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="hidden sm:block px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
