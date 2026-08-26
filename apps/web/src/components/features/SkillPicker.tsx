import { useState, useRef, useEffect } from 'react';
import { FiX, FiSearch } from 'react-icons/fi';
import { useSkillsCatalog } from '@/hooks/queries/useSkills';
import type { Skill } from '@aip/types';
import { cn } from '@/lib/cn';

interface SkillPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

export default function SkillPicker({ value, onChange, label, error, placeholder = 'Search skills…' }: SkillPickerProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: catalogData } = useSkillsCatalog();
  const catalog = catalogData?.items ?? [];

  const selectedSkills = catalog.filter((s) => value.includes(s.id));
  const suggestions = catalog.filter(
    (s) =>
      !value.includes(s.id) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  ).slice(0, 10);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function add(skill: Skill) {
    onChange([...value, skill.id]);
    setQuery('');
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    // `relative`, because the suggestion panel below is `absolute`. Without a
    // positioned ancestor here — and neither `Card` nor `Card.Body` is one — the
    // panel anchored to some far-off ancestor instead of to this field, so the
    // options rendered away from the input the user was typing into and `w-full`
    // sized them against the wrong box.
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <p className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">{label}</p>
      )}
      <div
        className={cn(
          'min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-lg border bg-white transition-colors dark:bg-slate-800',
          error
            ? 'border-rose-400 dark:border-rose-700'
            : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600',
          open && 'ring-2 ring-indigo-500',
        )}
        onClick={() => setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selectedSkills.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800"
          >
            {s.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(s.id); }}
              className="hover:text-rose-600 transition-colors focus-visible:outline-none dark:hover:text-rose-400"
              aria-label={`Remove ${s.name}`}
            >
              <FiX className="w-3 h-3" />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <FiSearch className="w-3.5 h-3.5 text-slate-400 shrink-0 dark:text-slate-500" />
          <input
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder={selectedSkills.length === 0 ? placeholder : ''}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            aria-label={label ?? 'Search skills'}
          />
        </div>
      </div>

      {open && query.length > 0 && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto dark:bg-slate-900 dark:border-slate-700"
        >
          {suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No skills found.</p>
          ) : (
            suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); add(s); }}
                className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center justify-between dark:text-slate-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
              >
                <span>{s.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500">{s.category}</span>
              </button>
            ))
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">{error}</p>
      )}
    </div>
  );
}
