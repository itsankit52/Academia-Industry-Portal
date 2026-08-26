import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="flex items-center gap-2.5 cursor-pointer group">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className={cn(
              'w-4 h-4 rounded border-slate-300 text-indigo-600',
              'focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
              'dark:border-slate-600 dark:bg-slate-800',
              className,
            )}
            {...props}
          />
          <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors dark:text-slate-300 dark:group-hover:text-slate-100">{label}</span>
        </label>
        {error && (
          <p className="text-xs text-rose-600 pl-6 dark:text-rose-400" role="alert">{error}</p>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
export default Checkbox;
