import VerificationQueuePanel from '@/components/features/VerificationQueuePanel';

export default function CompanyVerifications() {
  return (
    <VerificationQueuePanel
      scope="company"
      title="Applicant Certificate Verification"
      subtitle="Verify certificates submitted by candidates who applied to your postings."
    />
  );
}
