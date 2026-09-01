import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { FiX, FiSearch, FiPlus, FiLoader } from 'react-icons/fi';
import { useSkillsCatalog, useCreateSkill } from '@/hooks/queries/useSkills';
import type { Skill } from '@aip/types';
import type { SkillCategory } from '@aip/config';
import { cn } from '@/lib/cn';

const DEFAULT_CATEGORY: SkillCategory = 'OTHER';

interface SkillPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

export default function SkillPicker({
  value,
  onChange,
  label,
  error,
  placeholder = 'Search or type a skill…',
}: SkillPickerProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: catalogData, isLoading, isError } = useSkillsCatalog();
  const createSkill = useCreateSkill();
  const catalog = catalogData?.items ?? [];

  // 200ms debounce — searches are now mostly in-memory because the whole
  // catalog is loaded, but this keeps the keyboard highlight from snapping
  // every keystroke and gives a more deliberate "search" feel.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Click outside closes the panel.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedSkills = useMemo(
    () => catalog.filter((s) => value.includes(s.id)),
    [catalog, value],
  );

  // Candidates = catalog matches that aren't already picked. Sorted so exact
  // prefix matches come first, then by name. Empty query lists all unselected.
  const suggestions = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const unselected = catalog.filter((s) => !value.includes(s.id));
    if (!q) return unselected.slice(0, 50);
    return unselected
      .filter((s) => s.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aExact = a.name.toLowerCase() === q;
        const bExact = b.name.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;
        const aPrefix = a.name.toLowerCase().startsWith(q);
        const bPrefix = b.name.toLowerCase().startsWith(q);
        if (aPrefix && !bPrefix) return -1;
        if (bPrefix && !aPrefix) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 50);
  }, [catalog, value, debouncedQuery]);

  // Determine whether the typed query is missing from the catalog — if so,
  // offer "Create <name>". Exact case-insensitive match disables the option.
  const canCreate = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) return null;
    const exists = catalog.some(
      (s) => s.name.toLowerCase() === q.toLowerCase() && !value.includes(s.id),
    );
    if (exists) return null;
    return q;
  }, [debouncedQuery, catalog, value]);

  // Combined list of options for keyboard navigation. When a Create option is
  // available, append it as the last entry.
  const optionCount = suggestions.length + (canCreate ? 1 : 0);

  // Reset highlight whenever the option set changes.
  useEffect(() => {
    setHighlightIndex(0);
  }, [debouncedQuery, optionCount]);

  const add = useCallback(
    (skill: Skill) => {
      onChange([...value, skill.id]);
      setQuery('');
      setDebouncedQuery('');
      setOpen(false);
    },
    [onChange, value],
  );

  const remove = useCallback(
    (id: string) => {
      onChange(value.filter((v) => v !== id));
    },
    [onChange, value],
  );

  function handleCreate() {
    if (!canCreate) return;
    createSkill.mutate(
      {
        name: canCreate,
        category: DEFAULT_CATEGORY,
      },
      {
        onSuccess: (created) => {
          onChange([...value, created.id]);
          setQuery('');
          setDebouncedQuery('');
          setOpen(false);
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = suggestions[highlightIndex];
      if (picked) {
        add(picked);
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const showPanel = open && (debouncedQuery.length > 0 || isLoading);

  return (
    // `relative`, because the suggestion panel below is `absolute`. Without a
    // positioned ancestor here — and neither `Card` nor `Card.Body` is one — the
    // panel anchored to some far-off ancestor instead of to this field, so the
    // options rendered away from the input the user was typing into and `w-full`
    // sized them against the wrong box.
    <div className="w-full relative" ref={containerRef}>
      {label && (
        <p className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">
          {label}
        </p>
      )}
      <div
        className={cn(
          'min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-lg border bg-white transition-colors dark:bg-slate-800',
          error
            ? 'border-rose-400 dark:border-rose-700'
            : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600',
          open && 'ring-2 ring-indigo-500',
        )}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        role="combobox"
        aria-expanded={showPanel}
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
              onClick={(e) => {
                e.stopPropagation();
                remove(s.id);
              }}
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
            ref={inputRef}
            className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder={selectedSkills.length === 0 ? placeholder : ''}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            aria-label={label ?? 'Search skills'}
            aria-autocomplete="list"
          />
        </div>
      </div>

      {showPanel && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-full max-w-sm bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto dark:bg-slate-900 dark:border-slate-700"
        >
          {isError ? (
            <p className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              Couldn't load skills. Please retry.
            </p>
          ) : isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <FiLoader className="w-3.5 h-3.5 animate-spin" />
              Loading skills…
            </div>
          ) : suggestions.length === 0 && !canCreate ? (
            <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No skills found.</p>
          ) : (
            <>
              {suggestions.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={idx === highlightIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(s);
                  }}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between',
                    idx === highlightIndex
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                  )}
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{s.category}</span>
                </button>
              ))}
              {canCreate && (
                <button
                  type="button"
                  role="option"
                  aria-selected={highlightIndex === suggestions.length}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleCreate();
                  }}
                  onMouseEnter={() => setHighlightIndex(suggestions.length)}
                  disabled={createSkill.isPending}
                  className={cn(
                    'w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2 border-t border-slate-100 dark:border-slate-800',
                    highlightIndex === suggestions.length
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950',
                    createSkill.isPending && 'opacity-60',
                  )}
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  {createSkill.isPending ? `Creating "${canCreate}"…` : `Create "${canCreate}"`}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
