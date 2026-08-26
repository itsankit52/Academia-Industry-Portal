import type { Notification } from '@aip/types';
import { Link } from 'react-router-dom';
import { FiBell } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/cn';

interface Props {
  notification: Notification;
}

export default function NotificationItem({ notification }: Props) {
  const isUnread = !notification.readAt;

  const inner = (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 rounded-lg transition-colors',
        isUnread
          ? 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-950'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800',
      )}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
          isUnread
            ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
        )}
      >
        <FiBell className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug truncate', isUnread ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300')}>
          {notification.title}
        </p>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 dark:text-slate-400">{notification.body}</p>
        <p className="text-xs text-slate-400 mt-1 dark:text-slate-500">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
      {isUnread && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1.5" aria-label="Unread" />}
    </div>
  );

  if (notification.link) {
    return (
      <Link to={notification.link} className="block no-underline">
        {inner}
      </Link>
    );
  }

  return inner;
}
