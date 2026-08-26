import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function InstitutionDashboardStub() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      <PageHeader title="Institution Portal" subtitle="Manage faculty, students and collaboration events." />
      <EmptyState
        title="Coming in Wave D"
        description="Institution-level dashboards, analytics, and management tools will be delivered in a later wave."
      />
    </div>
  );
}
