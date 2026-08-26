import { FiAlertTriangle } from 'react-icons/fi';
import Button from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-4 dark:bg-rose-950/40 dark:text-rose-400">
        <FiAlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1 dark:text-slate-100">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-5 dark:text-slate-400">{description}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export { ErrorState };
