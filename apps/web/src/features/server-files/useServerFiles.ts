import type {
  MeshCentralClient,
  ServerFileEntry,
  ServerFileSpace,
  ServerFileTree,
} from '@meshcentral/control-client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { findServerFileEntries, nearestExistingPath } from './serverFileViewModel';

interface UseServerFilesOptions {
  client?: MeshCentralClient;
  connected: boolean;
}

export function useServerFiles({ client, connected }: UseServerFilesOptions) {
  const [tree, setTree] = useState<ServerFileTree>();
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const currentSpace = useMemo<ServerFileSpace | undefined>(() => {
    const spaceId = currentPath[0] ?? tree?.spaces[0]?.id;
    return tree?.spaces.find((space) => space.id === spaceId) ?? tree?.spaces[0];
  }, [currentPath, tree]);
  const normalizedPath = useMemo(
    () => (currentSpace ? nearestExistingPath(currentSpace, currentPath) : []),
    [currentPath, currentSpace],
  );
  const entries = useMemo(
    () => findServerFileEntries(currentSpace, normalizedPath) ?? [],
    [currentSpace, normalizedPath],
  );
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedPaths.includes(entry.path.join('\u0000'))),
    [entries, selectedPaths],
  );
  const canTransferFiles = (names: readonly string[]) =>
    names.length > 0 &&
    names.every((name) =>
      entries.some((entry) => entry.name === name && entry.kind === 'file'),
    );

  const applyTree = useCallback((nextTree: ServerFileTree) => {
    setTree(nextTree);
    setCurrentPath((path) => {
      const space =
        nextTree.spaces.find((candidate) => candidate.id === path[0]) ?? nextTree.spaces[0];
      return space ? nearestExistingPath(space, path.length > 0 ? path : space.path) : [];
    });
    setSelectedPaths([]);
  }, []);

  const refresh = useCallback(async () => {
    if (!client || !connected) return;
    setLoading(true);
    setError(undefined);
    try {
      applyTree(await client.files.list());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    } finally {
      setLoading(false);
    }
  }, [applyTree, client, connected]);

  useEffect(() => {
    if (!client) return;
    return client.files.subscribe(applyTree);
  }, [applyTree, client]);

  useEffect(() => {
    if (connected) void refresh();
  }, [connected, refresh]);

  const runOperation = useCallback(
    async (operation: () => Promise<ServerFileTree>) => {
      setBusy(true);
      setError(undefined);
      try {
        applyTree(await operation());
        return true;
      } catch (operationError) {
        setError(operationError instanceof Error ? operationError.message : String(operationError));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [applyTree],
  );

  const openSpace = useCallback((spaceId: string) => {
    setCurrentPath([spaceId]);
    setSelectedPaths([]);
  }, []);
  const openDirectory = useCallback((entry: ServerFileEntry) => {
    if (entry.kind !== 'directory') return;
    setCurrentPath(entry.path);
    setSelectedPaths([]);
  }, []);
  const openPath = useCallback((path: readonly string[]) => {
    setCurrentPath([...path]);
    setSelectedPaths([]);
  }, []);
  const readFile = useCallback(
    (entry: ServerFileEntry) => {
      if (!client || entry.kind !== 'file') return Promise.reject(new Error('File is unavailable.'));
      return client.files.getFile(entry.path.slice(0, -1), entry.name);
    },
    [client],
  );

  return {
    tree,
    currentSpace,
    currentPath: normalizedPath,
    entries,
    selectedPaths,
    selectedEntries,
    setSelectedPaths,
    loading,
    busy,
    error,
    connected,
    refresh,
    openSpace,
    openDirectory,
    openPath,
    clearError: () => setError(undefined),
    createFolder: (name: string) =>
      client ? runOperation(() => client.files.createFolder(normalizedPath, name)) : false,
    upload: (name: string, data: Uint8Array) =>
      client ? runOperation(() => client.files.setFile(normalizedPath, name, data)) : false,
    rename: (oldName: string, newName: string) =>
      client ? runOperation(() => client.files.rename(normalizedPath, oldName, newName)) : false,
    remove: (names: readonly string[], recursive: boolean) =>
      client ? runOperation(() => client.files.delete(normalizedPath, names, recursive)) : false,
    copy: (destinationPath: readonly string[], names: readonly string[]) =>
      client && canTransferFiles(names)
        ? runOperation(() => client.files.copy(normalizedPath, destinationPath, names))
        : false,
    move: (destinationPath: readonly string[], names: readonly string[]) =>
      client && canTransferFiles(names)
        ? runOperation(() => client.files.move(normalizedPath, destinationPath, names))
        : false,
    readFile,
  };
}