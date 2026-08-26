import { FiBell } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import NotificationItem from '@/components/cards/NotificationItem';
import { useCompanyNotifications, useMarkAllNotificationsRead } from '@/hooks/queries/useCompanyNotifications';

export default function CompanyNotifications() {
  const { data, isLoading, isError, refetch } = useCompanyNotifications();
  const notifications = data?.items ?? [];
  const markAllRead = useMarkAllNotificationsRead();
  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up.'}
        actions={
          unreadCount > 0 ? (
            <Button size="sm" variant="outline" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} className="h-16" />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={<FiBell />} title="No notifications yet" description="You'll see hiring updates and alerts here." />
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
