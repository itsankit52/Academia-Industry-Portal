import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, placeholder, className, id, required, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300"
          >
            {label}
            {required && (
              <span className="ml-0.5 text-rose-500" aria-hidden="true">
                {' '}
                *
              </span>
            )}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'block w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 bg-white',
            'transition-colors duration-150 cursor-pointer',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0',
            'dark:text-slate-100 dark:bg-slate-800',
            error
              ? 'border-rose-400 bg-rose-50 focus-visible:ring-rose-400 dark:bg-rose-950/30 dark:border-rose-700'
              : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600',
            className,
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        >
          {/* The placeholder must NOT be `disabled`. When nothing is selected,
              browsers select the first *enabled* option — so a disabled
              placeholder made the first real option (e.g. the first
              institution) the silent default, including when options arrive
              after mount. An enabled, `hidden` placeholder with value "" stays
              selected until the user picks something, and the form's
              validation then reports the field as missing. */}
          {placeholder && (
            <option value="" hidden>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1.5 text-xs text-rose-600 dark:text-rose-400"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';

export { Select };
export default Select;
