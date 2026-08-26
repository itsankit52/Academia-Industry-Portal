import { useState } from 'react';
import { FiCode } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import SkillChip from '@/components/ui/SkillChip';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import AddSkillForm from '@/components/features/AddSkillForm';
import { useStudentSkills } from '@/hooks/queries/useStudentSkills';
import { useDeleteStudentSkill } from '@/hooks/queries/useDeleteStudentSkill';

export default function StudentSkills() {
  const { data: skills, isLoading, isError, refetch } = useStudentSkills();
  const deleteSkill = useDeleteStudentSkill();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Skills" subtitle="Manage your skills and proficiency levels." />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">My Skills</h2>
          </Card.Header>
          <Card.Body>
            {isError && <ErrorState onRetry={() => void refetch()} />}
            {isLoading && <SkeletonCard />}
            {skills && skills.length === 0 && (
              <EmptyState
                icon={<FiCode />}
                title="No skills added yet"
                description="Add your first skill using the form on the right."
              />
            )}
            {skills && skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <div key={s.id} className="flex items-center gap-1 group">
                    <SkillChip name={s.skill.name} proficiency={s.proficiency} />
                    <button
                      onClick={() => setDeleteId(s.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500 text-xs ml-1"
                      aria-label={`Remove ${s.skill.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Add Skill</h2>
          </Card.Header>
          <Card.Body>
            <AddSkillForm />
          </Card.Body>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        title="Remove Skill"
        description="Are you sure you want to remove this skill from your profile?"
        confirmLabel="Remove"
        variant="danger"
        loading={deleteSkill.isPending}
        onConfirm={() => {
          if (deleteId) {
            deleteSkill.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
