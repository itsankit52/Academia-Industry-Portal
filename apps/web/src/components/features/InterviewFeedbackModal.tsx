import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { useUpdateInterview } from '@/hooks/queries/useCompanyInterviews';
import type { Interview } from '@aip/types';

const feedbackSchema = z.object({
  feedback: z.string().min(1, 'Feedback is required').max(5000),
});

type FeedbackInput = z.infer<typeof feedbackSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  interview: Interview;
}

export default function InterviewFeedbackModal({ open, onClose, interview }: Props) {
  const updateInterview = useUpdateInterview();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { feedback: interview.feedback ?? '' },
  });

  function onSubmit(data: FeedbackInput) {
    updateInterview.mutate(
      { id: interview.id, data: { status: 'COMPLETED', feedback: data.feedback } },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark Completed & Add Feedback" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
        <div>
          <p className="text-sm text-slate-600 mb-3 dark:text-slate-400">
            Candidate: <span className="font-semibold text-slate-900 dark:text-slate-100">{interview.candidateName}</span>
          </p>
          <p className="text-sm text-slate-600 mb-4 dark:text-slate-400">
            Role: <span className="font-medium">{interview.opportunityTitle}</span>
          </p>
        </div>

        <Textarea
          label="Interview Feedback"
          rows={5}
          placeholder="Summarise the interview performance, strengths, and areas for improvement…"
          error={errors.feedback?.message}
          {...register('feedback')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={updateInterview.isPending}>
            Mark Completed
          </Button>
        </div>
      </form>
    </Modal>
  );
}
