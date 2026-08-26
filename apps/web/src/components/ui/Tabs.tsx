import { type ReactNode, createContext, useContext } from 'react';
import { cn } from '@/lib/cn';

interface TabsContextValue {
  value: string;
  onChange: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue>({ value: '', onChange: () => {} });

interface TabsProps {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}

function Tabs({ value, onChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  className?: string;
}

function TabList({ children, className }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn('flex border-b border-slate-200 gap-1 dark:border-slate-800', className)}
    >
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  label: string;
}

function Tab({ value, label }: TabProps) {
  const ctx = useContext(TabsContext);
  const isActive = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onChange(value)}
      className={cn(
        'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        isActive
          ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600',
      )}
    >
      {label}
    </button>
  );
}

interface TabPanelsProps {
  children: ReactNode;
  className?: string;
}

function TabPanels({ children, className }: TabPanelsProps) {
  return <div className={className}>{children}</div>;
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
  className?: string;
}

function TabPanel({ value, children, className }: TabPanelProps) {
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}

Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;

export { Tabs, TabList, Tab, TabPanels, TabPanel };
export default Tabs;
