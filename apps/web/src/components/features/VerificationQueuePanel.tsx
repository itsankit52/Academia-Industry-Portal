import { useState } from 'react';
import { FiCheckCircle, FiExternalLink, FiX } from 'react-icons/fi';
import { format } from 'date-fns';
import { DOCUMENT_TYPES, type DocumentType } from '@aip/config';
import type { Document as ApiDocument } from '@aip/types';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useVerificationQueue, useVerifyDocument } from '@/hooks/queries/useVerifications';

interface Props {
  scope: 'admin' | 'company' | 'institution';
  title: string;
  subtitle?: string;
}

const typeOptions = [
  { value: '', label: 'All Types' },
  ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
];

type PopulatedUser = { id?: string; _id?: string; email?: string; role?: string };
type DocumentWithUser = Omit<ApiDocument, 'user'> & { user: string | PopulatedUser };

function extractUserEmail(doc: DocumentWithUser): string {
  if (typeof doc.user === 'object' && doc.user && 'email' in doc.user) {
    return doc.user.email ?? '—';
  }
  return typeof doc.user === 'string' ? doc.user : '—';
}

export default function VerificationQueuePanel({ scope, title, subtitle }: Props) {
  const [documentType, setDocumentType] = useState('');
  const [page, setPage] = useState(1);
  const [reviewDoc, setReviewDoc] = useState<DocumentWithUser | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const filters = {
    page,
    ...(documentType ? { documentType: documentType as DocumentType } : {}),
  };
  const { data, isLoading, isError, refetch } = useVerificationQueue(scope, filters);
  const verify = useVerifyDocument();

  const items = (data?.items ?? []) as DocumentWithUser[];
  const totalPages = data?.totalPages ?? 1;

  function closeReview() {
    setReviewDoc(null);
    setShowRejectForm(false);
    setRejectNotes('');
  }

  function handleApprove() {
    if (!reviewDoc) return;
    verify.mutate(
      { id: reviewDoc.id, verificationStatus: 'VERIFIED' },
      { onSuccess: () => closeReview() },
    );
  }

  function handleReject() {
    if (!reviewDoc || !rejectNotes.trim()) return;
    verify.mutate(
      {
        id: reviewDoc.id,
        verificationStatus: 'REJECTED',
        verificationNotes: rejectNotes.trim(),
      },
      { onSuccess: () => closeReview() },
    );
  }

  if (isError) return <ErrorState onRetry={() => void refetch()} />;

  const previewUrl = reviewDoc ? `${import.meta.env.VITE_API_URL}/documents/${reviewDoc.id}/binary` : '';
  const isPreviewable = reviewDoc
    ? reviewDoc.mimeType === 'application/pdf' || reviewDoc.mimeType.startsWith('image/')
    : false;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle ?? (data ? `${data.total} pending document${data.total !== 1 ? 's' : ''}.` : undefined)}
      />

      <Filters>
        <Select
          label="Document Type"
          value={documentType}
          onChange={(e) => { setDocumentType(e.target.value); setPage(1); }}
          options={typeOptions}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th>Submitter</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Title / Filename</Table.Th>
            <Table.Th>Issuer</Table.Th>
            <Table.Th>Submitted</Table.Th>
            <Table.Th className="text-right pr-4">Action</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={8} cols={6} />
          ) : items.length === 0 ? (
            <tr><td colSpan={6}><EmptyState icon={<FiCheckCircle />} title="No pending documents" /></td></tr>
          ) : (
            items.map((doc) => (
              <tr key={doc.id}>
                <Table.Td className="text-sm">{extractUserEmail(doc)}</Table.Td>
                <Table.Td>
                  <Badge variant="info" size="sm">{doc.documentType.replace(/_/g, ' ')}</Badge>
                </Table.Td>
                <Table.Td className="text-sm">
                  <div className="font-medium">{doc.title ?? doc.filename}</div>
                  {doc.title && <div className="text-xs text-slate-500">{doc.filename}</div>}
                </Table.Td>
                <Table.Td className="text-sm">{doc.issuer ?? '—'}</Table.Td>
                <Table.Td className="text-xs text-slate-500 whitespace-nowrap">
                  {format(new Date(doc.createdAt), 'dd MMM yyyy HH:mm')}
                </Table.Td>
                <Table.Td className="text-right pr-4">
                  <Button size="sm" variant="outline" onClick={() => setReviewDoc(doc)}>Review</Button>
                </Table.Td>
              </tr>
            ))
          )}
        </Table.Body>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <span className="text-sm text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next
          </Button>
        </div>
      )}

      <Modal open={reviewDoc !== null} onClose={closeReview} title="Review Document" size="xl">
        {reviewDoc && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Submitter</p>
                <p className="font-medium">{extractUserEmail(reviewDoc)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Type</p>
                <Badge variant="info" size="sm">{reviewDoc.documentType.replace(/_/g, ' ')}</Badge>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Title</p>
                <p className="font-medium">{reviewDoc.title ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Issuer</p>
                <p className="font-medium">{reviewDoc.issuer ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Issued Date</p>
                <p className="font-medium">{reviewDoc.issuedDate ? format(new Date(reviewDoc.issuedDate), 'dd MMM yyyy') : '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500 mb-1">Filename</p>
                <p className="font-medium truncate">{reviewDoc.filename}</p>
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-950">
              {isPreviewable ? (
                <iframe
                  src={previewUrl}
                  title="Document preview"
                  className="w-full h-[480px]"
                />
              ) : (
                <div className="p-6 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Inline preview not available for {reviewDoc.mimeType}.
                  </p>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" iconLeft={<FiExternalLink className="w-4 h-4" />}>
                      Open in new tab
                    </Button>
                  </a>
                </div>
              )}
            </div>

            {showRejectForm && (
              <Textarea
                label="Rejection reason"
                placeholder="Explain why this document is being rejected."
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={3}
              />
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={closeReview} iconLeft={<FiX className="w-4 h-4" />}>
                Close
              </Button>
              {showRejectForm ? (
                <Button
                  variant="danger"
                  size="sm"
                  loading={verify.isPending}
                  onClick={handleReject}
                  disabled={!rejectNotes.trim()}
                >
                  Confirm Rejection
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRejectForm(true)}
                    disabled={verify.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    loading={verify.isPending}
                    onClick={handleApprove}
                    iconLeft={<FiCheckCircle className="w-4 h-4" />}
                  >
                    Verify
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
