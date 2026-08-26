import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiArrowLeft } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAptitudeTest } from '@/hooks/queries/useAptitudeTest';

export default function StudentAptitudeResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAptitudeTest(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const test = data?.test;
  const result = data?.result;

  if (!test) return null;

  if (test.status !== 'SUBMITTED') {
    return <Navigate to={`/student/aptitude/tests/${id}`} replace />;
  }

  const scoreColor = test.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={`${test.category} Result`}
        subtitle="Review your performance and correct answers"
        actions={
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiArrowLeft className="w-4 h-4" />}
            onClick={() => navigate('/student/aptitude')}
          >
            Back to Aptitude
          </Button>
        }
      />

      <Card>
        <Card.Body className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {test.passed ? (
              <FiCheckCircle className="w-12 h-12 text-emerald-500" />
            ) : (
              <FiXCircle className="w-12 h-12 text-rose-500" />
            )}
            <div>
              <p className={cn('text-3xl font-bold tabular-nums', scoreColor)}>
                {test.score}
                <span className="text-base font-normal text-slate-400 dark:text-slate-500">/100</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {test.correctCount} of {test.totalQuestions} correct
              </p>
            </div>
          </div>
          <Badge variant={test.passed ? 'success' : 'danger'}>
            {test.passed ? 'Passed' : 'Failed'} · passing {test.passingScore}
          </Badge>
        </Card.Body>
      </Card>

      {result && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Detailed breakdown
          </h2>
          <div className="space-y-3">
            {result.questions.map((q, i) => {
              const isCorrect = q.correct === true;
              const unanswered = q.chosenIndex === null || q.chosenIndex === undefined;
              return (
                <Card key={q.questionId}>
                  <Card.Body className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        <span className="text-slate-500 dark:text-slate-400 mr-2">Q{i + 1}.</span>
                        {q.question}
                      </p>
                      <Badge variant={isCorrect ? 'success' : unanswered ? 'warning' : 'danger'}>
                        {isCorrect ? 'Correct' : unanswered ? 'Skipped' : 'Wrong'}
                      </Badge>
                    </div>
                    <ul className="space-y-1.5">
                      {q.options.map((option, idx) => {
                        const isYours = q.chosenIndex === idx;
                        const isRight = q.correctIndex === idx;
                        return (
                          <li
                            key={idx}
                            className={cn(
                              'flex items-start gap-2 rounded-md px-3 py-2 text-sm border',
                              isRight && 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700',
                              isYours && !isRight && 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-700',
                              !isRight && !isYours && 'border-slate-200 dark:border-slate-700',
                            )}
                          >
                            <span className="text-slate-800 dark:text-slate-200 flex-1">{option}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {isYours && (
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  Your answer
                                </span>
                              )}
                              {isRight && <FiCheckCircle className="w-4 h-4 text-emerald-500" />}
                              {isYours && !isRight && <FiXCircle className="w-4 h-4 text-rose-500" />}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {q.explanation && (
                      <div className="rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                          Explanation
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">{q.explanation}</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
