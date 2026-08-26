export default function PageSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        <p className="text-sm text-slate-500 font-medium dark:text-slate-400">Loading…</p>
      </div>
    </div>
  );
}

export { PageSkeleton };
