import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { FiArrowLeft, FiSend, FiXCircle } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import {
  useMentorshipRequest,
  useMessages,
  useSendMessage,
  useUpdateRequestStatus,
} from '@/hooks/queries/useMentorship';
import { useAuth } from '@/hooks/useAuth';
import type { MentorshipStatus } from '@aip/config';

const statusVariant: Record<MentorshipStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  REQUESTED: 'warning',
  ACCEPTED: 'info',
  DECLINED: 'danger',
  ACTIVE: 'success',
  COMPLETED: 'default',
  CANCELLED: 'default',
};

interface Props {
  layoutBase?: string;
}

export default function StudentMentorshipDetails({ layoutBase = '/student/mentorship' }: Props) {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [msg, setMsg] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const requestQ = useMentorshipRequest(requestId ?? '');
  const messagesQ = useMessages(requestId ?? '', { pageSize: 200 });
  const sendMut = useSendMessage(requestId ?? '');
  const statusMut = useUpdateRequestStatus();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messagesQ.data?.items.length]);

  if (requestQ.isLoading) {
    return <div className="container-page py-8"><SkeletonCard /></div>;
  }
  if (requestQ.isError || !requestQ.data) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void requestQ.refetch()} />
      </div>
    );
  }

  const req = requestQ.data;
  const menteeId = typeof req.mentee === 'string' ? req.mentee : req.mentee.id;
  const isMentee = user?.id === menteeId;
  const canCancel = isMentee && (req.status === 'REQUESTED' || req.status === 'ACCEPTED' || req.status === 'ACTIVE');
  const canMessage = req.status === 'ACCEPTED' || req.status === 'ACTIVE';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = msg.trim();
    if (!trimmed) return;
    sendMut.mutate(trimmed, { onSuccess: () => setMsg('') });
  };

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={isMentee ? req.mentorName : req.menteeName}
        subtitle={`Mentorship request — ${format(new Date(req.createdAt), 'MMM d, yyyy')}`}
        actions={
          <Button variant="outline" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />} onClick={() => navigate(layoutBase)}>
            Back
          </Button>
        }
      />

      <Card>
        <Card.Body className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={statusVariant[req.status]}>{req.status}</Badge>
            {req.startedAt && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Started {format(new Date(req.startedAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Initial message</p>
            <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{req.initialMessage}</p>
          </div>
          {req.goals && (
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Goals</p>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{req.goals}</p>
            </div>
          )}
          {canCancel && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button variant="danger" size="sm" iconLeft={<FiXCircle className="w-4 h-4" />} onClick={() => setShowCancel(true)}>
                Cancel Mentorship
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Messages</h2>
        </Card.Header>
        <div ref={scrollRef} className="px-6 py-4 h-[420px] overflow-y-auto space-y-3">
          {messagesQ.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading messages…</p>
          ) : messagesQ.data && messagesQ.data.items.length > 0 ? (
            messagesQ.data.items.map((m) => {
              const senderId = typeof m.sender === 'string' ? m.sender : m.sender.id;
              const mine = senderId === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'}`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>
                      {format(new Date(m.createdAt), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center">No messages yet.</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          {canMessage ? (
            <form onSubmit={submit} className="flex flex-col gap-2">
              <Textarea
                rows={3}
                placeholder="Type a message…"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                maxLength={2000}
              />
              <div className="flex justify-end">
                <Button type="submit" iconRight={<FiSend className="w-4 h-4" />} loading={sendMut.isPending} disabled={!msg.trim()}>
                  Send
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Messaging is available once the mentorship is accepted and active.
              {' '}
              <Link to={layoutBase} className="text-indigo-600 hover:text-indigo-700 no-underline">Back to list</Link>
            </p>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={showCancel}
        title="Cancel mentorship?"
        description="This will end the mentorship. You can request a new one later."
        confirmLabel="Cancel Mentorship"
        variant="danger"
        loading={statusMut.isPending}
        onConfirm={() => statusMut.mutate({ id: req.id, status: 'CANCELLED' }, { onSuccess: () => setShowCancel(false) })}
        onCancel={() => setShowCancel(false)}
      />
    </div>
  );
}
