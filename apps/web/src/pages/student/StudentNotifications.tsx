import { FiBell } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import NotificationItem from '@/components/cards/NotificationItem';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { useNotifications } from '@/hooks/queries/useNotifications';
import { useMarkNotificationRead } from '@/hooks/queries/useMarkNotificationRead';
import { useMarkAllNotificationsRead } from '@/hooks/queries/useMarkAllNotificationsRead';

export default function StudentNotifications() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const notifications = data?.items ?? [];
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="container-page py-8 space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with your latest alerts."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              size="sm"
              loading={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      {isError && <ErrorState onRetry={() => void refetch()} />}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} className="h-16" />)}
        </div>
      )}

      {notifications && notifications.length === 0 && (
        <EmptyState
          icon={<FiBell />}
          title="No notifications"
          description="You're all caught up! Notifications will appear here."
        />
      )}

      {notifications && notifications.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                if (!notification.readAt) {
                  markRead.mutate(notification.id);
                }
              }}
              className="cursor-pointer"
            >
              <NotificationItem notification={notification} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
