import { useState } from 'react';
import { FiCode, FiPlus, FiExternalLink, FiTrash2, FiEdit2 } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useStudentProjects } from '@/hooks/queries/useStudentProjects';
import { useDeleteStudentProject } from '@/hooks/queries/useDeleteStudentProject';
import ProjectForm from '@/components/features/ProjectForm';
import type { StudentProject } from '@/hooks/queries/useStudentProjects';

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: StudentProject;
  onEdit: (p: StudentProject) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <Card.Header className="flex flex-row items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
          {project.title}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(project)}
            className="p-1.5 rounded text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
            aria-label={`Edit ${project.title}`}
          >
            <FiEdit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(project._id)}
            className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
            aria-label={`Delete ${project.title}`}
          >
            <FiTrash2 className="w-4 h-4" />
          </button>
        </div>
      </Card.Header>
      <Card.Body className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
          {project.description}
        </p>

        {project.role && (
          <div className="text-xs text-slate-500 dark:text-slate-500">
            <span className="font-medium">Role:</span> {project.role}
          </div>
        )}

        {project.technologies && project.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {project.technologies.map((t) => (
              <span
                key={t}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {project.links && project.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 no-underline"
              >
                <FiExternalLink className="w-3 h-3" />
                {l.label || l.url}
              </a>
            ))}
          </div>
        )}

        {project.completedAt && (
          <div className="text-xs text-slate-400 dark:text-slate-500">
            Completed: {new Date(project.completedAt).toLocaleDateString()}
          </div>
        )}

        <div className="text-xs text-slate-400 dark:text-slate-500">
          {project.isPublic ? '🌐 Public' : '🔒 Private'}
        </div>
      </Card.Body>
    </Card>
  );
}

export default function StudentProjects() {
  const { data: projects, isLoading, isError, refetch } = useStudentProjects();
  const deleteProject = useDeleteStudentProject();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<StudentProject | null>(null);

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Showcase your portfolio projects to companies and institutions."
        actions={
          <Button
            onClick={() => {
              setEditProject(null);
              setShowForm(true);
            }}
          >
            <FiPlus className="w-4 h-4 mr-1" />
            Add Project
          </Button>
        }
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}
      {isLoading && <SkeletonCard />}

      {projects && projects.length === 0 && !showForm && (
        <EmptyState
          icon={<FiCode />}
          title="No projects yet"
          description="Add your first portfolio project to showcase your work."
          action={{
            label: 'Add Project',
            onClick: () => {
              setEditProject(null);
              setShowForm(true);
            },
          }}
        />
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p._id}
              project={p}
              onEdit={(proj) => {
                setEditProject(proj);
                setShowForm(true);
              }}
              onDelete={setDeleteId}
            />
          ))}
        </div>
      )}

      {showForm && (
        <Card>
          <Card.Header>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              {editProject ? 'Edit Project' : 'Add Project'}
            </h2>
          </Card.Header>
          <Card.Body>
            <ProjectForm
              project={editProject}
              onClose={() => {
                setShowForm(false);
                setEditProject(null);
              }}
            />
          </Card.Body>
        </Card>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete Project"
        description="Are you sure you want to permanently delete this project?"
        confirmLabel="Delete"
        variant="danger"
        loading={deleteProject.isPending}
        onConfirm={() => {
          if (deleteId) {
            deleteProject.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
          }
        }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
