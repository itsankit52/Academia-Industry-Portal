import { cn } from '@/lib/cn';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-12 h-12 text-base',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
  const base = cn(
    'rounded-full object-cover flex items-center justify-center font-semibold shrink-0',
    sizeClasses[size],
    className,
  );

  if (src) {
    return <img src={src} alt={alt ?? name ?? 'Avatar'} className={base} />;
  }

  return (
    <div className={cn(base, 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300')} aria-label={name ?? 'Avatar'}>
      {name ? getInitials(name) : '?'}
    </div>
  );
}

export { Avatar };
