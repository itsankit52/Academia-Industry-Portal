import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import PageSkeleton from '@/components/ui/PageSkeleton';

export default function RequireAuth() {
  const { isAuthenticated, isBooting } = useAuth();
  const location = useLocation();

  if (isBooting) return <PageSkeleton />;
  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}
