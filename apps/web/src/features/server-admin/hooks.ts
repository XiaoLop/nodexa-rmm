import { useCallback, useEffect, useRef, useState } from 'react';
import { useMeshCentralControl } from '../gateway';
import { boundedAppend } from './model';

export function useServerConnection() {
  const { client } = useMeshCentralControl();
  const [status, setStatus] = useState(client?.connectionStatus);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    setStatus(client?.connectionStatus);
    return client?.on('connection', event => {
      setStatus(event.current);
      setGeneration(value => value + 1);
    });
  }, [client]);
  return { client, connected: !!client && status === 'connected', generation };
}

export function useServerTrace() {
  const connection = useServerConnection();
  const { client, connected, generation } = connection;
  type Packet = Parameters<Parameters<NonNullable<typeof client>['server']['subscribeTrace']>[0]>[0];
  const [sources, setSources] = useState<readonly string[] | undefined>();
  const [records, setRecords] = useState<Packet[]>([]);
  const [paused, setPaused] = useState(false);
  const localEpoch = useRef(0);
  const clearRecords = useCallback(() => {
    localEpoch.current++;
    setRecords([]);
  }, []);
  useEffect(() => {
    setSources(client?.server.getTraceSources());
    if (!client) return;
    return client.server.subscribeTraceSources(next => setSources([...next]));
  }, [client, connected, generation]);
  useEffect(() => {
    if (!client || !connected) return;
    let pending: Packet[] = [];
    let batchEpoch = localEpoch.current;
    const syncLocalClear = () => {
      if (batchEpoch !== localEpoch.current) { pending = []; batchEpoch = localEpoch.current; }
    };
    const unsubscribe = client.server.subscribeTrace(packet => {
      syncLocalClear();
      pending = boundedAppend(pending, [packet]);
    });
    const timer = setInterval(() => {
      syncLocalClear();
      if (!pending.length) return;
      const batch = pending;
      pending = [];
      setRecords(previous => boundedAppend(previous, batch));
    }, 100);
    return () => { clearInterval(timer); unsubscribe(); };
  }, [client, connected, generation]);
  return { ...connection, sources, records, paused, setPaused, clearRecords };
}

export function useServerErrorLog() {
  const connection = useServerConnection();
  const { client, connected, generation } = connection;
  const [content, setContent] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [clearSent, setClearSent] = useState(false);
  const epoch = useRef(0);
  const operation = useRef(false);
  const refresh = useCallback(async () => {
    if (!client || client.connectionStatus !== 'connected' || operation.current) return;
    const current = epoch.current;
    operation.current = true;
    setBusy(true);
    setError(false);
    try {
      const result = await client.server.fetchErrorLog();
      if (current === epoch.current) setContent(result.content);
    } catch { if (current === epoch.current) setError(true); }
    finally { if (current === epoch.current) { operation.current = false; setBusy(false); } }
  }, [client]);
  useEffect(() => {
    epoch.current++;
    operation.current = false;
    setBusy(false);
    setContent(undefined);
    setClearSent(false);
    if (connected) void refresh();
    return () => { epoch.current++; };
  }, [connected, client, generation, refresh]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), [client, connected, generation]);
  const clear = async () => {
    if (!client || client.connectionStatus !== 'connected' || operation.current) return;
    const current = epoch.current;
    operation.current = true;
    setBusy(true);
    setError(false);
    try {
      await client.server.clearErrorLog();
      if (current !== epoch.current) return;
      setClearSent(true);
      setContent(undefined);
      // A sent-only acknowledgement is not deletion success. Read once, never retry deletion.
      timer.current = setTimeout(() => { void refresh(); }, 1000);
    } catch { if (current === epoch.current) setError(true); }
    finally { if (current === epoch.current) { operation.current = false; setBusy(false); } }
  };
  return { ...connection, content, busy, error, clearSent, refresh, clear };
}
