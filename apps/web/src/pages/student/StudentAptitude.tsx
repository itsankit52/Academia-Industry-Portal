import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { FiTarget, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi';
import type { AptitudeCategory } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAptitudeCategories } from '@/hooks/queries/useAptitudeCategories';
import { useMyAptitudeTests } from '@/hooks/queries/useMyAptitudeTests';
import { useStartAptitudeTest } from '@/hooks/queries/useStartAptitudeTest';
import type { ApiClientError } from '@/lib/ApiClientError';

const CATEGORY_META: Record<
  AptitudeCategory,
  { label: string; description: string; accent: string }
> = {
  QUANT: {
    label: 'Quantitative',
    description: 'Numerical, algebra, arithmetic, and word problems.',
    accent: 'from-indigo-500 to-blue-500',
  },
  LOGIC: {
    label: 'Logical Reasoning',
    description: 'Sequences, coding-decoding, puzzles, and analytics.',
    accent: 'from-emerald-500 to-teal-500',
  },
  VERBAL: {
    label: 'Verbal Reasoning',
    description: 'Vocabulary, analogies, antonyms, and comprehension.',
    accent: 'from-amber-500 to-orange-500',
  },
  ENGLISH: {
    label: 'English',
    description: 'Grammar, articles, tenses, and sentence construction.',
    accent: 'from-rose-500 to-pink-500',
  },
};

function statusBadge(status: string, passed: boolean): { label: string; variant: 'success' | 'danger' | 'warning' | 'info' } {
  if (status === 'SUBMITTED') {
    return passed ? { label: 'Passed', variant: 'success' } : { label: 'Failed', variant: 'danger' };
  }
  if (status === 'IN_PROGRESS') return { label: 'In progress', variant: 'warning' };
  return { label: 'Expired', variant: 'info' };
}

export default function StudentAptitude() {
  const navigate = useNavigate();
  const { data: categories, isLoading: catsLoading } = useAptitudeCategories();
  const { data: recent, isLoading: recentLoading } = useMyAptitudeTests({ page: 1, pageSize: 5 });
  const start = useStartAptitudeTest();

  function handleStart(category: AptitudeCategory) {
    start.mutate(
      { category, questionCount: 15 },
      {
        onSuccess: (test) => {
          navigate(`/student/aptitude/tests/${test.id}`);
        },
        onError: (err: ApiClientError) => {
          if (err.status === 409) {
            toast.error('You already have an in-progress test in this category');
          } else if (err.status === 400) {
            toast.error(err.message);
          } else {
            toast.error('Failed to start test. Please try again.');
          }
        },
      },
    );
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Aptitude Tests"
        subtitle="Sharpen your quantitative, logical, verbal, and English skills"
      />

      {catsLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!catsLoading && categories && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((c) => {
            const meta = CATEGORY_META[c.category];
            const isStarting = start.isPending && start.variables?.category === c.category;
            const disabled = c.activeQuestionCount === 0 || start.isPending;
            return (
              <Card key={c.category} className="overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${meta.accent}`} />
                <Card.Body className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {meta.label}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {c.activeQuestionCount} questions available
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{meta.description}</p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <FiClock className="w-3.5 h-3.5" />
                      30 min · 15 questions
                    </span>
                    <Button
                      size="sm"
                      iconLeft={<FiTarget className="w-4 h-4" />}
                      disabled={disabled}
                      loading={isStarting}
                      onClick={() => handleStart(c.category)}
                    >
                      Start Test
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recent attempts</h2>
        {recentLoading && <SkeletonCard />}
        {!recentLoading && (!recent || recent.items.length === 0) && (
          <EmptyState
            title="No attempts yet"
            description="Take a test to see your history here."
            icon={<FiTarget />}
          />
        )}
        {!recentLoading && recent && recent.items.length > 0 && (
          <Card>
            <Card.Body className="p-0">
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {recent.items.map((t) => {
                  const meta = CATEGORY_META[t.category];
                  const badge = statusBadge(t.status, t.passed);
                  const date = t.submittedAt ?? t.createdAt;
                  return (
                    <li key={t.id}>
                      <button
                        onClick={() =>
                          navigate(
                            t.status === 'SUBMITTED'
                              ? `/student/aptitude/tests/${t.id}/result`
                              : `/student/aptitude/tests/${t.id}`,
                          )
                        }
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {t.passed ? (
                            <FiCheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                          ) : (
                            <FiXCircle className="w-5 h-5 text-slate-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {meta.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {t.correctCount}/{t.totalQuestions} correct · {format(new Date(date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                            {t.score}
                            <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/100</span>
                          </span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card.Body>
          </Card>
        )}
      </div>
    </div>
  );
}
