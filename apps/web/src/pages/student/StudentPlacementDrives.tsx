/**
 * Phase 11 — Student Placement Drives page.
 *
 * Students can browse open placement drives, preview their eligibility,
 * and register for drives they're eligible for.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiTarget, FiCalendar, FiMapPin, FiBriefcase, FiCheckCircle, FiXCircle, FiAlertTriangle, FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { usePlacementDrives, type PlacementDrive } from '@/hooks/queries/usePlacementDrives';
import { useDriveEligibilityPreview } from '@/hooks/queries/useDriveParticipants';
import { useRegisterForDrive } from '@/hooks/queries/useDriveParticipants';
import { toast } from 'sonner';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'REGISTRATION_OPEN', label: 'Registration Open' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'DRIVE_IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
];

const modeOptions = [
  { value: '', label: 'All modes' },
  { value: 'OFF_CAMPUS', label: 'Off Campus' },
  { value: 'ON_CAMPUS', label: 'On Campus' },
  { value: 'POOL', label: 'Pool Drive' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'HYBRID', label: 'Hybrid' },
];

const STATUS_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default' | 'danger'> = {
  REGISTRATION_OPEN: 'success',
  PUBLISHED: 'info',
  DRIVE_IN_PROGRESS: 'warning',
  COMPLETED: 'default',
  CANCELLED: 'danger',
  ARCHIVED: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION_OPEN: 'Reg. Open',
  PUBLISHED: 'Published',
  DRIVE_IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

function DriveCardSkeleton() {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
      <SkeletonCard className="h-5 w-3/4" />
      <SkeletonCard className="h-4 w-full" />
      <SkeletonCard className="h-4 w-1/2" />
      <div className="flex gap-2 mt-2">
        <SkeletonCard className="h-6 w-20" />
        <SkeletonCard className="h-6 w-20" />
      </div>
    </div>
  );
}

function EligibilityBadge({ eligible, failures }: { eligible: boolean; failures: Array<{ message: string }> }) {
  if (eligible) {
    return <Badge variant="success" size="sm"><FiCheckCircle className="w-3 h-3 mr-1 inline" />Eligible</Badge>;
  }
  return (
    <Badge variant="danger" size="sm">
      <FiXCircle className="w-3 h-3 mr-1 inline" />
      Not Eligible
    </Badge>
  );
}

interface DriveDetailModalProps {
  drive: PlacementDrive;
  onClose: () => void;
}

function DriveDetailModal({ drive, onClose }: DriveDetailModalProps) {
  const { data: eligibility, isLoading: eligibilityLoading, refetch: refetchEligibility } =
    useDriveEligibilityPreview(drive.id);
  const register = useRegisterForDrive(drive.id);

  const isOpen = drive.status === 'REGISTRATION_OPEN' || drive.status === 'PUBLISHED';
  const canRegister = isOpen && (eligibility?.eligible ?? false);
  const alreadyRegistered = eligibility?.failures.some(
    (f) => f.rule === 'MAX_PARTICIPATIONS_PER_DRIVE' || f.message.includes('already registered'),
  );

  function handleRegister() {
    register.mutate(
      {
        companyId: drive.participatingCompanies[0]?.id,
      },
      {
        onSuccess: () => {
          toast.success('Registered!', { description: 'You have been registered for this placement drive.' });
          void refetchEligibility();
        },
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Registration failed';
          toast.error(msg, { description: 'Registration failed' });
        },
      },
    );
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={drive.title}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">{drive.description}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {drive.mode && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiMapPin className="w-4 h-4 shrink-0" />
              <span>{drive.mode.replace('_', ' ')}</span>
            </div>
          )}
          {drive.location && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiTarget className="w-4 h-4 shrink-0" />
              <span>{drive.location}</span>
            </div>
          )}
          {drive.registrationOpensAt && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiCalendar className="w-4 h-4 shrink-0" />
              <span>Reg. opens: {new Date(drive.registrationOpensAt).toLocaleDateString()}</span>
            </div>
          )}
          {drive.registrationClosesAt && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiCalendar className="w-4 h-4 shrink-0" />
              <span>Reg. closes: {new Date(drive.registrationClosesAt).toLocaleDateString()}</span>
            </div>
          )}
          {drive.driveStartsAt && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiCalendar className="w-4 h-4 shrink-0" />
              <span>Drive: {new Date(drive.driveStartsAt).toLocaleDateString()}</span>
            </div>
          )}
          {drive.totalSlots != null && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <FiUsers className="w-4 h-4 shrink-0" />
              <span>Slots: {drive.filledSlots ?? 0} / {drive.totalSlots}</span>
            </div>
          )}
        </div>

        {drive.participatingCompanies.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Participating Companies</h4>
            <div className="flex flex-wrap gap-2">
              {drive.participatingCompanies.map((c) => (
                <Badge key={c.id} variant="default">{c.companyName ?? c.id}</Badge>
              ))}
            </div>
          </div>
        )}

        {drive.opportunities.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Opportunity Types</h4>
            <div className="flex flex-wrap gap-2">
              {drive.opportunities.map((o) => (
                <Badge key={o.opportunityId} variant="info">
                  {o.opportunityType.replace('_', ' ')} ({o.openings} openings)
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Eligibility section */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Your Eligibility</h4>
          {eligibilityLoading ? (
            <div className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ) : eligibility ? (
            <div className="space-y-2">
              <EligibilityBadge eligible={eligibility.eligible} failures={eligibility.failures} />
              {eligibility.failures.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {eligibility.failures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <FiXCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                      {f.message}
                    </li>
                  ))}
                </ul>
              )}
              {eligibility.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {eligibility.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                      <FiAlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-800">
        {canRegister ? (
          <>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleRegister}
              loading={register.isPending}
            >
              Register for Drive
            </Button>
          </>
        ) : alreadyRegistered ? (
          <>
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button variant="primary" disabled>
              <FiCheckCircle className="w-4 h-4 mr-1" /> Already Registered
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose}>Close</Button>
        )}
      </div>
    </Modal>
  );
}

export default function StudentPlacementDrives() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [q, setQ] = useState('');
  const [selectedDrive, setSelectedDrive] = useState<PlacementDrive | null>(null);

  const { data, isLoading, isError, refetch } = usePlacementDrives({
    status: status || undefined,
    mode: mode || undefined,
    q: q || undefined,
    page,
  });

  const drives = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Placement Drives"
        subtitle="Browse open placement drives, check your eligibility, and register."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search drives…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full"
          />
        </div>
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-44"
        />
        <Select
          options={modeOptions}
          value={mode}
          onChange={(e) => { setMode(e.target.value); setPage(1); }}
          className="w-44"
        />
      </div>

      {isError && <ErrorState onRetry={refetch} />}

      {/* Drive grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <DriveCardSkeleton key={i} />)}
        </div>
      ) : drives.length === 0 ? (
        <EmptyState
          icon={<FiTarget />}
          title="No placement drives found"
          description="No drives match your current filters. Check back later or adjust your search."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drives.map((drive) => {
            const isOpen = drive.status === 'REGISTRATION_OPEN' || drive.status === 'PUBLISHED';
            return (
              <div
                key={drive.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedDrive(drive)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') setSelectedDrive(drive); }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {drive.title}
                  </h3>
                  <Badge variant={STATUS_BADGE[drive.status] ?? 'default'} size="sm">
                    {STATUS_LABEL[drive.status] ?? drive.status}
                  </Badge>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                  {drive.description}
                </p>

                <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {drive.mode && (
                    <span className="flex items-center gap-1">
                      <FiMapPin className="w-3 h-3" />{drive.mode.replace('_', ' ')}
                    </span>
                  )}
                  {drive.location && (
                    <span className="flex items-center gap-1">
                      <FiTarget className="w-3 h-3" />{drive.location}
                    </span>
                  )}
                  {drive.driveStartsAt && (
                    <span className="flex items-center gap-1">
                      <FiCalendar className="w-3 h-3" />
                      {new Date(drive.driveStartsAt).toLocaleDateString()}
                    </span>
                  )}
                  {drive.totalSlots != null && (
                    <span className="flex items-center gap-1">
                      <FiUsers className="w-3 h-3" />
                      {drive.filledSlots ?? 0}/{drive.totalSlots}
                    </span>
                  )}
                </div>

                {drive.participatingCompanies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {drive.participatingCompanies.slice(0, 3).map((c) => (
                      <Badge key={c.id} variant="default" size="sm">{c.companyName ?? 'Company'}</Badge>
                    ))}
                    {drive.participatingCompanies.length > 3 && (
                      <Badge variant="default" size="sm">+{drive.participatingCompanies.length - 3}</Badge>
                    )}
                  </div>
                )}

                {isOpen && (
                  <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button size="sm" variant="primary" className="w-full" onClick={() => setSelectedDrive(drive)}>
                      View & Register
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center">
          <div className="flex gap-2">
            {Array.from({ length: pagination.pages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  page === i + 1
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Drive detail modal */}
      {selectedDrive && (
        <DriveDetailModal drive={selectedDrive} onClose={() => setSelectedDrive(null)} />
      )}
    </div>
  );
}
