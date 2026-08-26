import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useHydrateAuth } from './hooks/useHydrateAuth';

export default function App() {
  useHydrateAuth();
  return <RouterProvider router={router} />;
}
