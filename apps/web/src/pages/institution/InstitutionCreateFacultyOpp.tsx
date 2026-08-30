import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import FacultyOpportunityForm from '@/components/features/FacultyOpportunityForm';
import type { UpdateFacultyOpportunityInput } from '@aip/validation';
import { useCreateFacultyOpportunity } from '@/hooks/queries/useFacultyOpportunities';

export default function InstitutionCreateFacultyOpp() {
  const navigate = useNavigate();
  const create = useCreateFacultyOpportunity();

  function handleSubmit(data: UpdateFacultyOpportunityInput) {
    create.mutate(data, {
      onSuccess: () => navigate('/institution/faculty-opportunities'),
      onError: (err: Error) => toast.error(err.message),
    });
  }

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Post Faculty Opportunity"
        subtitle="Create a new faculty-facing program at your institution."
      />
      <FacultyOpportunityForm
        onSubmit={handleSubmit}
        onCancel={() => navigate('/institution/faculty-opportunities')}
        submitLabel="Publish"
        isLoading={create.isPending}
        allowDraft
      />
    </div>
  );
}
