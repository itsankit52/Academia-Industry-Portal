import { useEffect, useId, useRef, type ReactNode } from 'react';
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
  /** Clicking/tapping the backdrop closes the dialog. Default true. */
  closeOnBackdrop?: boolean;
  /** Pressing Escape closes the dialog. Default true. */
  closeOnEscape?: boolean;
  /** Accessible name of the × button. Default "Close dialog". */
  closeLabel?: string;
  /** Disables the × button (e.g. while a request is in flight). */
  closeDisabled?: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tabbable elements inside `root`, in DOM order, skipping hidden/inert ones. */
function tabbables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.closest('[inert], fieldset[disabled]') &&
      !el.hidden &&
      getComputedStyle(el).visibility !== 'hidden' &&
      getComputedStyle(el).display !== 'none',
  );
}

/** Only the most recently opened dialog handles keys (ConfirmDialog can stack on a Modal). */
function isTopmost(container: HTMLElement | null): boolean {
  const open = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return !!container && open[open.length - 1] === container;
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
  closeOnBackdrop = true,
  closeOnEscape = true,
  closeLabel = 'Close dialog',
  closeDisabled = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus moves into the dialog on open and returns to whatever opened it
  // (the trigger) on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      if (prev && document.contains(prev)) prev.focus();
    };
  }, [open]);

  // Focus trap: Tab / Shift+Tab cycle within the panel, and focus that lands
  // outside it (e.g. programmatically) is pulled back in.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel || !isTopmost(containerRef.current)) return;
      const items = tabbables(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (e.shiftKey && (!inside || active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const panel = panelRef.current;
      if (!panel || !isTopmost(containerRef.current)) return;
      if (e.target instanceof Node && !panel.contains(e.target)) panel.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost(containerRef.current)) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, closeOnEscape]);

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
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop — no backdrop-blur so it doesn't create a GPU compositing
          layer that can swallow pointer events on the panel above it.
          pointer-events on the backdrop are intentional: they close the dialog
          on click unless `closeOnBackdrop` is false, and otherwise still stop
          clicks reaching the page underneath. */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70"
        onClick={closeOnBackdrop ? onClose : undefined}
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
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800"
              aria-label={closeLabel}
              title={closeLabel}
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
