import { useEffect } from 'react';
import { useAuth } from './useAuth';

export function useHydrateAuth() {
  const { hydrate } = useAuth();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
