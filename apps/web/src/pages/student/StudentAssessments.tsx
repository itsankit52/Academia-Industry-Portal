import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClipboard, FiInfo } from 'react-icons/fi';
import { format } from 'date-fns';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useMyAssessments } from '@/hooks/queries/useMyAssessments';
import { useGenerateAssessment } from '@/hooks/queries/useGenerateAssessment';
import { useStudentSkills } from '@/hooks/queries/useStudentSkills';
import type { Assessment } from '@aip/types';
import type { ApiClientError } from '@/lib/ApiClientError';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  GENERATED: { label: 'Ready', variant: 'info' },
  IN_PROGRESS: { label: 'In Progress', variant: 'warning' },
  SUBMITTED: { label: 'Submitted', variant: 'default' },
  EVALUATED: { label: 'Evaluated', variant: 'success' },
};

function scoreColorClass(score?: number) {
  if (score === undefined) return 'text-slate-400 dark:text-slate-500';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function cardTarget(a: Assessment) {
  return a.status === 'EVALUATED'
    ? `/student/assessments/${a.id}`
    : `/student/assessments/${a.id}/take`;
}

export default function StudentAssessments() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);

  const { data: assessments, isLoading } = useMyAssessments(page);
  const { data: skills } = useStudentSkills();
  const generate = useGenerateAssessment();

  useEffect(() => {
    if (skills) {
      setSelectedSkillIds(skills.map((s) => s.skill.id));
    }
  }, [skills]);

  function openModal() {
    if (skills) setSelectedSkillIds(skills.map((s) => s.skill.id));
    setQuestionCount(10);
    setDurationMinutes(30);
    setShowModal(true);
  }

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function handleGenerate() {
    generate.mutate(
      { questionCount, durationMinutes, skillIds: selectedSkillIds },
      {
        onSuccess: (result) => {
          setShowModal(false);
          navigate(`/student/assessments/${result.id}/take`);
        },
        onError: (err: ApiClientError) => {
          if (err.status === 429) {
            toast.error('Too many generations, wait an hour');
          } else if (err.status === 400 && err.message.toLowerCase().includes('skill')) {
            toast.error(
              'Add at least one skill before generating an assessment. Go to /student/skills to add skills.',
            );
          } else {
            toast.error('AI service temporarily unavailable, please try again');
          }
        },
      },
    );
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Assessments"
        subtitle="AI-generated tests based on your skills"
        actions={
          <Button iconLeft={<FiClipboard className="w-4 h-4" />} onClick={openModal}>
            Generate New Assessment
          </Button>
        }
      />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!isLoading && assessments && assessments.items.length === 0 && (
        <EmptyState
          title="No assessments yet. Take your first one!"
          icon={<FiClipboard />}
          action={{ label: 'Generate Assessment', onClick: openModal }}
        />
      )}

      {!isLoading && assessments && assessments.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assessments.items.map((a) => {
              const cfg = statusConfig[a.status] ?? { label: a.status, variant: 'default' as BadgeVariant };
              const date = a.submittedAt ?? a.createdAt;
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(cardTarget(a))}
                  className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-xl"
                >
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <Card.Body className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        <span className={`text-2xl font-bold tabular-nums ${scoreColorClass(a.evaluation?.totalScore)}`}>
                          {a.evaluation?.totalScore !== undefined ? a.evaluation.totalScore : '—'}
                          <span className="text-sm font-normal text-slate-400 dark:text-slate-500">/100</span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {a.skillNames.slice(0, 3).map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium"
                          >
                            {name}
                          </span>
                        ))}
                        {a.skillNames.length > 3 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 self-center">
                            +{a.skillNames.length - 3}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>{a.questionCount} questions</span>
                        <span>{format(new Date(date), 'MMM d, yyyy')}</span>
                      </div>
                    </Card.Body>
                  </Card>
                </button>
              );
            })}
          </div>
          {assessments.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                page={assessments.page}
                totalPages={assessments.totalPages}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}

      <Modal
        open={showModal}
        onClose={() => { if (!generate.isPending) setShowModal(false); }}
        title="Generate New Assessment"
        size="md"
      >
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Questions:{' '}
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{questionCount}</span>
            </label>
            <input
              type="range"
              min={5}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-1">
              <span>5</span>
              <span>20</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={15}
              max={120}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.min(120, Math.max(15, Number(e.target.value))))}
              className="block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Skills</p>
            {!skills || skills.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No skills added yet.{' '}
                <a href="/student/skills" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
                  Add skills first
                </a>
                .
              </p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {skills.map((ss) => (
                  <label
                    key={ss.skill.id}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.includes(ss.skill.id)}
                      onChange={() => toggleSkill(ss.skill.id)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                      {ss.skill.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800">
            <FiInfo className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
              {/* The model comes from the backend's GEMINI_MODEL, so naming a
                  version here would go stale the moment it is changed. The
                  assessment itself records which model generated it. */}
              AI will generate questions based on your selected skills. This takes ~10 seconds.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(false)}
            disabled={generate.isPending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generate.isPending || selectedSkillIds.length === 0}
            loading={generate.isPending}
          >
            {generate.isPending ? 'Generating with AI...' : 'Generate'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
