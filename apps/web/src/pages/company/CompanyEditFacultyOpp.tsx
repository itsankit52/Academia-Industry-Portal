import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import FacultyOpportunityForm from '@/components/features/FacultyOpportunityForm';
import type { CreateFacultyOpportunityInput, UpdateFacultyOpportunityInput } from '@aip/validation';
import {
  useFacultyOpportunity,
  useUpdateFacultyOpportunity,
} from '@/hooks/queries/useFacultyOpportunities';

export default function CompanyEditFacultyOpp() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: opp, isLoading, isError, refetch } = useFacultyOpportunity(id ?? '');
  const update = useUpdateFacultyOpportunity(id ?? '');

  function handleSubmit(
    data: CreateFacultyOpportunityInput | UpdateFacultyOpportunityInput,
    status: 'DRAFT' | 'PUBLISHED' = 'PUBLISHED',
  ) {
    // When saving as draft from the edit page, include status so the backend
    // actually flips the record back to DRAFT. Omitting it preserves the
    // existing status (e.g. CLOSED stays CLOSED).
    const payload: UpdateFacultyOpportunityInput = {
      ...data,
      ...(status === 'DRAFT' ? { status } : {}),
    };
    update.mutate(payload, {
      onSuccess: () => navigate('/company/faculty-opportunities'),
      onError: (err: Error) => toast.error(err.message),
    });
  }

  if (isLoading) {
    return (
      <div className="container-page py-8 space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (isError || !opp) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader title="Edit Faculty Opportunity" subtitle={opp.title} />
      <FacultyOpportunityForm
        initialValues={opp}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/company/faculty-opportunities')}
        submitLabel="Save Changes"
        isLoading={update.isPending}
      />
    </div>
  );
}
