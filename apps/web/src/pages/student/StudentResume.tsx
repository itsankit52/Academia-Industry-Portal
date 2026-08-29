import { useState } from 'react';
import { FiFile, FiDownload, FiTrash2, FiEye, FiUpload, FiCpu, FiCheck } from 'react-icons/fi';
import { format } from 'date-fns';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
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
import {
  useAddSkillsFromResume,
  type ResumeSkillResult,
} from '@/hooks/queries/useAddSkillsFromResume';
import Textarea from '@/components/ui/Textarea';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StudentResume() {
  const { data: resume, isLoading, isError, refetch } = useStudentResume();
  const uploadResume = useUploadResume();
  const deleteResume = useDeleteResume();
  const addSkillsFromResume = useAddSkillsFromResume();

  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const [uploadedSkills, setUploadedSkills] = useState<string[]>([]);
  const [resumeText, setResumeText] = useState('');
  const [extractSkills, setExtractSkills] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [confirmingResume, setConfirmingResume] = useState(false);
  const [confirmingExtract, setConfirmingExtract] = useState(false);

  const extractMutation = useMutation({
    mutationFn: (text: string) => apiPost<{ skills: string[] }>('/ai/resume-analyze', { text }),
    onSuccess: (result) => {
      const skills = result.skills ?? [];
      setExtractSkills(skills);
      setExtracting(false);
      if (skills.length === 0) {
        toast.warning('No skills detected in the provided text.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to extract skills.');
      setExtracting(false);
    },
  });

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

  function handleExtract() {
    if (!resumeText.trim()) return;
    setExtracting(true);
    extractMutation.mutate(resumeText);
  }

  function handleAddAllFromUpload() {
    if (uploadedSkills.length === 0) return;
    setConfirmingResume(true);
  }

  function handleConfirmAddAllUpload() {
    setConfirmingResume(false);
    addSkillsFromResume.mutate(
      { skills: uploadedSkills },
      {
        onSuccess: (result) => {
          const res = result as ResumeSkillResult;
          if (res.added.length > 0 || res.skipped.length > 0) {
            setUploadedSkills((prev) =>
              prev.filter(
                (s) => !res.skipped.includes(s) && !res.added.some((a) => a.skill.name === s),
              ),
            );
          }
        },
      },
    );
  }

  function handleConfirmExtract() {
    if (extractSkills.length === 0) return;
    setConfirmingExtract(true);
  }

  function handleAddAllFromExtract() {
    setConfirmingExtract(false);
    addSkillsFromResume.mutate(
      { skills: extractSkills },
      {
        onSuccess: (result) => {
          const res = result as ResumeSkillResult;
          if (res.added.length + res.skipped.length > 0) {
            setExtractSkills((prev) =>
              prev.filter(
                (s) => !res.skipped.includes(s) && !res.added.some((a) => a.skill.name === s),
              ),
            );
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
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Current Resume
                </h2>
              </Card.Header>
              <Card.Body>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                    <FiFile className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      Version {resume.version}
                    </p>
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
                      const downloadHref =
                        resume.url && resume.url.startsWith('http')
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
                            <Button
                              variant="outline"
                              size="sm"
                              iconLeft={<FiEye className="w-4 h-4" />}
                            >
                              View
                            </Button>
                          </a>
                          <a
                            href={downloadHref}
                            download={resume.filename ?? 'resume.pdf'}
                            aria-label="Download resume"
                            className="inline-flex"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              iconLeft={<FiDownload className="w-4 h-4" />}
                            >
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
              <FileDrop label="Resume" accept=".pdf,.doc,.docx" onChange={setFile} />
              {uploadResume.isPending && <ProgressBar value={progress} />}
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
                  Skills From Resume Upload
                </h2>
              </Card.Header>
              <Card.Body className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  We detected <strong>{uploadedSkills.length}</strong> skill
                  {uploadedSkills.length === 1 ? '' : 's'} in your resume. Click &quot;Add All to
                  Profile&quot; to add them all at once, or use the Add Skill form to add them
                  individually.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {uploadedSkills.map((skill) => (
                    <SkillChip key={skill} name={skill} />
                  ))}
                </div>
                <Button
                  onClick={handleAddAllFromUpload}
                  loading={addSkillsFromResume.isPending}
                  iconLeft={<FiCheck className="w-4 h-4" />}
                >
                  Add All to Profile
                </Button>
              </Card.Body>
            </Card>
          )}

          {/* AI skill extraction from pasted resume text */}
          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                <FiCpu /> Extract Skills with AI
              </h2>
            </Card.Header>
            <Card.Body className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Paste your resume text below to extract skills using AI. The extracted skills will
                be shown here — click &quot;Add All to Profile&quot; to add them to your skill
                profile at once.
              </p>
              <Textarea
                label="Resume Text"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste the content of your resume here — your skills section works best..."
                rows={6}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleExtract}
                  disabled={!resumeText.trim() || extracting}
                  loading={extracting}
                  iconLeft={<FiCpu className="w-4 h-4" />}
                >
                  Extract Skills
                </Button>
                {extractSkills.length > 0 && (
                  <Button onClick={handleConfirmExtract} iconLeft={<FiCheck className="w-4 h-4" />}>
                    Add All to Profile
                  </Button>
                )}
              </div>
              {extractSkills.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                      Detected skills ({extractSkills.length}) — click &quot;Add All to
                      Profile&quot; above:
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setExtractSkills([])}>
                      Clear
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {extractSkills.map((skill) => (
                      <SkillChip key={skill} name={skill} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Skills are matched against the platform&apos;s skills catalogue. Skills not
                    found in the catalogue will be shown separately for manual addition.
                  </p>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Confirmation for "Add All" from upload */}
      <ConfirmDialog
        open={confirmingResume}
        title="Add Skills from Resume"
        description={`Add ${uploadedSkills.length} skill${uploadedSkills.length === 1 ? '' : 's'} to your profile at BEGINNER level? Existing skills will be skipped.`}
        confirmLabel="Add All"
        loading={addSkillsFromResume.isPending}
        onConfirm={handleConfirmAddAllUpload}
        onCancel={() => setConfirmingResume(false)}
      />

      {/* Confirmation for "Add All" from AI extraction */}
      <ConfirmDialog
        open={confirmingExtract}
        title="Add Extracted Skills"
        description={`Add ${extractSkills.length} skill${extractSkills.length === 1 ? '' : 's'} to your profile at BEGINNER level? Existing skills will be skipped.`}
        confirmLabel="Add All"
        loading={addSkillsFromResume.isPending}
        onConfirm={handleAddAllFromExtract}
        onCancel={() => setConfirmingExtract(false)}
      />

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
