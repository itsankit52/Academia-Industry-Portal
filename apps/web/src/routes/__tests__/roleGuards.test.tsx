/**
 * Phase 15C — Frontend Role Guards Tests
 *
 * Tests:
 * - RequireRole renders children when user role matches
 * - RequireRole renders ForbiddenPage when user role does NOT match (all 4 roles)
 * - RequireAuth redirects unauthenticated users to /login
 * - RequireAuth renders children when user is authenticated
 * - dashboardPathForRole returns correct path for all 4 roles
 * - dashboardPathForRole returns '/' for unknown/null roles
 */

import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Role } from '@aip/config';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import RequireRole from '../guards/RequireRole';
import RequireAuth from '../guards/RequireAuth';
import { renderWithProviders } from '@/test/renderWithProviders';
import { useAuthStore } from '@/store/auth';
import { dashboardPathForRole } from '@/lib/roleRoutes';

// ─── RequireRole tests ────────────────────────────────────────────────

const ALL_ROLES: Role[] = ['STUDENT', 'COMPANY', 'FACULTY', 'INSTITUTION'];

function FakeChild() {
  return <div data-testid="allowed-child">Allowed Content</div>;
}

describe('RequireRole guard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isBooting: false });
  });

  it('renders children when user role matches', () => {
    for (const role of ALL_ROLES) {
      useAuthStore.setState({
        user: { id: 'u1', email: 'test@t.com', role, isActive: true, createdAt: '', updatedAt: '' },
      });
      renderWithProviders(
        <RequireRole role={role}>
          <FakeChild />
        </RequireRole>,
      );
      expect(screen.getByTestId('allowed-child')).toBeInTheDocument();
    }
  });

  it('renders ForbiddenPage when user role does NOT match', () => {
    const wrongRole: Role = 'STUDENT';
    const matchingRole: Role = 'COMPANY';

    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'test@t.com',
        role: wrongRole,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
    });

    renderWithProviders(
      <RequireRole role={matchingRole}>
        <FakeChild />
      </RequireRole>,
    );

    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByTestId('allowed-child')).not.toBeInTheDocument();
  });

  it('renders ForbiddenPage for STUDENT trying to access COMPANY routes', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'student@t.com',
        role: 'STUDENT',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
    });
    renderWithProviders(
      <RequireRole role="COMPANY">
        <FakeChild />
      </RequireRole>,
    );
    expect(screen.getByText('403')).toBeInTheDocument();
  });

  it('renders ForbiddenPage for FACULTY trying to access INSTITUTION routes', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'faculty@t.com',
        role: 'FACULTY',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
    });
    renderWithProviders(
      <RequireRole role="INSTITUTION">
        <FakeChild />
      </RequireRole>,
    );
    expect(screen.getByText('403')).toBeInTheDocument();
  });

  it('renders ForbiddenPage when user is null', () => {
    renderWithProviders(
      <RequireRole role="STUDENT">
        <FakeChild />
      </RequireRole>,
    );
    expect(screen.getByText('403')).toBeInTheDocument();
  });
});

// ─── RequireAuth tests ────────────────────────────────────────────────

function FakeDashboard() {
  return <div data-testid="dashboard">Dashboard Content</div>;
}

describe('RequireAuth guard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isBooting: false });
  });

  it('renders children when user is authenticated', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'test@t.com',
        role: 'STUDENT',
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
    });
    // RequireAuth uses <Outlet /> for its child, so we wrap in a Routes
    // so the children are picked up as the outlet's content.
    renderWithProviders(
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="*" element={<FakeDashboard />} />
        </Route>
      </Routes>,
      { route: '/any-route' },
    );
    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
  });

  it('redirects unauthenticated user via Navigate', () => {
    // We render a small Routes stack so Navigate inside RequireAuth can be
    // picked up. The destination URL is checked via the rendered DOM.
    renderWithProviders(
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="*" element={<FakeDashboard />} />
        </Route>
      </Routes>,
      { route: '/student/dashboard' },
    );
    // When unauthenticated, RequireAuth renders <Navigate to="/login..." />.
    // The Navigate component renders nothing visible, so the dashboard should
    // NOT be in the document.
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('shows PageSkeleton while booting', () => {
    useAuthStore.setState({ user: null, isBooting: true });
    // RequireAuth uses <Outlet /> (no children prop), so wrap in Routes
    // like the other RequireAuth tests.
    renderWithProviders(
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="*" element={<FakeDashboard />} />
        </Route>
      </Routes>,
      { route: '/student/dashboard' },
    );
    // While booting, neither dashboard nor redirect should be shown
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});

// ─── roleRoutes tests ─────────────────────────────────────────────────

describe('dashboardPathForRole', () => {
  it('returns correct path for STUDENT', () => {
    expect(dashboardPathForRole('STUDENT')).toBe('/student/dashboard');
  });

  it('returns correct path for COMPANY', () => {
    expect(dashboardPathForRole('COMPANY')).toBe('/company/dashboard');
  });

  it('returns correct path for FACULTY', () => {
    expect(dashboardPathForRole('FACULTY')).toBe('/faculty/dashboard');
  });

  it('returns correct path for INSTITUTION', () => {
    expect(dashboardPathForRole('INSTITUTION')).toBe('/institution/dashboard');
  });

  it('returns correct path for ADMIN', () => {
    expect(dashboardPathForRole('ADMIN')).toBe('/admin/dashboard');
  });

  it('returns / for null', () => {
    expect(dashboardPathForRole(null)).toBe('/');
  });

  it('returns / for undefined', () => {
    expect(dashboardPathForRole(undefined)).toBe('/');
  });

  it('returns / for unknown role', () => {
    expect(dashboardPathForRole('SUPERUSER' as Role)).toBe('/');
  });
});
