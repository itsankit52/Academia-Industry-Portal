import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface RadioOption {
  value: string;
  label: string;
}

interface RadioGroupProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label?: string;
  options: RadioOption[];
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  name: string;
}

const RadioGroup = forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ label, options, value, onChange, error, name, className }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-2', className)} role="radiogroup" aria-label={label}>
      {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>}
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange?.(opt.value)}
            className="w-4 h-4 border-slate-300 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800"
          />
          <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors dark:text-slate-300 dark:group-hover:text-slate-100">{opt.label}</span>
        </label>
      ))}
      {error && <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">{error}</p>}
    </div>
  ),
);

RadioGroup.displayName = 'RadioGroup';

export { RadioGroup };
export default RadioGroup;
