import { cn } from '@/lib/cn';

interface LogoProps {
  className?: string;
  alt?: string;
}

export default function Logo({ className, alt = 'AIP Logo' }: LogoProps) {
  return <img src="/logo.png" alt={alt} className={cn('h-6 w-auto object-contain', className)} />;
}
