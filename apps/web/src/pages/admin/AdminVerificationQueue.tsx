import VerificationQueuePanel from '@/components/features/VerificationQueuePanel';

export default function AdminVerificationQueue() {
  return (
    <VerificationQueuePanel
      scope="admin"
      title="Verification Queue"
      subtitle="Review pending documents across all users."
    />
  );
}
