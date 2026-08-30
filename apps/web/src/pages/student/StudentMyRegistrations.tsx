import { useState } from 'react';
import { format } from 'date-fns';
import { FiCalendar, FiCheckCircle, FiStar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useMyRegistrations, useUnregisterFromEvent, useSubmitEventFeedback } from '@/hooks/queries/useEvents';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function StudentMyRegistrations() {
  const q = useMyRegistrations({ pageSize: 100 });
  const unreg = useUnregisterFromEvent();

  const [feedbackTarget, setFeedbackTarget] = useState<{ eventId: string; eventTitle: string } | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');
  const feedbackMut = useSubmitEventFeedback(feedbackTarget?.eventId ?? '');

  const handleSubmitFeedback = () => {
    if (!feedbackTarget || feedbackRating < 1) return;
    feedbackMut.mutate(
      { rating: feedbackRating, comment: feedbackComment || undefined },
      {
        onSuccess: () => {
          setFeedbackTarget(null);
          setFeedbackRating(0);
          setFeedbackComment('');
        },
      },
    );
  };

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="My Event Registrations" subtitle="Events you have signed up for." />
      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState onRetry={() => void q.refetch()} />
      ) : q.data && q.data.items.length > 0 ? (
        <div className="space-y-3">
          {q.data.items.map((r) => (
            <Card key={r.id}>
              <Card.Body className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {r.event ? r.event.title : 'Event no longer available'}
                    </h3>
                    {r.attendedAt && (
                      <Badge variant="success" size="sm">
                        <FiCheckCircle className="w-3 h-3 mr-1" />
                        Attended
                      </Badge>
                    )}
                    {r.rating && (
                      <Badge variant="info" size="sm" className="flex items-center gap-1">
                        <FiStar className="w-3 h-3" /> {r.rating}/5
                      </Badge>
                    )}
                  </div>
                  {r.event && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 inline-flex items-center gap-1">
                      <FiCalendar className="w-3.5 h-3.5" />
                      {format(new Date(r.event.startAt), 'MMM d, yyyy')} · {r.event.mode} · {r.event.host.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.attendedAt && !r.rating && r.event && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFeedbackTarget({ eventId: r.event!.id, eventTitle: r.event!.title })}
                      className="flex items-center gap-1"
                    >
                      <FiStar className="w-3.5 h-3.5" /> Give Feedback
                    </Button>
                  )}
                  {r.event && !r.attendedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={unreg.isPending && unreg.variables === r.event.id}
                      onClick={() => r.event && unreg.mutate(r.event.id)}
                    >
                      Unregister
                    </Button>
                  )}
                </div>
              </Card.Body>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<FiCalendar />} title="No registrations" description="Browse events and register to see them here." />
      )}

      <Modal
        open={!!feedbackTarget}
        onClose={() => setFeedbackTarget(null)}
        title={`Feedback — ${feedbackTarget?.eventTitle ?? ''}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Rating <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FiStar
                    className={`w-7 h-7 ${star <= feedbackRating ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
                  />
                </button>
              ))}
              {feedbackRating > 0 && (
                <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                  {STAR_LABELS[feedbackRating]}
                </span>
              )}
            </div>
          </div>

          <Textarea
            label="Comment (optional)"
            rows={4}
            placeholder="Share your thoughts about the event..."
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            maxLength={2000}
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFeedbackTarget(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={feedbackRating < 1 || feedbackMut.isPending}
              loading={feedbackMut.isPending}
              onClick={handleSubmitFeedback}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
