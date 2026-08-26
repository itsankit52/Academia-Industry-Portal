import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FiltersProps {
  children: ReactNode;
  className?: string;
}

export default function Filters({ children, className }: FiltersProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3', className)}>
      {children}
    </div>
  );
}

export { Filters };
