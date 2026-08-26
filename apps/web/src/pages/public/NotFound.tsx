import { Link } from 'react-router-dom';
import { FiCompass } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-6">
          <FiCompass className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
        </div>
        <h1 className="text-5xl font-bold text-slate-900 dark:text-slate-100 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-3">Page not found</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium no-underline"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
