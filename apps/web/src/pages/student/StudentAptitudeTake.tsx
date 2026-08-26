import { useState, useEffect, useRef } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import { FiClock } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAptitudeTest } from '@/hooks/queries/useAptitudeTest';
import { useSaveAptitudeAnswer } from '@/hooks/queries/useSaveAptitudeAnswer';
import { useSubmitAptitudeTest } from '@/hooks/queries/useSubmitAptitudeTest';

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StudentAptitudeTake() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAptitudeTest(id ?? '');
  const saveAnswer = useSaveAptitudeAnswer(id ?? '');
  const submitTest = useSubmitAptitudeTest();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const autoSubmitted = useRef(false);
  const submitMutate = useRef(submitTest.mutate);
  submitMutate.current = submitTest.mutate;

  const test = data?.test;

  useEffect(() => {
    if (!test) return;
    const seed: Record<string, number> = {};
    test.questions.forEach((q) => {
      if (q.chosenIndex !== null && q.chosenIndex !== undefined) {
        seed[q.questionId] = q.chosenIndex;
      }
    });
    setAnswers(seed);
  }, [test?.id]);

  useEffect(() => {
    if (!test || test.status !== 'IN_PROGRESS') return;
    const initial = Math.max(0, new Date(test.expiresAt).getTime() - Date.now());
    setRemaining(initial);
    const tick = setInterval(() => {
      const rem = Math.max(0, new Date(test.expiresAt).getTime() - Date.now());
      setRemaining(rem);
      if (rem === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submitMutate.current(id ?? '', {
          onSuccess: () => navigate(`/student/aptitude/tests/${id}/result`),
          onError: () => toast.error('Auto-submit failed. Please try manually.'),
        });
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [test?.expiresAt, test?.status, id, navigate]);

  function handleSelect(questionId: string, chosenIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: chosenIndex }));
    saveAnswer.mutate({ questionId, chosenIndex });
  }

  function handleSubmitConfirm() {
    setShowConfirm(false);
    submitMutate.current(id ?? '', {
      onSuccess: () => navigate(`/student/aptitude/tests/${id}/result`),
      onError: () => toast.error('Submission failed. Please try again.'),
    });
  }

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!test) return null;

  if (test.status === 'SUBMITTED') {
    return <Navigate to={`/student/aptitude/tests/${id}/result`} replace />;
  }

  if (test.status === 'EXPIRED') {
    return (
      <div className="container-page py-16 text-center space-y-4">
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">This test has expired.</p>
        <Button onClick={() => navigate('/student/aptitude')}>Back to Aptitude</Button>
      </div>
    );
  }

  const currentQuestion = test.questions[currentIdx];
  const currentSelected = currentQuestion ? answers[currentQuestion.questionId] : undefined;
  const isTimeLow = remaining > 0 && remaining < 2 * 60 * 1000;
  const totalQ = test.totalQuestions;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 flex items-center justify-between gap-4">
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          Aptitude Test — {test.category}
        </h1>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-mono font-semibold tabular-nums shrink-0',
            isTimeLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300',
          )}
        >
          <FiClock className="w-4 h-4" />
          {formatTime(remaining)}
        </span>
      </div>

      <div className="flex flex-1">
        <aside className="hidden sm:flex flex-col w-[200px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 gap-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Questions
          </p>
          <div className="grid grid-cols-5 gap-2">
            {test.questions.map((q, i) => {
              const answered = answers[q.questionId] !== undefined;
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={q.questionId}
                  onClick={() => setCurrentIdx(i)}
                  className={cn(
                    'flex items-center justify-center text-xs font-medium rounded-lg transition-colors aspect-square',
                    isCurrent &&
                      'ring-2 ring-indigo-500 ring-offset-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
                    answered && !isCurrent &&
                      'bg-emerald-500 text-white',
                    !answered && !isCurrent &&
                      'bg-white border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {currentQuestion && (
              <>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Question {currentIdx + 1} of {totalQ}
                  </p>
                  <p className="text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {currentQuestion.question.question}
                  </p>
                </div>

                <div className="space-y-2" role="radiogroup" aria-label="Answer options">
                  {currentQuestion.question.options.map((option, idx) => {
                    const selected = currentSelected === idx;
                    return (
                      <label
                        key={idx}
                        className={cn(
                          'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                          selected
                            ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                        )}
                      >
                        <input
                          type="radio"
                          name={`q-${currentQuestion.questionId}`}
                          value={idx}
                          checked={selected}
                          onChange={() => handleSelect(currentQuestion.questionId, idx)}
                          className="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-800 dark:text-slate-200">{option}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    disabled={currentIdx === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentIdx((i) => Math.min(totalQ - 1, i + 1))}
                    disabled={currentIdx === totalQ - 1}
                  >
                    Next
                  </Button>
                  <div className="flex-1" />
                  <Button variant="primary" size="sm" onClick={() => setShowConfirm(true)}>
                    Submit Test
                  </Button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Submit Test"
        description="Are you sure? Unanswered questions will count as 0 marks."
        confirmLabel="Submit"
        variant="primary"
        onConfirm={handleSubmitConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {submitTest.isPending && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Spinner size="lg" className="text-white" />
          <p className="text-white font-semibold text-lg">Submitting…</p>
        </div>
      )}
    </div>
  );
}
