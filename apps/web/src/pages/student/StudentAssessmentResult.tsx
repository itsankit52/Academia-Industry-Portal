import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiCpu } from 'react-icons/fi';
import { format } from 'date-fns';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useAssessment } from '@/hooks/queries/useAssessment';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  GENERATED: { label: 'Ready', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', variant: 'default' },
  EVALUATED: { label: 'Evaluated', variant: 'success' },
};

function scoreColorClass(score: number) {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function scoreBorderClass(score: number) {
  if (score >= 75) return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10';
  if (score >= 50) return 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10';
  return 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10';
}

function questionScoreColorClass(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

export default function StudentAssessmentResult() {
  const { id } = useParams<{ id: string }>();
  const { data: assessment, isLoading } = useAssessment(id ?? '');

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!assessment) return null;

  if (!assessment.evaluation || assessment.status !== 'EVALUATED') {
    return (
      <div className="container-page py-8">
        <Card>
          <Card.Body className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Assessment not yet submitted or still processing.
            </p>
            <Link to="/student/assessments">
              <Button variant="outline" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />}>
                Back to Assessments
              </Button>
            </Link>
          </Card.Body>
        </Card>
      </div>
    );
  }

  const { evaluation } = assessment;
  const cfg = statusConfig[assessment.status] ?? { label: assessment.status, variant: 'default' as BadgeVariant };

  const questionMap = Object.fromEntries(assessment.questions.map((q) => [q.id, q]));
  const answerMap = Object.fromEntries(assessment.answers.map((a) => [a.questionId, a.text]));

  return (
    <div className="container-page py-8 space-y-6">
      <Link to="/student/assessments">
        <Button variant="outline" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />}>
          All Assessments
        </Button>
      </Link>

      <Card className={cn('border-2', scoreBorderClass(evaluation.totalScore))}>
        <Card.Body>
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <div className="flex-1">
              <div className={cn('text-6xl font-bold tabular-nums leading-none', scoreColorClass(evaluation.totalScore))}>
                {evaluation.totalScore}
                <span className="text-2xl font-normal text-slate-400 dark:text-slate-500">/100</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {evaluation.rawScore} / {evaluation.maxScore} marks
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-medium border border-violet-100 dark:border-violet-800">
                  <FiCpu className="w-3 h-3" />
                  {assessment.generatedByModel}
                </span>
              </div>
              {assessment.submittedAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submitted {format(new Date(assessment.submittedAt), 'MMM d, yyyy • h:mm a')}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {assessment.skillNames.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Overall Feedback
          </h2>
        </Card.Header>
        <Card.Body>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {evaluation.overallFeedback}
          </p>
        </Card.Body>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <Card.Header className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
              Strengths
            </h2>
          </Card.Header>
          <Card.Body className="bg-emerald-50/30 dark:bg-emerald-900/5">
            <p className="text-sm text-emerald-700 dark:text-emerald-400 leading-relaxed">
              {evaluation.strengths}
            </p>
          </Card.Body>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <Card.Header className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
              Areas to Improve
            </h2>
          </Card.Header>
          <Card.Body className="bg-amber-50/30 dark:bg-amber-900/5">
            <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
              {evaluation.weaknesses}
            </p>
          </Card.Body>
        </Card>
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
          Question Breakdown
        </h2>
        <div className="space-y-4">
          {evaluation.perQuestion.map((pq, i) => {
            const question = questionMap[pq.questionId];
            const answerText = answerMap[pq.questionId] ?? '';
            const maxMarks = question?.maxMarks ?? 10;
            return (
              <Card key={pq.questionId}>
                <Card.Body className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Question {i + 1}</p>
                      {question && question.targetSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {question.targetSkills.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                        {question?.text}
                      </p>
                    </div>
                    <div className={cn('text-xl font-bold tabular-nums shrink-0', questionScoreColorClass(pq.score, maxMarks))}>
                      {pq.score}
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500">/{maxMarks}</span>
                    </div>
                  </div>

                  {answerText && (
                    <blockquote className="border-l-2 border-slate-300 dark:border-slate-700 pl-3 text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                      {answerText}
                    </blockquote>
                  )}

                  {pq.feedback && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      {pq.feedback}
                    </p>
                  )}
                </Card.Body>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
