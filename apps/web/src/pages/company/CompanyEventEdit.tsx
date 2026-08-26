import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EventForm, { type EventFormValues } from '@/components/forms/EventForm';
import { useEvent, useUpdateEvent } from '@/hooks/queries/useEvents';

interface CompanyEventEditProps {
  basePath?: string;
}

export default function CompanyEventEdit({ basePath = '/company/events' }: CompanyEventEditProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventQ = useEvent(id ?? '');
  const updateMut = useUpdateEvent();

  if (eventQ.isLoading) {
    return <div className="container-page py-8"><SkeletonCard /></div>;
  }
  if (eventQ.isError || !eventQ.data) {
    return (
      <div className="container-page py-8">
        <ErrorState onRetry={() => void eventQ.refetch()} />
      </div>
    );
  }

  const ev = eventQ.data;

  const submit = (values: EventFormValues) => {
    updateMut.mutate(
      {
        id: ev.id,
        title: values.title,
        description: values.description,
        eventType: values.eventType,
        startAt: values.startAt,
        mode: values.mode,
        ...(values.endAt ? { endAt: values.endAt } : {}),
        ...(values.location ? { location: values.location } : {}),
        ...(values.meetingLink ? { meetingLink: values.meetingLink } : {}),
        ...(typeof values.capacity === 'number' && !Number.isNaN(values.capacity) ? { capacity: values.capacity } : {}),
        ...(values.registrationDeadline ? { registrationDeadline: values.registrationDeadline } : {}),
        targetAudience: values.targetAudience ?? [],
        tags: (values.tags as unknown as string[]) ?? [],
      },
      { onSuccess: () => navigate(`${basePath}/${ev.id}`) },
    );
  };

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Edit Event"
        actions={
          <Button variant="outline" size="sm" iconLeft={<FiArrowLeft className="w-4 h-4" />} onClick={() => navigate(`${basePath}/${ev.id}`)}>
            Back
          </Button>
        }
      />
      <Card>
        <Card.Body>
          <EventForm
            defaultValues={{
              title: ev.title,
              description: ev.description,
              eventType: ev.eventType,
              startAt: ev.startAt,
              endAt: ev.endAt,
              location: ev.location,
              mode: ev.mode,
              meetingLink: ev.meetingLink,
              capacity: ev.capacity,
              registrationDeadline: ev.registrationDeadline,
              targetAudience: ev.targetAudience,
              tags: ev.tags.join(', ') as unknown as string,
            }}
            submitLabel="Save Changes"
            submitting={updateMut.isPending}
            onSubmit={submit}
            onCancel={() => navigate(`${basePath}/${ev.id}`)}
          />
        </Card.Body>
      </Card>
    </div>
  );
}
