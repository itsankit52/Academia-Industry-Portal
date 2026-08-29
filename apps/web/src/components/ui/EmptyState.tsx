import { type ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?:
    | {
        label: string;
        onClick: () => void;
      }
    | ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4 text-2xl dark:bg-slate-800 dark:text-slate-500">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 mb-1 dark:text-slate-100">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs mb-5 dark:text-slate-400">{description}</p>
      )}
      {action && typeof action === 'object' && 'onClick' in action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      {action && typeof action !== 'object' && <div className="mt-2">{action}</div>}
      {action && typeof action === 'object' && !('onClick' in action) && (
        <div className="mt-2">{action}</div>
      )}
    </div>
  );
}

export { EmptyState };
