import { useState, KeyboardEvent } from 'react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';

interface BranchPickerProps {
  value: string[];
  onChange: (branches: string[]) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

export default function BranchPicker({
  value,
  onChange,
  label,
  error,
  placeholder = 'Type a branch and press Enter…',
}: BranchPickerProps) {
  const [input, setInput] = useState('');

  function add() {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  }

  function remove(branch: string) {
    onChange(value.filter((v) => v !== branch));
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add();
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="w-full">
      {label && (
        <p className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">{label}</p>
      )}
      <div
        className={cn(
          'min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-lg border bg-white transition-colors dark:bg-slate-800',
          error
            ? 'border-rose-400 dark:border-rose-700'
            : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600',
        )}
      >
        {value.map((branch) => (
          <span
            key={branch}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-medium border border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800"
          >
            {branch}
            <button
              type="button"
              onClick={() => remove(branch)}
              className="hover:text-rose-600 transition-colors focus-visible:outline-none dark:hover:text-rose-400"
              aria-label={`Remove ${branch}`}
            >
              <FiX className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[160px] text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder={value.length === 0 ? placeholder : ''}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={add}
          aria-label={label ?? 'Branch input'}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">{error}</p>
      )}
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Press Enter or comma to add each branch.</p>
    </div>
  );
}
