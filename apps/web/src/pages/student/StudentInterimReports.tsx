import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { FiArrowLeft, FiFilePlus, FiStar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import ErrorState from '@/components/ui/ErrorState';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useInterimReports,
  useCreateInterimReport,
  type CreateInterimReportInput,
} from '@/hooks/queries/useInterimReports';

interface FormValues {
  weekNumber: number;
  workDescription?: string;
  learnings?: string;
  challenges?: string;
  hoursSpent?: number;
  periodStart?: string;
  periodEnd?: string;
}

export default function StudentInterimReports() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    defaultValues: { weekNumber: 1 },
  });

  const reportsQ = useInterimReports(appId ?? '', { pageSize: 100 });
  const createMut = useCreateInterimReport(appId ?? '');

  const onSubmit = handleSubmit((values) => {
    const payload: CreateInterimReportInput = {
      weekNumber: Number(values.weekNumber),
      ...(values.workDescription ? { workDescription: values.workDescription } : {}),
      ...(values.learnings ? { learnings: values.learnings } : {}),
      ...(values.challenges ? { challenges: values.challenges } : {}),
      ...(values.hoursSpent !== undefined && values.hoursSpent !== null && !Number.isNaN(Number(values.hoursSpent))
        ? { hoursSpent: Number(values.hoursSpent) }
        : {}),
      ...(values.periodStart ? { periodStart: new Date(values.periodStart).toISOString() } : {}),
      ...(values.periodEnd ? { periodEnd: new Date(values.periodEnd).toISOString() } : {}),
    };
    createMut.mutate(payload, {
      onSuccess: () => {
        setShowCreate(false);
        reset({ weekNumber: (values.weekNumber ?? 0) + 1 });
      },
    });
  });

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Interim Reports"
        subtitle="Weekly reports on your active engagement."
        actions={
          <>
            <Button variant="outline" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />} onClick={() => navigate(`/student/applications/${appId ?? ''}`)}>
              Back
            </Button>
            <Button size="sm" iconLeft={<FiFilePlus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
              New Report
            </Button>
          </>
        }
      />

      {reportsQ.isLoading ? (
        <SkeletonCard />
      ) : reportsQ.isError ? (
        <ErrorState onRetry={() => void reportsQ.refetch()} />
      ) : reportsQ.data && reportsQ.data.items.length > 0 ? (
        <div className="space-y-3">
          {reportsQ.data.items.map((r) => (
            <Card key={r.id}>
              <Card.Body className="space-y-2">
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
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Work</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{r.workDescription}</p>
                  </div>
                )}
                {r.learnings && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Learnings</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{r.learnings}</p>
                  </div>
                )}
                {r.challenges && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Challenges</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{r.challenges}</p>
                  </div>
                )}
                {r.mentorFeedback && (
                  <div className="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2 border border-emerald-100 dark:border-emerald-900">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mb-1">Mentor feedback</p>
                    <p className="text-sm text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap">{r.mentorFeedback}</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<FiFilePlus />}
          title="No reports yet"
          description="Submit your first weekly interim report to keep your mentor updated."
          action={{ label: 'Create Report', onClick: () => setShowCreate(true) }}
        />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Interim Report" size="lg">
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              type="number"
              label="Week #"
              min={1}
              max={52}
              required
              error={formState.errors.weekNumber?.message}
              {...register('weekNumber', { required: 'Week required', valueAsNumber: true, min: 1, max: 52 })}
            />
            <Input
              type="date"
              label="Period Start"
              {...register('periodStart')}
            />
            <Input
              type="date"
              label="Period End"
              {...register('periodEnd')}
            />
          </div>
          <Input
            type="number"
            label="Hours Spent"
            min={0}
            max={168}
            {...register('hoursSpent', { valueAsNumber: true })}
          />
          <Textarea
            label="Work Description"
            rows={4}
            {...register('workDescription', { maxLength: { value: 5000, message: 'Max 5000 characters' } })}
          />
          <Textarea
            label="Learnings"
            rows={3}
            {...register('learnings', { maxLength: { value: 3000, message: 'Max 3000 characters' } })}
          />
          <Textarea
            label="Challenges"
            rows={3}
            {...register('challenges', { maxLength: { value: 3000, message: 'Max 3000 characters' } })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={createMut.isPending}>Submit Report</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
