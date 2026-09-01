import { useState, useRef, useEffect, useMemo } from 'react';
import { useForm, useController } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSearch, FiX, FiPlus, FiLoader, FiCheck } from 'react-icons/fi';
import { PROFICIENCY_LEVELS } from '@aip/config';
import type { Proficiency, SkillCategory } from '@aip/config';
import FormField from '@/components/ui/FormField';
import RadioGroup from '@/components/ui/RadioGroup';
import Button from '@/components/ui/Button';
import { useSkillsCatalog, useCreateSkill } from '@/hooks/queries/useSkills';
import { useAddStudentSkill } from '@/hooks/queries/useAddStudentSkill';
import type { Skill } from '@aip/types';
import { cn } from '@/lib/cn';

const DEFAULT_CATEGORY: SkillCategory = 'OTHER';

const schema = z.object({
  proficiency: z.enum(PROFICIENCY_LEVELS as unknown as [Proficiency, ...Proficiency[]]),
  yearsExperience: z.coerce.number().min(0).max(50).optional(),
  evidenceUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export default function AddSkillForm() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: catalogData, isLoading, isError } = useSkillsCatalog();
  const createSkill = useCreateSkill();
  const addStudentSkill = useAddStudentSkill();
  const catalog = catalogData?.items ?? [];

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Filter suggestions
  const suggestions = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return catalog.slice(0, 30);
    return catalog
      .filter((s) => s.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aExact = a.name.toLowerCase() === q;
        const bExact = b.name.toLowerCase() === q;
        if (aExact && !bExact) return -1;
        if (bExact && !aExact) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
  }, [catalog, debouncedQuery]);

  const canCreate = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) return null;
    const exists = catalog.some((s) => s.name.toLowerCase() === q.toLowerCase());
    if (exists) return null;
    return q;
  }, [debouncedQuery, catalog]);

  const optionCount = suggestions.length + (canCreate ? 1 : 0);

  useEffect(() => {
    setHighlightIndex(0);
  }, [debouncedQuery, optionCount]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { proficiency: 'BEGINNER', evidenceUrl: '' },
  });

  const { field: profField } = useController({ control, name: 'proficiency' });

  const proficiencyOptions = PROFICIENCY_LEVELS.map((p) => ({
    value: p,
    label: p.charAt(0) + p.slice(1).toLowerCase(),
  }));

  function selectSkill(skill: Skill) {
    setSelectedSkill(skill);
    setQuery('');
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  function handleCreate() {
    if (!canCreate) return;
    createSkill.mutate(
      { name: canCreate, category: DEFAULT_CATEGORY },
      {
        onSuccess: (created) => {
          selectSkill(created);
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
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
        selectSkill(picked);
      } else if (canCreate) {
        handleCreate();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  }

  function onSubmit(data: FormValues) {
    if (!selectedSkill) return;
    addStudentSkill.mutate(
      {
        skillId: selectedSkill.id,
        proficiency: data.proficiency,
        yearsExperience: data.yearsExperience,
        evidenceUrl: data.evidenceUrl || undefined,
      },
      {
        onSuccess: () => {
          reset({ proficiency: 'BEGINNER', evidenceUrl: '' });
          setSelectedSkill(null);
          setQuery('');
        },
      },
    );
  }

  function handleClearSkill() {
    setSelectedSkill(null);
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Skill search / selected skill */}
      <div className="relative" ref={containerRef}>
        <p className="block text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">Skill</p>
        {selectedSkill ? (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30">
            <div>
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                {selectedSkill.name}
              </span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                {selectedSkill.category}
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearSkill}
              className="text-indigo-500 hover:text-rose-600 transition-colors"
              aria-label="Change skill"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 transition-colors',
              showDropdown
                ? 'border-indigo-500 ring-1 ring-indigo-500'
                : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-600',
            )}
          >
            <FiSearch className="w-4 h-4 text-slate-400 shrink-0 dark:text-slate-500" />
            <input
              ref={inputRef}
              className="flex-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Search or type a skill…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              aria-label="Search skills"
            />
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && !selectedSkill && (
          <div
            role="listbox"
            className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto dark:bg-slate-900 dark:border-slate-700"
          >
            {isError ? (
              <p className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
                Couldn't load skills.
              </p>
            ) : isLoading ? (
              <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <FiLoader className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            ) : suggestions.length === 0 && !canCreate ? (
              <p className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                No skills found.
              </p>
            ) : (
              <>
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSkill(s);
                    }}
                    onMouseEnter={() => setHighlightIndex(idx)}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors',
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleCreate();
                    }}
                    disabled={createSkill.isPending}
                    className={cn(
                      'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 transition-colors',
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
      </div>

      {/* Show confirmation when a skill is selected */}
      {selectedSkill && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <FiCheck className="w-4 h-4" />
          Skill selected
        </div>
      )}

      {!selectedSkill && (
        <p className="text-xs text-rose-500 -mt-2">Please select or create a skill above.</p>
      )}

      <RadioGroup
        name="proficiency"
        label="Proficiency"
        options={proficiencyOptions}
        value={profField.value}
        onChange={profField.onChange}
      />
      <FormField
        control={control}
        name="yearsExperience"
        label="Years of Experience"
        type="number"
        placeholder="0"
      />
      <FormField
        control={control}
        name="evidenceUrl"
        label="Evidence URL"
        type="url"
        placeholder="https://github.com/…"
      />
      <Button type="submit" loading={addStudentSkill.isPending} size="sm" disabled={!selectedSkill}>
        Add Skill
      </Button>
    </form>
  );
}
