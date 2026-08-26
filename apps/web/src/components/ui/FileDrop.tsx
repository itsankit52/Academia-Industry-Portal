import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { FiUpload, FiFile, FiX } from 'react-icons/fi';
import { cn } from '@/lib/cn';

interface FileDropProps {
  label?: string;
  accept?: string;
  onChange?: (file: File | null) => void;
  error?: string;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDrop({ label, accept, onChange, error }: FileDropProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    onChange?.(f);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  }

  function clear() {
    setFile(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="w-full">
      {label && <p className="text-sm font-medium text-slate-700 mb-1.5 dark:text-slate-300">{label}</p>}
      {file ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <FiFile className="w-5 h-5 text-indigo-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate dark:text-slate-200">{file.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="p-1 rounded text-slate-400 hover:text-rose-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-500 dark:hover:text-rose-400"
            aria-label="Remove file"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
            dragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-indigo-700 dark:hover:bg-slate-800/50',
            error && 'border-rose-400 dark:border-rose-700',
          )}
        >
          <FiUpload className="w-6 h-6 text-slate-400 dark:text-slate-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Click to upload</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">or drag and drop</p>
          </div>
          {accept && <p className="text-xs text-slate-400 dark:text-slate-500">{accept.toUpperCase().replace(/\./g, '').replace(/,/g, ', ')}</p>}
        </div>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="sr-only" aria-label={label ?? 'File upload'} />
      {error && <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400" role="alert">{error}</p>}
    </div>
  );
}

export { FileDrop };
