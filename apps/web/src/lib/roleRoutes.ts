/**
 * Phase 14A — Centralized role → route mapping.
 *
 * Every component that links a "Dashboard" or "Home" button for an
 * authenticated user (Navbar, MobileMenu, Sidebar, Footer, post-login
 * redirects, etc.) MUST consume `dashboardPathForRole` rather than
 * inlining the switch. This keeps the four role routes — student,
 * company, faculty, institution — consistent across the SPA and means a
 * future role or rename only has to be made in one place.
 *
 * The Admin role is intentionally treated as an internal tool with no
 * public "dashboard" surface; it is included so the public Navbar's
 * `useAuth().user` doesn't blow up when an admin signs in for support.
 */
import type { Role } from '@aip/config';

export const ROLE_DASHBOARD: Record<Role, string> = {
  STUDENT: '/student/dashboard',
  COMPANY: '/company/dashboard',
  FACULTY: '/faculty/dashboard',
  INSTITUTION: '/institution/dashboard',
  ADMIN: '/admin/dashboard',
};

export const ROLE_HOME: Record<Role, string> = ROLE_DASHBOARD;

export const ROLE_NOTIFICATIONS: Record<Role, string> = {
  STUDENT: '/student/notifications',
  COMPANY: '/company/notifications',
  // Faculty and institution currently reuse the dashboard for notifications;
  // they are listed here so the path stays explicit.
  FACULTY: '/faculty/dashboard',
  INSTITUTION: '/institution/dashboard',
  ADMIN: '/admin/dashboard',
};

export const ROLE_SETTINGS: Record<Role, string> = {
  STUDENT: '/student/settings',
  COMPANY: '/company/settings',
  FACULTY: '/faculty/settings',
  INSTITUTION: '/institution/settings',
  ADMIN: '/admin/settings',
};

/**
 * Returns the dashboard path for the given role. Falls back to `/` for any
 * unknown role so a stale auth-store value (e.g. a deleted role) cannot
 * render a broken link.
 */
export function dashboardPathForRole(role: Role | string | null | undefined): string {
  if (role && role in ROLE_DASHBOARD) {
    return ROLE_DASHBOARD[role as Role];
  }
  return '/';
}
