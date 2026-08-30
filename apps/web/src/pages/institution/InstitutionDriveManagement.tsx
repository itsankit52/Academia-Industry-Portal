/**
 * Phase 11 — Institution Drive Management page.
 *
 * Allows institutions to create, manage, and monitor placement drives:
 *   - List all drives with status filtering
 *   - Create new drives
 *   - Edit drive details
 *   - Transition drive status (publish, cancel, etc.)
 *   - View participants per drive
 *   - Access drive reports
 *
 * Reuses UI primitives and follows existing patterns from InstitutionPlacements.
 */

import { useState, type ChangeEvent } from 'react';
import {
  FiTarget,
  FiPlus,
  FiCalendar,
  FiMapPin,
  FiUsers,
  FiTrendingUp,
  FiEdit,
  FiEye,
} from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { toast } from 'sonner';
import {
  usePlacementDrives,
  useCreatePlacementDrive,
  useUpdatePlacementDrive,
  type PlacementDrive,
  type CreateDriveInput,
} from '@/hooks/queries/usePlacementDrives';
import { useDriveParticipants } from '@/hooks/queries/useDriveParticipants';
import { apiPost } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REGISTRATION_OPEN', label: 'Registration Open' },
  { value: 'DRIVE_IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'default',
  PUBLISHED: 'info',
  REGISTRATION_OPEN: 'success',
  DRIVE_IN_PROGRESS: 'warning',
  COMPLETED: 'default',
  CANCELLED: 'danger',
  ARCHIVED: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  REGISTRATION_OPEN: 'Reg. Open',
  DRIVE_IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
};

const MODE_OPTIONS = [
  { value: 'ON_CAMPUS', label: 'On Campus' },
  { value: 'OFF_CAMPUS', label: 'Off Campus' },
  { value: 'POOL', label: 'Pool Drive' },
  { value: 'WALK_IN', label: 'Walk-in' },
  { value: 'HYBRID', label: 'Hybrid' },
];

/* ── Create/Edit Drive Modal ────────────────────────────────────────── */

interface DriveFormState {
  title: string;
  description: string;
  mode: string;
  location: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  driveStartsAt: string;
  driveEndsAt: string;
  totalSlots: string;
}

const EMPTY_FORM: DriveFormState = {
  title: '',
  description: '',
  mode: 'ON_CAMPUS',
  location: '',
  registrationOpensAt: '',
  registrationClosesAt: '',
  driveStartsAt: '',
  driveEndsAt: '',
  totalSlots: '',
};

interface DriveFormModalProps {
  drive?: PlacementDrive;
  onClose: () => void;
}

function DriveFormModal({ drive, onClose }: DriveFormModalProps) {
  const [form, setForm] = useState<DriveFormState>(() =>
    drive
      ? {
          title: drive.title,
          description: drive.description,
          mode: drive.mode,
          location: drive.location ?? '',
          registrationOpensAt: drive.registrationOpensAt?.split('T')[0] ?? '',
          registrationClosesAt: drive.registrationClosesAt?.split('T')[0] ?? '',
          driveStartsAt: drive.driveStartsAt?.split('T')[0] ?? '',
          driveEndsAt: drive.driveEndsAt?.split('T')[0] ?? '',
          totalSlots: drive.totalSlots?.toString() ?? '',
        }
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<Partial<Record<keyof DriveFormState, string>>>({});

  const createDrive = useCreatePlacementDrive();
  const updateDrive = useUpdatePlacementDrive(drive?.id ?? '');
  const isEditing = !!drive;
  const isPending = createDrive.isPending || updateDrive.isPending;

  function setField<K extends keyof DriveFormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof DriveFormState, string>> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (!form.driveStartsAt) errs.driveStartsAt = 'Start date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const payload: CreateDriveInput = {
      title: form.title.trim(),
      description: form.description.trim(),
      mode: form.mode,
      location: form.location.trim() || undefined,
      registrationOpensAt: form.registrationOpensAt ? `${form.registrationOpensAt}T00:00:00Z` : undefined,
      registrationClosesAt: form.registrationClosesAt ? `${form.registrationClosesAt}T23:59:59Z` : undefined,
      driveStartsAt: form.driveStartsAt ? `${form.driveStartsAt}T09:00:00Z` : undefined,
      driveEndsAt: form.driveEndsAt ? `${form.driveEndsAt}T18:00:00Z` : undefined,
      totalSlots: form.totalSlots ? parseInt(form.totalSlots, 10) : undefined,
      participatingCompanies: drive?.participatingCompanies.map((c) => c.id) ?? [],
    };

    const mutation = isEditing ? updateDrive : createDrive;
    mutation.mutate(payload, {
      onSuccess: () => {
        toast.success(isEditing ? 'Drive updated' : 'Drive created', { description: `Drive "${form.title}" has been saved.` });
        onClose();
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Failed to save drive');
      },
    });
  }

  const fieldClass = 'flex flex-col gap-1';
  const labelClass = 'text-xs font-medium text-slate-600 dark:text-slate-400';
  const inputClass = 'w-full';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? 'Edit Drive' : 'Create Placement Drive'}
      size="lg"
    >
      <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <div className={fieldClass}>
          <label className={labelClass}>Title *</label>
          <Input
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="e.g., TechCorp Campus Drive 2025"
            className={inputClass}
          />
          {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
        </div>

        <div className={fieldClass}>
          <label className={labelClass}>Description *</label>
          <textarea
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Brief description of the drive..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {errors.description && <span className="text-xs text-red-500">{errors.description}</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={fieldClass}>
            <label className={labelClass}>Mode</label>
            <Select
              options={MODE_OPTIONS}
              value={form.mode}
              onChange={(e) => setField('mode', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Location</label>
            <Input
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="City, Venue..."
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={fieldClass}>
            <label className={labelClass}>Registration Opens</label>
            <Input
              type="date"
              value={form.registrationOpensAt}
              onChange={(e) => setField('registrationOpensAt', e.target.value)}
              className={inputClass}
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Registration Closes</label>
            <Input
              type="date"
              value={form.registrationClosesAt}
              onChange={(e) => setField('registrationClosesAt', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={fieldClass}>
            <label className={labelClass}>Drive Starts *</label>
            <Input
              type="date"
              value={form.driveStartsAt}
              onChange={(e) => setField('driveStartsAt', e.target.value)}
              className={inputClass}
            />
            {errors.driveStartsAt && <span className="text-xs text-red-500">{errors.driveStartsAt}</span>}
          </div>
          <div className={fieldClass}>
            <label className={labelClass}>Drive Ends</label>
            <Input
              type="date"
              value={form.driveEndsAt}
              onChange={(e) => setField('driveEndsAt', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className={fieldClass}>
          <label className={labelClass}>Total Slots</label>
          <Input
            type="number"
            value={form.totalSlots}
            onChange={(e) => setField('totalSlots', e.target.value)}
            placeholder="Max participants..."
            min="1"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 dark:border-slate-800">
        <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit} loading={isPending}>
          {isEditing ? 'Save Changes' : 'Create Drive'}
        </Button>
      </div>
    </Modal>
  );
}

/* ── Participant Sidebar ─────────────────────────────────────────────── */

interface ParticipantSidebarProps {
  drive: PlacementDrive;
  onClose: () => void;
}

function ParticipantSidebar({ drive, onClose }: ParticipantSidebarProps) {
  const { data, isLoading, isError, refetch } = useDriveParticipants(drive.id);
  const participants = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">{drive.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isError && <ErrorState onRetry={refetch} />}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : participants.length === 0 ? (
          <EmptyState
            icon={<FiUsers />}
            title="No participants yet"
            description="Students will appear here once they register."
          />
        ) : (
          <div className="space-y-3">
            {participants.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {p.studentProfile?.fullName ?? p.student}
                  </span>
                  <Badge variant={p.status === 'REGISTERED' ? 'success' : 'default'} size="sm">
                    {p.status}
                  </Badge>
                </div>
                {p.studentProfile?.branch && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.studentProfile.branch} · CGPA: {p.studentProfile.cgpa?.toFixed(2) ?? '—'}
                  </p>
                )}
                {p.company?.companyName && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Company: {p.company.companyName}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {pagination && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {pagination.total} total participants
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */

export default function InstitutionDriveManagement() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState<PlacementDrive | null>(null);
  const [viewingDrive, setViewingDrive] = useState<PlacementDrive | null>(null);

  const { data, isLoading, isError, refetch } = usePlacementDrives({
    status: status || undefined,
    q: q || undefined,
    page,
    limit: 12,
  });

  const drives = data?.data ?? [];
  const pagination = data?.pagination;

  function handleTransition(drive: PlacementDrive, targetStatus: string) {
    apiPost(`/placement-drives/${drive.id}/transition`, { targetStatus, reason: `Transitioned to ${targetStatus}` })
      .then(() => {
        toast.success('Drive updated', { description: `Status changed to ${STATUS_LABEL[targetStatus] ?? targetStatus}` });
        void refetch();
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Failed to update drive');
      });
  }

  const isSidebarOpen = !!viewingDrive;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Drive Management"
        subtitle="Create and manage placement drives, monitor registrations, and track outcomes."
        actions={
          <Button variant="primary" iconLeft={<FiPlus className="w-4 h-4" />} onClick={() => setShowCreateModal(true)}>
            Create Drive
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search drives..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="w-full"
          />
        </div>
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="w-48"
        />
      </div>

      {isError && <ErrorState onRetry={refetch} />}

      {/* Drives grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : drives.length === 0 ? (
        <EmptyState
          icon={<FiTarget />}
          title="No placement drives found"
          description="Create your first placement drive to get started."
          action={
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>Create Drive</Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {drives.map((drive) => (
            <Card key={drive.id} className="flex flex-col">
              <Card.Header>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                    {drive.title}
                  </h3>
                  <Badge variant={STATUS_BADGE[drive.status] ?? 'default'} size="sm">
                    {STATUS_LABEL[drive.status] ?? drive.status}
                  </Badge>
                </div>
              </Card.Header>
              <Card.Body className="flex-1 space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                  {drive.description}
                </p>

                <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
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
              </Card.Body>

              <Card.Footer>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={<FiEye className="w-3 h-3" />}
                    onClick={() => setViewingDrive(drive)}
                  >
                    Participants
                  </Button>
                  {drive.status === 'DRAFT' && (
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={<FiTrendingUp className="w-3 h-3" />}
                      onClick={() => handleTransition(drive, 'PUBLISHED')}
                    >
                      Publish
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={<FiEdit className="w-3 h-3" />}
                    onClick={() => setEditingDrive(drive)}
                    className="ml-auto"
                  />
                </div>
              </Card.Footer>
            </Card>
          ))}
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

      {/* Create/Edit modal */}
      {(showCreateModal || editingDrive) && (
        <DriveFormModal
          drive={editingDrive ?? undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingDrive(null);
          }}
        />
      )}

      {/* Participant sidebar */}
      {isSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setViewingDrive(null)}
          />
          <ParticipantSidebar drive={viewingDrive!} onClose={() => setViewingDrive(null)} />
        </>
      )}
    </div>
  );
}
