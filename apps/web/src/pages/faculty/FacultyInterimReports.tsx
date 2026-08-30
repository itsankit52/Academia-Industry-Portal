import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { FiArrowLeft, FiStar, FiUser } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useInterimReports, useMentorFeedback } from '@/hooks/queries/useInterimReports';
import { useApplication } from '@/hooks/queries/useApplication';

interface FeedbackFormValues {
  mentorFeedback: string;
  mentorRating?: number;
}

function FeedbackForm({
  reportId,
  appId,
  defaultFeedback,
  defaultRating,
  onDone,
}: {
  reportId: string;
  appId: string;
  defaultFeedback?: string;
  defaultRating?: number;
  onDone?: () => void;
}) {
  const mut = useMentorFeedback(appId);
  const { register, handleSubmit, formState } = useForm<FeedbackFormValues>({
    defaultValues: { mentorFeedback: defaultFeedback ?? '', mentorRating: defaultRating },
  });
  const submit = handleSubmit((values) => {
    mut.mutate(
      {
        id: reportId,
        mentorFeedback: values.mentorFeedback,
        ...(typeof values.mentorRating === 'number' && !Number.isNaN(values.mentorRating)
          ? { mentorRating: Number(values.mentorRating) }
          : {}),
      },
      { onSuccess: () => onDone?.() },
    );
  });
  return (
    <form onSubmit={submit} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <Textarea
        label="Your Feedback"
        rows={3}
        required
        error={formState.errors.mentorFeedback?.message}
        {...register('mentorFeedback', { required: 'Feedback required', maxLength: { value: 2000, message: 'Max 2000 chars' } })}
      />
      <Input
        type="number"
        label="Rating (1-5, optional)"
        min={1}
        max={5}
        {...register('mentorRating', { valueAsNumber: true, min: 1, max: 5 })}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={mut.isPending}>Save Feedback</Button>
      </div>
    </form>
  );
}

export default function FacultyInterimReports() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const q = useInterimReports(appId ?? '', { pageSize: 100 });
  const appQ = useApplication(appId ?? '');

  const studentName = appQ.data?.student && typeof appQ.data.student === 'object'
    ? appQ.data.student.fullName
    : 'Intern';

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Interim Reports"
        subtitle={`Reviewing reports for ${studentName}.`}
        actions={
          <>
            <Button variant="outline" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />} onClick={() => navigate('/faculty/assigned-interns')}>
              Back
            </Button>
          </>
        }
      />

      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-3">
          {q.data.items.map((r) => (
            <Card key={r.id}>
              <Card.Body className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Week {r.weekNumber}</h3>
                    {typeof r.hoursSpent === 'number' && (
                      <Badge variant="default" size="sm">{r.hoursSpent} hrs</Badge>
                    )}
                    {typeof r.mentorRating === 'number' && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <FiStar className="w-3.5 h-3.5" />{r.mentorRating}/5
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {format(new Date(r.submittedAt), 'MMM d, yyyy')}
                  </span>
                </div>
                {r.workDescription && (
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"><span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Work</span>{r.workDescription}</p>
                )}
                {r.learnings && (
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"><span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Learnings</span>{r.learnings}</p>
                )}
                {r.challenges && (
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap"><span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Challenges</span>{r.challenges}</p>
                )}

                {r.mentorFeedback && editingId !== r.id ? (
                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 border border-emerald-100 dark:border-emerald-900">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Your feedback</p>
                      <button
                        type="button"
                        onClick={() => setEditingId(r.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-sm text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">{r.mentorFeedback}</p>
                  </div>
                ) : (
                  <FeedbackForm
                    reportId={r.id}
                    appId={appId ?? ''}
                    defaultFeedback={r.mentorFeedback}
                    defaultRating={r.mentorRating}
                    onDone={() => setEditingId(null)}
                  />
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FiUser />}
          title="No reports yet"
          description="Weekly reports submitted by the intern will appear here for your review."
        />
      )}
    </div>
  );
}
