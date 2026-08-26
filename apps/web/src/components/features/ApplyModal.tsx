import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useApplyToOpportunity } from '@/hooks/queries/useApplyToOpportunity';
import type { OpportunityType } from '@aip/config';

interface Props {
  open: boolean;
  onClose: () => void;
  opportunityType: OpportunityType;
  opportunityId: string;
  opportunityTitle: string;
}

export default function ApplyModal({
  open,
  onClose,
  opportunityType,
  opportunityId,
  opportunityTitle,
}: Props) {
  const [coverLetter, setCoverLetter] = useState('');
  const apply = useApplyToOpportunity();

  function handleSubmit() {
    // Only the fields `createApplicationSchema` accepts may be sent — it is
    // `.strict()`, so an unknown key fails the whole request. Omitting
    // `resumeId` makes the API attach the latest resume on file.
    apply.mutate(
      {
        opportunityType,
        opportunityId,
        coverLetter: coverLetter.trim() || undefined,
      },
      {
        onSuccess: () => {
          setCoverLetter('');
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Apply — ${opportunityTitle}`} size="md">
      <div className="px-6 py-5 space-y-4">
        <Textarea
          label="Cover Letter"
          placeholder="Tell the company why you're a great fit…"
          rows={6}
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
        />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your most recent resume on file will be attached automatically. Upload a new one from
          your profile first if you want to send a different version.
        </p>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800">
        <Button variant="outline" size="sm" onClick={onClose} disabled={apply.isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} loading={apply.isPending}>
          Submit Application
        </Button>
      </div>
    </Modal>
  );
}
