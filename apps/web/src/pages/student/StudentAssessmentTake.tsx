import { useState, useEffect, useRef } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAssessment } from '@/hooks/queries/useAssessment';
import { useSaveAnswer } from '@/hooks/queries/useSaveAnswer';
import { useSubmitAssessment } from '@/hooks/queries/useSubmitAssessment';

function formatTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StudentAssessmentTake() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assessment, isLoading } = useAssessment(id ?? '');
  const saveAnswer = useSaveAnswer(id ?? '');
  const submitAssessment = useSubmitAssessment();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const autoSubmitted = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitMutate = useRef(submitAssessment.mutate);
  submitMutate.current = submitAssessment.mutate;

  useEffect(() => {
    if (!assessment) return;
    const seed: Record<string, string> = {};
    assessment.answers.forEach((a) => { seed[a.questionId] = a.text; });
    setAnswers(seed);
  }, [assessment?.id]);

  useEffect(() => {
    if (!assessment) return;
    const initial = Math.max(0, new Date(assessment.expiresAt).getTime() - Date.now());
    setRemaining(initial);
    const tick = setInterval(() => {
      const rem = Math.max(0, new Date(assessment.expiresAt).getTime() - Date.now());
      setRemaining(rem);
      if (rem === 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        submitMutate.current(id ?? '', {
          onSuccess: () => navigate(`/student/assessments/${id}`),
          onError: () => toast.error('Auto-submit failed. Please try manually.'),
        });
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [assessment?.expiresAt, id, navigate]);

  function handleAnswerChange(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveAnswer.mutate({ questionId, text });
    }, 500);
  }

  function handleSubmitConfirm() {
    setShowConfirm(false);
    submitMutate.current(id ?? '', {
      onSuccess: () => navigate(`/student/assessments/${id}`),
      onError: () => toast.error('AI service temporarily unavailable, please try again'),
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

  if (!assessment) return null;

  if (assessment.status === 'SUBMITTED' || assessment.status === 'EVALUATED') {
    return <Navigate to={`/student/assessments/${id}`} replace />;
  }

  const currentQuestion = assessment.questions[currentIdx];
  const currentAnswer = answers[currentQuestion?.id ?? ''] ?? '';
  const isTimeLow = remaining > 0 && remaining < 5 * 60 * 1000;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 py-3 flex items-center justify-between gap-4">
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          Assessment — {assessment.skillNames.join(', ')}
        </h1>
        <span
          className={cn(
            'text-sm font-mono font-semibold tabular-nums shrink-0',
            isTimeLow ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300',
          )}
        >
          {formatTime(remaining)}
        </span>
      </div>

      <div className="flex flex-1">
        <aside className="hidden sm:flex flex-col w-[200px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 gap-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Questions
          </p>
          <div className="grid grid-cols-4 gap-2">
            {assessment.questions.map((q, i) => {
              const answered = (answers[q.id] ?? '').trim().length > 0;
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={cn(
                    'flex items-center justify-center text-xs font-medium rounded-lg transition-colors aspect-square',
                    isCurrent && 'ring-2 ring-indigo-500 ring-offset-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
                    answered && !isCurrent && 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
                    !answered && !isCurrent && 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="flex-1 p-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {currentQuestion && (
              <>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    Question {currentIdx + 1} of {assessment.questionCount}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {currentQuestion.targetSkills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <p className="text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    {currentQuestion.text}
                  </p>
                </div>

                <div>
                  <Textarea
                    rows={8}
                    value={currentAnswer}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Type your answer here…"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <span
                      className={cn(
                        'text-xs transition-opacity',
                        saveAnswer.isPending
                          ? 'text-amber-500 opacity-100'
                          : saveAnswer.isSuccess
                            ? 'text-emerald-500 opacity-100'
                            : 'opacity-0',
                      )}
                    >
                      {saveAnswer.isPending ? 'Saving…' : 'Saved'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {currentAnswer.length} / 2000
                    </span>
                  </div>
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
                    onClick={() => setCurrentIdx((i) => Math.min(assessment.questionCount - 1, i + 1))}
                    disabled={currentIdx === assessment.questionCount - 1}
                  >
                    Next
                  </Button>
                  <div className="flex-1" />
                  <Button variant="primary" size="sm" onClick={() => setShowConfirm(true)}>
                    Submit Assessment
                  </Button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Submit Assessment"
        description="Submit for AI evaluation? This will lock your answers and Gemini will score them (takes ~10 seconds)."
        confirmLabel="Submit"
        variant="primary"
        onConfirm={handleSubmitConfirm}
        onCancel={() => setShowConfirm(false)}
      />

      {submitAssessment.isPending && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Spinner size="lg" className="text-white" />
          <p className="text-white font-semibold text-lg">Evaluating with AI…</p>
          <p className="text-slate-300 text-sm">This takes about 10 seconds</p>
        </div>
      )}
    </div>
  );
}
