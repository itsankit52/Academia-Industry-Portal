/**
 * Phase 11 — Student My Participations page.
 *
 * Shows a list of placement drives the student has registered for, with their
 * current status in the participation funnel, drive details, and the ability
 * to withdraw from a drive.
 */

import { useState } from 'react';
import { FiAward, FiCalendar, FiBriefcase, FiAlertCircle, FiClock, FiX } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMyParticipations,
  type PlacementParticipant,
} from '@/hooks/queries/useDriveParticipants';
import { apiPost } from '@/lib/api';
import { queryKeys } from '@/hooks/queries/queryKeys';

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  REGISTERED: 'info',
  SHORTLISTED: 'success',
  INTERVIEW_SCHEDULED: 'warning',
  IN_ROUND: 'warning',
  OFFERED: 'success',
  ACCEPTED: 'success',
  HIRED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: 'Registered',
  SHORTLISTED: 'Shortlisted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  IN_ROUND: 'In Round',
  OFFERED: 'Offered',
  ACCEPTED: 'Accepted',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const STATUS_ORDER = [
  'REGISTERED',
  'SHORTLISTED',
  'INTERVIEW_SCHEDULED',
  'IN_ROUND',
  'OFFERED',
  'ACCEPTED',
  'HIRED',
];

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { value: 'IN_ROUND', label: 'In Round' },
  { value: 'OFFERED', label: 'Offered' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

/* ── Status Stepper ────────────────────────────────────────────────── */

function StatusStepper({ currentStatus }: { currentStatus: string }) {
  if (currentStatus === 'REJECTED' || currentStatus === 'WITHDRAWN') {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="font-medium">{STATUS_LABEL[currentStatus] ?? currentStatus}</span>
      </div>
    );
  }
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_ORDER.map((status, idx) => {
        const isActive = idx === currentIdx;
        const isPassed = idx < currentIdx;
        return (
          <div key={status} className="flex items-center">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                isActive
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : isPassed
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
              }`}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
            {idx < STATUS_ORDER.length - 1 && (
              <span className={`mx-1 ${isPassed ? 'text-emerald-500' : 'text-slate-300'}`}>→</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Withdraw Modal ────────────────────────────────────────────────── */

interface WithdrawModalProps {
  participant: PlacementParticipant;
  onClose: () => void;
  onConfirm: (participantId: string, driveId: string, reason: string) => void;
  isPending: boolean;
}

function WithdrawModal({ participant, onClose, onConfirm, isPending }: WithdrawModalProps) {
  const [reason, setReason] = useState('');

  return (
    <Modal open onClose={onClose} title="Withdraw from Drive" size="md">
      <div className="px-6 py-4 space-y-4">
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <FiAlertCircle className="w-4 h-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This action cannot be undone. The drive coordinator will be notified of your
              withdrawal.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Reason for withdrawal *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please share why you're withdrawing..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-800">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => onConfirm(participant.id, participant.drive, reason)}
          loading={isPending}
          disabled={!reason.trim()}
        >
          Withdraw
        </Button>
      </div>
    </Modal>
  );
}

/* ── Participation Card ────────────────────────────────────────────── */

interface ParticipationCardProps {
  participant: PlacementParticipant;
  onWithdraw: (p: PlacementParticipant) => void;
}

function ParticipationCard({ participant, onWithdraw }: ParticipationCardProps) {
  const canWithdraw =
    participant.status === 'REGISTERED' ||
    participant.status === 'SHORTLISTED' ||
    participant.status === 'INTERVIEW_SCHEDULED';

  return (
    <Card>
      <Card.Header>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            {participant.company?.companyName ?? 'Company'}
          </h3>
          <Badge variant={STATUS_BADGE[participant.status] ?? 'default'} size="sm">
            {STATUS_LABEL[participant.status] ?? participant.status}
          </Badge>
        </div>
      </Card.Header>
      <Card.Body className="space-y-3">
        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
          {participant.opportunity?.opportunityType && (
            <span className="flex items-center gap-1">
              <FiBriefcase className="w-3 h-3" />
              {participant.opportunity.opportunityType.replace('_', ' ')}
            </span>
          )}
          {participant.registeredAt && (
            <span className="flex items-center gap-1">
              <FiCalendar className="w-3 h-3" />
              Registered: {new Date(participant.registeredAt).toLocaleDateString()}
            </span>
          )}
          {participant.lastActivityAt && (
            <span className="flex items-center gap-1">
              <FiClock className="w-3 h-3" />
              Updated: {new Date(participant.lastActivityAt).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Status stepper */}
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Progress</p>
          <StatusStepper currentStatus={participant.status} />
        </div>

        {/* Withdraw reason if applicable */}
        {participant.withdrawalReason && (
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Withdraw reason: {participant.withdrawalReason}
          </div>
        )}

        {/* Timeline */}
        {participant.timeline && participant.timeline.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-indigo-600">
              View timeline ({participant.timeline.length} events)
            </summary>
            <ul className="mt-2 space-y-1 pl-4 border-l border-slate-200 dark:border-slate-700">
              {participant.timeline.map((t, i) => (
                <li key={i} className="text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  {' — '}
                  {new Date(t.at).toLocaleString()}
                  {t.note && <span className="block text-slate-400">{t.note}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card.Body>
      {canWithdraw && (
        <Card.Footer>
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiX className="w-3 h-3" />}
            onClick={() => onWithdraw(participant)}
            className="text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800"
          >
            Withdraw
          </Button>
        </Card.Footer>
      )}
    </Card>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export default function StudentMyParticipations() {
  const [status, setStatus] = useState('');
  const [withdrawing, setWithdrawing] = useState<PlacementParticipant | null>(null);
  const [withdrawPending, setWithdrawPending] = useState(false);

  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useMyParticipations();

  const allParticipations = data?.participations ?? [];

  // Apply status filter
  const participations = status
    ? allParticipations.filter((p) => p.status === status)
    : allParticipations;

  const stats = {
    total: allParticipations.length,
    active: allParticipations.filter((p) =>
      ['REGISTERED', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'IN_ROUND'].includes(p.status),
    ).length,
    offered: allParticipations.filter((p) => ['OFFERED', 'ACCEPTED', 'HIRED'].includes(p.status))
      .length,
    rejected: allParticipations.filter((p) => ['REJECTED', 'WITHDRAWN'].includes(p.status)).length,
  };

  function handleWithdraw(participantId: string, driveId: string, reason: string) {
    setWithdrawPending(true);
    apiPost(`/placement-drives/${driveId}/participants/${participantId}/withdraw`, { reason })
      .then(() => {
        toast.success('Withdrawn', { description: 'You have been withdrawn from the drive.' });
        setWithdrawing(null);
        // Phase 14A: Invalidate all placement-related caches so dashboards and
        // drives list reflect the new status without a manual refresh.
        void qc.invalidateQueries({ queryKey: queryKeys.drives.myParticipations() });
        void qc.invalidateQueries({ queryKey: queryKeys.drives.list() });
        void qc.invalidateQueries({ queryKey: queryKeys.studentDashboard() });
        void qc.invalidateQueries({ queryKey: queryKeys.placement.readiness() });
        void refetch();
      })
      .catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : 'Failed to withdraw'),
      )
      .finally(() => setWithdrawPending(false));
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="My Participations"
        subtitle="Track your placement drive participations, see your current status, and manage withdrawals."
      />

      {/* Stats */}
      {!isLoading && allParticipations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-slate-700 dark:text-slate-300' },
            { label: 'Active', value: stats.active, color: 'text-indigo-600 dark:text-indigo-400' },
            {
              label: 'Offered',
              value: stats.offered,
              color: 'text-emerald-600 dark:text-emerald-400',
            },
            { label: 'Closed', value: stats.rejected, color: 'text-slate-500 dark:text-slate-400' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-center"
            >
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      {allParticipations.length > 0 && (
        <div className="flex gap-3">
          <Select
            options={STATUS_FILTERS}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-48"
          />
        </div>
      )}

      {isError && <ErrorState onRetry={refetch} />}

      {/* Participations grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : participations.length === 0 ? (
        <EmptyState
          icon={<FiAward />}
          title={status ? 'No matching participations' : 'No participations yet'}
          description={
            status
              ? 'No drives match the selected status filter.'
              : 'Browse placement drives and register to see your participations here.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {participations.map((p) => (
            <ParticipationCard key={p.id} participant={p} onWithdraw={setWithdrawing} />
          ))}
        </div>
      )}

      {/* Withdraw modal */}
      {withdrawing && (
        <WithdrawModal
          participant={withdrawing}
          onClose={() => setWithdrawing(null)}
          onConfirm={handleWithdraw}
          isPending={withdrawPending}
        />
      )}
    </div>
  );
}
