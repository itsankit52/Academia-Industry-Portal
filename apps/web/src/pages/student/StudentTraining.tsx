import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiBookOpen, FiStar } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import TrainingCard from '@/components/cards/TrainingCard';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import Pagination from '@/components/ui/Pagination';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useTrainings } from '@/hooks/queries/useTrainings';
import { useRecommendedTrainings } from '@/hooks/queries/useRecommendedTrainings';
import { useSkillsCatalog } from '@/hooks/queries/useSkillsCatalog';
import { useEnrollInTraining } from '@/hooks/queries/useTrainingEnrollment';
import { useMyEnrollments } from '@/hooks/queries/useTrainingEnrollment';

export default function StudentTraining() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(() =>
    searchParams.getAll('skill').filter(Boolean),
  );

  const { data: catalogData } = useSkillsCatalog();
  const catalog = catalogData?.items ?? [];
  const recommended = useRecommendedTrainings();
  const recommendedItems = recommended.data?.items ?? [];
  const { data, isLoading, isError, refetch } = useTrainings({ skills: selectedSkills, page });

  const enrollmentsQ = useMyEnrollments({ pageSize: 100 });
  const enrollMut = useEnrollInTraining();

  const enrolledTrainingIds = new Set(
    (enrollmentsQ.data?.items ?? []).map((e) => e.training),
  );

  function toggleSkill(skillId: string) {
    setSelectedSkills((prev) =>
      prev.includes(skillId) ? prev.filter((s) => s !== skillId) : [...prev, skillId],
    );
    setPage(1);
  }

  function handleEnroll(trainingId: string) {
    enrollMut.mutate(trainingId);
  }

  return (
    <div className="container-page py-8 space-y-8">
      <PageHeader title="Training Programmes" subtitle="Enrol in programmes to upskill and close your gaps." />

      {recommendedItems.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <FiStar className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Recommended for You</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedItems.map((item) => (
              <TrainingCard
                key={item.training.id}
                training={item.training}
                onEnroll={handleEnroll}
                isEnrolling={enrollMut.isPending && enrollMut.variables === item.training.id}
                isEnrolled={enrolledTrainingIds.has(item.training.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <FiBookOpen className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">All Programmes</h2>
        </div>

        {catalog.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {catalog.map((skill) => (
              <button
                key={skill.id}
                onClick={() => toggleSkill(skill.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedSkills.includes(skill.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {skill.name}
              </button>
            ))}
            {selectedSkills.length > 0 && (
              <button
                onClick={() => setSelectedSkills([])}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {isError && <ErrorState onRetry={() => void refetch()} />}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {data && data.items.length === 0 && !isLoading && (
          <EmptyState
            icon={<FiBookOpen />}
            title="No training programmes found"
            description="Try clearing your skill filters or check back later."
          />
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {data.items.map((training) => (
                <TrainingCard
                  key={training.id}
                  training={training}
                  onEnroll={handleEnroll}
                  isEnrolling={enrollMut.isPending && enrollMut.variables === training.id}
                  isEnrolled={enrolledTrainingIds.has(training.id)}
                />
              ))}
            </div>
            <div className="flex justify-center">
              <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
