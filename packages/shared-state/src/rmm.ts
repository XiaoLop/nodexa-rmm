import type { MeshCentralClient, RmmResource } from '@meshcentral/control-client';
import { useEffect, useState } from 'react';

export function useRmmQuery<T>(
  client: MeshCentralClient | undefined,
  connected: boolean,
  query: (resource: RmmResource) => Promise<T>,
  shouldPoll?: (result: T) => boolean,
  revision = 0,
) {
  const [result, setResult] = useState<T>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    setResult(undefined);
    setError(undefined);
    if (!client || !connected) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const data = await query(client.rmm);
        if (cancelled) return;
        setResult(data);
        setError(undefined);
        if (shouldPoll?.(data)) timer = setTimeout(() => void load(), 3000);
      } catch (error) {
        if (cancelled) return;
        setResult(undefined);
        setError(error instanceof Error ? error.message : 'REQUEST_FAILED');
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [client, connected, query, revision, shouldPoll]);
  return { result, error };
}
