import { useState } from 'react';
import { FiFile, FiDownload, FiTrash2, FiEye, FiUpload } from 'react-icons/fi';
import { format } from 'date-fns';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import FileDrop from '@/components/ui/FileDrop';
import ProgressBar from '@/components/ui/ProgressBar';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Badge from '@/components/ui/Badge';
import SkillChip from '@/components/ui/SkillChip';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useStudentResume } from '@/hooks/queries/useStudentResume';
import { useUploadResume } from '@/hooks/queries/useUploadResume';
import { useDeleteResume } from '@/hooks/queries/useDeleteResume';
import { useAddStudentSkill } from '@/hooks/queries/useAddStudentSkill';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentResume() {
  const { data: resume, isLoading, isError, refetch } = useStudentResume();
  const uploadResume = useUploadResume();
  const deleteResume = useDeleteResume();
  const addSkill = useAddStudentSkill();

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const [uploadedSkills, setUploadedSkills] = useState<string[]>([]);

  function handleUpload() {
    if (!file) return;
    setProgress(0);
    uploadResume.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (data) => {
          setFile(null);
          setProgress(0);
          if (data.parsedSkills?.length) {
            setUploadedSkills(data.parsedSkills);
          }
        },
      },
    );
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Resume" subtitle="Upload and manage your resume." />

      {isError && <ErrorState onRetry={() => void refetch()} />}
      {isLoading && <SkeletonCard />}

      {!isLoading && (
        <>
          {resume ? (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Current Resume</h2>
              </Card.Header>
              <Card.Body>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FiFile className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Version {resume.version}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {formatBytes(resume.sizeBytes)} · Uploaded{' '}
                      {format(new Date(resume.createdAt), 'MMM d, yyyy')}
                    </p>
                    <Badge variant="info" size="sm" className="mt-2">
                      {resume.mimeType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(() => {
                      const downloadHref = resume.url && resume.url.startsWith('http')
                        ? resume.url
                        : `${import.meta.env.VITE_API_URL}/students/me/resume/download`;
                      return (
                        <>
                          <a
                            href={downloadHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex"
                            aria-label="View resume"
                          >
                            <Button variant="outline" size="sm" iconLeft={<FiEye className="w-4 h-4" />}>
                              View
                            </Button>
                          </a>
                          <a href={downloadHref} download={resume.filename ?? 'resume.pdf'} aria-label="Download resume" className="inline-flex">
                            <Button variant="outline" size="sm" iconLeft={<FiDownload className="w-4 h-4" />}>
                              Download
                            </Button>
                          </a>
                        </>
                      );
                    })()}
                    <Button
                      variant="danger"
                      size="sm"
                      iconLeft={<FiTrash2 className="w-4 h-4" />}
                      onClick={() => setShowDelete(true)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ) : (
            <EmptyState
              icon={<FiFile />}
              title="No resume uploaded"
              description="Upload your resume below to apply for jobs and internships."
            />
          )}

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                {resume ? 'Replace Resume' : 'Upload Resume'}
              </h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <FileDrop
                label="Resume"
                accept=".pdf,.doc,.docx"
                onChange={setFile}
              />
              {uploadResume.isPending && (
                <ProgressBar value={progress} />
              )}
              <Button
                onClick={handleUpload}
                disabled={!file}
                loading={uploadResume.isPending}
                iconLeft={<FiUpload className="w-4 h-4" />}
              >
                Upload Resume
              </Button>
            </Card.Body>
          </Card>

          {uploadedSkills.length > 0 && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Parsed Skills
                </h2>
              </Card.Header>
              <Card.Body className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  We detected these skills in your resume. Add them to your profile?
                </p>
                <div className="flex flex-wrap gap-2">
                  {uploadedSkills.map((skill) => (
                    <div key={skill} className="flex items-center gap-1.5">
                      <SkillChip name={skill} />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          addSkill.mutate(
                            { skillId: skill, proficiency: 'BEGINNER' },
                            {
                              onSuccess: () =>
                                setUploadedSkills((prev) => prev.filter((s) => s !== skill)),
                            },
                          )
                        }
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={showDelete}
        title="Delete Resume"
        description="Are you sure you want to delete your current resume? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteResume.isPending}
        onConfirm={() => deleteResume.mutate(undefined, { onSuccess: () => setShowDelete(false) })}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
