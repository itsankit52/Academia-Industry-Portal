import { type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TableProps {
  children: ReactNode;
  className?: string;
  zebra?: boolean;
  hover?: boolean;
}

export default function Table({ children, className, zebra = true, hover = true }: TableProps) {
  return (
    <div className="overflow-x-auto w-full rounded-lg border border-slate-200 dark:border-slate-800">
      <table
        className={cn(
          'w-full text-sm text-left',
          zebra && '[&_tbody_tr:nth-child(even)]:bg-slate-50 dark:[&_tbody_tr:nth-child(even)]:bg-slate-800/50',
          hover && '[&_tbody_tr]:hover:bg-indigo-50/40 dark:[&_tbody_tr]:hover:bg-indigo-950/30 [&_tbody_tr]:transition-colors',
          className,
        )}
      >
        {children}
      </table>
    </div>
  );
}

interface ThProps {
  children: ReactNode;
  className?: string;
}

export function Thead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={cn('bg-slate-50 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700', className)}>
      {children}
    </thead>
  );
}

export function Th({ children, className }: ThProps) {
  return (
    <th className={cn('px-4 py-3 font-semibold text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400', className)}>
      {children}
    </th>
  );
}

export function Tbody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={cn('divide-y divide-slate-100 dark:divide-slate-800', className)}>{children}</tbody>;
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 text-slate-700 dark:text-slate-300', className)}>{children}</td>;
}

Table.Head = Thead;
Table.Th = Th;
Table.Body = Tbody;
Table.Td = Td;
