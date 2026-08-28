import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EventForm, { type EventFormValues } from '@/components/forms/EventForm';
import { useCreateEvent, type CreateEventInput } from '@/hooks/queries/useEvents';

const BASE_PATH = '/faculty/events';

export default function FacultyEventCreate() {
  const navigate = useNavigate();
  const createMut = useCreateEvent();

  const submit = (values: EventFormValues) => {
    const payload: CreateEventInput = {
      title: values.title,
      description: values.description,
      eventType: values.eventType,
      startAt: values.startAt,
      mode: values.mode,
      ...(values.endAt ? { endAt: values.endAt } : {}),
      ...(values.location ? { location: values.location } : {}),
      ...(values.meetingLink ? { meetingLink: values.meetingLink } : {}),
      ...(typeof values.capacity === 'number' && !Number.isNaN(values.capacity)
        ? { capacity: values.capacity }
        : {}),
      ...(values.registrationDeadline ? { registrationDeadline: values.registrationDeadline } : {}),
      targetAudience: values.targetAudience ?? [],
      tags: (values.tags as unknown as string[]) ?? [],
    };
    createMut.mutate(payload, {
      onSuccess: (data) => navigate(`${BASE_PATH}/${data.id}`),
    });
  };

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="New Event"
        actions={
          <Button
            variant="outline"
            size="sm"
            iconLeft={<FiArrowLeft className="w-4 h-4" />}
            onClick={() => navigate(BASE_PATH)}
          >
            Back
          </Button>
        }
      />
      <Card>
        <Card.Body>
          <EventForm
            submitLabel="Create Event"
            submitting={createMut.isPending}
            onSubmit={submit}
            onCancel={() => navigate(BASE_PATH)}
          />
        </Card.Body>
      </Card>
    </div>
  );
}
