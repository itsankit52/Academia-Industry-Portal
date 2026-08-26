import { Fragment, useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FiPlus, FiEdit2, FiArchive, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { toast } from 'sonner';
import {
  createAptitudeQuestionSchema,
  type CreateAptitudeQuestionInput,
} from '@aip/validation';
import { APTITUDE_CATEGORIES, type AptitudeCategory } from '@aip/config';
import type { AptitudeQuestion } from '@aip/types';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Filters from '@/components/ui/Filters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import Textarea from '@/components/ui/Textarea';
import { SkeletonTableRows } from '@/components/ui/Skeleton';
import { useAdminAptitudeQuestions } from '@/hooks/queries/useAdminAptitudeQuestions';
import { useCreateAptitudeQuestion } from '@/hooks/queries/useCreateAptitudeQuestion';
import {
  useUpdateAptitudeQuestion,
  type UpdateAptitudeQuestionPayload,
} from '@/hooks/queries/useUpdateAptitudeQuestion';
import { useArchiveAptitudeQuestion } from '@/hooks/queries/useArchiveAptitudeQuestion';

const categoryOptions = [
  { value: '', label: 'All categories' },
  ...APTITUDE_CATEGORIES.map((c) => ({ value: c, label: c })),
];
const difficultyOptions = [
  { value: '', label: 'All difficulties' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];
const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
];

type FormValues = CreateAptitudeQuestionInput;

interface QuestionFormModalProps {
  open: boolean;
  onClose: () => void;
  editTarget?: AptitudeQuestion;
}

function QuestionFormModal({ open, onClose, editTarget }: QuestionFormModalProps) {
  const create = useCreateAptitudeQuestion();
  const update = useUpdateAptitudeQuestion();
  const isEdit = Boolean(editTarget);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createAptitudeQuestionSchema),
    defaultValues: {
      category: 'QUANT',
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      difficulty: 'MEDIUM',
    },
  });

  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      reset({
        category: editTarget.category,
        question: editTarget.question,
        options: editTarget.options as [string, string, string, string],
        correctIndex: editTarget.correctIndex,
        ...(editTarget.explanation ? { explanation: editTarget.explanation } : {}),
        difficulty: editTarget.difficulty,
        ...(editTarget.tags.length > 0 ? { tags: editTarget.tags } : {}),
      });
    } else {
      reset({
        category: 'QUANT',
        question: '',
        options: ['', '', '', ''],
        correctIndex: 0,
        difficulty: 'MEDIUM',
      });
    }
  }, [open, editTarget?.id, reset]);

  const correctIndex = watch('correctIndex');

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    if (isEdit && editTarget) {
      const patch: UpdateAptitudeQuestionPayload = {
        category: data.category,
        question: data.question,
        options: data.options,
        correctIndex: data.correctIndex,
        difficulty: data.difficulty,
        ...(data.explanation !== undefined ? { explanation: data.explanation } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      };
      update.mutate(
        { id: editTarget.id, patch },
        {
          onSuccess: () => {
            toast.success('Question updated');
            onClose();
          },
          onError: (err) => toast.error(err.message || 'Failed to update'),
        },
      );
    } else {
      create.mutate(data, {
        onSuccess: () => {
          toast.success('Question created');
          onClose();
        },
        onError: (err) => toast.error(err.message || 'Failed to create'),
      });
    }
  };

  const isPending = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isPending) onClose();
      }}
      title={isEdit ? 'Edit Question' : 'Add Question'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Category"
            options={APTITUDE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            error={errors.category?.message}
            {...register('category')}
          />
          <Select
            label="Difficulty"
            options={[
              { value: 'EASY', label: 'Easy' },
              { value: 'MEDIUM', label: 'Medium' },
              { value: 'HARD', label: 'Hard' },
            ]}
            error={errors.difficulty?.message}
            {...register('difficulty')}
          />
        </div>

        <Textarea
          label="Question"
          rows={3}
          placeholder="Enter the question text (10-1000 chars)..."
          error={errors.question?.message}
          {...register('question')}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Options</p>
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="radio"
                name="correctIndex"
                checked={Number(correctIndex) === idx}
                onChange={() =>
                  setValue('correctIndex', idx as 0 | 1 | 2 | 3, { shouldValidate: true })
                }
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                aria-label={`Mark option ${idx + 1} as correct`}
              />
              <div className="flex-1">
                <Input
                  placeholder={`Option ${idx + 1}`}
                  error={errors.options?.[idx]?.message}
                  {...register(`options.${idx}` as const)}
                />
              </div>
            </div>
          ))}
          {errors.correctIndex && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {errors.correctIndex.message}
            </p>
          )}
        </div>

        <Textarea
          label="Explanation (optional)"
          rows={2}
          placeholder="Shown to students after submission..."
          error={errors.explanation?.message}
          {...register('explanation')}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={isPending}>
            {isEdit ? 'Save Changes' : 'Create Question'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminAptitudeQuestions() {
  const [category, setCategory] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AptitudeQuestion | undefined>();
  const [archiveTarget, setArchiveTarget] = useState<AptitudeQuestion | null>(null);

  const filters = {
    page,
    pageSize: 20,
    ...(category ? { category: category as AptitudeCategory } : {}),
    ...(difficulty ? { difficulty: difficulty as 'EASY' | 'MEDIUM' | 'HARD' } : {}),
    ...(status ? { status: status as 'ACTIVE' | 'ARCHIVED' } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, isError, refetch } = useAdminAptitudeQuestions(filters);
  const archive = useArchiveAptitudeQuestion();

  if (isError) return <ErrorState onRetry={refetch} />;

  function openCreate() {
    setEditTarget(undefined);
    setModalOpen(true);
  }

  function openEdit(q: AptitudeQuestion) {
    setEditTarget(q);
    setModalOpen(true);
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    archive.mutate(archiveTarget.id, {
      onSuccess: () => {
        toast.success('Question archived');
        setArchiveTarget(null);
      },
      onError: (err) => toast.error(err.message || 'Failed to archive'),
    });
  }

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Aptitude Bank"
          subtitle={`${data?.total ?? 0} question${data?.total === 1 ? '' : 's'} across categories.`}
        />
        <Button size="sm" onClick={openCreate} iconLeft={<FiPlus className="w-4 h-4" />}>
          Add Question
        </Button>
      </div>

      <Filters>
        <Input
          label="Search"
          placeholder="Search question text..."
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <Select
          label="Category"
          options={categoryOptions}
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
        />
        <Select
          label="Difficulty"
          options={difficultyOptions}
          value={difficulty}
          onChange={(e) => {
            setPage(1);
            setDifficulty(e.target.value);
          }}
        />
        <Select
          label="Status"
          options={statusOptions}
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        />
      </Filters>

      <Table>
        <Table.Head>
          <tr>
            <Table.Th className="w-8">{null}</Table.Th>
            <Table.Th>Question</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Difficulty</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th className="text-right">Actions</Table.Th>
          </tr>
        </Table.Head>
        <Table.Body>
          {isLoading ? (
            <SkeletonTableRows rows={6} cols={6} />
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={6}>
                <EmptyState
                  title="No questions match your filters"
                  description="Try adjusting filters or add a new question."
                />
              </td>
            </tr>
          ) : (
            items.map((q) => {
              const isOpen = expanded[q.id] ?? false;
              return (
                <Fragment key={q.id}>
                  <tr>
                    <Table.Td>
                      <button
                        onClick={() => toggleExpanded(q.id)}
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      >
                        {isOpen ? <FiChevronDown /> : <FiChevronRight />}
                      </button>
                    </Table.Td>
                    <Table.Td>
                      <span className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2">
                        {q.question}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="info">{q.category}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant={
                          q.difficulty === 'HARD'
                            ? 'danger'
                            : q.difficulty === 'EASY'
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {q.difficulty}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant={q.status === 'ACTIVE' ? 'success' : 'default'}>
                        {q.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(q)}
                          iconLeft={<FiEdit2 className="w-3.5 h-3.5" />}
                        >
                          Edit
                        </Button>
                        {q.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setArchiveTarget(q)}
                            iconLeft={<FiArchive className="w-3.5 h-3.5" />}
                          >
                            Archive
                          </Button>
                        )}
                      </div>
                    </Table.Td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6}>
                        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-lg space-y-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                              Options
                            </p>
                            <ul className="space-y-1">
                              {q.options.map((opt, idx) => (
                                <li
                                  key={idx}
                                  className={`text-sm px-2 py-1 rounded ${
                                    idx === q.correctIndex
                                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-medium'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {String.fromCharCode(65 + idx)}. {opt}
                                  {idx === q.correctIndex && (
                                    <span className="ml-2 text-xs">(correct)</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {q.explanation && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
                                Explanation
                              </p>
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {q.explanation}
                              </p>
                            </div>
                          )}
                          {q.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {q.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </Table.Body>
      </Table>

      {totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <QuestionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editTarget={editTarget}
      />

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive question?"
        description="Archived questions won't be shown to students. You can still edit them later."
        confirmLabel="Archive"
        variant="danger"
        loading={archive.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
