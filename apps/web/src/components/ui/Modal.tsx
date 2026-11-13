import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  children,
  className,
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      prev?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop — no backdrop-blur so it doesn't create a GPU compositing
          layer that can swallow pointer events on the panel above it.
          pointer-events on the backdrop are intentional (closes on click). */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          // relative + z-10 ensures the panel sits above the absolute backdrop
          // in the same stacking context regardless of paint order.
          'relative z-10 w-full bg-white rounded-xl shadow-lg focus:outline-none dark:bg-slate-900 dark:border dark:border-slate-800',
          sizeClasses[size],
          className,
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Close dialog"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export { Modal };
