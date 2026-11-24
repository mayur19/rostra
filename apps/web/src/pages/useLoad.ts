import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

/** Loads data once (and on demand), exposing loading and user-friendly error state. */
export function useLoad<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(loader, deps);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await load());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong while loading.');
    }
  }, [load]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload, setData };
}
