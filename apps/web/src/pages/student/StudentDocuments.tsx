import { useState } from 'react';
import { FiFile, FiDownload, FiTrash2, FiUpload, FiExternalLink } from 'react-icons/fi';
import { format } from 'date-fns';
import { DOCUMENT_TYPES, type DocumentType } from '@aip/config';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import FileDrop from '@/components/ui/FileDrop';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ProgressBar from '@/components/ui/ProgressBar';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  useMyDocuments,
  useUploadDocument,
  useDeleteDocument,
} from '@/hooks/queries/useDocuments';
import { useStudentProfile } from '@/hooks/queries/useStudentProfile';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const documentTypeOptions = [
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'INTERNSHIP_REPORT', label: 'Internship Report' },
  { value: 'ACADEMIC_RECORD', label: 'Academic Record' },
  { value: 'RESUME', label: 'Resume' },
];

const filterTypeOptions = [
  { value: '', label: 'All Types' },
  ...DOCUMENT_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
];

const statusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  VERIFIED: 'success',
  PENDING: 'warning',
  REJECTED: 'danger',
};

export default function StudentDocuments() {
  const { data: profile } = useStudentProfile();
  const [documentType, setDocumentType] = useState<DocumentType>('CERTIFICATE');
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filters = filterType ? { documentType: filterType as DocumentType } : {};
  const { data, isLoading, isError, refetch } = useMyDocuments(filters);
  const upload = useUploadDocument();
  const remove = useDeleteDocument();

  const documents = data?.items ?? [];

  function handleUpload() {
    if (!file) return;
    setProgress(0);
    upload.mutate(
      {
        file,
        documentType,
        ...(title ? { title } : {}),
        ...(issuer ? { issuer } : {}),
        ...(issuedDate ? { issuedDate: new Date(issuedDate).toISOString() } : {}),
        onProgress: setProgress,
      },
      {
        onSuccess: () => {
          setFile(null);
          setTitle('');
          setIssuer('');
          setIssuedDate('');
          setProgress(0);
        },
      },
    );
  }

  const shareUrl = profile?.id
    ? `${window.location.origin}/portfolio/${profile.id}`
    : null;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Upload certificates, internship reports and academic records for verification."
      />

      {shareUrl && (
        <Card>
          <Card.Body className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Your public portfolio</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-all">{shareUrl}</p>
            </div>
            <div className="flex gap-2">
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" iconLeft={<FiExternalLink className="w-4 h-4" />}>Open</Button>
              </a>
              <Button
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl);
                }}
              >
                Copy Link
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Header>
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Upload Document</h2>
        </Card.Header>
        <Card.Body className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Document Type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              options={documentTypeOptions}
            />
            <Input
              label="Title"
              placeholder="e.g. AWS Cloud Practitioner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Input
              label="Issuer (optional)"
              placeholder="e.g. Amazon Web Services"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
            />
            <Input
              label="Issued Date (optional)"
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
            />
          </div>
          <FileDrop label="File" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" onChange={setFile} />
          {upload.isPending && <ProgressBar value={progress} />}
          <Button
            onClick={handleUpload}
            disabled={!file || !documentType}
            loading={upload.isPending}
            iconLeft={<FiUpload className="w-4 h-4" />}
          >
            Upload
          </Button>
        </Card.Body>
      </Card>

      <div className="flex items-end gap-3">
        <Select
          label="Filter by Type"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          options={filterTypeOptions}
        />
      </div>

      {isError && <ErrorState onRetry={() => void refetch()} />}
      {isLoading && <SkeletonCard />}

      {!isLoading && documents.length === 0 && (
        <EmptyState
          icon={<FiFile />}
          title="No documents yet"
          description="Upload certificates and reports above to build a verified portfolio."
        />
      )}

      {!isLoading && documents.length > 0 && (
        <div className="space-y-3">
          {documents.map((doc) => {
            const downloadHref = `${import.meta.env.VITE_API_URL}/documents/${doc.id}/binary`;
            const variant = statusVariant[doc.verificationStatus] ?? 'warning';
            return (
              <Card key={doc.id}>
                <Card.Body className="flex flex-wrap items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FiFile className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {doc.title || doc.filename}
                      </p>
                      <Badge variant={variant} size="sm">{doc.verificationStatus}</Badge>
                      <Badge variant="info" size="sm">{doc.documentType.replace(/_/g, ' ')}</Badge>
                    </div>
                    {doc.issuer && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">Issued by {doc.issuer}</p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatBytes(doc.sizeBytes)} · Uploaded {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                    </p>
                    {doc.verificationStatus === 'REJECTED' && doc.verificationNotes && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">Reason: {doc.verificationNotes}</p>
                    )}
                    {doc.verificationStatus === 'VERIFIED' && doc.verifiedAt && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400">
                        Verified {format(new Date(doc.verifiedAt), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={downloadHref} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline" size="sm" iconLeft={<FiDownload className="w-4 h-4" />}>Download</Button>
                    </a>
                    <Button
                      variant="danger"
                      size="sm"
                      iconLeft={<FiTrash2 className="w-4 h-4" />}
                      onClick={() => setPendingDelete(doc.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={remove.isPending}
        onConfirm={() =>
          pendingDelete &&
          remove.mutate(pendingDelete, { onSuccess: () => setPendingDelete(null) })
        }
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
