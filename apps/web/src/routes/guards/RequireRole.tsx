import type { ReactNode } from 'react';
import type { Role } from '@aip/config';
import { useAuth } from '@/hooks/useAuth';
import ForbiddenPage from '@/pages/public/ForbiddenPage';

interface Props {
  role: Role;
  children: ReactNode;
}

export default function RequireRole({ role, children }: Props) {
  const { user } = useAuth();
  if (user?.role !== role) return <ForbiddenPage />;
  return <>{children}</>;
}
