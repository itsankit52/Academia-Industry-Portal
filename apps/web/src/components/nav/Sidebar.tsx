import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';
import type { NavItem } from './StudentNavItems';

interface Props {
  items: NavItem[];
  header: string;
  /** Mobile drawer mode: the drawer is open (drawer only shown on mobile). */
  isOpen?: boolean;
  /** Mobile drawer mode: called when the user wants to close the drawer. */
  onClose?: () => void;
  /** Mobile drawer mode: ref forwarded from the layout for focus management. */
  drawerRef?: React.RefObject<HTMLElement>;
}

/**
 * Responsive sidebar:
 * - Desktop (lg+): static, always visible, collapsible/expandable via chevron button.
 * - Mobile (<lg): fixed drawer that slides in, overlay backdrop, close button.
 *   Pass `isOpen`, `onClose`, and `drawerRef` from `useSidebarDrawer` to enable.
 */
export default function Sidebar({ items, header, isOpen = false, onClose, drawerRef }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  // When a nav link is clicked, close the drawer on mobile.
  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / Drawer */}
      <aside
        ref={drawerRef}
        tabIndex={isOpen ? 0 : -1}
        aria-label={`${header} navigation`}
        aria-hidden={!isOpen && drawerRef !== undefined}
        className={cn(
          // Mobile: fixed drawer, slides in from the left
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200 transition-transform duration-200 dark:bg-slate-900 dark:border-slate-800',
          'lg:static lg:inset-auto lg:z-auto lg:transform-none',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Always render as a flex container — on mobile it's translated off-screen
          // and shown when the drawer is opened; on desktop (lg+) it stays in flow.
          'flex',
          collapsed ? 'lg:w-16' : 'lg:w-64',
        )}
      >
        {/* Mobile header bar */}
        <div
          className={cn(
            'flex items-center h-16 border-b border-slate-200 px-4 dark:border-slate-800',
            'lg:justify-between lg:px-4',
            collapsed ? 'justify-center lg:justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <span className="text-sm font-semibold text-slate-800 truncate dark:text-slate-200">
              {header}
            </span>
          )}

          {/* Desktop collapse/expand button */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              'p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800',
              collapsed && 'lg:mx-auto',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <FiChevronRight className="w-4 h-4" />
            ) : (
              <FiChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile close button (only when used as a drawer) */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              aria-label="Close navigation"
            >
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation links */}
        <nav
          className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2"
          aria-label="Sidebar navigation"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline group',
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                    collapsed && 'lg:justify-center lg:px-2',
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
