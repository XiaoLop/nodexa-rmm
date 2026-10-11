import type { MeshCentralClient } from '@meshcentral/control-client';
import {
  FileOperationError,
  FilesSession,
  RELAY_PROTOCOLS,
  RelayClient,
  browserFileSource,
  joinFilePath,
  type DirectoryListing,
  type FileDialogMessage,
  type FileDownloadProgress,
  type FileEntry,
  type FileUploadProgress,
  type RelaySession,
} from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import { useEffect, useRef, useState } from 'react';
import { MESH_CENTRAL_RELAY_URL } from '../../../config/gateway';
import {
  batchUploadBandwidthConfig,
  calculateBatchUploadChunkSize,
} from '../../../features/batch-upload/bandwidth';
import {
  getDirectoryHierarchy,
  resolveTargetFilePath,
} from '../../../features/batch-upload/fileSystem';
import type { BatchUploadFileItem } from '../../../features/batch-upload/types';
import { createBrowserDownload } from '../../../features/files/createBrowserDownload';
import { retainExistingSelection } from './fileViewModel';

export type FileWorkspaceStatus =
  'connecting' | 'ready' | 'busy' | 'error' | 'disconnected' | 'offline' | 'forbidden';

export interface FileTransferView {
  kind: 'upload' | 'download';
  name: string;
  transferredBytes: number;
  totalBytes?: number;
  percentage?: number;
}

export interface FileArchiveProgress {
  type: FileDialogMessage['type'];
  file?: string;
  progress?: number;
}

export interface FileSessionError {
  code: string;
  raw?: string;
}

interface UseDeviceFilesSessionOptions {
  device: Device;
  meshCentralClient?: MeshCentralClient;
  controlConnected: boolean;
  filesAllowed?: boolean;
}

export function useDeviceFilesSession({
  device,
  meshCentralClient,
  controlConnected,
  filesAllowed,
}: UseDeviceFilesSessionOptions) {
  const [status, setStatus] = useState<FileWorkspaceStatus>('connecting');
  const [listing, setListing] = useState<DirectoryListing>();
  const [error, setError] = useState<FileSessionError>();
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<FileTransferView>();
  const [archiveProgress, setArchiveProgress] = useState<FileArchiveProgress>();
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const relayRef = useRef<RelaySession | undefined>(undefined);
  const filesRef = useRef<FilesSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const lifecycleRef = useRef(0);
  const listingRef = useRef<DirectoryListing | undefined>(undefined);
  const refreshRunningRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  listingRef.current = listing;

  const disconnect = () => {
    lifecycleRef.current += 1;
    abortRef.current?.abort();
    filesRef.current?.dispose();
    relayRef.current?.cancel('File workspace closed.');
    abortRef.current = undefined;
    filesRef.current = undefined;
    relayRef.current = undefined;
    refreshRunningRef.current = false;
    refreshQueuedRef.current = false;
  };

  const setOperationError = (operationError: unknown, fallback: string) => {
    if (operationError instanceof FileOperationError && operationError.code === 'cancelled') return;
    setError({
      code: operationError instanceof FileOperationError ? operationError.code : fallback,
      raw: operationError instanceof Error ? operationError.message : undefined,
    });
  };

  const readDirectory = async (path: string, preserveSelection = false) => {
    const files = filesRef.current;
    if (!files) throw new FileOperationError('File relay is not connected.', 'connection-lost');
    const lifecycle = lifecycleRef.current;
    setError(undefined);
    setStatus('busy');
    try {
      const nextListing = await files.listDirectory(path, { timeoutMs: 20_000 });
      if (lifecycleRef.current !== lifecycle) return;
      setListing(nextListing);
      setSelectedPaths((current) =>
        preserveSelection ? retainExistingSelection(current, nextListing.entries) : [],
      );
      setStatus('ready');
    } catch (directoryError) {
      if (lifecycleRef.current !== lifecycle) return;
      setOperationError(directoryError, 'read-directory');
      setStatus('error');
      throw directoryError;
    }
  };

  const refresh = async () => {
    const path = listingRef.current?.path ?? '';
    if (refreshRunningRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    refreshRunningRef.current = true;
    try {
      do {
        refreshQueuedRef.current = false;
        await readDirectory(path, true);
      } while (refreshQueuedRef.current);
    } finally {
      refreshRunningRef.current = false;
    }
  };

  useEffect(() => {
    disconnect();
    setListing(undefined);
    setSelectedPaths([]);
    setActiveTransfer(undefined);
    setArchiveProgress(undefined);
    setError(undefined);

    if (filesAllowed === false) {
      setStatus('forbidden');
      return;
    }
    if (!device.online) {
      setStatus('offline');
      return;
    }
    if (!controlConnected || !meshCentralClient || !MESH_CENTRAL_RELAY_URL) {
      setStatus('disconnected');
      return;
    }

    const lifecycle = ++lifecycleRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('connecting');

    void (async () => {
      try {
        const relay = await new RelayClient({
          baseUrl: MESH_CENTRAL_RELAY_URL,
          control: meshCentralClient,
        }).createSession({
          deviceId: device.id,
          protocol: RELAY_PROTOCOLS.files,
          signal: controller.signal,
        });
        if (controller.signal.aborted || lifecycleRef.current !== lifecycle) {
          relay.cancel('File workspace is no longer active.');
          return;
        }
        relayRef.current = relay;
        relay.onError((relayError) => {
          if (lifecycleRef.current !== lifecycle) return;
          setOperationError(relayError, 'connection-lost');
          setStatus('disconnected');
        });
        relay.onClose(() => {
          if (lifecycleRef.current !== lifecycle) return;
          setStatus('disconnected');
          setActiveTransfer(undefined);
          setArchiveProgress(undefined);
        });
        const files = new FilesSession(relay);
        filesRef.current = files;
        files.onDialogMessage((message) => {
          if (lifecycleRef.current !== lifecycle) return;
          setArchiveProgress(
            message.type === 'closed'
              ? undefined
              : { type: message.type, file: message.file, progress: message.progress },
          );
        });
        files.onRefreshRequested(() => {
          if (lifecycleRef.current === lifecycle) void refresh().catch(() => undefined);
        });
        await readDirectory('');
      } catch (connectionError) {
        if (controller.signal.aborted || lifecycleRef.current !== lifecycle) return;
        setOperationError(connectionError, 'connection-lost');
        setStatus('error');
      }
    })();

    return disconnect;
  }, [device.id, device.online, filesAllowed, meshCentralClient, controlConnected, reconnectVersion]);

  const selectedEntries = (listing?.entries ?? []).filter((entry) =>
    selectedPaths.includes(entry.path),
  );

  const runWriteAndRefresh = async (send: (files: FilesSession) => void) => {
    const files = filesRef.current;
    if (!files || !listingRef.current) return;
    setError(undefined);
    try {
      send(files);
      await refresh();
    } catch (operationError) {
      setOperationError(operationError, 'operation');
    }
  };

  const createDirectory = (name: string) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) => files.createDirectory(joinFilePath(current.path, name)));
  };

  const removeSelected = () => {
    const current = listingRef.current;
    if (!current || selectedEntries.length === 0) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.removeEntries(
        current.path,
        selectedEntries.map((entry) => entry.name),
        { recursive: selectedEntries.some((entry) => entry.kind !== 'file') },
      ),
    );
  };

  const removeEntry = (entry: FileEntry) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.removeEntries(
        current.path,
        [entry.name],
        { recursive: entry.kind !== 'file' },
      ),
    );
  };

  const renameSelected = (name: string) => {
    const current = listingRef.current;
    const entry = selectedEntries[0];
    if (!current || !entry || selectedEntries.length !== 1) return Promise.resolve();
    return runWriteAndRefresh((files) => files.renameEntry(current.path, entry.name, name));
  };

  const copySelected = (destination: string) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.copyFiles(
        current.path,
        destination,
        selectedEntries.map((entry) => entry.name),
      ),
    );
  };

  const moveSelected = (destination: string) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.moveFiles(
        current.path,
        destination,
        selectedEntries.map((entry) => entry.name),
      ),
    );
  };

  const uploadFiles = async (
    items: BatchUploadFileItem[],
    targetDirectory: string,
    options?: { overwritePolicy?: 'skip' | 'overwrite' },
  ) => {
    const files = filesRef.current;
    if (!files || items.length === 0) return;
    const lifecycle = lifecycleRef.current;
    setError(undefined);
    setStatus('busy');
    const overwritePolicy = options?.overwritePolicy ?? 'overwrite';
    const totalBatchBytes = items.reduce((acc, item) => acc + item.file.size, 0);
    let overallTransferredBytes = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        if (lifecycleRef.current !== lifecycle) break;
        const item = items[i];
        if (!item) continue;
        const { targetDirectory: resolvedTargetDir, targetFileName } = resolveTargetFilePath(
          targetDirectory,
          item.relativePath,
          device.platform,
        );

        // 递归预创建各级父目录
        try {
          const hierarchy = getDirectoryHierarchy(resolvedTargetDir, device.platform);
          for (const dir of hierarchy) {
            files.createDirectory(dir);
          }
        } catch {
          // 忽略已存在或同步异常
        }

        // 如果配置为 skip，检查是否存在同名文件
        if (overwritePolicy === 'skip') {
          try {
            const listing = await files.listDirectory(resolvedTargetDir, { timeoutMs: 15_000 });
            const exists = listing.entries.some(
              (entry) => entry.kind === 'file' && entry.name === targetFileName,
            );
            if (exists) {
              overallTransferredBytes += item.file.size;
              continue;
            }
          } catch {
            // 目录不存在或读取失败，继续尝试上传
          }
        }

        const displayName =
          items.length > 1 ? `(${i + 1}/${items.length}) ${item.relativePath}` : item.relativePath;

        setActiveTransfer({
          kind: 'upload',
          name: displayName,
          transferredBytes: overallTransferredBytes,
          totalBytes: totalBatchBytes,
          percentage:
            totalBatchBytes > 0
              ? Number(((overallTransferredBytes / totalBatchBytes) * 100).toFixed(1))
              : 0,
        });

        await files.uploadFile(resolvedTargetDir, browserFileSource(item.file), {
          name: targetFileName,
          timeoutMs: 60_000,
          chunkSize: calculateBatchUploadChunkSize(batchUploadBandwidthConfig, 1),
          onProgress: (progress: FileUploadProgress) => {
            const currentItemAck = progress.acknowledgedBytes;
            const currentTotalTransferred = overallTransferredBytes + currentItemAck;
            setActiveTransfer({
              kind: 'upload',
              name: displayName,
              transferredBytes: currentTotalTransferred,
              totalBytes: totalBatchBytes,
              percentage:
                totalBatchBytes > 0
                  ? Number(((currentTotalTransferred / totalBatchBytes) * 100).toFixed(1))
                  : 0,
            });
          },
        });

        overallTransferredBytes += item.file.size;
      }

      if (lifecycleRef.current === lifecycle) await refresh();
    } catch (uploadError) {
      if (lifecycleRef.current === lifecycle) setOperationError(uploadError, 'upload');
    } finally {
      if (lifecycleRef.current === lifecycle) {
        setActiveTransfer(undefined);
        setStatus(filesRef.current ? 'ready' : 'disconnected');
      }
    }
  };

  const upload = async (file: File) => {
    const current = listingRef.current;
    if (!current) return;
    await uploadFiles([{ file, relativePath: file.name }], current.path);
  };

  const download = async (entry: FileEntry) => {
    const files = filesRef.current;
    if (!files || entry.kind !== 'file') return;
    try {
      const target = await createBrowserDownload(entry.name);
      if (!target) return;
      const lifecycle = lifecycleRef.current;
      setError(undefined);
      setStatus('busy');
      setActiveTransfer({
        kind: 'download',
        name: entry.name,
        transferredBytes: 0,
        totalBytes: entry.size,
        percentage: entry.size === undefined ? undefined : 0,
      });
      try {
        await files.downloadFile(entry.path, target.sink, {
          timeoutMs: 60_000,
          totalBytes: entry.size,
          onProgress: (progress: FileDownloadProgress) =>
            setActiveTransfer({
              kind: 'download',
              name: entry.name,
              transferredBytes: progress.receivedBytes,
              totalBytes: progress.totalBytes,
              percentage: progress.percentage,
            }),
        });
      } finally {
        if (lifecycleRef.current === lifecycle) {
          setActiveTransfer(undefined);
          setStatus(filesRef.current ? 'ready' : 'disconnected');
        }
      }
    } catch (downloadError) {
      setOperationError(downloadError, 'download');
    }
  };

  const createZip = (outputName: string) => {
    const files = filesRef.current;
    const current = listingRef.current;
    if (!files || !current) return;
    try {
      files.createZip(
        current.path,
        selectedEntries.map((entry) => entry.name),
        outputName,
      );
      setArchiveProgress({ type: 'zipping' });
    } catch (archiveError) {
      setOperationError(archiveError, 'archive');
    }
  };

  const extractZip = (destination: string) => {
    const files = filesRef.current;
    const entry = selectedEntries[0];
    if (!files || !entry) return;
    try {
      files.extractZip(entry.path, destination);
      setArchiveProgress({ type: 'unzipping' });
    } catch (archiveError) {
      setOperationError(archiveError, 'archive');
    }
  };

  return {
    status,
    listing,
    error,
    selectedPaths,
    selectedEntries,
    activeTransfer,
    archiveProgress,
    setSelectedPaths,
    openDirectory: readDirectory,
    refresh,
    createDirectory,
    removeSelected,
    removeEntry,
    renameSelected,
    copySelected,
    moveSelected,
    upload,
    uploadFiles,
    download,
    createZip,
    extractZip,
    cancelTransfer: () => filesRef.current?.cancelActive('File transfer cancelled by user.'),
    reconnect: () => setReconnectVersion((current) => current + 1),
  };
}
